const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const path = require('path');
const tough = require('tough-cookie');
const { wrapper } = require('axios-cookiejar-support');

const app = express();
const port = process.env.PORT || 3000;

// 設定 cookie jar
const cookieJar = new tough.CookieJar();
const client = wrapper(axios.create({
    jar: cookieJar,
    withCredentials: true
}));

// 啟用 CORS，設定允許的來源
app.use(cors({
    origin: ['https://wanderer24-louis.github.io', 'http://localhost:3000', 'https://ptt-image-grabber.onrender.com'],
    methods: ['GET', 'POST', 'OPTIONS'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'Cookie'],
    exposedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400
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
        
        // 處理 PTT 請求
        if (url.includes('ptt.cc')) {
            try {
                // 設定重試次數和超時時間
                const maxRetries = 5;
                const timeout = 60000; // 增加到 60 秒
                let retryCount = 0;
                let response;

                // 先訪問 PTT 首頁獲取必要的 cookie
                console.log('訪問 PTT 首頁獲取 cookie...');
                await client.get('https://www.ptt.cc', {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                        'Accept-Language': 'zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7',
                        'Accept-Encoding': 'gzip, deflate, br',
                        'Connection': 'keep-alive',
                        'Upgrade-Insecure-Requests': '1',
                        'Cache-Control': 'no-cache',
                        'Pragma': 'no-cache',
                        'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
                        'Sec-Ch-Ua-Mobile': '?0',
                        'Sec-Ch-Ua-Platform': '"Windows"',
                        'Sec-Fetch-Dest': 'document',
                        'Sec-Fetch-Mode': 'navigate',
                        'Sec-Fetch-Site': 'none',
                        'Sec-Fetch-User': '?1',
                        'DNT': '1'
                    },
                    timeout: timeout
                });

                // 設定 over18 cookie
                await cookieJar.setCookie(
                    'over18=1; Path=/; Domain=.ptt.cc; Secure; HttpOnly',
                    'https://www.ptt.cc'
                );

                // 等待更長時間，模擬真實用戶行為
                await new Promise(resolve => setTimeout(resolve, 15000));

                // 定義不同的 User-Agent
                const userAgents = [
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edge/120.0.0.0 Safari/537.36',
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/115.0',
                    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Safari/605.1.15',
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
                ];

                while (retryCount < maxRetries) {
                    try {
                        console.log(`嘗試第 ${retryCount + 1} 次請求`);
                        
                        // 使用不同的 User-Agent
                        const currentUserAgent = userAgents[retryCount % userAgents.length];
                        console.log('使用 User-Agent:', currentUserAgent);

                        // 1. 先發送 HEAD 請求
                        try {
                            await client.head(url, {
                                headers: {
                                    'User-Agent': currentUserAgent,
                                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                                    'Accept-Language': 'zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7',
                                    'Accept-Encoding': 'gzip, deflate, br',
                                    'Connection': 'keep-alive',
                                    'Upgrade-Insecure-Requests': '1',
                                    'Cache-Control': 'no-cache',
                                    'Pragma': 'no-cache',
                                    'Referer': 'https://www.ptt.cc/',
                                    'Origin': 'https://www.ptt.cc',
                                    'Cookie': 'over18=1',
                                    'DNT': '1',
                                    'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
                                    'Sec-Ch-Ua-Mobile': '?0',
                                    'Sec-Ch-Ua-Platform': '"Windows"',
                                    'Sec-Fetch-Dest': 'document',
                                    'Sec-Fetch-Mode': 'navigate',
                                    'Sec-Fetch-Site': 'same-origin',
                                    'Sec-Fetch-User': '?1'
                                },
                                timeout: timeout,
                                maxRedirects: 5
                            });
                        } catch (error) {
                            console.log('HEAD 請求失敗，繼續嘗試 GET 請求');
                        }

                        // 等待更長時間
                        await new Promise(resolve => setTimeout(resolve, 10000));

                        // 2. 發送 GET 請求
                        response = await client.get(url, {
                            headers: {
                                'User-Agent': currentUserAgent,
                                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                                'Accept-Language': 'zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7',
                                'Accept-Encoding': 'gzip, deflate, br',
                                'Connection': 'keep-alive',
                                'Upgrade-Insecure-Requests': '1',
                                'Cache-Control': 'no-cache',
                                'Pragma': 'no-cache',
                                'Referer': 'https://www.ptt.cc/',
                                'Origin': 'https://www.ptt.cc',
                                'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
                                'Sec-Ch-Ua-Mobile': '?0',
                                'Sec-Ch-Ua-Platform': '"Windows"',
                                'Sec-Fetch-Dest': 'document',
                                'Sec-Fetch-Mode': 'navigate',
                                'Sec-Fetch-Site': 'same-origin',
                                'Sec-Fetch-User': '?1',
                                'Cookie': 'over18=1',
                                'DNT': '1'
                            },
                            timeout: timeout,
                            maxRedirects: 5,
                            validateStatus: function (status) {
                                return status >= 200 && status < 500;
                            }
                        });

                        console.log('網頁回應狀態碼:', response.status);
                        console.log('回應標頭:', response.headers);

                        // 檢查是否被 Cloudflare 阻擋
                        if (response.data.includes('Just a moment...') || 
                            response.data.includes('Enable JavaScript and cookies to continue') ||
                            response.data.includes('Checking your browser') ||
                            response.data.includes('Please wait while we verify')) {
                            console.log('被 Cloudflare 阻擋，等待後重試...');
                            retryCount++;
                            if (retryCount < maxRetries) {
                                // 等待更長時間
                                await new Promise(resolve => setTimeout(resolve, 30000 * (retryCount + 1)));
                                continue;
                            } else {
                                throw new Error('被 Cloudflare 阻擋，請稍後再試');
                            }
                        }

                        // 如果請求成功，跳出重試迴圈
                        if (response.status === 200) {
                            break;
                        }

                        // 如果遇到特定錯誤，直接拋出錯誤
                        if (response.status === 404) {
                            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                        }

                        // 其他錯誤，等待後重試
                        retryCount++;
                        if (retryCount < maxRetries) {
                            console.log(`等待 30 秒後重試...`);
                            await new Promise(resolve => setTimeout(resolve, 30000));
                        }
                    } catch (error) {
                        console.error(`第 ${retryCount + 1} 次請求失敗:`, error.message);
                        retryCount++;
                        if (retryCount < maxRetries) {
                            console.log(`等待 30 秒後重試...`);
                            await new Promise(resolve => setTimeout(resolve, 30000));
                        } else {
                            throw error;
                        }
                    }
                }

                // 檢查是否被重定向到 18 禁確認頁面
                if (response.data.includes('您要繼續嗎？')) {
                    console.log('需要 18 禁確認');
                    
                    // 從回應中提取表單數據
                    const $ = cheerio.load(response.data);
                    const formAction = $('form').attr('action');
                    const formData = new URLSearchParams();
                    formData.append('from', url);
                    formData.append('yes', 'yes');

                    // 發送確認請求
                    const confirmResponse = await client.post(
                        'https://www.ptt.cc' + formAction,
                        formData.toString(),
                        {
                            headers: {
                                'Content-Type': 'application/x-www-form-urlencoded',
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                                'Accept-Language': 'zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7',
                                'Accept-Encoding': 'gzip, deflate, br',
                                'Connection': 'keep-alive',
                                'Upgrade-Insecure-Requests': '1',
                                'Cache-Control': 'no-cache',
                                'Pragma': 'no-cache',
                                'Referer': url,
                                'Origin': 'https://www.ptt.cc',
                                'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
                                'Sec-Ch-Ua-Mobile': '?0',
                                'Sec-Ch-Ua-Platform': '"Windows"',
                                'Sec-Fetch-Dest': 'document',
                                'Sec-Fetch-Mode': 'navigate',
                                'Sec-Fetch-Site': 'same-origin',
                                'Sec-Fetch-User': '?1',
                                'Cookie': 'over18=1'
                            },
                            timeout: timeout,
                            maxRedirects: 5
                        }
                    );
                    
                    if (confirmResponse.status === 200) {
                        response = confirmResponse;
                    }
                }

                // 檢查是否被重定向到登入頁面
                if (response.data.includes('請先登入') || response.data.includes('請輸入驗證碼')) {
                    console.log('需要登入或驗證碼');
                    return res.status(403).json({ 
                        error: 'PTT 需要登入或驗證碼，請稍後再試' 
                    });
                }

                // 檢查回應內容類型
                const contentType = response.headers['content-type'];
                if (contentType && contentType.includes('image/')) {
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

                const $ = cheerio.load(response.data);
                const images = new Set();

                // 處理文章內容
                const content = $('.bbs-screen.bbs-content').html() || '';
                console.log('文章內容:', content);

                // 搜尋所有圖片相關的連結
                const imagePatterns = [
                    /https?:\/\/[^\s<>"]+?\.(?:jpg|jpeg|gif|png)/gi,  // 直接圖片連結
                    /https?:\/\/[^\s<>"]+?imgur\.com\/[^\s<>"]+/gi,   // Imgur 連結
                    /https?:\/\/[^\s<>"]+?\.imgur\.com\/[^\s<>"]+/gi, // 其他 Imgur 子域名
                    /https?:\/\/[^\s<>"]+?\.(?:imgur|imgbb|flickr|photobucket)\.com\/[^\s<>"]+/gi,  // 其他圖片網站
                    /https?:\/\/[^\s<>"]+?\.(?:imgur|imgbb|flickr|photobucket)\.com\/[^\s<>"]+\.(?:jpg|jpeg|gif|png)/gi  // 帶副檔名的圖片網站連結
                ];

                // 處理文章內容中的純文字連結
                const textContent = $('.bbs-screen.bbs-content').text();
                console.log('文章純文字內容:', textContent);

                // 搜尋所有可能的連結
                const allLinks = textContent.match(/https?:\/\/[^\s<>"]+/g) || [];
                console.log('從純文字中找到的所有連結:', allLinks);

                // 處理所有找到的連結
                for (const link of allLinks) {
                    console.log('處理連結:', link);
                    
                    // 處理 imgur 連結
                    if (link.includes('imgur.com')) {
                        const imageUrl = await getImgurImage(link);
                        if (imageUrl) {
                            console.log('找到 imgur 圖片:', imageUrl);
                            images.add(imageUrl);
                        }
                    }
                    // 處理直接圖片連結
                    else if (link.match(/\.(jpg|jpeg|gif|png)$/i)) {
                        console.log('找到直接圖片連結:', link);
                        images.add(link);
                    }
                    // 處理其他可能的圖片連結
                    else if (link.match(/\.(imgur|imgbb|flickr|photobucket)\.com/i)) {
                        console.log('找到其他圖片網站連結:', link);
                        images.add(link);
                    }
                }

                // 處理所有圖片模式
                for (const pattern of imagePatterns) {
                    const matches = content.match(pattern) || [];
                    console.log(`使用模式 ${pattern} 找到的連結:`, matches);
                    
                    for (const link of matches) {
                        console.log('處理模式匹配的連結:', link);
                        if (link.includes('imgur.com')) {
                            const imageUrl = await getImgurImage(link);
                            if (imageUrl) {
                                console.log('找到 imgur 圖片:', imageUrl);
                                images.add(imageUrl);
                            }
                        } else {
                            console.log('找到直接圖片連結:', link);
                            images.add(link);
                        }
                    }
                }

                // 特別處理 Baseball 版的圖片
                if (url.includes('/Baseball/')) {
                    console.log('處理 Baseball 版文章');
                    
                    // 搜尋文章中的 imgur 連結
                    const imgurLinks = content.match(/https?:\/\/[^\s<>"]+?imgur\.com\/[^\s<>"]+/gi) || [];
                    console.log('Baseball 版找到的 imgur 連結:', imgurLinks);
                    
                    for (const link of imgurLinks) {
                        console.log('處理 Baseball 版 imgur 連結:', link);
                        const imageUrl = await getImgurImage(link);
                        if (imageUrl) {
                            console.log('找到 Baseball 版 imgur 圖片:', imageUrl);
                            images.add(imageUrl);
                        }
                    }

                    // 搜尋文章中的其他圖片連結
                    const otherImageLinks = content.match(/https?:\/\/[^\s<>"]+?\.(?:jpg|jpeg|gif|png)/gi) || [];
                    console.log('Baseball 版找到的其他圖片連結:', otherImageLinks);
                    
                    for (const link of otherImageLinks) {
                        console.log('處理 Baseball 版其他圖片連結:', link);
                        images.add(link);
                    }
                }

                console.log('找到的圖片數量:', images.size);
                console.log('找到的圖片:', Array.from(images));

                if (images.size === 0) {
                    console.log('未找到任何圖片，返回 404 錯誤');
                    return res.status(404).json({
                        error: '未找到任何圖片',
                        source: 'not_found'
                    });
                }

                return res.status(200).json({ 
                    images: Array.from(images),
                    source: 'found'
                });

            } catch (error) {
                console.error('處理 PTT 請求時發生錯誤:', error);
                if (error.response) {
                    console.error('錯誤回應狀態碼:', error.response.status);
                    console.error('錯誤回應標頭:', error.response.headers);
                    console.error('錯誤回應內容:', error.response.data);
                }
                return res.status(500).json({ 
                    error: `無法抓取圖片：${error.message}`,
                    details: error.stack
                });
            }
        } else {
            // 處理非 PTT 的請求
            try {
                console.log('處理一般網站請求:', url);
                const response = await client.get(url, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                        'Accept-Language': 'zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7',
                        'Accept-Encoding': 'gzip, deflate, br',
                        'Connection': 'keep-alive',
                        'Upgrade-Insecure-Requests': '1',
                        'Cache-Control': 'no-cache',
                        'Pragma': 'no-cache'
                    },
                    timeout: 30000,
                    maxRedirects: 5
                });

                // 檢查回應內容類型
                const contentType = response.headers['content-type'];
                if (contentType && contentType.includes('image/')) {
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

                const $ = cheerio.load(response.data);
                const images = new Set();

                // 處理所有圖片標籤
                $('img').each((i, elem) => {
                    const src = $(elem).attr('src');
                    const dataSrc = $(elem).attr('data-src');
                    const dataOriginal = $(elem).attr('data-original');
                    const dataLazySrc = $(elem).attr('data-lazy-src');
                    
                    if (src) {
                        const absoluteUrl = new URL(src, url).href;
                        console.log('找到圖片:', absoluteUrl);
                        images.add(absoluteUrl);
                    }
                    if (dataSrc) {
                        const absoluteUrl = new URL(dataSrc, url).href;
                        console.log('找到 data-src 圖片:', absoluteUrl);
                        images.add(absoluteUrl);
                    }
                    if (dataOriginal) {
                        const absoluteUrl = new URL(dataOriginal, url).href;
                        console.log('找到 data-original 圖片:', absoluteUrl);
                        images.add(absoluteUrl);
                    }
                    if (dataLazySrc) {
                        const absoluteUrl = new URL(dataLazySrc, url).href;
                        console.log('找到 data-lazy-src 圖片:', absoluteUrl);
                        images.add(absoluteUrl);
                    }
                });

                // 處理背景圖片
                $('[style*="background"]').each((i, elem) => {
                    const style = $(elem).attr('style');
                    const matches = style.match(/url\(['"]?([^'"()]+)['"]?\)/g);
                    if (matches) {
                        matches.forEach(match => {
                            const urlMatch = match.match(/url\(['"]?([^'"()]+)['"]?\)/);
                            if (urlMatch && urlMatch[1]) {
                                const absoluteUrl = new URL(urlMatch[1], url).href;
                                console.log('找到背景圖片:', absoluteUrl);
                                images.add(absoluteUrl);
                            }
                        });
                    }
                });

                // 處理 meta 標籤中的圖片
                $('meta[property="og:image"]').each((i, elem) => {
                    const content = $(elem).attr('content');
                    if (content) {
                        const absoluteUrl = new URL(content, url).href;
                        console.log('找到 meta 圖片:', absoluteUrl);
                        images.add(absoluteUrl);
                    }
                });

                // 處理連結中的圖片
                $('a').each((i, elem) => {
                    const href = $(elem).attr('href');
                    if (href && /\.(jpg|jpeg|png|gif|webp|avif)$/i.test(href)) {
                        const absoluteUrl = new URL(href, url).href;
                        console.log('找到連結圖片:', absoluteUrl);
                        images.add(absoluteUrl);
                    }
                });

                // 處理特定網站的圖片
                if (url.includes('imgur.com')) {
                    const imageUrl = await getImgurImage(url);
                    if (imageUrl) {
                        images.add(imageUrl);
                    }
                }

                // 過濾掉無效的圖片 URL
                const validImages = Array.from(images).filter(imgUrl => {
                    try {
                        const url = new URL(imgUrl);
                        return url.protocol.startsWith('http') && 
                               /\.(jpg|jpeg|png|gif|webp|avif)$/i.test(url.pathname);
                    } catch (e) {
                        return false;
                    }
                });

                console.log('找到的圖片數量:', validImages.length);
                console.log('找到的圖片:', validImages);

                if (validImages.length === 0) {
                    return res.status(404).json({
                        error: '未找到任何圖片',
                        source: 'not_found'
                    });
                }

                return res.status(200).json({ 
                    images: validImages,
                    source: 'found'
                });

            } catch (error) {
                console.error('處理一般網站請求時發生錯誤:', error);
                return res.status(500).json({ 
                    error: `無法抓取圖片：${error.message}`,
                    details: error.stack
                });
            }
        }

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