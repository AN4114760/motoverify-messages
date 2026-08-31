# MotoVerify — 訊息模組

從 `motoverify-prototype.html` 抽出來的訊息功能,改寫成會真正運作的獨立專案。

原型裡的訊息是假的:`conversations` 寫死在 JS 陣列,`sendMsg()` 用 `setTimeout` 假裝對方回覆,重整就全部復原。這個版本換成真的資料庫、真的登入、真的即時推播,視覺沿用原型的 design token,所以搬回主專案時不用重畫。

| | 原型 | 這個版本 |
|---|---|---|
| 資料 | JS 陣列 | Postgres |
| 登入 | 假的 | Supabase Auth |
| 送訊息 | setTimeout 自動回 | 寫進資料庫,對方裝置即時收到 |
| 未讀數 | 寫死的數字 | 由 `last_read_at` 算出來 |
| 權限 | 無 | Row Level Security |

---

## 沒設定也能跑

如果沒有填 Supabase 環境變數,程式會自動切到**展示模式** — 用記憶體裡的假資料跑,畫面完全一樣,只是重整會重置。

這是刻意的:你可以先把網站丟上 Vercel 拿到網址給人看,之後再回頭補環境變數切成真實模式,不用改任何程式碼。

---

## 一、本機跑起來

```bash
npm install
npm run dev
```

打開 http://localhost:5173,現在是展示模式,隨便填一組信箱密碼就能進去。

## 二、建 Supabase 專案

1. 到 [supabase.com](https://supabase.com) 開一個新專案,地區選 **Southeast Asia (Singapore)**,離台灣最近。
2. 左側 **SQL Editor** → New query → 把 `supabase/schema.sql` 整份貼進去 → Run。
   會建好四張表、RLS policy、未讀數的 view、開對話的 RPC,並開啟 Realtime。整份可以重複執行,改壞了再貼一次就好。
3. 左側 **Authentication → Sign In / Providers → Email**,測試階段把 **Confirm email** 關掉,註冊完直接就能用,省去每次收信。正式上線前記得打開。
4. 左側 **Project Settings → API**,複製 `Project URL` 和 `anon public` key。

## 三、接上

```bash
cp .env.example .env
```

把剛剛那兩個值填進 `.env`,重新 `npm run dev`。上方的黃色展示模式提示消失,就代表接上真的後端了。

> `anon key` 被打包進前端是設計上就允許的,資料靠 RLS 保護。
> **`service_role` key 絕對不能進這個專案**,那把鑰匙會繞過所有 RLS。`.gitignore` 已經擋掉 `.env`。

## 四、推上 GitHub

```bash
git init
git add .
git commit -m "訊息模組:從原型抽出獨立開發"
git branch -M main
git remote add origin https://github.com/<你的帳號>/motoverify-messages.git
git push -u origin main
```

repo 設 private 沒問題,Vercel 讀得到。

## 五、部署到 Vercel

1. [vercel.com](https://vercel.com) 用 GitHub 帳號登入 → **Add New → Project** → 選這個 repo。
2. Framework 會自動判斷成 Vite,建置指令不用改。
3. 展開 **Environment Variables**,加兩筆:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Deploy。大約一分鐘後拿到 `xxx.vercel.app` 的網址。

之後每次 `git push` 都會自動重新部署。開 PR 的話 Vercel 會另外給一個預覽網址,不會動到正式版。

> 環境變數是在**建置時**打包進去的。之後改了環境變數,要到 Deployments 頁面 Redeploy 才會生效。

## 六、怎麼測

1. 用瀏覽器一般視窗註冊帳號 A。
2. 開無痕視窗,連同一個網址,註冊帳號 B。
3. 任一邊點右上角 **+**,選對方,開始對話。
4. 兩個視窗並排,在 A 打字送出 — B 那邊不用重整就會跳出來,列表的未讀角標也會即時變。

手機也直接連那個網址,版面已經處理過小螢幕。

---

## 檔案結構

```
supabase/schema.sql          資料表、RLS、view、RPC — 全部後端邏輯都在這
src/lib/types.ts             Backend 介面定義
src/lib/supabaseBackend.ts   真實實作
src/lib/demoBackend.ts       展示模式的記憶體實作
src/lib/backend.ts           依環境變數二選一
src/components/AuthScreen    登入註冊
src/components/InboxScreen   對話列表、篩選、開新對話
src/components/ChatScreen    對話框、即時訂閱、樂觀更新
src/styles.css               從原型抽出的樣式,token 未改動
```

把後端包成 `Backend` 介面是為了讓元件不直接碰 Supabase。將來要搬到 React Native,元件幾乎能原封不動搬過去,只換一個實作檔。

## 幾個實作上的取捨

**未讀數不存欄位,用算的。** `conversation_overview` 這個 view 比對 `last_read_at` 和訊息時間即時算出來,不會有計數對不上的問題。等到對話量大到查詢變慢,再改成 counter 加 trigger。

**RLS policy 用 `is_participant()` 函式包起來。** policy 裡直接查 `conversation_participants` 會觸發 RLS 遞迴錯誤,包成 `SECURITY DEFINER` 函式繞過。這是 Supabase 上很常踩的坑。

**送出訊息用樂觀更新。** 點送出的當下泡泡就出現(半透明),伺服器回來後換成真的那筆;失敗就變紅並標示「沒送出去」。

**時間一律用 server timestamp。** `created_at` 由資料庫給,不吃前端的時間,使用者改系統時間也不會亂掉。

## 還沒做的

搬回主專案前需要補的:訊息分頁(目前一次撈 200 則)、圖片訊息、封鎖與檢舉、推播通知、送出頻率限制、對方正在輸入的提示。
