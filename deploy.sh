#!/bin/bash

# PTT 圖片抓取器 - 快速部署腳本
# 此腳本將幫助您快速部署到GitHub和Render

echo "🚀 PTT 圖片抓取器 - 快速部署腳本"
echo "=================================="

# 檢查Git是否已初始化
if [ ! -d ".git" ]; then
    echo "📁 初始化Git倉庫..."
    git init
    git branch -M main
fi

# 檢查是否有未提交的更改
if [ -n "$(git status --porcelain)" ]; then
    echo "📝 發現未提交的更改，正在提交..."
    git add .
    git commit -m "Deploy: Update PTT image grabber with API key support"
fi

# 檢查遠程倉庫
if ! git remote get-url origin > /dev/null 2>&1; then
    echo "🔗 請設置GitHub遠程倉庫："
    echo "git remote add origin https://github.com/YOUR_USERNAME/ptt-image-grabber.git"
    echo ""
    read -p "請輸入您的GitHub倉庫URL: " REPO_URL
    if [ ! -z "$REPO_URL" ]; then
        git remote add origin "$REPO_URL"
    else
        echo "❌ 未提供倉庫URL，請手動設置"
        exit 1
    fi
fi

# 推送到GitHub
echo "📤 推送到GitHub..."
git push -u origin main

if [ $? -eq 0 ]; then
    echo "✅ 代碼已成功推送到GitHub"
    echo ""
    echo "🌐 現在請在Render上部署："
    echo "1. 訪問 https://render.com"
    echo "2. 點擊 'New +' → 'Web Service'"
    echo "3. 連接您的GitHub倉庫"
    echo "4. 使用以下配置："
    echo "   - Name: ptt-image-grabber"
    echo "   - Environment: Node"
    echo "   - Build Command: npm install"
    echo "   - Start Command: node app.js"
    echo "   - Health Check Path: /health"
    echo ""
    echo "5. 設置環境變量："
    echo "   - NODE_ENV: production"
    echo "   - API_KEY: IOnREPkNgH5O3QkuJyTZo2UujCdPDLlOfiSQZeY57B"
    echo "   - FLARESOLVERR_URL: https://flaresolverr.onrender.com/v1"
    echo ""
    echo "📚 詳細部署說明請查看 DEPLOYMENT.md"
else
    echo "❌ 推送到GitHub失敗，請檢查網路連接和權限"
    exit 1
fi
