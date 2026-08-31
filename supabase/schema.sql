-- MotoVerify 訊息模組 — Supabase schema
-- 直接整份貼進 Supabase Dashboard → SQL Editor → Run
-- 可重複執行(idempotent)

-- ---------------------------------------------------------------
-- 1. 資料表
-- ---------------------------------------------------------------

create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '騎士',
  created_at   timestamptz not null default now()
);

create table if not exists public.conversations (
  id         uuid primary key default gen_random_uuid(),
  tag        text not null default '一般' check (tag in ('一般','交易中','買家詢問','系統')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.conversation_participants (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  last_read_at    timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create table if not exists public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id       uuid not null references auth.users(id) on delete cascade,
  content         text not null check (char_length(content) between 1 and 2000),
  created_at      timestamptz not null default now()
);

create index if not exists messages_convo_time_idx
  on public.messages (conversation_id, created_at desc);
create index if not exists participants_user_idx
  on public.conversation_participants (user_id);

-- ---------------------------------------------------------------
-- 2. 新使用者自動建 profile
-- ---------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------
-- 3. 新訊息時更新對話排序時間
-- ---------------------------------------------------------------

create or replace function public.touch_conversation()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.conversations
     set updated_at = new.created_at
   where id = new.conversation_id;
  return null;
end $$;

drop trigger if exists on_message_sent on public.messages;
create trigger on_message_sent
  after insert on public.messages
  for each row execute function public.touch_conversation();

-- ---------------------------------------------------------------
-- 4. 權限判斷函式
--    SECURITY DEFINER 是關鍵:policy 內若直接查 conversation_participants
--    會觸發 RLS 遞迴錯誤,包成函式繞過。
-- ---------------------------------------------------------------

create or replace function public.is_participant(cid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.conversation_participants
     where conversation_id = cid and user_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------
-- 5. RLS
-- ---------------------------------------------------------------

alter table public.profiles                  enable row level security;
alter table public.conversations             enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages                  enable row level security;

drop policy if exists profiles_read   on public.profiles;
drop policy if exists profiles_update on public.profiles;
create policy profiles_read   on public.profiles for select to authenticated using (true);
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists convo_read on public.conversations;
create policy convo_read on public.conversations for select to authenticated
  using (public.is_participant(id));

drop policy if exists part_read on public.conversation_participants;
drop policy if exists part_update_self on public.conversation_participants;
create policy part_read on public.conversation_participants for select to authenticated
  using (user_id = auth.uid() or public.is_participant(conversation_id));
create policy part_update_self on public.conversation_participants for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists msg_read on public.messages;
drop policy if exists msg_send on public.messages;
create policy msg_read on public.messages for select to authenticated
  using (public.is_participant(conversation_id));
-- 兩個條件缺一不可:只能以自己身分發言,且只能發到自己參與的對話
create policy msg_send on public.messages for insert to authenticated
  with check (sender_id = auth.uid() and public.is_participant(conversation_id));

-- ---------------------------------------------------------------
-- 6. 清單用的 view(對方名稱、最後一則、未讀數一次撈完)
-- ---------------------------------------------------------------

drop view if exists public.conversation_overview;
create view public.conversation_overview with (security_invoker = on) as
select
  c.id,
  c.tag,
  c.updated_at,
  p.user_id,
  p.last_read_at,
  (select p2.user_id from public.conversation_participants p2
     where p2.conversation_id = c.id and p2.user_id <> p.user_id limit 1) as peer_id,
  (select pr.display_name from public.conversation_participants p2
     join public.profiles pr on pr.id = p2.user_id
    where p2.conversation_id = c.id and p2.user_id <> p.user_id limit 1) as peer_name,
  (select m.content from public.messages m
    where m.conversation_id = c.id order by m.created_at desc limit 1) as last_message,
  (select count(*) from public.messages m
    where m.conversation_id = c.id
      and m.sender_id <> p.user_id
      and m.created_at > p.last_read_at) as unread_count
from public.conversations c
join public.conversation_participants p on p.conversation_id = c.id;

-- ---------------------------------------------------------------
-- 7. 開啟對話(已存在就沿用,不會重複建)
-- ---------------------------------------------------------------

create or replace function public.start_conversation(peer uuid, tag text default '一般')
returns uuid language plpgsql security definer set search_path = public as $$
declare cid uuid; me uuid := auth.uid();
begin
  if me is null then raise exception '需要登入'; end if;
  if peer = me then raise exception '不能和自己開對話'; end if;

  select p1.conversation_id into cid
    from public.conversation_participants p1
    join public.conversation_participants p2 on p2.conversation_id = p1.conversation_id
   where p1.user_id = me and p2.user_id = peer
   limit 1;

  if cid is not null then return cid; end if;

  insert into public.conversations (tag) values (tag) returning id into cid;
  insert into public.conversation_participants (conversation_id, user_id)
  values (cid, me), (cid, peer);
  return cid;
end $$;

-- ---------------------------------------------------------------
-- 8. 開啟 Realtime 推播
-- ---------------------------------------------------------------

do $$
begin
  alter publication supabase_realtime add table public.messages;
exception when duplicate_object then null;
end $$;
