# 多家戶實作

> 狀態：已依此文件實作（2026-08-19）
> 前提：第一版單戶已上線，見 [implementation-plan.md](./implementation-plan.md)
> 產品名：狗狗管家。同一支 LINE 官方帳號，服務多個家戶群組。

## 1. 目標

一支 OA、一個 LIFF、一個 webhook，接入不同家戶群組。每群一戶，資料用 `household_id` 隔離。同一人可以出現在多戶（人在哪個群，就是哪一戶）。

成功標準：

1. 現有「家裡」的帳單與成員仍是第一戶，不會因開通邏輯再建一筆空戶。
2. 把管家拉進第二個群，群裡第一次打「呼叫狗狗」後，成為獨立的第二戶。
3. 提醒只打到該戶已綁定的群；從該群 Flex 打開 LIFF，只看得到該戶資料。

## 2. 已決定

| 項目 | 決定 |
| --- | --- |
| OA | 維持同一支 Messaging API channel |
| 產品入口 | 只在**群組**。記帳單、開 LIFF、開通家戶都在群裡 |
| 1:1 | 客服與導引，不當帳單入口 |
| 圖文選單 | 拿掉（或不再當產品入口） |
| 進群 `join` | 只打招呼，**不建戶、不寫** `line_group_id` |
| 開通 | 該群第一次「呼叫狗狗」 |
| 現有資料 | seed／已在用的「家裡」= 第一個已開通家戶 |
| 入籍 | 在已開通的群呼叫或從該群開 LIFF，寫入 `household_members` |
| 手貼 SQL 白名單 | 退場。表留下，改由程式 upsert |
| `groupId` | 一般使用者不必知道。開通靠 webhook；LIFF 用 `householdId` |
| 離群 | 解綁群，**不刪**家戶與帳單 |
| 訂閱 | 以後掛在家戶上，這版不做 |
| 後台管理員開通 | 以後可把「建戶」從指令改成後台；這版用指令 |

## 3. 刻意不做（這版）

- 1:1 家戶切換器、`X-Household-Id`、沒線索時的 409 選戶
- 進群立刻建戶
- 用 LINE「查群成員」API 二次驗證（簡單做法即可）
- 支援未命名多人聊天室（`room` / `roomId`）；只做 `group`
- 家戶合併、改綁到新群、成員角色（管理員 vs 一般）
- 訂閱／trial／付費閘道
- 對話式填單

## 4. 兩個角色，不要混

| 場景 | 放哪 | 行為 |
| --- | --- | --- |
| 開通家戶、叫出選單 | 家戶群組 | 打「呼叫狗狗」 |
| 到期提醒、點進去改 | 家戶群組 | 提醒 Flex 按鈕開 LIFF |
| 平常主動登錄 | 家戶群組 | 同一句指令的 Flex（列表／新增） |
| 加好友、不會用、投訴 | 官方帳號 1:1 | 說明請到群組呼叫狗狗；不當開通 |

群組沒有圖文選單。不要把假選單反覆 push 進群。入口就是：進群歡迎詞一次、指令回 Flex、到期提醒 Flex。可請家人把歡迎或選單訊息置頂。

LIFF 必須從群組訊息的 Flex 打開。LINE 自 2023 年起不再把 `groupId` 給 `liff.getContext()`，因此選單與提醒連結自行帶 `?h={householdId}`。沒有這個參數（外部瀏覽器、舊訊息、1:1）→ 拒絕，畫面請回群組打「呼叫狗狗」。

## 5. 指令「呼叫狗狗」

群組裡**整則訊息**相符才算（trim 掉前後空白）。不要用「包含這四個字」——家人群可能說「要不要呼叫狗狗來幫忙」。

建議同時接受：

- `呼叫狗狗`（主口令）
- `呼叫狗狗管家`（帳號全名）
- 正文前有 LINE 群組 @mention 時，去掉 mention 再比（例如 `@狗狗管家 呼叫狗狗`）

1:1 打這句：回「請把管家拉進家戶群，在群裡打『呼叫狗狗』」，**不建戶、不出帳單選單**。

`ping` 只留開發測 webhook，不寫進給家人的說明。

## 6. 開通規則

`join` 與「群裡每一則訊息」都**不要**再跑現在的 `bindGroupId`（它會把群綁到最早那一戶）。開通只發生在群組「呼叫狗狗」。

用事件裡的 `source.groupId` 分岔：

```text
若 已有 household.line_group_id = 這個 groupId
  → 已開通。upsert 說話的人進 household_members，reply 帳單選單。

否則若 存在恰好一戶 line_group_id IS NULL
  → 遷移：把這個 groupId 寫進那一戶（現有「家裡」）。
    upsert 說話的人，reply 帳單選單。
    （只會發生一次；之後「家裡」不再是空綁定。）

否則
  → 新戶：insert households（name 盡量用 LINE group summary 的群名，失敗則「未命名家戶」），
    line_group_id = groupId。
    upsert 說話的人進 household_members，reply 帳單選單。
```

`line_group_id` 維持 unique。同一群的指令重送兩次，走第一條，不會建成兩戶。

說話的人：群組訊息的 `source.userId`。若事件沒有 userId（少見），仍可開通家戶，但這次無法入籍；對方之後從該群開 LIFF 再補成員。

### 6.1 現有「家裡」

Migration 已插入一戶名為「家裡」。帳單、戶號、成員都掛在上面。它就是第一個已開通家戶。

- 若這一戶**已經有** `line_group_id`（舊版進群就綁上了）：在那個群呼叫 → 第一條。到**別的群**第一次呼叫 → 第三條，新建第二戶。
- 若這一戶 `line_group_id` 仍是空的：全世界第一次「呼叫狗狗」會走第二條，把該群綁到現有資料，**不要 insert 新戶**。

## 7. 成員

`household_members` 仍是權限表：不在表裡就不能打該戶帳單 API。退場的是「管理員把 userId 手貼進 SQL」，不是這張表。

入籍時機（已開通的群）：

1. 群裡「呼叫狗狗」（webhook 有 `groupId` + `userId`）→ upsert
2. 從該群 Flex 打開 LIFF → 後端用 ID Token 的 `sub` + `?h=` 的家戶 id 對上家戶 → upsert

權限這版不做角色：入籍者都能看／改該戶帳單與戶號。

人退出 LINE 群：這版**不**自動從 `household_members` 刪除。沒有該群 context 就開不了產品；舊深連結仍應核對「是該戶成員」。之後若要做退群同步，另議。

一人多戶：同一 `line_user_id` 可以有多列（不同 `household_id`）。必須刪掉

```sql
household_members_line_user_id_idx  -- unique (line_user_id)
```

主鍵 `(household_id, line_user_id)` 留下。

## 8. 身分與當前戶

維持：前端送 `Authorization: Bearer {liff.getIDToken()}`，後端向 LINE verify，取 `sub`。

單戶時 `requireMember` 用 `line_user_id` + `maybeSingle()` 推唯一家戶。多家戶會有多列，`maybeSingle()` 會失敗。

這版產品只從群組開，**當前戶 = Flex 連結上的 `householdId`**，不必做 1:1 切換。

建議流程：

1. 驗證 ID Token → `line_user_id`
2. Flex／提醒連結帶 `?h={householdId}`；前端存 `sessionStorage`，請求帶 header `X-Household-Id`
3. 用 id 找 `households`；找不到 → 403，請在群裡先呼叫狗狗開通
4. upsert／確認 `household_members` 後，以該 `household_id` 做 CRUD

不要只信前端傳來的 uuid：必須是真實家戶，再寫入／核對成員。LINE 已不在 LIFF 提供 `groupId`，不要再用 `liff.getContext().groupId`。

`/api/bills/[id]`：帳單已有 `household_id`，仍須確認呼叫者是該戶成員（由 header 的家戶決定範圍）。對不上 → 404。

沒有 `h` 參數（外部瀏覽器、1:1、舊 Flex）：不要列出所有家戶給他選，直接拒絕。請再打一次「呼叫狗狗」。

## 9. Webhook

| 事件 | 行為 |
| --- | --- |
| `join`（OA 進群） | reply 歡迎：請打「呼叫狗狗」開通。不寫資料庫 |
| 群組文字「呼叫狗狗」 | 第 6 節開通／選單 |
| 其他群組訊息 | 忽略。**不要** bind |
| `leave`（OA 被移出／退出） | 該 `line_group_id` 解綁（設 null 或標記 unbound）。不刪 households / bills / members |
| 同一 `groupId` 再次 `join` 後第一次呼叫 | 第一條：綁回舊戶 |
| `follow`（加好友） | 可繼續寫 `line_follows`；建議 1:1 reply 導引去群組。**不加進家戶** |
| 1:1 「呼叫狗狗」 | 導引去群組，不開通 |
| `ping` | 開發用 pong，可限制或不寫進說明 |

解綁後提醒排程不得再 push 到已失效的群（現有 `skippedNoGroup` 在 `line_group_id` 為空時已接近此行為）。

`follow` 不是授權。它只是「誰加過官方帳號」的備註，給客服／對照用。能不能記帳單只看 `household_members`。

## 10. 提醒與 LIFF 深連結

`lib/reminders.ts` 已依帳單的 `household_id` 找該戶 `line_group_id` 再分群 push，多家戶幾乎不用改租戶邊界。確認：

- 未綁群或已解綁 → 略過，不要重試到打光額度
- Flex「查看這筆」「列表」「新增」的 LIFF URL 帶 `?h={householdId}`；點進 App 後以這個家戶為準

額度仍按群內收得到的人數計。家戶變多會線性增加；節點維持到期前 7 / 3 / 0 各一次。

## 11. Schema 與程式要動的地方

資料：

- 刪 `household_members_line_user_id_idx`
- `households.line_group_id` unique 留下
- 不必為訂閱加欄位（以後再加 `status` / period 等）
- 可選：`households` 加 `unbound_at`，解綁時保留「曾經的 groupId」於另欄，避免兩戶都 null 時難回溯。最低限度是把 `line_group_id` 設回 null

程式（對照現況）：

| 位置 | 現況 | 改成 |
| --- | --- | --- |
| `lib/webhook.ts` `bindGroupId` | 永遠綁最早一戶；join 與每則群訊息都跑 | 刪除或改為第 6 節開通，只在「呼叫狗狗」呼叫 |
| `BILLS_MENU_KEYWORD` | `;帳單` | `呼叫狗狗`（加別名與 mention 處理） |
| `requireMember` | `maybeSingle()` 一人一戶 | 用 `X-Household-Id` 找戶 + 確認／upsert 成員 |
| `lib/api.ts` | 只帶 Bearer | 帶 `h` 對應的家戶 header |
| LIFF 前端 | 不讀 `getContext()` | 從 URL `?h=` 讀 householdId；沒有就顯示請回群組 |
| 403 畫面 | 秀 userId 請手貼 SQL | 未開通：請在群裡呼叫狗狗；非成員／錯群：你不是這戶的人 |
| LINE 後台圖文選單 | 規劃接列表／新增 | 拿掉或改成客服說明 |

帳單／戶號 CRUD 已吃 `householdId`，解析當前戶正確後即可隔離。

## 12. 以後可接、這版預留

- **後台開通**：第 6 節第三條改由管理員建立家戶並寫入 `line_group_id`；群裡「呼叫狗狗」只對已開通的群回選單，未開通則回「請待管理員開通」。
- **訂閱**：欄位掛 `households`（或一對一 subscriptions）。驗證放在「已知道哪一戶之後、碰該戶資料之前」，不要擋 webhook、follow、開通指令。未訂閱的戶，提醒不要 push。一人多戶時，A 戶付費、B 戶未付費互不影響。
- **進群要開通確認**：若誤拉變多，可把「第一次呼叫 = 建戶」改成後台核准，指令不變。

## 13. 實作順序

1. Migration：刪 `line_user_id` 全域 unique。確認現有「家裡」那一筆保留。
2. Webhook：`join` 只歡迎；拿掉隨訊息 bind；「呼叫狗狗」實作第 6 節三條分岔 + 入籍；`leave` 解綁；1:1 導引。
3. `requireMember` + LIFF 帶 `householdId`（`?h=`）；沒有參數則拒絕。
4. 403／未開通文案；拿掉手貼 SQL 的說明（README 一併改）。
5. 用第二個測試群走一次：第一次呼叫 → 新戶、資料不與「家裡」串在一起；自己兩個群都能開各自 LIFF。

## 14. 與第一版規劃的差異（摘要）

第一版刻意不做多住戶，進群即綁唯一家戶，主動登錄走 1:1 圖文選單，成員靠 SQL 白名單。

這份改為：群組即產品、第一次呼叫才開通、現有「家裡」當第一戶、成員由指令／LIFF 寫入、1:1 只做客服。資料模型（帳單屬於家戶、提醒按戶推群）第一版就對了，多家戶是補上租戶生命週期，不是重寫 CRUD。
