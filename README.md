# 家戶繳費單

家人在 LINE **家戶群組**裡查看、新增、編輯繳費單；到期前 7 天、3 天、當天各提醒一次，打到該戶群組。

同一支官方帳號（狗狗管家）可以接入多個家戶群組。規劃見 [docs/implementation-plan.md](docs/implementation-plan.md)，多家戶見 [docs/multi-household.md](docs/multi-household.md)。

## 本機先跑起來（瀏覽器、假登入）

1. 建立 [Supabase](https://supabase.com) 專案。
2. 在 SQL Editor 依序執行：
   - `supabase/migrations/20260817120000_init.sql`
   - `supabase/migrations/20260817140000_bill_payment_url.sql`
   - `supabase/migrations/20260817153000_household_accounts.sql`
   - `supabase/migrations/20260819100000_multi_household.sql`
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

已上線的資料庫請補跑 `20260819100000_multi_household.sql`（刪除一人一戶的 unique、加上解綁欄位）。

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
   - Size：Full（相機掃 QR 需要 Full；Tall 無法掃碼）
   - Scope：勾選 `openid`、`profile`
   - 開啟 **Scan QR**
3. 後台允許官方帳號加入群組，並把帳號拉進家戶群組。
4. Webhook URL：`https://your-app.zeabur.app/api/line/webhook`，開啟 webhook。
5. **不要**把圖文選單接到帳單列表／新增。1:1 只做客服導引。
6. 把 Zeabur 環境變數補齊，確認沒有開 mock 登入。
7. 在家戶群組打 **「呼叫狗狗」** 開通該戶（現有「家裡」資料會成為第一戶）。之後同一句會回列表／新增選單。從選單或提醒 Flex 打開 LIFF 的人會自動成為該戶成員。

加好友會寫入 `line_follows`，並在 1:1 回覆請到群組使用。提醒是 push 到該戶綁定的群組。
