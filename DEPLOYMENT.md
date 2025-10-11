# 部署指南

本指南將幫助您將PTT圖片抓取器部署到GitHub和Render。

## 步驟1: 準備GitHub倉庫

### 1.1 創建GitHub倉庫

1. 登入 [GitHub](https://github.com)
2. 點擊右上角的 "+" 按鈕，選擇 "New repository"
3. 填寫倉庫信息：
   - **Repository name**: `ptt-image-grabber`
   - **Description**: `PTT 圖片抓取工具 - 支援API密鑰驗證`
   - **Visibility**: 選擇 Public 或 Private
   - **Initialize**: 不要勾選任何選項（我們已有代碼）

4. 點擊 "Create repository"

### 1.2 推送代碼到GitHub

在您的本地項目目錄中執行以下命令：

```bash
# 初始化Git倉庫（如果還沒有）
git init

# 添加所有文件
git add .

# 提交更改
git commit -m "Initial commit: PTT image grabber with API key support"

# 設置主分支
git branch -M main

# 添加遠程倉庫（替換為您的GitHub倉庫URL）
git remote add origin https://github.com/YOUR_USERNAME/ptt-image-grabber.git

# 推送代碼
git push -u origin main
```

## 步驟2: 部署到Render

### 2.1 創建Render帳戶

1. 訪問 [Render](https://render.com)
2. 點擊 "Get Started for Free"
3. 使用GitHub帳戶登入

### 2.2 創建Web Service

1. 在Render儀表板中，點擊 "New +"
2. 選擇 "Web Service"
3. 連接您的GitHub倉庫：
   - 選擇 "Build and deploy from a Git repository"
   - 選擇您的 `ptt-image-grabber` 倉庫

### 2.3 配置服務

填寫以下配置：

**基本設置**:
- **Name**: `ptt-image-grabber`
- **Environment**: `Node`
- **Region**: 選擇離您最近的區域
- **Branch**: `main`

**構建和部署**:
- **Build Command**: `npm install`
- **Start Command**: `node app.js`
- **Health Check Path**: `/health`

**環境變量**:
點擊 "Advanced" → "Environment Variables"，添加以下變量：

| Key | Value |
|-----|-------|
| `NODE_ENV` | `production` |
| `API_KEY` | `IOnREPkNgH5O3QkuJyTZo2UujCdPDLlOfiSQZeY57B` |
| `FLARESOLVERR_URL` | `https://flaresolverr.onrender.com/v1` |

### 2.4 部署

1. 點擊 "Create Web Service"
2. Render將開始構建和部署您的應用
3. 等待部署完成（通常需要2-5分鐘）

## 步驟3: 驗證部署

### 3.1 檢查健康狀態

訪問您的應用URL + `/health`：
```
https://your-app-name.onrender.com/health
```

應該看到類似以下的回應：
```json
{
  "success": true,
  "message": "服務正常運行",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "version": "1.0.0"
}
```

### 3.2 測試API功能

使用curl測試API：
```bash
curl -X POST https://your-app-name.onrender.com/fetch_images \
  -H "X-API-Key: IOnREPkNgH5O3QkuJyTZo2UujCdPDLlOfiSQZeY57B" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "url=https://example.com"
```

### 3.3 訪問網頁界面

直接訪問您的應用URL：
```
https://your-app-name.onrender.com
```

## 步驟4: 自動部署設置

### 4.1 啟用自動部署

1. 在Render服務設置中
2. 確保 "Auto-Deploy" 已啟用
3. 選擇 "Deploy from main branch"

### 4.2 測試自動部署

1. 修改代碼（例如更新README）
2. 提交並推送到main分支：
```bash
git add .
git commit -m "Test auto-deployment"
git push origin main
```
3. 檢查Render儀表板，應該會看到新的部署開始

## 步驟5: 監控和維護

### 5.1 監控日誌

在Render儀表板中：
1. 點擊您的服務
2. 查看 "Logs" 標籤
3. 監控應用運行狀態

### 5.2 更新應用

1. 在本地修改代碼
2. 提交更改：
```bash
git add .
git commit -m "Update feature"
git push origin main
```
3. Render會自動重新部署

### 5.3 環境變量管理

在Render中更新環境變量：
1. 進入服務設置
2. 點擊 "Environment"
3. 修改或添加新的環境變量
4. 點擊 "Save Changes"
5. 服務會自動重啟

## 故障排除

### 常見問題

1. **部署失敗**
   - 檢查 `package.json` 中的依賴
   - 確保Node.js版本兼容
   - 查看構建日誌

2. **API密鑰錯誤**
   - 確認環境變量設置正確
   - 檢查API密鑰是否正確

3. **FlareSolverr連接失敗**
   - 確認FlareSolverr服務URL正確
   - 檢查網路連接

### 獲取幫助

- 查看Render文檔：https://render.com/docs
- 檢查GitHub Actions日誌
- 查看應用日誌

## 安全注意事項

1. **保護API密鑰**
   - 不要在代碼中硬編碼API密鑰
   - 使用環境變量存儲敏感信息
   - 定期更換API密鑰

2. **限制訪問**
   - 考慮添加IP白名單
   - 實施速率限制
   - 監控異常訪問

3. **備份**
   - 定期備份代碼
   - 保存重要的環境變量
   - 記錄部署配置
