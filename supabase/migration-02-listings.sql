-- MotoVerify 訊息模組 — migration 02
-- 目的:讓對話從真實情境長出來,不再是「列出全站使用者隨便點」
--
-- 這份是接在 schema.sql 之後跑的。整份可重複執行。
-- Supabase Dashboard → SQL Editor → New query → 貼上 → Run

-- ---------------------------------------------------------------
-- 1. 使用者代碼(像 LINE ID,可以給別人加你,但不外洩信箱)
-- ---------------------------------------------------------------

alter table public.profiles
  add column if not exists user_code text;

create or replace function public.gen_user_code()
returns text language sql volatile as $$
  -- 去掉容易看錯的 0/O/1/I
  select string_agg(substr('23456789ABCDEFGHJKLMNPQRSTUVWXYZ',
                           (floor(random()*32)+1)::int, 1), '')
    from generate_series(1,6);
$$;

update public.profiles set user_code = public.gen_user_code() where user_code is null;

alter table public.profiles alter column user_code set not null;
alter table public.profiles alter column user_code set default public.gen_user_code();

create unique index if not exists profiles_user_code_idx on public.profiles (user_code);

-- 註冊時一併產生代碼
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, user_code)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)),
    public.gen_user_code()
  )
  on conflict (id) do nothing;
  return new;
end $$;

-- ---------------------------------------------------------------
-- 2. 車輛刊登
-- ---------------------------------------------------------------

create table if not exists public.listings (
  id         uuid primary key default gen_random_uuid(),
  -- 指向 profiles 而不是 auth.users,PostgREST 才能一次把賣家名稱撈出來
  seller_id  uuid not null references public.profiles(id) on delete cascade,
  title      text not null check (char_length(title) between 1 and 80),
  price      integer not null check (price >= 0),
  year       integer,
  mileage    integer,
  location   text not null default '台北市',
  accent     text not null default '#3360E4',
  created_at timestamptz not null default now()
);

create index if not exists listings_created_idx on public.listings (created_at desc);

alter table public.listings enable row level security;

drop policy if exists listings_read   on public.listings;
drop policy if exists listings_insert on public.listings;
drop policy if exists listings_delete on public.listings;

-- 市場是公開的,登入者都看得到
create policy listings_read on public.listings for select to authenticated using (true);
create policy listings_insert on public.listings for insert to authenticated
  with check (seller_id = auth.uid());
create policy listings_delete on public.listings for delete to authenticated
  using (seller_id = auth.uid());

-- ---------------------------------------------------------------
-- 3. 對話綁定刊登
-- ---------------------------------------------------------------

alter table public.conversations
  add column if not exists listing_id uuid references public.listings(id) on delete set null;

-- ---------------------------------------------------------------
-- 4. 收緊 profiles 的讀取權限
--    原本是 using (true) — 任何登入者都能撈全站名單,上線前必須改掉
-- ---------------------------------------------------------------

create or replace function public.shares_conversation(other uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1
      from public.conversation_participants a
      join public.conversation_participants b on b.conversation_id = a.conversation_id
     where a.user_id = auth.uid() and b.user_id = other
  );
$$;

create or replace function public.is_seller(uid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.listings where seller_id = uid);
$$;

drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated
using (
  id = auth.uid()                    -- 自己
  or public.shares_conversation(id)  -- 有共同對話的人
  or public.is_seller(id)            -- 有刊登在架上的賣家(要顯示賣家名稱)
);

-- ---------------------------------------------------------------
-- 5. 建立對話的兩種入口
-- ---------------------------------------------------------------

-- 舊的全站任選版本,移除
drop function if exists public.start_conversation(uuid, text);

-- (a) 從車輛刊登聯絡賣家
create or replace function public.start_conversation_from_listing(listing uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare cid uuid; me uuid := auth.uid(); seller uuid;
begin
  if me is null then raise exception '需要登入'; end if;

  select seller_id into seller from public.listings where id = listing;
  if seller is null then raise exception '找不到這則刊登'; end if;
  if seller = me then raise exception '這是你自己的刊登'; end if;

  -- 同一則刊登、同一組買賣雙方,只會有一個對話
  select c.id into cid
    from public.conversations c
    join public.conversation_participants p1 on p1.conversation_id = c.id and p1.user_id = me
    join public.conversation_participants p2 on p2.conversation_id = c.id and p2.user_id = seller
   where c.listing_id = listing
   limit 1;
  if cid is not null then return cid; end if;

  insert into public.conversations (tag, listing_id) values ('買家詢問', listing) returning id into cid;
  insert into public.conversation_participants (conversation_id, user_id) values (cid, me), (cid, seller);
  return cid;
end $$;

-- (b) 用使用者代碼或信箱直接聯絡
create or replace function public.start_conversation_by_handle(handle text)
returns uuid language plpgsql security definer set search_path = public as $$
declare cid uuid; me uuid := auth.uid(); target uuid; h text := btrim(handle);
begin
  if me is null then raise exception '需要登入'; end if;
  if h = '' then raise exception '請輸入代碼或信箱'; end if;

  if position('@' in h) > 0 then
    select id into target from auth.users where lower(email) = lower(h);
  else
    select id into target from public.profiles where upper(user_code) = upper(h);
  end if;

  if target is null then raise exception '找不到這個使用者'; end if;
  if target = me then raise exception '不能和自己開對話'; end if;

  select p1.conversation_id into cid
    from public.conversation_participants p1
    join public.conversation_participants p2 on p2.conversation_id = p1.conversation_id
    join public.conversations c on c.id = p1.conversation_id
   where p1.user_id = me and p2.user_id = target and c.listing_id is null
   limit 1;
  if cid is not null then return cid; end if;

  insert into public.conversations (tag) values ('一般') returning id into cid;
  insert into public.conversation_participants (conversation_id, user_id) values (cid, me), (cid, target);
  return cid;
end $$;

-- ---------------------------------------------------------------
-- 6. 列表 view 加上刊登資訊
-- ---------------------------------------------------------------

drop view if exists public.conversation_overview;
create view public.conversation_overview with (security_invoker = on) as
select
  c.id,
  c.tag,
  c.updated_at,
  c.listing_id,
  (select l.title from public.listings l where l.id = c.listing_id) as listing_title,
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
-- 7. 測試用:把六筆示範刊登平均分給目前已註冊的帳號
--    等組員都註冊完再跑一次,每個人手上就都會有車可以被聯絡。
--    重跑會先清掉舊的示範資料,不影響大家自己刊登的車。
-- ---------------------------------------------------------------

create or replace function public.seed_demo_listings()
returns integer language plpgsql security definer set search_path = public as $$
declare
  users uuid[];
  n integer;
  i integer := 0;
  demo jsonb := '[
    {"t":"2020 山葉 勁戰六代","p":78000,"y":2020,"m":12400,"loc":"台北市 中正區","c":"#3360E4"},
    {"t":"2019 光陽 雷霆S 125","p":52000,"y":2019,"m":23800,"loc":"新北市 板橋區","c":"#1FA463"},
    {"t":"2022 Gogoro VIVA MIX","p":61000,"y":2022,"m":8100,"loc":"台北市 大安區","c":"#E8912C"},
    {"t":"2018 三陽 DRG 158","p":66000,"y":2018,"m":31500,"loc":"桃園市 中壢區","c":"#E5484D"},
    {"t":"2021 SYM 迪爵 125","p":43000,"y":2021,"m":15200,"loc":"台中市 西屯區","c":"#7A5AF0"},
    {"t":"2017 山葉 BWS 125","p":38000,"y":2017,"m":42000,"loc":"高雄市 左營區","c":"#2AA8B0"}
  ]'::jsonb;
  item jsonb;
begin
  select array_agg(id order by created_at) into users from public.profiles;
  n := coalesce(array_length(users, 1), 0);
  if n = 0 then raise exception '還沒有任何註冊帳號'; end if;

  delete from public.listings where title in (select jsonb_array_elements(demo)->>'t');

  for item in select * from jsonb_array_elements(demo) loop
    insert into public.listings (seller_id, title, price, year, mileage, location, accent)
    values (
      users[(i % n) + 1],
      item->>'t',
      (item->>'p')::int,
      (item->>'y')::int,
      (item->>'m')::int,
      item->>'loc',
      item->>'c'
    );
    i := i + 1;
  end loop;

  return i;
end $$;
