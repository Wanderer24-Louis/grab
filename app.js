const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const path = require('path');
const tough = require('tough-cookie');
const { wrapper } = require('axios-cookiejar-support');
const HttpsProxyAgent = require('https-proxy-agent');

const app = express();
const port = process.env.PORT || 3000;

// 代理列表
let proxyList = [];
let lastProxyUpdate = 0;
const PROXY_UPDATE_INTERVAL = 30 * 60 * 1000; // 30 分鐘更新一次

// 獲取免費代理列表
async function updateProxyList() {
    try {
        console.log('開始更新代理列表...');
        const proxySources = [
            'https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/http.txt',
            'https://raw.githubusercontent.com/ShiftyTR/Proxy-List/master/http.txt',
            'https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/http.txt'
        ];

        let newProxies = [];
        for (const source of proxySources) {
            try {
                const response = await axios.get(source, { timeout: 10000 });
                const proxies = response.data.split('\n')
                    .map(line => line.trim())
                    .filter(line => line && !line.startsWith('#'));
                newProxies = newProxies.concat(proxies);
            } catch (error) {
                console.error(`從 ${source} 獲取代理失敗:`, error.message);
            }
        }

        // 驗證代理
        const validProxies = [];
        for (const proxy of newProxies) {
            try {
                const httpsAgent = new HttpsProxyAgent(`http://${proxy}`);
                await axios.get('https://www.ptt.cc', {
                    httpsAgent,
                    timeout: 5000,
                    validateStatus: () => true
                });
                validProxies.push(`http://${proxy}`);
                console.log(`代理 ${proxy} 驗證成功`);
            } catch (error) {
                console.log(`代理 ${proxy} 驗證失敗`);
            }
        }

        proxyList = validProxies;
        lastProxyUpdate = Date.now();
        console.log(`代理列表更新完成，共 ${proxyList.length} 個有效代理`);
    } catch (error) {
        console.error('更新代理列表時發生錯誤:', error);
    }
}

// 獲取隨機代理
function getRandomProxy() {
    if (proxyList.length === 0) {
        return null;
    }
    return proxyList[Math.floor(Math.random() * proxyList.length)];
}

// 定期更新代理列表
setInterval(updateProxyList, PROXY_UPDATE_INTERVAL);
updateProxyList(); // 立即執行一次

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

// 設定請求標頭
const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
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
  'Cookie': 'over18=1'
};

// 隨機延遲函數
const randomDelay = (min, max) => {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise(resolve => setTimeout(resolve, delay));
};

// 修改 getImgurPageImage 函數
async function getImgurPageImage(url) {
  try {
    // 先訪問主頁面
    await randomDelay(2000, 5000);
    const response = await axios.get(url, {
      headers,
      timeout: 30000,
      maxRedirects: 5,
      validateStatus: function (status) {
        return status >= 200 && status < 400;
      }
    });

    // 檢查是否被 Cloudflare 阻擋
    if (response.data.includes('cf-browser-verification') || 
        response.data.includes('challenge-platform') ||
        response.data.includes('cf_chl_prog')) {
      console.log('檢測到 Cloudflare 保護，等待重試...');
      await randomDelay(10000, 15000);
      throw new Error('Cloudflare 保護');
    }

    // 解析頁面內容
    const $ = cheerio.load(response.data);
    const imageUrl = $('meta[property="og:image"]').attr('content');
    
    if (!imageUrl) {
      throw new Error('找不到圖片 URL');
    }

    return imageUrl;
    } catch (error) {
    console.error('獲取 Imgur 圖片失敗:', error.message);
    throw error;
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

// 修改 /fetch_images 路由
app.post('/fetch_images', async (req, res) => {
  const { url } = req.body;
    if (!url) {
    return res.status(400).json({ error: '請提供 URL' });
    }

    try {
    // 先訪問主頁面
    await randomDelay(2000, 5000);
        const response = await axios.get(url, {
      headers,
      timeout: 30000,
      maxRedirects: 5,
            validateStatus: function (status) {
        return status >= 200 && status < 400;
      }
    });

    // 檢查是否被 Cloudflare 阻擋
    if (response.data.includes('cf-browser-verification') || 
        response.data.includes('challenge-platform') ||
        response.data.includes('cf_chl_prog')) {
      console.log('檢測到 Cloudflare 保護，等待重試...');
      await randomDelay(10000, 15000);
      throw new Error('Cloudflare 保護');
    }

    // 解析頁面內容
        const $ = cheerio.load(response.data);
    const imageUrls = [];

    // 處理不同類型的圖片
    $('a[href*="imgur.com"]').each((i, element) => {
      const href = $(element).attr('href');
      if (href && !href.includes('/a/')) {
        imageUrls.push(href);
      }
    });

    // 處理其他圖片來源
    $('img').each((i, element) => {
      const src = $(element).attr('src');
      if (src && (src.startsWith('http') || src.startsWith('//'))) {
        imageUrls.push(src);
      }
    });

    // 去重並過濾無效 URL
    const uniqueUrls = [...new Set(imageUrls)].filter(url => 
      url && (url.startsWith('http') || url.startsWith('//'))
    );

    // 處理每個圖片 URL
    const results = [];
    for (const imageUrl of uniqueUrls) {
      try {
        await randomDelay(1000, 3000);
        const processedUrl = await processImageUrl(imageUrl);
        if (processedUrl) {
          results.push(processedUrl);
        }
      } catch (error) {
        console.error(`處理圖片 URL 失敗: ${imageUrl}`, error.message);
      }
    }

    res.json({ images: results });
  } catch (error) {
    console.error('獲取圖片失敗:', error.message);
    res.status(500).json({ error: '獲取圖片失敗: ' + error.message });
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