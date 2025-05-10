const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// 啟用 CORS，設定允許的來源
app.use(cors({
    origin: ['https://wanderer24-louis.github.io', 'http://localhost:3000'],
    methods: ['GET', 'POST'],
    credentials: true
}));

// 設定 JSON 解析
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 提供靜態檔案
app.use(express.static(path.join(__dirname, 'public')));

// 首頁路由
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 從 imgur 網頁獲取圖片
async function getImgurPageImage(imgurUrl) {
    try {
        console.log('處理 imgur 網頁連結:', imgurUrl);
        
        // 確保是 imgur.com 的連結
        if (!imgurUrl.includes('imgur.com')) {
            console.log('不是 imgur.com 連結');
            return null;
        }

        // 確保 URL 格式正確
        if (!imgurUrl.startsWith('http')) {
            imgurUrl = 'https://' + imgurUrl;
        }

        // 如果是直接的圖片連結，直接返回
        if (imgurUrl.includes('i.imgur.com')) {
            return imgurUrl;
        }

        // 抓取 imgur 網頁
        const response = await axios.get(imgurUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });

        const $ = cheerio.load(response.data);
        
        // 嘗試從 meta 標籤獲取圖片
        const metaImage = $('meta[property="og:image"]').attr('content');
        if (metaImage) {
            console.log('從 meta 標籤找到圖片:', metaImage);
            // 移除查詢參數
            return metaImage.split('?')[0];
        }

        // 嘗試從圖片標籤獲取
        const imgSrc = $('img.post-image').attr('src');
        if (imgSrc) {
            console.log('從圖片標籤找到圖片:', imgSrc);
            // 移除查詢參數
            return imgSrc.split('?')[0];
        }

        // 如果都找不到，返回原始連結
        console.log('無法從網頁提取圖片，返回原始連結');
        return imgurUrl;
    } catch (error) {
        console.error('處理 imgur 網頁時發生錯誤:', error);
        return null;
    }
}

// 從 i.imgur.com 連結獲取圖片
async function getImgurImage(imgurUrl) {
    try {
        // 如果輸入是 Promise，等待它解析
        if (imgurUrl instanceof Promise) {
            imgurUrl = await imgurUrl;
        }

        // 確保輸入是字串
        if (typeof imgurUrl !== 'string') {
            console.log('無效的圖片連結:', imgurUrl);
            return null;
        }

        console.log('處理連結:', imgurUrl);
        
        // 移除 @ 符號（如果存在）
        let imageUrl = imgurUrl.replace('@', '');
        
        // 確保是 imgur.com 的連結
        if (!imageUrl.includes('imgur.com')) {
            console.log('不是 imgur.com 連結');
            return null;
        }

        // 如果是 imgur 網頁連結，嘗試獲取實際圖片
        if (!imageUrl.includes('i.imgur.com')) {
            return await getImgurPageImage(imageUrl);
        }

        // 確保 URL 格式正確
        if (!imageUrl.startsWith('http')) {
            imageUrl = 'https://' + imageUrl;
        }

        // 移除 URL 中的查詢參數
        imageUrl = imageUrl.split('?')[0];

        // 提取圖片 ID（移除副檔名）
        const imageId = imageUrl.split('/').pop().split('.')[0];
        const baseUrl = 'https://i.imgur.com/' + imageId;

        // 如果 URL 已經包含副檔名，直接返回
        if (imageUrl.endsWith('.jpg') || imageUrl.endsWith('.jpeg') || 
            imageUrl.endsWith('.png') || imageUrl.endsWith('.gif')) {
            console.log('已有副檔名的圖片連結:', imageUrl);
            return baseUrl + imageUrl.substring(imageUrl.lastIndexOf('.'));
        }

        // 嘗試不同的副檔名
        const extensions = ['.jpg', '.jpeg', '.png', '.gif'];
        for (const ext of extensions) {
            const urlWithExt = baseUrl + ext;
            console.log('嘗試帶副檔名的連結:', urlWithExt);
            return urlWithExt;
        }
        
        console.log('處理後的圖片連結:', imageUrl);
        return imageUrl;
    } catch (error) {
        console.error('處理圖片連結時發生錯誤:', error);
        return null;
    }
}

// 抓取圖片 API
app.post('/fetch_images', async (req, res) => {
    const url = req.body.url;
    
    if (!url) {
        return res.status(400).json({ error: '請輸入網址' });
    }

    try {
        console.log('收到的 URL:', url);

        // 檢查是否為直接的 imgur 連結
        if (url.includes('imgur.com')) {
            console.log('檢測到 imgur 連結');
            const imageUrl = await getImgurImage(url);
            console.log('處理後的圖片 URL:', imageUrl);
            
            if (imageUrl) {
                return res.status(200).json({
                    images: [imageUrl],
                    source: 'direct'
                });
            }
        }

        console.log('開始抓取網頁:', url);
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
                'Cache-Control': 'max-age=0'
            },
            timeout: 10000, // 10 秒超時
            validateStatus: function (status) {
                return status >= 200 && status < 500; // 接受所有 2xx-4xx 的狀態碼
            }
        });

        console.log('網頁回應狀態碼:', response.status);
        
        // 檢查回應內容類型
        const contentType = response.headers['content-type'];
        if (contentType && contentType.includes('image/')) {
            // 直接回傳圖片連結
            return res.status(200).json({
                images: [url],
                source: 'direct-image'
            });
        }
        if (!contentType || !contentType.includes('text/html')) {
            console.log('非 HTML 回應:', contentType);
            return res.status(400).json({ 
                error: '無法解析網頁內容，請確認網址是否正確' 
            });
        }

        // 檢查是否被重定向到登入頁面
        if (response.data.includes('請先登入') || response.data.includes('請輸入驗證碼')) {
            console.log('需要登入或驗證碼');
            return res.status(403).json({ 
                error: 'PTT 需要登入或驗證碼，請稍後再試' 
            });
        }

        const $ = cheerio.load(response.data);
        const images = new Set(); // 使用 Set 來避免重複圖片

        // 特別處理 PTT 文章中的圖片
        if (url.includes('ptt.cc')) {
            console.log('處理 PTT 文章');
            
            // 1. 從文章內容中提取所有可能的圖片連結
            const content = $('.bbs-screen.bbs-content').html() || '';
            console.log('文章內容:', content);

            // 2. 搜尋所有圖片相關的連結
            const imagePatterns = [
                /https?:\/\/[^\s<>"]+?\.(?:jpg|jpeg|gif|png)/gi,  // 直接圖片連結
                /https?:\/\/[^\s<>"]+?imgur\.com\/[^\s<>"]+/gi,   // Imgur 連結
                /https?:\/\/[^\s<>"]+?\.imgur\.com\/[^\s<>"]+/gi, // 其他 Imgur 子域名
                /https?:\/\/[^\s<>"]+?\.(?:imgur|imgbb|flickr|photobucket)\.com\/[^\s<>"]+/gi,  // 其他圖片網站
                /https?:\/\/[^\s<>"]+?\.(?:imgur|imgbb|flickr|photobucket)\.com\/[^\s<>"]+\.(?:jpg|jpeg|gif|png)/gi  // 帶副檔名的圖片網站連結
            ];

            // 3. 處理文章內容中的純文字連結
            const textContent = $('.bbs-screen.bbs-content').text();
            const textLinks = textContent.match(/https?:\/\/[^\s<>"]+/g) || [];
            console.log('從純文字中找到的連結:', textLinks);

            for (const link of textLinks) {
                if (link.includes('imgur.com')) {
                    const imageUrl = await getImgurImage(link);
                    if (imageUrl) {
                        images.add(imageUrl);
                    }
                } else if (link.match(/\.(jpg|jpeg|gif|png)$/i)) {
                    images.add(link);
                }
            }

            // 4. 處理所有圖片模式
            for (const pattern of imagePatterns) {
                const matches = content.match(pattern) || [];
                console.log(`使用模式 ${pattern} 找到的連結:`, matches);
                
                for (const link of matches) {
                    if (link.includes('imgur.com')) {
                        const imageUrl = await getImgurImage(link);
                        if (imageUrl) {
                            images.add(imageUrl);
                        }
                    } else {
                        images.add(link);
                    }
                }
            }

            // 5. 搜尋文章中的圖片標籤
            $('.bbs-screen.bbs-content img').each((i, elem) => {
                const src = $(elem).attr('src');
                if (src) {
                    console.log('找到文章中的圖片標籤:', src);
                    try {
                        const absoluteUrl = new URL(src, url).href;
                        images.add(absoluteUrl);
                    } catch (error) {
                        console.error('處理圖片 URL 時發生錯誤:', error);
                    }
                }
            });

            // 6. 搜尋文章中的連結標籤
            $('.bbs-screen.bbs-content a').each((i, elem) => {
                const href = $(elem).attr('href');
                if (href) {
                    console.log('找到文章中的連結:', href);
                    if (href.includes('imgur.com')) {
                        const imageUrl = getImgurImage(href);
                        if (imageUrl) {
                            images.add(imageUrl);
                        }
                    } else if (href.match(/\.(jpg|jpeg|gif|png)$/i)) {
                        try {
                            const absoluteUrl = new URL(href, url).href;
                            images.add(absoluteUrl);
                        } catch (error) {
                            console.error('處理圖片 URL 時發生錯誤:', error);
                        }
                    }
                }
            });

            // 7. 處理文章中的純文字 Imgur ID
            const imgurIdPattern = /imgur\.com\/([a-zA-Z0-9]+)/g;
            let match;
            while ((match = imgurIdPattern.exec(textContent)) !== null) {
                const imgurId = match[1];
                const imgurUrl = `https://imgur.com/${imgurId}`;
                console.log('找到 Imgur ID:', imgurId);
                const imageUrl = await getImgurImage(imgurUrl);
                if (imageUrl) {
                    images.add(imageUrl);
                }
            }
        }

        console.log('找到的圖片數量:', images.size);
        console.log('找到的圖片:', Array.from(images));

        // 確保回應是有效的 JSON
        res.setHeader('Content-Type', 'application/json');
        return res.status(200).json({ 
            images: Array.from(images),
            source: images.size > 0 ? 'found' : 'not_found'
        });

    } catch (error) {
        console.error('抓取圖片時發生錯誤:', error);
        return res.status(500).json({ 
            error: `無法抓取圖片：${error.message}`,
            details: error.stack
        });
    }
});

// 錯誤處理中間件
app.use((err, req, res, next) => {
    console.error('伺服器錯誤:', err);
    res.status(500).json({
        error: '伺服器內部錯誤',
        message: err.message
    });
});

// 處理 404 錯誤
app.use((req, res) => {
    res.status(404).json({
        error: '找不到請求的資源'
    });
});

app.listen(port, () => {
    console.log(`伺服器運行在 http://localhost:${port}`);
}); 