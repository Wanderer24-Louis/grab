from flask import Flask, render_template, request, jsonify, send_from_directory
from flask_cors import CORS
import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin
import logging
import sys
import os

# 設定日誌
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)  # 啟用 CORS 支援

LOCAL_IMAGE_FOLDER = os.path.join('static', 'local_images')
ALLOWED_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'}

@app.route('/')
def index():
    logger.info('訪問首頁')
    return render_template('index.html')

@app.route('/fetch_local_images', methods=['GET'])
def fetch_local_images():
    try:
        files = os.listdir(LOCAL_IMAGE_FOLDER)
        images = [f for f in files if os.path.splitext(f)[1].lower() in ALLOWED_EXTENSIONS]
        logger.info(f'本地圖片數量: {len(images)}')
        return jsonify({'images': images})
    except Exception as e:
        logger.error(f'讀取本地圖片錯誤: {str(e)}')
        return jsonify({'error': f'讀取本地圖片錯誤：{str(e)}'}), 500

@app.route('/local_images/<filename>')
def local_image(filename):
    return send_from_directory(LOCAL_IMAGE_FOLDER, filename)

@app.route('/fetch_images', methods=['POST'])
def fetch_images():
    url = request.form.get('url')
    logger.info(f'收到圖片抓取請求，URL: {url}')
    
    if not url:
        logger.warning('未提供 URL')
        return jsonify({'error': '請輸入網址'}), 400
    
    try:
        # 添加 User-Agent 來模擬瀏覽器請求
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
        logger.info(f'開始請求網頁: {url}')
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        
        logger.info('成功獲取網頁內容，開始解析圖片')
        soup = BeautifulSoup(response.text, 'html.parser')
        
        images = []
        for img in soup.find_all('img'):
            src = img.get('src')
            if src:
                # 將相對路徑轉換為絕對路徑
                absolute_url = urljoin(url, src)
                images.append(absolute_url)
        
        logger.info(f'找到 {len(images)} 張圖片')
        return jsonify({'images': images})
    except requests.exceptions.RequestException as e:
        logger.error(f'請求錯誤: {str(e)}')
        return jsonify({'error': f'無法抓取網頁：{str(e)}'}), 500
    except Exception as e:
        logger.error(f'發生錯誤: {str(e)}')
        return jsonify({'error': f'發生錯誤：{str(e)}'}), 500

if __name__ == '__main__':
    try:
        logger.info('啟動 Flask 應用程式')
        app.run(debug=True, host='127.0.0.1', port=5000)
    except Exception as e:
        logger.error(f'啟動失敗: {str(e)}')
        sys.exit(1) 