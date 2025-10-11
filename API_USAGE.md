# API 密鑰使用說明

## 概述
您的PTT圖片抓取工具現在支持API密鑰驗證功能，以提供更好的安全性和訪問控制。

## API 密鑰
您的API密鑰：`IOnREPkNgH5O3QkuJyTZo2UujCdPDLlOfiSQZeY57B`

## 使用方法

### 1. 通過網頁界面使用
1. 打開網頁界面
2. 在"API密鑰"欄位中輸入您的API密鑰（可選）
3. 輸入要抓取的網址
4. 點擊"抓取圖片"按鈕

### 2. 通過API直接調用

#### 方法一：使用Header
```bash
curl -X POST http://localhost:10000/fetch_images \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -H "X-API-Key: IOnREPkNgH5O3QkuJyTZo2UujCdPDLlOfiSQZeY57B" \
  -d "url=https://example.com"
```

#### 方法二：使用Body參數
```bash
curl -X POST http://localhost:10000/fetch_images \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "url=https://example.com&apiKey=IOnREPkNgH5O3QkuJyTZo2UujCdPDLlOfiSQZeY57B"
```

#### 方法三：使用Query參數
```bash
curl -X POST "http://localhost:10000/fetch_images?apiKey=IOnREPkNgH5O3QkuJyTZo2UujCdPDLlOfiSQZeY57B" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "url=https://example.com"
```

### 3. 使用JavaScript/Node.js
```javascript
const axios = require('axios');

const response = await axios.post('http://localhost:10000/fetch_images', {
    url: 'https://example.com',
    apiKey: 'IOnREPkNgH5O3QkuJyTZo2UujCdPDLlOfiSQZeY57B'
}, {
    headers: {
        'X-API-Key': 'IOnREPkNgH5O3QkuJyTZo2UujCdPDLlOfiSQZeY57B'
    }
});
```

## 端點說明

### 健康檢查端點
- **URL**: `GET /health`
- **說明**: 檢查服務狀態，不需要API密鑰
- **回應**: 
```json
{
    "success": true,
    "message": "服務正常運行",
    "timestamp": "2024-01-01T00:00:00.000Z",
    "version": "1.0.0"
}
```

### 圖片抓取端點
- **URL**: `POST /fetch_images`
- **說明**: 抓取指定網址的圖片，需要API密鑰
- **參數**:
  - `url` (必需): 要抓取的網址
  - `apiKey` (可選): API密鑰（如果不在Header中提供）
- **Header**:
  - `X-API-Key` (可選): API密鑰
- **回應**:
```json
{
    "success": true,
    "images": ["圖片URL1", "圖片URL2"],
    "count": 2,
    "url": "https://example.com"
}
```

## 錯誤處理

### 401 未授權
```json
{
    "success": false,
    "error": "缺少API密鑰",
    "message": "請在請求中提供API密鑰"
}
```

### 403 禁止訪問
```json
{
    "success": false,
    "error": "無效的API密鑰",
    "message": "提供的API密鑰不正確"
}
```

## 測試
運行測試腳本來驗證API密鑰功能：
```bash
node test_api.js
```

## 環境變量
您可以在環境變量中設置API密鑰：
```bash
export API_KEY=IOnREPkNgH5O3QkuJyTZo2UujCdPDLlOfiSQZeY57B
```

## 安全注意事項
1. 請妥善保管您的API密鑰
2. 不要在公開的代碼庫中暴露API密鑰
3. 定期更換API密鑰以提高安全性
4. 使用HTTPS來保護API密鑰的傳輸
