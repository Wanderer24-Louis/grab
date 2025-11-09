const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const path = require('path');
const { URL } = require('url');
const { CookieJar } = require('tough-cookie');
const { wrapper } = require('axios-cookiejar-support');

const app = express();
const port = process.env.PORT || 10000;

// FlareSolverr 設定
const FLARESOLVERR_URL = process.env.FLARESOLVERR_URL || 'http://localhost:8191/v1';
const FLARESOLVERR_SESSION = 'ptt_session';

// API 密鑰設定
const API_KEY = process.env.API_KEY || 'IOnREPkNgH5O3QkuJyTZo2UujCdPDLlOfiSQZeY57B';

// 設置 CORS
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // 添加這一行處理 form 數據
app.use(express.static('public'));

// 移除 API 密鑰驗證，允許公開訪問

// 根路徑（不需要API密鑰）
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 健康檢查端點（不需要API密鑰）
app.get('/health', (req, res) => {
    res.json({
        success: true,
        message: '服務正常運行',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        flaresolverr: FLARESOLVERR_URL
    });
});

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

// 將相對路徑轉換為絕對路徑
function resolveUrl(baseUrl, relativeUrl) {
    try {
        return new URL(relativeUrl, baseUrl).href;
    } catch (error) {
        console.error('URL解析失敗:', error.message);
        return relativeUrl;
    }
}

// 處理 Imgur 連結
function processImgurUrl(url) {
    // 如果是 Imgur 相簿連結，需要特殊處理
    if (url.includes('imgur.com/a/')) {
        return url;
    }
    // 如果是 Imgur 單張圖片連結，確保是圖片格式
    if (url.includes('imgur.com/') && !url.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
        // 嘗試轉換為直接圖片連結
        const imgurId = url.split('/').pop().split('.')[0];
        if (imgurId) {
            return `https://i.imgur.com/${imgurId}.jpg`;
        }
    }
    return url;
}

// 使用 FlareSolverr 發送請求
async function makeRequest(url) {
    // 先嘗試使用 FlareSolverr（如果配置了）
    if (FLARESOLVERR_URL && FLARESOLVERR_URL !== 'http://localhost:8191/v1') {
        try {
            console.log(`嘗試使用 FlareSolverr 請求: ${url}`);
            const response = await axios.post(`${FLARESOLVERR_URL}/request`, {
                cmd: 'request.get',
                url: url,
                session: FLARESOLVERR_SESSION,
                maxTimeout: 60000,
                returnOnlyCookies: false
            }, {
                timeout: 90000  // 增加超時時間，因為 FlareSolverr 需要時間處理
            });

            if (response.data && response.data.status === 'success') {
                console.log('FlareSolverr 請求成功');
                const solution = response.data.solution;
                return {
                    status: solution.status || 200,
                    data: solution.response,
                    headers: solution.headers || {}
                };
            } else {
                console.log('FlareSolverr 返回非成功狀態:', response.data);
                // 如果 FlareSolverr 失敗，繼續嘗試直接請求
            }
        } catch (error) {
            console.log(`FlareSolverr 請求失敗: ${error.message}`);
            if (error.response) {
                console.log('FlareSolverr 回應:', error.response.data);
            }
            // 繼續嘗試直接請求
        }
    }

    // 如果 FlareSolverr 失敗或未配置，嘗試直接請求（使用更完整的瀏覽器標頭）
    try {
        console.log(`直接請求: ${url}`);
        const urlObj = new URL(url);
        const directResponse = await client.get(url, {
            headers: {
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
                'Cache-Control': 'max-age=0',
                'Referer': urlObj.origin,
                'DNT': '1'
            },
            timeout: 60000,
            maxRedirects: 10,
            validateStatus: function (status) {
                // 接受所有狀態碼，讓我們自己處理
                return true;
            }
        });

        console.log(`直接請求回應狀態碼: ${directResponse.status}`);
        
        return {
            status: directResponse.status,
            data: directResponse.data,
            headers: directResponse.headers
        };
    } catch (error) {
        console.error('直接請求失敗:', error.message);
        if (error.response) {
            console.error('回應狀態碼:', error.response.status);
            console.error('回應標頭:', error.response.headers);
        }
        throw error;
    }
}

// 獲取 PTT 文章圖片（公開訪問，無需API密鑰）
app.post('/fetch_images', async (req, res) => {
    console.log('收到圖片抓取請求');
    console.log('請求體:', req.body);
    console.log('請求頭:', req.headers);
    
    const url = req.body.url; // 從 body 中獲取 url
    if (!url) {
        console.log('缺少 URL 參數');
        return res.status(400).json({ 
            success: false,
            error: '請提供 URL',
            message: 'URL 參數不能為空'
        });
    }

    try {
        console.log(`開始處理圖片抓取請求: ${url}`);
        const response = await makeRequest(url);
        
        if (response.status !== 200) {
            console.error(`請求目標網站失敗，狀態碼: ${response.status}`);
            // 如果是 403，說明目標網站拒絕了請求，不是我們的服務器問題
            if (response.status === 403) {
                return res.status(200).json({
                    success: false,
                    error: '目標網站拒絕訪問',
                    message: '目標網站返回 403 錯誤，可能是因為：\n1. 網站有反爬蟲保護\n2. 需要登入才能訪問\n3. IP 被限制訪問',
                    status: response.status,
                    images: []
                });
            }
            return res.status(200).json({
                success: false,
                error: '請求目標網站失敗',
                message: `目標網站回應狀態碼：${response.status}`,
                status: response.status,
                images: []
            });
        }

        console.log('成功獲取網頁內容，開始解析圖片');
        const $ = cheerio.load(response.data);
        const imageUrls = new Set();

        // 處理所有圖片連結（<a> 標籤）
        $('a').each((i, elem) => {
            const href = $(elem).attr('href');
            if (href) {
                try {
                    let absoluteUrl = resolveUrl(url, href);
                    
                    // 處理 Imgur 連結
                    if (absoluteUrl.includes('imgur.com')) {
                        absoluteUrl = processImgurUrl(absoluteUrl);
                        imageUrls.add(absoluteUrl);
                    } 
                    // 處理直接圖片連結
                    else if (absoluteUrl.match(/\.(jpg|jpeg|png|gif|webp|bmp)$/i)) {
                        imageUrls.add(absoluteUrl);
                    }
                } catch (error) {
                    console.error(`處理連結失敗: ${href}`, error.message);
                }
            }
        });

        // 處理所有圖片標籤（<img> 標籤）
        $('img').each((i, elem) => {
            // 檢查多個可能的屬性
            const src = $(elem).attr('src') || $(elem).attr('data-src') || $(elem).attr('data-lazy-src') || $(elem).attr('data-original');
            if (src) {
                try {
                    // 過濾掉 data URI 和 base64 圖片（太大）
                    if (src.startsWith('data:')) {
                        return;
                    }
                    
                    let absoluteUrl = resolveUrl(url, src);
                    
                    // 處理 Imgur 連結
                    if (absoluteUrl.includes('imgur.com')) {
                        absoluteUrl = processImgurUrl(absoluteUrl);
                        imageUrls.add(absoluteUrl);
                    }
                    // 處理直接圖片連結
                    else if (absoluteUrl.match(/\.(jpg|jpeg|png|gif|webp|bmp)$/i) || 
                             absoluteUrl.includes('imgur.com') ||
                             absoluteUrl.includes('i.imgur.com')) {
                        imageUrls.add(absoluteUrl);
                    }
                } catch (error) {
                    console.error(`處理圖片標籤失敗: ${src}`, error.message);
                }
            }
        });

        // 處理背景圖片（style 屬性中的 background-image）
        $('[style*="background-image"]').each((i, elem) => {
            const style = $(elem).attr('style');
            if (style) {
                const match = style.match(/url\(['"]?([^'")]+)['"]?\)/i);
                if (match && match[1]) {
                    try {
                        let bgUrl = resolveUrl(url, match[1]);
                        if (bgUrl.match(/\.(jpg|jpeg|png|gif|webp|bmp)$/i)) {
                            imageUrls.add(bgUrl);
                        }
                    } catch (error) {
                        console.error(`處理背景圖片失敗: ${match[1]}`, error.message);
                    }
                }
            }
        });

        const images = Array.from(imageUrls).filter(img => {
            // 過濾掉明顯不是圖片的URL
            return img && !img.includes('logo') && !img.includes('icon') && img.length < 500;
        });
        
        console.log(`找到 ${images.length} 張圖片`);
        
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
        console.error('錯誤堆疊:', error.stack);
        res.status(500).json({ 
            success: false,
            error: '獲取圖片失敗',
            message: error.message,
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
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