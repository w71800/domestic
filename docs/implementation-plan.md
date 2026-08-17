# 家戶繳費單小工具 — 實作規劃

> 狀態：第一版已實作（2026-08-17）
> 範圍：列表、新增／編輯、到期提醒。不做圖表。

## 1. 目標

做一個家人共用的繳費單工具，**整份操作體驗固定在 LINE** 裡：

1. 在 LIFF 中查看、新增、編輯繳費單。
2. 到期前提醒打到 **家裡群組**。
3. 兩人（或以上家人）都能新增與修改同一組資料。

成功標準：拿到帳單後能在一分鐘內登錄；到期前家人在群組看得到，點進去就能改繳費日期。

## 2. 刻意不做

- 圖表、年度比較、統計儀表板
- Notion / Google Sheet 當資料源
- Web Push
- 對話式 Bot 問答填單
- LINE Mini App 上架審核
- 多住戶、公開註冊
- 逾期每日催繳
- 把圖文選單接到家裡群組底部（平台不支援）

## 3. 技術棧

| 層 | 選擇 | 說明 |
| --- | --- | --- |
| 介面 | LIFF（Tall 或 Full） | 跑在 LINE WebView 的小網站 |
| 前端 + API | Next.js（App Router）+ TypeScript | 同一專案提供頁面、API、cron |
| 託管 | Zeabur | 常駐 Node 服務；內部每天 09:00（台北）跑提醒 |
| 資料 | Supabase（Postgres） | 家戶共用、到期查詢 |
| 推播 | LINE Messaging API | push 到群組 `groupId` |
| 官方帳號入口 | 圖文選單（Rich Menu） | 僅 1:1 聊天室 |
| 群組入口 | Flex Message 按鈕 | 提醒訊息上開 LIFF |

## 4. LINE 使用方式

### 4.1 兩個入口，不要混在一起

| 場景 | 放哪 | 怎麼開 LIFF |
| --- | --- | --- |
| 到期被提醒、當下要看／標記 | 家裡群組 | 提醒 Flex 上的按鈕 |
| 平常拿到帳單、主動登錄 | 官方帳號 1:1 | 底部圖文選單熱區 |

**圖文選單（後台「上傳圖片 → 劃熱區」）只會出現在與官方帳號的 1:1 聊天室**，不會出現在群組。群組沒有常駐選單欄。電腦版 LINE 也不顯示圖文選單。

群組裡若要開 LIFF，只能靠「某一則訊息上的連結或按鈕」。不要把 imagemap 當假選單反覆丟進群組。

### 4.2 官方帳號要準備的東西

同一個 Messaging API channel：

- Channel access token（只放伺服器環境變數）
- LIFF App：Endpoint 指向 Zeabur HTTPS 網址；scope 勾 `openid`、`profile`
- 允許官方帳號加入群組
- Webhook：至少處理官方帳號被加入群組（拿到 `groupId`）、以及 `follow`
- 圖文選單兩個熱區：`列表`、`新增`，URI 為 `https://liff.line.me/{liffId}` 與 `https://liff.line.me/{liffId}/new`

### 4.3 家裡群組

- 官方帳號必須是群組成員。
- 第一次進群的 webhook（`join` / 相關群組事件）寫入 `households.line_group_id`。
- 提醒用 Messaging API **push 到該 `groupId`**，不要 multicast 給每個人（此版以群組為準）。
- 家人仍建議加官方帳號為好友，1:1 圖文選單才看得到。

### 4.4 額度

Push / multicast 計入官方帳號月配額（依方案、地區；免費方案額度不大）。Reply 不計費。

計費單位是「送到幾個人」，群組一則 push 會依群內可收到的人數計算。

因此提醒採固定節點：**到期前 7 天、3 天、當天** 各一次，不做到期後每天催。之後若要在聊天室做「已繳」，用 postback + **reply**（免費）。

## 5. 畫面

LIFF 三個畫面即可。

### 5.1 列表 `/`

- 未繳在上、已繳在下（已繳只顯示近期即可，例如 90 天）。
- 每列：類型、金額、繳費期限、計費月份、是否已繳。
- 點一列進入編輯。
- 明顯的「新增」入口（配合圖文選單深連結 `/new`）。

### 5.2 新增 `/new`

欄位：

- 類型：水 / 電 / 瓦斯 / 管理費 / 其他
- 金額（整數 TWD）
- 繳費期限（日期）
- 計費區間起迄（精準到月；UI 用年月，存成該月 1 號）
- 備註（選填）

水電常跨兩個月，區間用起迄，不要只存一個月。

### 5.3 編輯 `/bills/[id]`

同上，加上：

- 繳費日期（可空、可改）
- 主動作「標記今天已繳」（寫入今天，仍可再改日期）

`paid_date = null` 表示未繳，同時作為「還要不要提醒」的開關。

提醒 Flex 深連結：`https://liff.line.me/{liffId}/bills/{id}`。

## 6. 資料模型

帳單屬於家戶，不屬於個人。

```text
households
  id
  name
  line_group_id     -- 家裡群組，提醒推這裡
  created_at

household_members
  household_id
  line_user_id      -- 驗證 ID Token 後的 sub
  display_name
  created_at

bills
  id
  household_id
  type              -- water | electricity | gas | management | other
  amount            -- integer, TWD
  due_date          -- date
  paid_date         -- date | null
  period_start      -- date, 該月 1 號
  period_end        -- date, 該月 1 號
  notes
  updated_by        -- line_user_id
  created_at
  updated_at

reminder_logs
  id
  bill_id
  kind              -- d7 | d3 | d0
  sent_at
```

約束建議：

- `household_members (household_id, line_user_id)` unique
- `reminder_logs (bill_id, kind)` unique，避免同一節點重送
- `period_end >= period_start`
- `amount > 0`

第一版只做 **一個家戶**。成員用白名單：家人各自開啟一次 LIFF 後，把 `line_user_id` 寫進 `household_members`（可先手動 SQL 插入，或第一次開 App 時 upsert 再人工確認）。

不在名單內 → API 拒絕。LIFF 網址外洩也不構成資料存取。

## 7. 身分驗證

前端 **不要** 把 `liff.getProfile()` 的 userId 當憑證。

流程：

1. `liff.init({ liffId })`
2. 需要時 `liff.login()`（外部瀏覽器）
3. 請求 API 時帶 `Authorization: Bearer {liff.getIDToken()}`
4. 後端向 LINE `POST https://api.line.me/oauth2/v2.1/verify` 驗證，取 `sub` 為 `line_user_id`
5. 查 `household_members`；不在名單則 403
6. 以該家戶為範圍做 CRUD（前端不直連 Supabase）

LIFF 設定必須開 `openid`，否則拿不到 ID Token。

從群組按鈕開啟時，`liff.getContext().type` 可能為 `group`，必要時可核對 `groupId` 與 `households.line_group_id`。授權仍以成員表為準。

## 8. 提醒流程

不是輪詢，是每天一次的排程。

- 時間：每天 09:00 `Asia/Taipei`（Zeabur 常駐行程內排程；九點後重啟會補跑一次）
- 查出：`paid_date IS NULL` 且 `due_date` 等於今天、3 天後、或 7 天後
- 對應 `kind`：`d0` / `d3` / `d7`
- 該 `(bill_id, kind)` 已在 `reminder_logs` 則跳過
- 對 `households.line_group_id` 送 Flex
- 成功後寫 `reminder_logs`

Flex 內容最少要有：類型、金額、期限、計費月份、「查看這筆」「列表」兩個 URI。

若該月沒有符合的帳單，不發訊息。

Cron HTTP 路由仍用 `CRON_SECRET` 保護，方便手動補送。正式環境預設由行程內排程觸發，不必再外掛 cron 服務。`line_group_id` 尚未寫入時，工作記錄錯誤並結束，不要重試到把額度打光。

## 9. API 範圍（第一版）

全部需驗證 LINE ID Token，且呼叫者必須是家戶成員。

| 方法 | 路徑 | 用途 |
| --- | --- | --- |
| GET | `/api/bills` | 列表（未繳優先） |
| POST | `/api/bills` | 新增 |
| GET | `/api/bills/[id]` | 單筆 |
| PATCH | `/api/bills/[id]` | 編輯（含繳費日期） |
| POST | `/api/cron/reminders` | 僅 cron |

不提供刪除也可以；若要做，做成軟刪或僅未繳可刪，規劃時預留即可。

Webhook：`POST /api/line/webhook`

- `follow`：可記錄 userId（仍須人工或白名單才能進家戶）
- 官方帳號加入群組：寫入 `line_group_id`（若家戶尚無群組，或與既有值相同）
- 第一版不處理聊天室「已繳」postback

## 10. 專案結構（建議）

```text
app/
  page.tsx                 -- 列表
  new/page.tsx             -- 新增
  bills/[id]/page.tsx      -- 編輯
  api/bills/route.ts
  api/bills/[id]/route.ts
  api/cron/reminders/route.ts  -- 手動補送
  api/line/webhook/route.ts
instrumentation.ts             -- 服務啟動時掛上提醒排程
lib/
  scheduler.ts                 -- 每天 09:00 Asia/Taipei
  line.ts                      -- 驗證 ID Token、push Flex
  supabase.ts              -- 僅伺服器端、service role
  bills.ts                 -- 查詢與提醒條件
  liff.ts                  -- 前端 init
docs/
  implementation-plan.md
```

Supabase schema 用 SQL migration 管理（`supabase/migrations/`）。

## 11. 環境變數

```text
NEXT_PUBLIC_LIFF_ID
LINE_CHANNEL_ID              -- 驗證 ID Token 的 client_id
LINE_CHANNEL_SECRET          -- webhook 簽章
LINE_CHANNEL_ACCESS_TOKEN    -- push
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
CRON_SECRET
```

前端只需要 `NEXT_PUBLIC_LIFF_ID`。Service role 與 LINE token 不可進 client bundle。

## 12. 實作順序

1. **資料**：Supabase 建表、RLS 預設拒絕（API 走 service role + 自行檢查成員）、塞兩筆假資料。
2. **網頁 CRUD**：Next.js 列表／新增／編輯，先用瀏覽器、假登入或暫時略過 LINE，確認欄位與狀態正確。
3. **LINE 驗證**：接上 LIFF init、後端驗證 ID Token、白名單、拿掉假登入。
4. **官方帳號**：圖文選單接到 `/` 與 `/new`；webhook 記錄 `groupId`。
5. **提醒**：行程內每天 09:00 跑 + Flex 深連結到 `/bills/[id]`。
6. **家人試用**：兩人加好友、進群、各開一次 LIFF、走一筆從新增到標記已繳。

前兩步可完全在電腦瀏覽器開發；LIFF 是最後套上的殼。

## 13. 之後可加、第一版不做

- 聊天室 Flex「已繳」postback + reply
- 逾期補一則 `overdue`（仍不要每日催）
- 刪除／作廢
- 依類型篩選
- 把 LIFF 做成 PWA 方便電腦開（圖文選單在 PC 不可見，但可從群組訊息開）

## 14. 已決定的事項

- 資料：Supabase，不用 Notion / Sheet
- 體驗容器：LIFF，不做獨立給家人用的一般網站為主路徑
- 提醒通道：LINE；目的地：家裡群組
- 提醒節點：到期前 7 / 3 / 0 天各一次
- 圖文選單：只放官方帳號 1:1，當主動登錄入口
- 群組：只靠提醒（及必要時的）Flex 按鈕開 LIFF
