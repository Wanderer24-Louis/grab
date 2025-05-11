const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const path = require('path');
const { CookieJar } = require('tough-cookie');
const { wrapper } = require('axios-cookiejar-support');

const app = express();
const port = process.env.PORT || 10000;

// 設置 CORS
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// 創建 axios 實例
const jar = new CookieJar();
const client = wrapper(axios.create({ 
    jar,
    timeout: 60000,
    maxRedirects: 5,
    validateStatus: function (status) {
        return status >= 200 && status < 500;
    }
}));

// 設置請求標頭
const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'Accept-Language': 'zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Cache-Control': 'max-age=0'
};

// 隨機延遲函數
const randomDelay = (min, max) => {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    return new Promise(resolve => setTimeout(resolve, delay));
};

// 檢查是否被 Cloudflare 阻擋
const isCloudflareBlocked = (data) => {
    return data.includes('cf-browser-verification') || 
           data.includes('challenge-platform') ||
           data.includes('cf_chl_') ||
           data.includes('cf_clearance');
};

// 獲取 Imgur 頁面圖片
async function getImgurPageImage(url) {
    try {
        // 添加隨機延遲
        await randomDelay(5000, 10000);
        
        const response = await client.get(url, { 
            headers,
            timeout: 60000
        });

        if (response.status === 403 || isCloudflareBlocked(response.data)) {
            console.log('檢測到 Cloudflare 保護，等待後重試...');
            await randomDelay(15000, 30000);
            return getImgurPageImage(url);
        }

        const $ = cheerio.load(response.data);
        const imageUrl = $('meta[property="og:image"]').attr('content');
        
        if (!imageUrl) {
            throw new Error('找不到圖片 URL');
        }

        return imageUrl;
    } catch (error) {
        console.error('獲取 Imgur 頁面圖片失敗:', error.message);
        throw error;
    }
}

// 獲取 Imgur 相簿圖片
async function getImgurAlbumImages(url) {
    try {
        // 添加隨機延遲
        await randomDelay(5000, 10000);
        
        const response = await client.get(url, { 
            headers,
            timeout: 60000
        });

        if (response.status === 403 || isCloudflareBlocked(response.data)) {
            console.log('檢測到 Cloudflare 保護，等待後重試...');
            await randomDelay(15000, 30000);
            return getImgurAlbumImages(url);
        }

        const $ = cheerio.load(response.data);
        const images = [];
        
        $('.post-image-container').each((i, elem) => {
            const imgUrl = $(elem).find('img').attr('src');
            if (imgUrl) {
                images.push(imgUrl);
            }
        });

        if (images.length === 0) {
            throw new Error('找不到相簿圖片');
        }

        return images;
    } catch (error) {
        console.error('獲取 Imgur 相簿圖片失敗:', error.message);
        throw error;
    }
}

// 獲取 PTT 文章圖片
app.get('/fetch_images', async (req, res) => {
    const url = req.query.url;
    if (!url) {
        return res.status(400).json({ 
            success: false,
            error: '請提供 URL',
            message: 'URL 參數不能為空'
        });
    }

    try {
        // 添加隨機延遲
        await randomDelay(5000, 10000);
        
        const response = await client.get(url, { 
            headers,
            timeout: 60000
        });

        if (response.status === 403 || isCloudflareBlocked(response.data)) {
            console.log('檢測到 Cloudflare 保護，等待後重試...');
            await randomDelay(15000, 30000);
            return res.status(429).json({ 
                success: false,
                error: '請求被限制',
                message: '請稍後再試，或嘗試使用其他網路環境'
            });
        }

        if (response.status !== 200) {
            return res.status(response.status).json({
                success: false,
                error: '請求失敗',
                message: `伺服器回應狀態碼：${response.status}`,
                status: response.status
            });
        }

        const $ = cheerio.load(response.data);
        const imageUrls = new Set();

        // 處理所有圖片連結
        $('a').each((i, elem) => {
            const href = $(elem).attr('href');
            if (href) {
                if (href.includes('imgur.com')) {
                    if (href.includes('/a/')) {
                        imageUrls.add(href);
                    } else {
                        imageUrls.add(href);
                    }
                } else if (href.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
                    imageUrls.add(href);
                }
            }
        });

        // 處理所有圖片標籤
        $('img').each((i, elem) => {
            const src = $(elem).attr('src');
            if (src && src.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
                imageUrls.add(src);
            }
        });

        const images = Array.from(imageUrls);
        
        if (images.length === 0) {
            return res.status(404).json({
                success: false,
                error: '找不到圖片',
                message: '在文章中未找到任何圖片'
            });
        }

        res.json({ 
            success: true,
            images,
            count: images.length,
            url: url
        });
    } catch (error) {
        console.error('獲取圖片失敗:', error.message);
        res.status(500).json({ 
            success: false,
            error: '獲取圖片失敗',
            message: error.message,
            details: error.stack
        });
    }
});

// 錯誤處理中間件
app.use((err, req, res, next) => {
    console.error('伺服器錯誤:', err);
    res.status(500).json({
        success: false,
        error: '伺服器內部錯誤',
        message: err.message,
        details: err.stack
    });
});

// 處理 404 錯誤
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: '找不到請求的資源',
        message: '請確認 URL 是否正確'
    });
});

// 啟動伺服器
app.listen(port, () => {
    console.log(`伺服器運行在 http://localhost:${port}`);
}); 