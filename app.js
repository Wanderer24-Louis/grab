const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const path = require('path');
const { CookieJar } = require('tough-cookie');
const { wrapper } = require('axios-cookiejar-support');

const app = express();
const port = process.env.PORT || 10000;

// FlareSolverr 設定
const FLARESOLVERR_URL = process.env.FLARESOLVERR_URL || 'http://localhost:8191/v1';
const FLARESOLVERR_SESSION = 'ptt_session';

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

// 使用 FlareSolverr 發送請求
async function makeRequest(url) {
    try {
        // 先嘗試使用 FlareSolverr
        const response = await axios.post(`${FLARESOLVERR_URL}/request`, {
            cmd: 'request.get',
            url: url,
            session: FLARESOLVERR_SESSION,
            maxTimeout: 60000
        });

        if (response.data.status === 'success') {
            return {
                status: 200,
                data: response.data.solution.response,
                headers: response.data.solution.headers
            };
        }

        // 如果 FlareSolverr 失敗，嘗試直接請求
        const directResponse = await client.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1'
            },
            timeout: 60000
        });

        return {
            status: directResponse.status,
            data: directResponse.data,
            headers: directResponse.headers
        };
    } catch (error) {
        console.error('請求失敗:', error.message);
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
        const response = await makeRequest(url);
        
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