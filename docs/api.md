# clinicContent API 規格

這份文件列出前端需要的所有 API。資料結構以 `src/lib/clinics.ts` 的 TypeScript 型別為準，
請不要另外發明欄位名稱。

前端已經備好串接層（`src/lib/api.ts`）：**設定 `NEXT_PUBLIC_API_BASE` 後就會改打真的 API**，
沒設定時走內建假資料。後端可以一支一支完成，不必等全部做完才整合。

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

不需帶 token。

```json
{ "account": "clinic001", "password": "••••••" }
```

回傳：

```json
{ "token": "eyJhbGciOi...", "account": "clinic001" }
```

失敗範例：`401` + `{ "error": "帳號或密碼錯誤" }`

```bash
curl -X POST "$BASE/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"account":"clinic001","password":"test1234"}'
```

### `POST /api/auth/logout`

作廢目前的 token，無 request body，回傳 `{}` 即可。
**前端不會因為這支失敗而擋下登出**，呼叫失敗仍會清掉本機狀態。

---

## 二、診所

### `GET /api/clinics`

回傳這個帳號可管理的診所清單。

```json
[
  { "id": "c001", "name": "博安家庭醫學科診所", "address": "台北市大安區麗水街3號" },
  { "id": "c004", "name": "安曼牙醫診所", "address": "台北市大安區復興南路一段135巷27號8樓之3" }
]
```

關鍵字搜尋目前由**前端自己過濾**（`ClinicList.tsx`），所以這支不需要支援查詢參數。
診所數量成長到需要分頁時再加。

---

## 三、內容

`{clinicId}` 是 `GET /api/clinics` 回傳的 `id`。

### `GET /api/clinics/{clinicId}/content`

回傳已儲存的四個區塊。**還沒有任何內容時回 `{}`，不要回 404。**

```json
{
  "info": { "text": "門診時間：…", "sources": [{ "title": "診所官網", "uri": "https://…" }] },
  "services": {
    "text": "",
    "sources": [],
    "specialty": "牙科",
    "items": [
      { "id": "…", "title": "牙齒美白", "body": "…", "image": "https://…", "imageError": null }
    ]
  }
}
```

### `PUT /api/clinics/{clinicId}/content`

**整份覆蓋**。request body 就是完整的 `ClinicContent`。

前端的「儲存」是把整個編輯草稿一次送出，所以採整份覆蓋而非分區塊更新。
若後端偏好分區塊更新（`PUT /content/{section}`），請提出，前端調整成本很低。

```bash
curl -X PUT "$BASE/api/clinics/c004/content" \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d '{"info":{"text":"門診時間：…","sources":[]}}'
```

### `DELETE /api/clinics/{clinicId}/content`

刪除這間診所的全部內容，回傳 `{}`。

### `POST /api/clinics/{clinicId}/content/publish`

把目前儲存的內容發布到前台，回傳 `{}`。無 request body——**發布的是伺服器上已儲存的版本**，
所以前端會先「儲存」再「傳送」。

---

## 四、圖片

### `POST /api/images`

`multipart/form-data`，欄位：

| 欄位 | 說明 |
|---|---|
| `clinicId` | 診所 id |
| `file` | 圖片檔（jpeg / png / webp） |

回傳：

```json
{ "url": "https://cdn.example.com/clinic/c004/abc123.jpg" }
```

**這支是上線的必要條件，不是優化。** 原因：

1. 目前 AI 生成與使用者上傳的圖片都是 base64 data URL，只存在瀏覽器記憶體，重整就消失。
2. LINE Flex 訊息的圖片**必須是 HTTPS 網址**，長度上限 2000 字元，data URL 一定過不了。

### `DELETE /api/images/{imageId}`

建議一開始就做。iCare 專案的圖片類別只有上傳沒有刪除，結果部分流程失敗時會留下沒人引用的
孤兒圖片，而且沒有任何方式清除。

---

## 五、AI 設定（後續）

目前 AI 的 provider、model、API key 存在瀏覽器 `localStorage`（`src/lib/ai-settings.ts`），
**API key 是明文**。有後端之後應該搬過去：

### `GET /api/ai-settings`

```json
{ "provider": "gemini", "model": "gemini-flash-latest", "hasApiKey": true }
```

**不要回傳 key 本身**，只回有沒有設定。

### `PUT /api/ai-settings`

```json
{ "provider": "gemini", "model": "gemini-flash-latest", "apiKey": "AIza…" }
```

後端加密儲存。`apiKey` 省略代表沿用舊的、不覆蓋。

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
2. **把 AI 金鑰搬到後端**，`/api/generate` 與 `/api/generate-image` 的 request body 拿掉 `apiKey`。
3. **清掉假資料分支**：`src/lib/clinics.ts` 裡所有 `if (useMock)`、`MOCK_CLINICS`、`delay()`，
   以及 `src/lib/api.ts` 的 `useMock` 匯出。
4. **「傳送」串 LINE 推播**，把 `EducationItem[]` 轉成 Flex carousel JSON。
