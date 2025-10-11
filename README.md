# PTT 圖片抓取器

這是一個可以從網頁中抓取圖片的工具，特別支援 PTT 和 Imgur 的圖片連結，並提供API密鑰驗證功能。

## 功能特點

- 支援從網頁中抓取圖片
- 特別支援 Imgur 圖片連結的處理
- 提供圖片預覽和放大功能
- 支援圖片導航（上一張/下一張）
- **API密鑰驗證功能**
- **FlareSolverr支援**（繞過Cloudflare保護）
- **伺服器狀態監控**

## 快速開始

### 本地開發

1. 確保您已安裝 Node.js（建議版本 18.0.0 或更高）

2. 複製專案：
```bash
git clone https://github.com/your-username/ptt-image-grabber.git
cd ptt-image-grabber
```

3. 安裝依賴：
```bash
npm install
```

4. 設置環境變量：
```bash
export API_KEY=IOnREPkNgH5O3QkuJyTZo2UujCdPDLlOfiSQZeY57B
export FLARESOLVERR_URL=http://localhost:8191/v1
```

5. 啟動伺服器：
```bash
npm start
```

6. 開啟瀏覽器訪問：`http://localhost:10000`

### 使用Docker

```bash
# 啟動FlareSolverr
docker-compose up -d flaresolverr

# 啟動應用
npm start
```

## 部署到Render

### 1. 準備GitHub倉庫

1. 在GitHub上創建新倉庫
2. 將代碼推送到GitHub：
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/your-username/ptt-image-grabber.git
git push -u origin main
```

### 2. 在Render上部署

1. 登入 [Render](https://render.com)
2. 點擊 "New +" → "Web Service"
3. 連接您的GitHub倉庫
4. 配置服務：
   - **Name**: `ptt-image-grabber`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node app.js`
   - **Health Check Path**: `/health`

5. 設置環境變量：
   - `NODE_ENV`: `production`
   - `API_KEY`: `IOnREPkNgH5O3QkuJyTZo2UujCdPDLlOfiSQZeY57B`
   - `FLARESOLVERR_URL`: `https://flaresolverr.onrender.com/v1`

6. 點擊 "Create Web Service"

### 3. 自動部署

項目已配置自動部署，當您推送代碼到main分支時，Render會自動重新部署。

## API使用

### 健康檢查
```bash
curl https://your-app.onrender.com/health
```

### 抓取圖片
```bash
curl -X POST https://your-app.onrender.com/fetch_images \
  -H "X-API-Key: IOnREPkNgH5O3QkuJyTZo2UujCdPDLlOfiSQZeY57B" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "url=https://example.com"
```

## 使用說明

1. 在輸入框中輸入要抓取圖片的網頁網址
2. 在API密鑰欄位輸入：`IOnREPkNgH5O3QkuJyTZo2UujCdPDLlOfiSQZeY57B`
3. 點擊「抓取圖片」按鈕
4. 等待系統處理並顯示找到的圖片
5. 點擊圖片可以放大查看
6. 在放大模式下可以使用左右按鈕切換圖片

## 技術棧

- **前端**: HTML, CSS, JavaScript
- **後端**: Node.js, Express
- **主要套件**:
  - express
  - axios
  - cheerio
  - cors
  - tough-cookie
  - axios-cookiejar-support

## 環境變量

| 變量名 | 描述 | 預設值 |
|--------|------|--------|
| `API_KEY` | API密鑰 | `IOnREPkNgH5O3QkuJyTZo2UujCdPDLlOfiSQZeY57B` |
| `FLARESOLVERR_URL` | FlareSolverr服務URL | `http://localhost:8191/v1` |
| `NODE_ENV` | 環境模式 | `development` |
| `PORT` | 服務端口 | `10000` |

## 測試

運行測試腳本：
```bash
node test_api.js
```

## 授權

MIT License 