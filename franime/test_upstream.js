const axios = require('axios');
const https = require('https');

async function test(url) {
    try {
        const agent = new https.Agent({ rejectUnauthorized: false });
        const res = await axios.get(url, { httpsAgent: agent, headers: { 'User-Agent': 'Mozilla/5.0' } });
        console.log("SUCCESS for", url);
        const m = res.data.match(/file:\s*["']([^"']+m3u8[^"']*)["']/i) || res.data.match(/src:\s*["']([^"']+\.mp4)["']/i) || res.data.match(/sources:\s*\[({.*?})\]/);
        if (m) console.log("FOUND ->", m[1]);
        else {
            console.log("NO MATCH");
            const m3u8s = res.data.match(/(https?:\/\/[^\s"']+\.m3u8[^\s"']*)/g);
            if (m3u8s) console.log("M3U8 URLs:", m3u8s);
        }
    } catch(e) { console.log("ERR", url, e.message); }
}

test('https://upstream.to/embed-7etemkrxpfa1.html');
test('https://lvturbo.com/e/ztz5974ylnmd.html');
test('https://vvide0.com/e/5nsxs5tm6y8t');
