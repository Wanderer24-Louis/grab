@echo off
echo 🚀 PTT 圖片抓取器 - 快速部署腳本
echo ==================================

REM 檢查Git是否已初始化
if not exist ".git" (
    echo 📁 初始化Git倉庫...
    git init
    git branch -M main
)

REM 檢查是否有未提交的更改
git status --porcelain > temp_status.txt
set /p status_content=<temp_status.txt
del temp_status.txt

if not "%status_content%"=="" (
    echo 📝 發現未提交的更改，正在提交...
    git add .
    git commit -m "Deploy: Update PTT image grabber with API key support"
)

REM 檢查遠程倉庫
git remote get-url origin >nul 2>&1
if errorlevel 1 (
    echo 🔗 請設置GitHub遠程倉庫
    echo git remote add origin https://github.com/YOUR_USERNAME/ptt-image-grabber.git
    echo.
    set /p REPO_URL="請輸入您的GitHub倉庫URL: "
    if not "!REPO_URL!"=="" (
        git remote add origin "!REPO_URL!"
    ) else (
        echo ❌ 未提供倉庫URL，請手動設置
        pause
        exit /b 1
    )
)

REM 推送到GitHub
echo 📤 推送到GitHub...
git push -u origin main

if %errorlevel% equ 0 (
    echo ✅ 代碼已成功推送到GitHub
    echo.
    echo 🌐 現在請在Render上部署：
    echo 1. 訪問 https://render.com
    echo 2. 點擊 'New +' → 'Web Service'
    echo 3. 連接您的GitHub倉庫
    echo 4. 使用以下配置：
    echo    - Name: ptt-image-grabber
    echo    - Environment: Node
    echo    - Build Command: npm install
    echo    - Start Command: node app.js
    echo    - Health Check Path: /health
    echo.
    echo 5. 設置環境變量：
    echo    - NODE_ENV: production
    echo    - API_KEY: IOnREPkNgH5O3QkuJyTZo2UujCdPDLlOfiSQZeY57B
    echo    - FLARESOLVERR_URL: https://flaresolverr.onrender.com/v1
    echo.
    echo 📚 詳細部署說明請查看 DEPLOYMENT.md
) else (
    echo ❌ 推送到GitHub失敗，請檢查網路連接和權限
    pause
    exit /b 1
)

pause
