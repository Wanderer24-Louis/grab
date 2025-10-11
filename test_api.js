const axios = require('axios');

// 測試API密鑰
const API_KEY = 'IOnREPkNgH5O3QkuJyTZo2UujCdPDLlOfiSQZeY57B';
const BASE_URL = 'http://localhost:10000';

async function testApiKey() {
    console.log('🔑 測試API密鑰功能...\n');
    
    try {
        // 測試1: 健康檢查（不需要API密鑰）
        console.log('1. 測試健康檢查端點...');
        const healthResponse = await axios.get(`${BASE_URL}/health`);
        console.log('✅ 健康檢查成功:', healthResponse.data);
        console.log('');
        
        // 測試2: 不提供API密鑰的請求（應該失敗）
        console.log('2. 測試不提供API密鑰的請求...');
        try {
            await axios.post(`${BASE_URL}/fetch_images`, {
                url: 'https://example.com'
            });
            console.log('❌ 應該失敗但成功了');
        } catch (error) {
            if (error.response && error.response.status === 401) {
                console.log('✅ 正確拒絕了沒有API密鑰的請求');
            } else {
                console.log('❌ 錯誤類型不正確:', error.response?.data);
            }
        }
        console.log('');
        
        // 測試3: 提供錯誤的API密鑰（應該失敗）
        console.log('3. 測試錯誤的API密鑰...');
        try {
            await axios.post(`${BASE_URL}/fetch_images`, {
                url: 'https://example.com',
                apiKey: 'wrong_key'
            }, {
                headers: {
                    'X-API-Key': 'wrong_key'
                }
            });
            console.log('❌ 應該失敗但成功了');
        } catch (error) {
            if (error.response && error.response.status === 403) {
                console.log('✅ 正確拒絕了錯誤的API密鑰');
            } else {
                console.log('❌ 錯誤類型不正確:', error.response?.data);
            }
        }
        console.log('');
        
        // 測試4: 提供正確的API密鑰（應該成功）
        console.log('4. 測試正確的API密鑰...');
        try {
            const response = await axios.post(`${BASE_URL}/fetch_images`, {
                url: 'https://example.com',
                apiKey: API_KEY
            }, {
                headers: {
                    'X-API-Key': API_KEY
                }
            });
            console.log('✅ API密鑰驗證成功');
            console.log('📊 回應數據:', response.data);
        } catch (error) {
            if (error.response) {
                console.log('📊 回應狀態:', error.response.status);
                console.log('📊 回應數據:', error.response.data);
            } else {
                console.log('❌ 請求失敗:', error.message);
            }
        }
        
    } catch (error) {
        console.error('❌ 測試失敗:', error.message);
    }
}

// 如果直接運行此腳本
if (require.main === module) {
    testApiKey();
}

module.exports = { testApiKey };
