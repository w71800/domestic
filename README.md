# 家戶繳費單

家人在 LINE 裡查看、新增、編輯繳費單；到期前 7 天、3 天、當天各提醒一次，打到家裡群組。

規劃細節見 [docs/implementation-plan.md](docs/implementation-plan.md)。

## 本機先跑起來（瀏覽器、假登入）

1. 建立 [Supabase](https://supabase.com) 專案。
2. 在 SQL Editor 依序執行：
   - `supabase/migrations/20260817120000_init.sql`
   - `supabase/seed.sql`
3. 複製環境變數並填入 Supabase 連線資訊：

```bash
cp .env.example .env.local
```

`SUPABASE_URL` 與 `SUPABASE_SERVICE_ROLE_KEY` 在 Project Settings → API。請用 **service role**，不要用 anon key。

4. 啟動：

```bash
npm install
npm run dev
```

開啟 [http://localhost:3000](http://localhost:3000)。本機預設用 `U-dev-local` 這位 seed 成員，不需要 LINE。本機預設**不會**跑到期排程。

## 部署到 Zeabur

Zeabur 會把 Next.js 當常駐 Node 服務跑，因此提醒排程做在行程內：每天 **09:00 Asia/Taipei** 執行；若服務在九點後重啟，會補跑一次（已送過的節點不會重送）。

1. 把專案推上 GitHub，在 [Zeabur](https://zeabur.com) 開專案 → Add Service → Git，匯入這個 repo。
2. 等第一次建置完成後，到 **Networking** 產生 `*.zeabur.app` 網域（LIFF / webhook 需要 HTTPS）。
3. 到 **Variables** 設定環境變數（與 `.env.example` 相同）。正式環境：
   - **不要**設 `NEXT_PUBLIC_DEV_MOCK_AUTH`
   - `NEXT_PUBLIC_LIFF_ID` 必須在建置前就有（會打進前端 bundle），改過後要重新部署
4. 重新部署一次，確認 Logs 有 `[reminders] 下次執行約 … 分鐘後`。

手動補送（可選）：

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://your-app.zeabur.app/api/cron/reminders
```

## 接上 LINE

1. 在 LINE Developers 建立 Messaging API channel，綁定官方帳號。
2. 新增 LIFF App：
   - Endpoint URL：Zeabur 的 HTTPS 網址（例如 `https://your-app.zeabur.app`）
   - Size：Tall 或 Full
   - Scope：勾選 `openid`、`profile`
3. 後台允許官方帳號加入群組，並把帳號拉進家裡群組。
4. Webhook URL：`https://your-app.zeabur.app/api/line/webhook`，開啟 webhook。
5. 圖文選單（只會出現在官方帳號 1:1 聊天室）兩個熱區：
   - 列表 → `https://liff.line.me/{LIFF_ID}`
   - 新增 → `https://liff.line.me/{LIFF_ID}/new`
6. 把 Zeabur 環境變數補齊，確認沒有開 mock 登入。
7. 家人加官方帳號為好友並開啟一次 LIFF。未在白名單會看到自己的 LINE userId，把該 ID 插入 `household_members`：

```sql
insert into household_members (household_id, line_user_id, display_name)
select id, 'Uxxxxxxxx', '家人名字'
from households
where name = '家裡'
limit 1;
```

加好友也會寫入 `line_follows`，可當對照。官方帳號進群後會把 `households.line_group_id` 填上；提醒是 push 到這個群組。
