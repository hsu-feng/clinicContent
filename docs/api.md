# clinicContent API 規格

這份文件列出前端需要的所有 API。資料結構以 `src/lib/clinics.ts` 的 TypeScript 型別為準，
請不要另外發明欄位名稱。

前端已經備好串接層（`src/lib/api.ts`）：**設定 `NEXT_PUBLIC_API_BASE` 後就會改打真的 API**，
沒設定時走內建假資料。後端可以一支一支完成，不必等全部做完才整合。

---

## 項目清單

後端總共要實作 **11 支 API**。每一項都標了對應的前端函式，可以直接對照 `src/lib/` 的串接層。

### 讀取

| 項目 | 端點 | 前端函式 |
|---|---|---|
| 診所列表 | `GET /api/clinics` | `fetchClinics`（clinics.ts） |
| 讀取四個區塊內容 | `GET /api/clinics/{clinicId}/content` | `fetchContent`（clinics.ts） |
| AI 設定 | `GET /api/ai-settings` | `loadAiSettings`（ai-settings.ts，目前讀 localStorage） |

### 寫入

| 項目 | 端點 | 前端函式 |
|---|---|---|
| 登入 | `POST /api/auth/login` | `login`（api.ts） |
| 登出 | `POST /api/auth/logout` | `logout`（api.ts） |
| 儲存內容 | `PUT /api/clinics/{clinicId}/content` | `saveContent`（clinics.ts） |
| 傳送（發布） | `POST /api/clinics/{clinicId}/content/publish` | `publishContent`（clinics.ts） |
| 刪除內容 | `DELETE /api/clinics/{clinicId}/content` | `deleteContent`（clinics.ts） |
| 儲存 AI 設定 | `PUT /api/ai-settings` | `saveAiSettings`（ai-settings.ts，目前寫 localStorage） |
| 圖片上傳 | `POST /api/images` | `uploadImage`（clinics.ts） |
| 圖片刪除 | `DELETE /api/images/{imageId}` | 尚未使用 |

三項容易被漏掉、但缺了會出問題的：

- **儲存內容**：編輯模式右上角的「儲存」。「傳送」發布的是**伺服器上已儲存的版本**，
  所以沒有儲存，整條編輯流程是斷的。
- **圖片上傳**：目前圖片都是 base64 data URL，只活在瀏覽器記憶體，重整就消失；
  而 LINE Flex 訊息要求圖片**必須是 HTTPS 網址**且長度 ≤2000 字元，data URL 一定過不了。
  這是上線的必要條件，不是優化。
- **圖片刪除**：建議一開始就做。iCare 專案的圖片類別只有上傳沒有刪除，
  結果部分流程失敗時會留下沒人引用、也無法清除的孤兒圖片。

### 不納入的範圍

**診所的新增、修改、刪除不在本專案**，由另一套系統維護，這裡只消費 `GET /api/clinics`。
（特別寫出來，是為了避免之後看到「診所只有讀取沒有寫入」時誤以為是漏列。）

### 待決議

`POST /api/generate` 與 `POST /api/generate-image` 目前是**前端專案自己的 Next.js route handler**
（見「六、已經實作的內部 API」），歸屬尚未決定。

這件事和「儲存 AI 設定」有相依關係：**一旦金鑰改由後端保管，這兩支就取不到金鑰**，
屆時必須二選一——

1. 整支搬到後端實作，或
2. 由後端提供取得金鑰的方式（或代理轉發）。

在決定之前，AI 金鑰會持續以明文存在瀏覽器 `localStorage`。

---

## 共通約定

| 項目 | 約定 |
|---|---|
| Base URL | 由 `NEXT_PUBLIC_API_BASE` 決定，例如 `https://api.example.com` |
| 認證 | 除登入外，所有請求帶 `Authorization: Bearer <token>` |
| 請求格式 | `Content-Type: application/json`（圖片上傳除外，用 `multipart/form-data`） |
| 成功 | 2xx，回傳該端點指定的 JSON |
| 失敗 | 非 2xx，回傳 `{ "error": "看得懂的中文訊息" }` |

**錯誤訊息會直接顯示給管理者看**，請寫成中文完整句子，例如「帳號或密碼錯誤」，
不要回 `INVALID_CREDENTIALS` 這類代碼。前端的 `apiFetch` 會把 `error` 取出來丟成 Error，
沒有 `error` 欄位時才退回預設訊息。

常用狀態碼：

| 狀態碼 | 時機 |
|---|---|
| 400 | 參數缺漏或格式錯誤 |
| 401 | 未登入或 token 失效 |
| 403 | 沒有這間診所的權限 |
| 404 | 診所或內容不存在 |
| 500 | 伺服器錯誤 |

---

## 資料結構

```ts
type SectionKey = "info" | "notices" | "services" | "education";

type Clinic = { id: string; name: string; address: string };

type Source = { title: string; uri: string };

// 診療項目的單筆
type ServiceItem = {
  id: string;
  title: string;          // 4–10 字
  body: string;           // 100–300 字
  image: string | null;   // 目前是 data URL，有圖片 API 後改存 HTTPS 網址
  imageError: string | null;
};

// 衛教資訊的單張 LINE 卡片
type EducationAction = { enabled: boolean; label: string; uri: string };

type EducationItem = {
  id: string;
  label: string;            // 標籤文字，2–6 字
  labelColorIndex: number;  // 0–5，對應 LABEL_COLORS 六個固定色
  image: string | null;
  imageError: string | null;
  title: string;            // 4–14 字
  body: string;             // 40–100 字
  actions: EducationAction[]; // 固定兩組
};

type SectionResult = {
  text: string;           // 純文字區塊（info / notices）的內容
  sources: Source[];      // AI 的參考來源
  specialty?: string;     // 科別，services / education 會用到
  items?: ServiceItem[];  // 只有 services
  cards?: EducationItem[];// 只有 education
};

type ClinicContent = Partial<Record<SectionKey, SectionResult>>;
```

**`imageError` 是前端的暫存欄位**（顯示生圖失敗原因），後端收到可以直接忽略、不必儲存。

四個區塊的內容形狀不同：

| 區塊 | 用到的欄位 |
|---|---|
| `info`（診所資訊） | `text`、`sources` |
| `notices`（注意事項） | `text`、`sources` |
| `services`（診療項目） | `specialty`、`items`、`sources`（`text` 為空字串） |
| `education`（衛教資訊） | `specialty`、`cards`、`sources`（`text` 為空字串） |

---

## 一、認證

### `POST /api/auth/login`

| | |
|---|---|
| 權限 | 不需 token |
| 成功 | `200` |

**Request**

```json
{ "account": "clinic001", "password": "使用者輸入的密碼" }
```

**Response**

```json
{ "token": "eyJhbGciOi...", "account": "clinic001" }
```

`token` 之後會放進 `Authorization: Bearer <token>`。前端目前把 `account` 存進 `sessionStorage`
只用來顯示在右上角，不做權限判斷。

**錯誤**

| 狀態碼 | 訊息範例 | 時機 |
|---|---|---|
| 400 | 請輸入帳號和密碼 | 欄位缺漏 |
| 401 | 帳號或密碼錯誤 | 驗證失敗（**不要分別回「查無帳號」與「密碼錯誤」**，避免帳號被列舉） |
| 403 | 這個帳號尚未啟用 | 帳號存在但停用 |

```bash
curl -X POST "$BASE/api/auth/login"   -H "Content-Type: application/json"   -d '{"account":"clinic001","password":"test1234"}'
```

### `POST /api/auth/logout`

| | |
|---|---|
| 權限 | 需 token |
| 成功 | `200` |

無 request body，回傳 `{}`。

**token 已經過期或無效時也請回 `200`**——這支的目的是作廢伺服器端的 session，
前端無論成功與否都會清掉本機狀態、導回登入頁，回錯誤只會造成無意義的紅字。

```bash
curl -X POST "$BASE/api/auth/logout" -H "Authorization: Bearer $TOKEN"
```

---

## 二、診所

### `GET /api/clinics`

| | |
|---|---|
| 權限 | 需 token |
| 成功 | `200` |

回傳這個帳號可管理的診所清單。沒有任何診所時回 `[]`，不要回 404。

```json
[
  { "id": "c001", "name": "博安家庭醫學科診所", "address": "台北市大安區麗水街3號" },
  { "id": "c004", "name": "安曼牙醫診所", "address": "台北市大安區復興南路一段135巷27號8樓之3" }
]
```

- **`id` 必須是後端產生的永久識別碼**，詳見下方「診所 id 的契約」。
- 排序由後端決定，前端照收不再排序。建議依名稱排序。
- 關鍵字搜尋由**前端自己過濾**（`ClinicList.tsx`），這支不需支援查詢參數。
  診所數量成長到需要分頁時再加。

**錯誤**：`401`（未登入或 token 失效）

```bash
curl "$BASE/api/clinics" -H "Authorization: Bearer $TOKEN"
```

#### 診所 id 的契約

`id` 一旦發出就**不可改變**，而且不可以用診所名稱、名稱雜湊、地址或查詢結果的序號來產生。

原因：`id` 是內容儲存的外鍵（`/api/clinics/{clinicId}/content`）。診所改名、搬遷或資料重新匯入後
若 `id` 變了，該診所已儲存的四個區塊就再也讀不回來，而且**不會有任何錯誤訊息**，
畫面只會顯示成從未生成過。

---

## 三、內容

`{clinicId}` 是 `GET /api/clinics` 回傳的 `id`。四個區塊的 key 固定為
`info`、`notices`、`services`、`education`。

### `GET /api/clinics/{clinicId}/content`

| | |
|---|---|
| 權限 | 需 token |
| 成功 | `200` |

回傳已儲存的四個區塊。**還沒有任何內容時回 `{}`，不要回 404。**

```json
{
  "info": {
    "text": "・診所定位與主要照護範圍…",
    "sources": [{ "title": "診所官網", "uri": "https://example.com" }]
  },
  "services": {
    "text": "",
    "sources": [],
    "specialty": "牙科",
    "items": [
      {
        "id": "8f1c…",
        "title": "牙齒美白",
        "body": "…",
        "image": "https://cdn.example.com/clinic/c004/abc123.webp",
        "imageError": null
      }
    ]
  }
}
```

**錯誤**

| 狀態碼 | 時機 |
|---|---|
| 401 | 未登入 |
| 403 | 沒有這間診所的權限 |
| 404 | 診所不存在（**內容不存在不算，要回 `{}`**） |

```bash
curl "$BASE/api/clinics/c004/content" -H "Authorization: Bearer $TOKEN"
```

### `PUT /api/clinics/{clinicId}/content`

| | |
|---|---|
| 權限 | 需 token |
| 成功 | `200`，回傳 `{}` |

**整份覆蓋**。request body 就是完整的 `ClinicContent`。

前端的「儲存」是把整個編輯草稿一次送出，所以採整份覆蓋而非分區塊更新。
若後端偏好分區塊更新（`PUT /content/{section}`），請提出，前端調整成本很低。

需要特別注意的三點：

- **沒出現在 body 裡的區塊視為刪除**。例如只送 `{"info":{…}}`，代表另外三個區塊要清空。
  這是「整份覆蓋」的必然結果，請不要做成部分合併，否則前端刪不掉區塊。
- **`imageError` 是前端的暫存欄位**（顯示生圖失敗原因），收到可以直接忽略、不必儲存。
- **payload 可能很大**。在 `POST /api/images` 完成之前，`image` 欄位是 base64 data URL，
  一張圖約 1–2MB，三張就可能超過 5MB。請把上傳大小上限設在 **10MB 以上**，
  否則會踩到預設的 1MB 限制。圖片 API 上線後這裡只會存網址，體積才會降下來。

**錯誤**

| 狀態碼 | 時機 |
|---|---|
| 400 | JSON 格式錯誤、區塊 key 不在四個允許值內 |
| 401 / 403 / 404 | 同上 |
| 413 | payload 超過大小上限 |

```bash
curl -X PUT "$BASE/api/clinics/c004/content"   -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN"   -d '{"info":{"text":"・診所定位…","sources":[]}}'
```

### `DELETE /api/clinics/{clinicId}/content`

| | |
|---|---|
| 權限 | 需 token |
| 成功 | `200`，回傳 `{}` |

刪除這間診所的全部四個區塊。

**請做成冪等**：本來就沒有內容時也回 `200`，不要回 404。前端的刪除按鈕只在有內容時才啟用，
但重複點擊或兩個分頁同時操作都可能送出第二次。

**錯誤**：`401` / `403` / `404`（診所不存在）

```bash
curl -X DELETE "$BASE/api/clinics/c004/content" -H "Authorization: Bearer $TOKEN"
```

### `POST /api/clinics/{clinicId}/content/publish`

| | |
|---|---|
| 權限 | 需 token |
| 成功 | `200`，回傳 `{}` |

把目前儲存的內容發布到前台。**無 request body**——發布的是伺服器上已儲存的版本，
所以前端的流程一定是先「儲存」再「傳送」。

**錯誤**

| 狀態碼 | 訊息範例 | 時機 |
|---|---|---|
| 400 | 尚未儲存任何內容，無法發布 | 這間診所沒有已儲存的內容 |
| 401 / 403 / 404 | | 同上 |

```bash
curl -X POST "$BASE/api/clinics/c004/content/publish" -H "Authorization: Bearer $TOKEN"
```

---

## 四、圖片

### `POST /api/images`

| | |
|---|---|
| 權限 | 需 token |
| Content-Type | `multipart/form-data` |
| 成功 | `200` |

**Request**

| 欄位 | 說明 |
|---|---|
| `clinicId` | 診所 id |
| `file` | 圖片檔，`image/jpeg`、`image/png`、`image/webp` |

**Response**

```json
{ "id": "img_abc123", "url": "https://cdn.example.com/clinic/c004/abc123.webp" }
```

**`id` 和 `url` 兩個都要回。** `url` 寫進內容裡給畫面用，`id` 則是
`DELETE /api/images/{imageId}` 唯一的輸入——只回 `url` 的話，圖片就永遠刪不掉。

- `url` 必須是 **HTTPS**、長度 ≤2000 字元（LINE Flex 訊息的限制）。
- 前端上傳前已擋掉非圖片檔與超過 5MB 的檔案，但後端仍要自己驗。

**錯誤**

| 狀態碼 | 訊息範例 | 時機 |
|---|---|---|
| 400 | 請選擇圖片檔 | 不是支援的圖片格式 |
| 401 / 403 | | 未登入／沒有這間診所的權限 |
| 413 | 圖片請小於 5MB | 檔案過大 |

```bash
curl -X POST "$BASE/api/images" -H "Authorization: Bearer $TOKEN"   -F "clinicId=c004" -F "file=@photo.webp"
```

**這支是上線的必要條件，不是優化。** 目前 AI 生成與使用者上傳的圖片都是 base64 data URL，
只存在瀏覽器記憶體、重整就消失；而 LINE Flex 訊息的圖片必須是 HTTPS 網址，data URL 一定過不了。

### `DELETE /api/images/{imageId}`

| | |
|---|---|
| 權限 | 需 token |
| 成功 | `200`，回傳 `{}` |

`{imageId}` 是 `POST /api/images` 回傳的 `id`。

**請做成冪等**：圖片已經不存在時也回 `200`。

**錯誤**：`401` / `403`

建議一開始就做。iCare 專案的圖片類別只有上傳沒有刪除，結果部分流程失敗時會留下沒人引用的
孤兒圖片，而且沒有任何方式清除。

```bash
curl -X DELETE "$BASE/api/images/img_abc123" -H "Authorization: Bearer $TOKEN"
```

---

## 五、AI 設定

目前 AI 的 provider、model、API key 存在瀏覽器 `localStorage`（`src/lib/ai-settings.ts`），
**API key 是明文**。有後端之後應該搬過去。

### `GET /api/ai-settings`

| | |
|---|---|
| 權限 | 需 token |
| 成功 | `200` |

```json
{ "provider": "gemini", "model": "gemini-flash-latest", "hasApiKey": true }
```

- **絕對不要回傳 key 本身**，只回 `hasApiKey` 代表有沒有設定過。
- 從未設定過時回預設值：`provider: "gemini"`、`model: "gemini-flash-latest"`、`hasApiKey: false`。

**錯誤**：`401`

```bash
curl "$BASE/api/ai-settings" -H "Authorization: Bearer $TOKEN"
```

### `PUT /api/ai-settings`

| | |
|---|---|
| 權限 | 需 token |
| 成功 | `200` |

**Request**

```json
{ "provider": "gemini", "model": "gemini-flash-latest", "apiKey": "AIza…" }
```

- `provider` 只接受 `gemini`、`openai`、`anthropic` 三個值。
- `apiKey` **省略**代表沿用舊的、不覆蓋；送**空字串**代表清除。
- 後端加密儲存，不要明文落地。

**Response**（與 GET 相同形狀，方便前端直接更新畫面）

```json
{ "provider": "gemini", "model": "gemini-flash-latest", "hasApiKey": true }
```

**錯誤**

| 狀態碼 | 訊息範例 | 時機 |
|---|---|---|
| 400 | 不支援的 AI 服務 | `provider` 不在三個允許值內 |
| 400 | 請填入模型名稱 | `model` 為空 |
| 401 | | 未登入 |

```bash
curl -X PUT "$BASE/api/ai-settings"   -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN"   -d '{"provider":"gemini","model":"gemini-flash-latest","apiKey":"AIza…"}'
```

---

## 六、已經實作的內部 API（後端不需重做）

這兩支是 Next.js 的 route handler，跑在前端專案的伺服器端：

| 端點 | 檔案 | 用途 |
|---|---|---|
| `POST /api/generate` | `src/app/api/generate/route.ts` | 四個區塊的內容生成 |
| `POST /api/generate-image` | `src/app/api/generate-image/route.ts` | 單張配圖，含 4 次重試與退路提示詞 |

兩支目前都由前端把 API key 放進 request body 送上來（因為設定存在瀏覽器）。
等「五、AI 設定」搬到後端之後，應改成由伺服器端自己取金鑰，request body 不再包含 `apiKey`。

---

## 七、外部服務（需申請金鑰與開通權限）

| 服務 | 用到的能力 | 備註 |
|---|---|---|
| Google Gemini | `generateContent` + `googleSearch` 工具 | 文字生成與上網搜尋 |
| Google Gemini | `gemini-2.5-flash-image` | 繪圖；需確認金鑰有此模型權限 |
| OpenAI | `responses.create` + `web_search` | 文字生成與上網搜尋 |
| OpenAI | `images.generate`（`gpt-image-1`） | 繪圖 |
| Anthropic | `beta.messages.create` + `web_search_20260209` | 文字生成；**沒有繪圖能力** |
| LINE Messaging API | 推播 Flex 訊息 | 「傳送」要真的推播到 LINE 時才需要 |

選用 Anthropic 時，衛教與診療項目的文字可以正常生成，但圖片會回
「Claude 無法生成圖片，請在「AI 設定」改用 Gemini 或 OpenAI」。

---

## 八、後端完成後的接續工作

依建議順序：

1. **圖片改走 `POST /api/images`**：生成或上傳完成後立刻上傳換成網址，不要把 data URL 存進內容。
   同時要把回應的 `id` 一起存進 `ServiceItem` / `EducationItem`，否則之後無法呼叫
   `DELETE /api/images/{imageId}`。目前 `uploadImage`（clinics.ts:174）只回傳 `url`，id 被丟掉。
2. **把 AI 金鑰搬到後端**，`/api/generate` 與 `/api/generate-image` 的 request body 拿掉 `apiKey`。
3. **清掉假資料分支**：`src/lib/clinics.ts` 裡所有 `if (useMock)`、`MOCK_CLINICS`、`delay()`，
   以及 `src/lib/api.ts` 的 `useMock` 匯出。
4. **「傳送」串 LINE 推播**，把 `EducationItem[]` 轉成 Flex carousel JSON。
5. **處理 token 失效**：`apiFetch`（api.ts:34）目前只把錯誤訊息丟出來，收到 `401` 時
   畫面會顯示一行紅字但人還停在原地。應該改成清掉 token 並導回登入頁。
