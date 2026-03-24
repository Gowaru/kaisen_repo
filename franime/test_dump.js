const axios = require('axios');
const https = require('https');
async function test(url) {
    try {
        const agent = new https.Agent({ rejectUnauthorized: false });
        const res = await axios.get(url, { httpsAgent: agent, headers: { 'User-Agent': 'Mozilla/5.0' } });
        console.log("=== " + url + " ===");
        console.log(res.data.substring(0, 1000));
        const matches = res.data.match(/({.*?file.*?})/g) || [];
        console.log("Matches:", matches.slice(0, 2));
    } catch(e) {}
}
test('https://lvturbo.com/e/ztz5974ylnmd.html');
