const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const path = require('path');

const app = express();
const port = 3000;

// 啟用 CORS
app.use(cors());

// 提供靜態檔案
app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
                return res.json({
                    images: [imageUrl],
                    source: 'direct'
                });
            }
        }

        console.log('開始抓取網頁:', url);
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });

        console.log('網頁回應狀態碼:', response.status);
        const $ = cheerio.load(response.data);
        const images = new Set(); // 使用 Set 來避免重複圖片

        // 專門處理 PTT 文章內容
        const mainContent = $('#main-content').text();
        console.log('PTT 文章內容長度:', mainContent.length);
        console.log('PTT 文章內容前 500 字:', mainContent.substring(0, 500));

        // 搜尋所有可能的 imgur 連結模式
        const imgurPatterns = [
            'i.imgur.com',
            'imgur.com',
            'https://i.imgur.com',
            'http://i.imgur.com',
            'https://imgur.com',
            'http://imgur.com'
        ];

        // 使用正則表達式搜尋所有可能的 imgur 連結
        const regexPatterns = [
            /https?:\/\/i\.imgur\.com\/[a-zA-Z0-9]+/g,
            /i\.imgur\.com\/[a-zA-Z0-9]+/g,
            /imgur\.com\/[a-zA-Z0-9]+/g,
            /\[img\](.*?)\[\/img\]/g,  // 搜尋 [img] 標籤
            /https?:\/\/imgur\.com\/[a-zA-Z0-9]+/g,
            /\[url=(.*?)\](.*?)\[\/url\]/g,  // 搜尋 [url] 標籤
            /\[url\](.*?)\[\/url\]/g,  // 搜尋 [url] 標籤（無參數）
            /https?:\/\/i\.imgur\.com\/[a-zA-Z0-9]+\.(jpg|jpeg|png|gif)/g,  // 帶副檔名的完整 URL
            /i\.imgur\.com\/[a-zA-Z0-9]+\.(jpg|jpeg|png|gif)/g  // 帶副檔名的相對 URL
        ];

        // 搜尋文章內容中的連結
        for (const regex of regexPatterns) {
            const matches = mainContent.match(regex);
            if (matches) {
                console.log('使用正則表達式', regex, '找到符合的連結:', matches);
                matches.forEach(match => {
                    // 如果是 [img] 標籤，提取其中的連結
                    if (match.startsWith('[img]')) {
                        match = match.replace('[img]', '').replace('[/img]', '');
                    }
                    // 如果是 [url] 標籤，提取其中的連結
                    else if (match.startsWith('[url=')) {
                        match = match.replace(/\[url=(.*?)\]/, '$1').replace('[/url]', '');
                    }
                    else if (match.startsWith('[url]')) {
                        match = match.replace('[url]', '').replace('[/url]', '');
                    }
                    
                    // 如果連結沒有 http 開頭，添加 https://
                    if (!match.startsWith('http')) {
                        match = 'https://' + match;
                    }
                    
                    console.log('處理連結:', match);
                    const imageUrl = getImgurImage(match);
                    if (imageUrl) {
                        images.add(imageUrl);
                    }
                });
            }
        }

        // 搜尋所有圖片標籤
        $('img').each((i, elem) => {
            const src = $(elem).attr('src');
            if (src) {
                console.log('找到圖片標籤:', src);
                for (const pattern of imgurPatterns) {
                    if (src.includes(pattern)) {
                        const imageUrl = getImgurImage(src);
                        if (imageUrl) {
                            images.add(imageUrl);
                        }
                    }
                }
            }
        });

        // 搜尋所有連結
        $('a').each((i, elem) => {
            const href = $(elem).attr('href');
            if (href) {
                console.log('找到連結標籤:', href);
                for (const pattern of imgurPatterns) {
                    if (href.includes(pattern)) {
                        const imageUrl = getImgurImage(href);
                        if (imageUrl) {
                            images.add(imageUrl);
                        }
                    }
                }
            }
        });

        // 搜尋所有文字節點
        $('*').contents().each(function() {
            if (this.type === 'text') {
                const text = $(this).text();
                if (text.includes('imgur.com')) {
                    console.log('找到包含 imgur 的文字節點:', text);
                    for (const regex of regexPatterns) {
                        const matches = text.match(regex);
                        if (matches) {
                            matches.forEach(match => {
                                if (!match.startsWith('http')) {
                                    match = 'https://' + match;
                                }
                                const imageUrl = getImgurImage(match);
                                if (imageUrl) {
                                    images.add(imageUrl);
                                }
                            });
                        }
                    }
                }
            }
        });

        // 使用 Map 來儲存唯一的圖片 URL，以圖片 ID 為鍵
        const uniqueImages = new Map();

        // 處理所有找到的圖片 URL
        for (const imageUrl of images) {
            const processedUrl = await getImgurImage(imageUrl);
            if (processedUrl) {
                // 提取圖片 ID
                const imageId = processedUrl.split('/').pop().split('.')[0];
                // 如果這個 ID 還沒有被處理過，就加入 Map
                if (!uniqueImages.has(imageId)) {
                    uniqueImages.set(imageId, processedUrl);
                }
            }
        }

        console.log('找到的圖片數量:', uniqueImages.size);
        console.log('找到的圖片:', Array.from(uniqueImages.values()));

        res.json({ 
            images: Array.from(uniqueImages.values()),
            source: uniqueImages.size > 0 ? 'found' : 'not_found'
        });

    } catch (error) {
        console.error('抓取圖片時發生錯誤:', error);
        res.status(500).json({ error: `無法抓取圖片：${error.message}` });
    }
});

app.listen(port, () => {
    console.log(`伺服器運行在 http://localhost:${port}`);
}); 