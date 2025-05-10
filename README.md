# PTT 圖片抓取器

這是一個可以從網頁中抓取圖片的工具，特別支援 PTT 和 Imgur 的圖片連結。

## 功能特點

- 支援從網頁中抓取圖片
- 特別支援 Imgur 圖片連結的處理
- 提供圖片預覽和放大功能
- 支援圖片導航（上一張/下一張）

## 安裝步驟

1. 確保您已安裝 Node.js（建議版本 14.0.0 或更高）

2. 複製專案：
```bash
git clone [您的專案網址]
cd ptt-image-grabber
```

3. 安裝依賴：
```bash
npm install
```

4. 啟動伺服器：
```bash
npm start
```

5. 開啟瀏覽器訪問：`http://localhost:3000`

## 使用說明

1. 在輸入框中輸入要抓取圖片的網頁網址
2. 點擊「抓取圖片」按鈕
3. 等待系統處理並顯示找到的圖片
4. 點擊圖片可以放大查看
5. 在放大模式下可以使用左右按鈕切換圖片

## 技術棧

- 前端：HTML, CSS, JavaScript
- 後端：Node.js, Express
- 主要套件：
  - express
  - axios
  - cheerio
  - cors

## 授權

MIT License 