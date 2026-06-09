// @ts-nocheck
import { MixDrop, StreamTape, Voe, Filemoon, DoodExtractor, HubCloud } from 'skystream-extractors/dist/index.js';

function encodeBase64(str) {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
    let output = "";
    let i = 0;
    str = encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, function (match, p1) {
        return String.fromCharCode('0x' + p1);
    });
    while (i < str.length) {
        let chr1 = str.charCodeAt(i++);
        let chr2 = i < str.length ? str.charCodeAt(i++) : Number.NaN;
        let chr3 = i < str.length ? str.charCodeAt(i++) : Number.NaN;
        let enc1 = chr1 >> 2;
        let enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
        let enc3 = ((chr2 & 15) << 2) | (chr3 >> 6);
        let enc4 = chr3 & 63;
        if (isNaN(chr2)) enc3 = enc4 = 64;
        else if (isNaN(chr3)) enc4 = 64;
        output += chars.charAt(enc1) + chars.charAt(enc2) + chars.charAt(enc3) + chars.charAt(enc4);
    }
    return output;
}

const axios = {
    get: async (url, config = {}) => {
        const h = config.headers || {};
        if (typeof http_get !== 'undefined') {
            let r;
            try {
                r = await http_get(url, h);
            } catch (e) {
                r = { status: 403, body: 'cloudflare' };
            }
            if (r.status === 403 || r.status === 503 || (typeof r.body === 'string' && (r.body.includes('Just a moment') || r.body.toLowerCase().includes('cloudflare') || r.body.includes('Challenge Validation')))) {
                if (typeof solveCaptcha !== 'undefined') {
                    await solveCaptcha('cloudflare', url);
                    try {
                        r = await http_get(url, h);
                    } catch (e) {
                        r = { status: 500, body: "" };
                    }
                }
            }
            let parsed = r.body;
            try { parsed = JSON.parse(r.body); } catch (e) { }
            return { data: parsed, status: r.status };
        }
        return { data: "" };
    },
    post: async (url, data, config = {}) => {
        const h = config.headers || {};
        if (typeof http_post !== 'undefined') {
            let r;
            try {
                r = await http_post(url, h, typeof data === 'string' ? data : JSON.stringify(data));
            } catch (e) {
                r = { status: 403, body: 'cloudflare' };
            }
            if (r.status === 403 || r.status === 503 || (typeof r.body === 'string' && (r.body.includes('Just a moment') || r.body.toLowerCase().includes('cloudflare') || r.body.includes('Challenge Validation')))) {
                if (typeof solveCaptcha !== 'undefined') {
                    await solveCaptcha('cloudflare', url);
                    try {
                        r = await http_post(url, h, typeof data === 'string' ? data : JSON.stringify(data));
                    } catch (e) {
                        r = { status: 500, body: "" };
                    }
                }
            }
            let parsed = r.body;
            try { parsed = JSON.parse(r.body); } catch (e) { }
            return { data: parsed, status: r.status };
        }
        return { data: "" };
    }
};

const PLUGIN_ID = 'animevostfr';
function log(msg, data) { try { console.log(`[${PLUGIN_ID}] ${msg}`, data || ''); } catch (_) { } }

const baseUrl = (typeof manifest !== 'undefined' && manifest.baseUrl) ? manifest.baseUrl : 'https://animevostfr.org';
const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
    'Referer': baseUrl,
    'Origin': baseUrl
};

const Extractors = {
    async resolveStream(url) {
        if (!url) return null;

        // 1. Try SkyStream built-in loadExtractor first
        if (typeof loadExtractor !== 'undefined') {
            try {
                const streams = await loadExtractor(url);
                if (streams && streams.length > 0) return streams[0];
            } catch (e) { }
        }

        // 2. Bundled skystream-extractors library
        try {
            let extracted = [];
            if (url.includes('mixdrop')) extracted = await new MixDrop().getUrl(url);
            else if (url.includes('streamtape')) extracted = await new StreamTape().getUrl(url);
            else if (url.includes('voe')) extracted = await new Voe().getUrl(url);
            else if (url.includes('filemoon')) extracted = await new Filemoon().getUrl(url);
            else if (url.includes('dood')) extracted = await new DoodExtractor().getUrl(url);
            else if (url.includes('hubcloud') || url.includes('hd-runtv')) extracted = await new HubCloud().getUrl(url);
            if (extracted && extracted.length > 0) return extracted[0];
        } catch (e) { log('Extractor failed: ' + url, e); }

        // --- Sibnet ---
        if (url.includes('sibnet.ru')) {
            try {
                const res = await axios.get(url, { headers: { 'Referer': url } });
                if (typeof res.data === 'string') {
                    const match = res.data.match(/player\.src\(\[\{src:\s*["']([^"']+)["']/i) ||
                        res.data.match(/src:\s*["'](\/v\/.*?\.mp4)["']/i) ||
                        res.data.match(/["']?src["']?\s*:\s*["']([^"']+\.mp4)["']/i);
                    if (match) {
                        let vUrl = match[1];
                        if (vUrl.startsWith('//')) vUrl = 'https:' + vUrl;
                        else if (vUrl.startsWith('/')) vUrl = 'https://video.sibnet.ru' + vUrl;
                        return new StreamResult({ url: "MAGIC_PROXY_v1" + encodeBase64(vUrl), quality: 'Auto', source: 'Sibnet', headers: { 'Referer': url } });
                    }
                }
            } catch (e) { log('Sibnet extraction failed', e); }
        }

        // --- Sendvid ---
        if (url.includes('sendvid.com')) {
            try {
                const res = await axios.get(url, { headers: { 'Referer': baseUrl } });
                if (typeof res.data === 'string') {
                    const match = res.data.match(/<source\s+src=["']([^"']+\.mp4)["']/i) ||
                        res.data.match(/video_source\s*=\s*["']([^"']+)["']/i) ||
                        res.data.match(/file\s*:\s*["']([^"']+)["']/i);
                    if (match) {
                        let vUrl = match[1];
                        if (vUrl.startsWith('//')) vUrl = 'https:' + vUrl;
                        return new StreamResult({ url: "MAGIC_PROXY_v1" + encodeBase64(vUrl), quality: 'Auto', source: 'Sendvid', headers: { 'Referer': url } });
                    }
                }
            } catch (e) { log('Sendvid extraction failed', e); }
        }

        // --- Vidmoly ---
        if (url.includes('vidmoly')) {
            try {
                let vidmolyUrl = url.replace(/vidmoly\.to/g, 'vidmoly.net');
                const vmHeaders = { 'Referer': baseUrl, 'Sec-Fetch-Dest': 'iframe', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0' };
                let res = await axios.get(vidmolyUrl, { headers: vmHeaders });
                let html = typeof res.data === 'string' ? res.data : '';
                if (typeof getAndUnpack !== 'undefined' && html.includes('eval(function(p,a,c,k')) {
                    try { const u = getAndUnpack(html); if (u) html += '\n' + u; } catch (e) { }
                }
                const fileMatch = html.match(/sources\s*:\s*\[\s*\{\s*file\s*:\s*["']([^"']+)["']/i) ||
                    html.match(/file\s*:\s*["']([^"']+\.m3u8[^"']*)["']/i) ||
                    html.match(/file\s*:\s*["']([^"']+\.mp4[^"']*)["']/i) ||
                    html.match(/<source\s+src=["']([^"']+)["']/i);
                if (fileMatch) {
                    let videoUrl = fileMatch[1];
                    if (videoUrl.startsWith('//')) videoUrl = 'https:' + videoUrl;
                    return new StreamResult({ url: "MAGIC_PROXY_v1" + encodeBase64(videoUrl), quality: 'Auto', source: 'Vidmoly', headers: { 'Referer': vidmolyUrl } });
                }
                if (url.includes('vidmoly.to') && !html.includes('sources')) {
                    res = await axios.get(url, { headers: vmHeaders });
                    html = typeof res.data === 'string' ? res.data : '';
                    if (typeof getAndUnpack !== 'undefined' && html.includes('eval(function(p,a,c,k')) { try { html += '\n' + getAndUnpack(html); } catch (e) { } }
                    const fm = html.match(/sources\s*:\s*\[\s*\{\s*file\s*:\s*['"]([^'"]+)['"]/i) || html.match(/file\s*:\s*['"]([^'"]+)['"]/i);
                    if (fm) { let v = fm[1]; if (v.startsWith('//')) v = 'https:' + v; return new StreamResult({ url: "MAGIC_PROXY_v1" + encodeBase64(v), quality: 'Auto', source: 'Vidmoly', headers: { 'Referer': url } }); }
                }
            } catch (e) { }
            let proxyUrl = url.replace('vidmoly.to', 'vidmoly.net');
            return new StreamResult({ url: "MAGIC_PROXY_v1" + encodeBase64(proxyUrl), quality: 'Auto', source: 'Vidmoly', headers: { 'Referer': baseUrl } });
        }

        // --- Minochinos / Vidhide ---
        if (url.includes('minochinos') || url.includes('vidhide') || url.includes('vidhidepre')) {
            try {
                const res = await axios.get(url, { headers: { 'Referer': baseUrl } });
                let html = typeof res.data === 'string' ? res.data : '';
                if (typeof getAndUnpack !== 'undefined' && html.includes('eval(function(p,a,c,k')) { try { const u = getAndUnpack(html); if (u) html += '\n' + u; } catch (e) { } }
                const fm = html.match(/file\s*:\s*"(https?:\/\/[^"]+)"/i) || html.match(/sources\s*:\s*\[\{[^}]*file\s*:\s*"(https?:\/\/[^"]+)"/i) || html.match(/<source\s+src=["'](https?:\/\/[^"']+)["']/i);
                if (fm) return new StreamResult({ url: "MAGIC_PROXY_v1" + encodeBase64(fm[1]), quality: 'Auto', source: 'Minochinos', headers: { 'Referer': url } });
            } catch (e) { }
            return new StreamResult({ url: "MAGIC_PROXY_v1" + encodeBase64(url), quality: 'Auto', source: 'Minochinos', headers: { 'Referer': baseUrl } });
        }

        // --- Myvi.ru ---
        if (url.includes('myvi.ru')) {
            try {
                const res = await axios.get(url, { headers: { 'Referer': baseUrl } });
                let html = typeof res.data === 'string' ? res.data : '';
                const vidMatch = html.match(/videoUrl["']?\s*:\s*["'](https?:\/\/[^"']+\.mp4[^"']*)["']/i) ||
                    html.match(/src["']?\s*:\s*["'](https?:\/\/[^"']+\.mp4[^"']*)["']/i) ||
                    html.match(/file["']?\s*:\s*["'](https?:\/\/[^"']+\.mp4[^"']*)["']/i);
                if (vidMatch) {
                    return new StreamResult({ url: "MAGIC_PROXY_v1" + encodeBase64(vidMatch[1]), quality: 'Auto', source: 'Myvi', headers: { 'Referer': url } });
                }
            } catch (e) { }
            return new StreamResult({ url: "MAGIC_PROXY_v1" + encodeBase64(url), quality: 'Auto', source: 'Myvi', headers: { 'Referer': baseUrl } });
        }

        // --- Uqload ---
        if (url.includes('uqload')) {
            try {
                const res = await axios.get(url, { headers: { 'Referer': baseUrl } });
                if (typeof res.data === 'string') {
                    const match = res.data.match(/sources:\s*\["([^"]+)"\]/i) ||
                        res.data.match(/sources\s*:\s*\[["']([^"']+)["']\]/i) ||
                        res.data.match(/file:"([^"]+)"/i) ||
                        res.data.match(/<source\s+src=["']([^"']+)["']/i);
                    if (match) {
                        let videoUrl = match[1];
                        if (videoUrl.startsWith('//')) videoUrl = 'https:' + videoUrl;
                        return new StreamResult({ url: "MAGIC_PROXY_v1" + encodeBase64(videoUrl), quality: 'Auto', source: 'Uqload', headers: { 'Referer': url } });
                    }
                }
            } catch (e) { }
            return new StreamResult({ url: "MAGIC_PROXY_v1" + encodeBase64(url), quality: 'Auto', source: 'Uqload', headers: { 'Referer': baseUrl } });
        }

        // --- Verystream ---
        if (url.includes('verystream')) {
            try {
                const res = await axios.get(url, { headers: { 'Referer': baseUrl } });
                if (typeof res.data === 'string') {
                    const match = res.data.match(/file\s*:\s*["']([^"']+)["']/i) ||
                        res.data.match(/src\s*:\s*["']([^"']+)["']/i) ||
                        res.data.match(/<source\s+src=["']([^"']+)["']/i) ||
                        res.data.match(/<video[^>]+src=["']([^"']+)["']/i) ||
                        res.data.match(/href=["']([^"']+\/get\/[^"']+)["'][^>]*>Direct/i) ||
                        res.data.match(/"url":\s*"([^"]+)"/i);
                    if (match) {
                        let videoUrl = match[1];
                        videoUrl = videoUrl.replace(/&amp;/g, '&');
                        if (videoUrl.startsWith('//')) videoUrl = 'https:' + videoUrl;
                        return new StreamResult({ url: "MAGIC_PROXY_v1" + encodeBase64(videoUrl), quality: 'Auto', source: 'Verystream', headers: { 'Referer': url } });
                    }
                }
            } catch (e) { }
            return new StreamResult({ url: "MAGIC_PROXY_v1" + encodeBase64(url), quality: 'Auto', source: 'Verystream', headers: { 'Referer': baseUrl } });
        }        // --- Embed4Me / Lplayer ---
        if (url.includes('embed4me') || url.includes('lpayer')) {
            return new StreamResult({
                url: "MAGIC_PROXY_v1" + encodeBase64(url),
                quality: 'Auto',
                source: 'Embed4Me',
                headers: { 'Referer': baseUrl }
            });
        }

        // --- YourUpload / VidGuard ---
        if (url.includes('yourupload') || url.includes('vidguard') || url.includes('vgfplay')) {
            try {
                const res = await axios.get(url, { headers: { 'Referer': baseUrl } });
                let html = typeof res.data === 'string' ? res.data : '';
                if (typeof getAndUnpack !== 'undefined' && html.includes('eval(function(p,a,c,k')) {
                    try { const u = getAndUnpack(html); if (u) html += '\n' + u; } catch (e) { }
                }
                const fm = html.match(/file\s*:\s*"([^"]+)"/i) ||
                    html.match(/sources\s*:\s*\[\{[^}]*file\s*:\s*"([^"]+)"/i) ||
                    html.match(/<source\s+src=["']([^"']+)["']/i);
                if (fm) {
                    return new StreamResult({
                        url: "MAGIC_PROXY_v1" + encodeBase64(fm[1]),
                        quality: 'Auto',
                        source: 'YourUpload',
                        headers: { 'Referer': url }
                    });
                }
            } catch (e) { }
            return new StreamResult({
                url: "MAGIC_PROXY_v1" + encodeBase64(url),
                quality: 'Auto',
                source: 'YourUpload',
                headers: { 'Referer': baseUrl }
            });
        }

        // --- Streamruby / StreamSB ---
        if (url.includes('streamruby') || url.includes('streamsb') || url.includes('sbplay')) {
            try {
                const res = await axios.get(url, { headers: { 'Referer': baseUrl, 'Accept': 'application/json,text/html,*/*' } });
                let html = typeof res.data === 'string' ? res.data : (typeof res.data?.stream_url === 'string' ? res.data.stream_url : '');
                // Try direct API response first
                if (res.data?.stream_url) {
                    return new StreamResult({
                        url: "MAGIC_PROXY_v1" + encodeBase64(res.data.stream_url),
                        quality: 'Auto',
                        source: 'StreamSB',
                        headers: { 'Referer': url }
                    });
                }
                if (html) {
                    if (typeof getAndUnpack !== 'undefined' && html.includes('eval(function(p,a,c,k')) {
                        try { const u = getAndUnpack(html); if (u) html += '\n' + u; } catch (e) { }
                    }
                    const fm = html.match(/sources\s*:\s*\[["']([^"']+)["']\]/i) ||
                        html.match(/file\s*:\s*["']([^"']+)["']/i) ||
                        html.match(/src["']?\s*:\s*["']([^"']+)["']/i) ||
                        html.match(/<source\s+src=["']([^"']+)["']/i);
                    if (fm) {
                        let vUrl = fm[1];
                        if (vUrl.startsWith('//')) vUrl = 'https:' + vUrl;
                        return new StreamResult({
                            url: "MAGIC_PROXY_v1" + encodeBase64(vUrl),
                            quality: 'Auto',
                            source: 'StreamSB',
                            headers: { 'Referer': url }
                        });
                    }
                }
            } catch (e) { }
            return new StreamResult({
                url: "MAGIC_PROXY_v1" + encodeBase64(url),
                quality: 'Auto',
                source: 'StreamSB',
                headers: { 'Referer': baseUrl }
            });
        }

        // --- Mp4Upload ---
        if (url.includes('mp4upload') || url.includes('mp4u')) {
            try {
                const res = await axios.get(url, { headers: { 'Referer': baseUrl } });
                const html = typeof res.data === 'string' ? res.data : '';
                const fm = html.match(/file\s*:\s*["']([^"']+)["']/i) ||
                    html.match(/src["']?\s*:\s*["']([^"']+)["']/i) ||
                    html.match(/<source\s+src=["']([^"']+)["']/i);
                if (fm) {
                    let vUrl = fm[1];
                    if (vUrl.startsWith('//')) vUrl = 'https:' + vUrl;
                    return new StreamResult({
                        url: "MAGIC_PROXY_v1" + encodeBase64(vUrl),
                        quality: 'Auto',
                        source: 'Mp4Upload',
                        headers: { 'Referer': url }
                    });
                }
            } catch (e) { }
            return new StreamResult({
                url: "MAGIC_PROXY_v1" + encodeBase64(url),
                quality: 'Auto',
                source: 'Mp4Upload',
                headers: { 'Referer': baseUrl }
            });
        }

        // --- Gofile / GoFile.io ---
        if (url.includes('gofile') || url.includes('gofile.io')) {
            try {
                const apiMatch = url.match(/gofile\.io\/d\/([^\/?]+)/i);
                if (apiMatch) {
                    const contentId = apiMatch[1];
                    const apiRes = await axios.get(`https://api.gofile.io/v2/files/${contentId}`, {
                        headers: { 'Authorization': 'Bearer', 'Accept': 'application/json' }
                    });
                    if (apiRes.data?.data?.children) {
                        const children = apiRes.data.data.children;
                        for (const childId in children) {
                            const child = children[childId];
                            if (child.link && child.mimetype?.startsWith('video')) {
                                return new StreamResult({
                                    url: "MAGIC_PROXY_v1" + encodeBase64(child.link),
                                    quality: 'Auto',
                                    source: 'GoFile',
                                    headers: { 'Referer': url }
                                });
                            }
                        }
                    }
                }
            } catch (e) { }
            return new StreamResult({
                url: "MAGIC_PROXY_v1" + encodeBase64(url),
                quality: 'Auto',
                source: 'GoFile',
                headers: { 'Referer': baseUrl }
            });
        }

        // --- Speedostream / SpeedoCDN ---
        if (url.includes('speedostream') || url.includes('speedocdn')) {
            try {
                const res = await axios.get(url, { headers: { 'Referer': baseUrl } });
                let html = typeof res.data === 'string' ? res.data : '';
                if (typeof getAndUnpack !== 'undefined' && html.includes('eval(function(p,a,c,k')) {
                    try { const u = getAndUnpack(html); if (u) html += '\n' + u; } catch (e) { }
                }
                const fm = html.match(/file\s*:\s*["']([^"']+)["']/i) ||
                    html.match(/sources\s*:\s*\[["']([^"']+)["']\]/i) ||
                    html.match(/src["']?\s*:\s*["']([^"']+)["']/i);
                if (fm) {
                    let vUrl = fm[1];
                    if (vUrl.startsWith('//')) vUrl = 'https:' + vUrl;
                    return new StreamResult({
                        url: "MAGIC_PROXY_v1" + encodeBase64(vUrl),
                        quality: 'Auto',
                        source: 'SpeedoStream',
                        headers: { 'Referer': url }
                    });
                }
            } catch (e) { }
            return new StreamResult({
                url: "MAGIC_PROXY_v1" + encodeBase64(url),
                quality: 'Auto',
                source: 'SpeedoStream',
                headers: { 'Referer': baseUrl }
            });
        }

        // --- Vembed.net ---
        if (url.includes('vembed') || url.includes('vembed.net')) {
            try {
                const res = await axios.get(url, { headers: { 'Referer': baseUrl } });
                const html = typeof res.data === 'string' ? res.data : '';
                const fm = html.match(/file\s*:\s*["']([^"']+)["']/i) ||
                    html.match(/src["']?\s*:\s*["']([^"']+)["']/i) ||
                    html.match(/<source\s+src=["']([^"']+)["']/i) ||
                    html.match(/<iframe[^>]*src=["']([^"']+)["'][^>]*>/i);
                if (fm) {
                    let vUrl = fm[1];
                    if (vUrl.startsWith('//')) vUrl = 'https:' + vUrl;
                    return new StreamResult({
                        url: "MAGIC_PROXY_v1" + encodeBase64(vUrl),
                        quality: 'Auto',
                        source: 'Vembed',
                        headers: { 'Referer': url }
                    });
                }
            } catch (e) { }
            return new StreamResult({
                url: "MAGIC_PROXY_v1" + encodeBase64(url),
                quality: 'Auto',
                source: 'Vembed',
                headers: { 'Referer': baseUrl }
            });
        }

        // --- Direct video URLs ---
        if (url.match(/\.(mp4|m3u8|mkv|webm)(\?|$)/i)) {
            return new StreamResult({
                url: "MAGIC_PROXY_v1" + encodeBase64(url),
                quality: 'Auto',
                source: 'Direct',
                headers: { 'Referer': baseUrl }
            });
        }

        // --- Unknown host → proxy fallback ---
        let host = 'Unknown'; try { host = url.split('/')[2] || 'Unknown'; } catch (e) { }
        return new StreamResult({
            url: "MAGIC_PROXY_v1" + encodeBase64(url),
            quality: 'Auto',
            source: host,
            headers: { 'Referer': baseUrl }
        });
    }
};

async function getHome(cb) {
    try {
        const res = await axios.get(baseUrl, { headers });
        const html = res.data;
        const doc = await parseHtml(html);
        const results = {};
        const queryAll = (d, s) => Array.from(d.querySelectorAll(s));
        const seenUrls = new Set();
        const fixUrl = p => { if (!p) return ''; if (p.startsWith('http')) return p; return baseUrl + (p.startsWith('/') ? '' : '/') + p; };

        // Helper to extract poster from an element
        const getPoster = el => {
            const imgEl = el.querySelector('img');
            return fixUrl(imgEl?.getAttribute('data-src') || imgEl?.getAttribute('src') || imgEl?.getAttribute('data-lazy-src'));
        };

        // ── 1. Top 10 Animes sidebar ──
        const top10 = [];
        queryAll(doc, '.TPost.A, .Wdgt .TPost').forEach(el => {
            const rankEl = el.querySelector('.Top');
            const titleEl = el.querySelector('.Title');
            const linkEl = el.querySelector('a');
            const imgEl = el.querySelector('img');
            const title = titleEl?.textContent.trim();
            let url = linkEl?.getAttribute('href');
            // Validate URL: skip non-anime links
            if (url && !url.match(/\/\d+-[\w-]+/) && !url.includes('/animes/') && !url.includes('/saison/') && !url.includes('/film/')) url = undefined;
            const rank = rankEl?.textContent.trim();
            if (title && url) {
                const fullUrl = url.startsWith('http') ? url : baseUrl + url;
                if (!seenUrls.has(fullUrl)) {
                    seenUrls.add(fullUrl);
                    top10.push(new MultimediaItem({
                        title: (rank ? rank + ' ' : '') + title,
                        url: fullUrl,
                        posterUrl: getPoster(el),
                        type: 'anime'
                    }));
                }
            }
        });
        if (top10.length > 0) results['Top 10 Animes'] = top10;

        // ── 2. TPostMv items (Derniers Animes with posters) ──
        const latestAnime = [];
        queryAll(doc, '.TPostMv').forEach(el => {
            const linkEl = el.querySelector('a');
            const titleEl = el.querySelector('.TPMvCn .anmt, .TPMvCn h3, .Title');
            const imgEl = el.querySelector('img');
            const title = titleEl?.textContent.trim() || imgEl?.getAttribute('alt');
            // URL from title link first (same element as title), then fallback
            let url = el.querySelector('.TPMvCn a, .TPMvCn .anmt a')?.getAttribute('href') || linkEl?.getAttribute('href');
            // Validate URL: skip non-anime links
            if (url && !url.match(/\/\d+-[\w-]+/) && !url.includes('/animes/') && !url.includes('/saison/') && !url.includes('/film/')) url = undefined;
            if (title && url) {
                const fullUrl = url.startsWith('http') ? url : baseUrl + url;
                if (!seenUrls.has(fullUrl)) {
                    seenUrls.add(fullUrl);
                    latestAnime.push(new MultimediaItem({
                        title, url: fullUrl, posterUrl: getPoster(el), type: 'anime'
                    }));
                }
            }
        });
        if (latestAnime.length > 0) results['Derniers Animes'] = latestAnime;

        // ── 3. Episodes by headings (VOSTFR/VF) ──
        queryAll(doc, 'h2, h3, h4').forEach(heading => {
            const sectionTitle = heading.textContent.trim();
            if (!sectionTitle || sectionTitle.length < 2) return;
            if (results[sectionTitle]) return; // skip if already extracted
            let container = heading.nextElementSibling;
            if (!container) container = heading.parentElement;
            if (!container) return;
            const items = [];
            queryAll(container, '.episode-item').forEach(el => {
                const linkEl = el.querySelector('.episode-link') || el.querySelector('a');
                const title = linkEl?.textContent.trim();
                const url = linkEl?.getAttribute('href');
                if (title && url) {
                    const fullUrl = url.startsWith('http') ? url : baseUrl + url;
                    if (!seenUrls.has(fullUrl)) {
                        seenUrls.add(fullUrl);
                        items.push(new MultimediaItem({
                            title, url: fullUrl, posterUrl: '', type: 'anime'
                        }));
                    }
                }
            });
            if (items.length > 0) results[sectionTitle] = items;
        });

        // ── 4. Derniers Films ──
        const filmItems = [];
        queryAll(doc, '.TPost.C').forEach(el => {
            const linkEl = el.querySelector('a');
            const titleEl = el.querySelector('.Title');
            const url = linkEl?.getAttribute('href');
            const title = titleEl?.textContent.trim();
            if (title && url && url.includes('/film/')) {
                const fullUrl = url.startsWith('http') ? url : baseUrl + url;
                if (!seenUrls.has(fullUrl)) {
                    seenUrls.add(fullUrl);
                    filmItems.push(new MultimediaItem({
                        title, url: fullUrl, posterUrl: getPoster(el), type: 'anime'
                    }));
                }
            }
        });
        if (filmItems.length > 0) results['Films'] = filmItems;

        // ── 5. Dernières Saisons ──
        const seasonItems = [];
        queryAll(doc, '.TPost.C').forEach(el => {
            const linkEl = el.querySelector('a');
            const titleEl = el.querySelector('.Title');
            const url = linkEl?.getAttribute('href');
            const title = titleEl?.textContent.trim();
            if (title && url && url.includes('/saison/')) {
                const fullUrl = url.startsWith('http') ? url : baseUrl + url;
                if (!seenUrls.has(fullUrl)) {
                    seenUrls.add(fullUrl);
                    seasonItems.push(new MultimediaItem({
                        title, url: fullUrl, posterUrl: getPoster(el), type: 'anime'
                    }));
                }
            }
        });
        if (seasonItems.length > 0) results['Dernières Saisons'] = seasonItems;

        // ── 6. Fallback: TPost.C items not yet categorized ──
        if (Object.keys(results).length === 0) {
            const fallbackItems = [];
            queryAll(doc, '.TPost.C, .TPostMv').forEach(el => {
                const linkEl = el.querySelector('a');
                const titleEl = el.querySelector('.Title, .TPMvCn .anmt, h3');
                const title = titleEl?.textContent.trim();
                const url = linkEl?.getAttribute('href');
                if (title && url) {
                    const fullUrl = url.startsWith('http') ? url : baseUrl + url;
                    if (!seenUrls.has(fullUrl)) {
                        seenUrls.add(fullUrl);
                        fallbackItems.push(new MultimediaItem({
                            title, url: fullUrl, posterUrl: getPoster(el), type: 'anime'
                        }));
                    }
                }
            });
            if (fallbackItems.length > 0) results['Derniers Ajouts'] = fallbackItems;
        }

        cb({ success: true, data: results });
    } catch (e) { log('getHome error', e); cb({ success: false, errorCode: 'HOME_ERROR', message: String(e) }); }
}

async function search(query, cb) {
    try {
        const items = [];
        const seenUrls = new Set();

        // ── Helper: extract item from a Toroplay4 result element ──
        function extractSearchItem(el) {
            // Get URL from the first anchor that looks like an anime link
            const linkEl = el.tagName === 'A' ? el : (el.querySelector('.TPMvCn a, .Title a, h2 a, h3 a, a[href*="/animes/"], a[href*="/saison/"], a[href*="/film/"]) || el.querySelector('a'));
            // Title comes from .TPMvCn .anmt, .Title, h2, h3, or the link itself
            const titleEl = el.querySelector('.TPMvCn .anmt, .Title, h2, h3, .episode-link') || linkEl;
            let title = titleEl?.getAttribute('title') || titleEl?.textContent?.trim() || linkEl?.textContent?.trim();
            const imgEl = el.querySelector('img');
            let url = linkEl?.getAttribute('href');
            // Validate URL: skip non-anime links
            if (url && !url.match(/\/\d+-[\w-]+/) && !url.includes('/animes/') && !url.includes('/saison/') && !url.includes('/film/')) url = undefined;
            const posterUrl = imgEl?.getAttribute('data-src') || imgEl?.getAttribute('src');
            return { title, url, posterUrl };
        }

        // ── Helper: parse items from HTML ──
        async function parseItems(html) {
            if (!html || typeof html !== 'string') return [];
            const results = [];

            // Strategy 1: Parse via DOM with Toroplay4 selectors
            if (typeof parseHtml === 'function') {
                try {
                    const dom = await parseHtml(html);
                    const searchSelectors = [
                        '.TPostMv',
                        '.TPost.C',
                        '.TPost',
                        '.page-item-detail',
                        '.episode-item',
                        'article',
                        '.search-result',
                        '.post-item'
                    ];
                    for (const sel of searchSelectors) {
                        if (results.length >= 25) break;
                        Array.from(dom.querySelectorAll(sel)).forEach(el => {
                            if (results.length >= 25) return;
                            const item = extractSearchItem(el);
                            if (item.title && item.url && !seenUrls.has(item.url)) {
                                seenUrls.add(item.url);
                                results.push(item);
                            }
                        });
                        if (results.length > 0) break;
                    }
                } catch (e) { }
            }

            // Strategy 2: Regex fallback for search result items
            if (results.length === 0 && typeof html === 'string') {
                const patterns = [
                    // TPostMv / search result with structured classes
                    /<div[^>]*class="[^"]*TPostMv[^"]*"[^>]*>[\s\S]*?<a[^>]+href="([^"]+)"[^>]*>[\s\S]*?<img[^>]+(?:data-src|src)="([^"]+)"[^>]*(?:alt="([^"]*)")?[\s\S]*?(?:anmt[^>]*>([^<]+)<|Title[^>]*>([^<]+)<)/gi,
                    // Generic item with anime/saison/film URL pattern
                    /<a[^>]+href="([^"]*(?:\/animes\/|\/saison\/|\/film\/)[^"]+)"[^>]*>[\s\S]*?<img[^>]+(?:data-src|src)="([^"]+)"[^>]*(?:alt="([^"]*)")?[\s\S]*?<\/a>/gi,
                    // Simple anchor with image
                    /<a[^>]+href="([^"]+)"[^>]*>\s*<img[^>]+(?:data-src|src)="([^"]+)"[^>]+alt="([^"]*)"[^>]*>/gi
                ];
                for (const regex of patterns) {
                    if (results.length >= 25) break;
                    let m;
                    while ((m = regex.exec(html)) !== null && results.length < 25) {
                        const url = m[1];
                        const posterUrl = m[2];
                        const altTitle = m[3] || m[4] || m[5] || '';
                        if (url && !seenUrls.has(url) && !url.includes('#') && !url.includes('javascript:')) {
                            seenUrls.add(url);
                            let title = altTitle.replace(/<[^>]+>/g, '').trim();
                            if (title) {
                                results.push({ title, url: url.startsWith('http') ? url : baseUrl + url, posterUrl });
                            }
                        }
                    }
                    if (results.length > 0) break;
                }
            }
            return results;
        }

        // ── Strategy 1: GET with ?s= (WordPress search, primary) ──
        if (items.length === 0) {
            try {
                const res = await axios.get(`${baseUrl}/?s=${encodeURIComponent(query)}`, { headers });
                if (res.data && typeof res.data === 'string' && res.data.length > 500) {
                    const parsed = await parseItems(res.data);
                    for (const p of parsed) {
                        items.push(p);
                    }
                }
            } catch (e) { }
        }

        // ── Strategy 2: POST with DLE-style search (for DLE-based Toroplay4 fallback) ──
        if (items.length === 0) {
            try {
                const res = await axios.post(baseUrl,
                    `do=search&subaction=search&search_start=0&full_search=0&result_from=1&story=${encodeURIComponent(query)}`,
                    { headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' } }
                );
                if (res.data && typeof res.data === 'string' && res.data.length > 500) {
                    const parsed = await parseItems(res.data);
                    for (const p of parsed) {
                        items.push(p);
                    }
                }
            } catch (e) { }
        }

        // ── Strategy 3: POST via /index.php (DLE fallback) ──
        if (items.length === 0) {
            try {
                const res = await axios.post(baseUrl + '/index.php',
                    `do=search&subaction=search&search_start=0&full_search=0&result_from=1&story=${encodeURIComponent(query)}`,
                    { headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' } }
                );
                if (res.data && typeof res.data === 'string' && res.data.length > 500) {
                    const parsed = await parseItems(res.data);
                    for (const p of parsed) {
                        items.push(p);
                    }
                }
            } catch (e) { }
        }

        // ── Strategy 4: GET with /search.html endpoint ──
        if (items.length === 0) {
            try {
                const res = await axios.get(`${baseUrl}/search.html?keyword=${encodeURIComponent(query)}`, { headers });
                if (res.data && typeof res.data === 'string' && res.data.length > 500) {
                    const parsed = await parseItems(res.data);
                    for (const p of parsed) {
                        items.push(p);
                    }
                }
            } catch (e) { }
        }

        const results = items.map(i => new MultimediaItem({
            title: i.title,
            url: i.url.startsWith('http') ? i.url : baseUrl + i.url,
            posterUrl: (function(p){ if(!p) return ''; if(p.startsWith('http')) return p; return baseUrl + (p.startsWith('/') ? '' : '/') + p; })(i.posterUrl),
            type: 'anime',
            playbackPolicy: 'none'
        }));

        cb({ success: true, data: results });
    } catch (e) { log('search error', e); cb({ success: false, errorCode: 'SEARCH_ERROR', message: String(e) }); }
}

function detectSeasonAndType(name) {
        let season = undefined;
        let contentType = undefined;
        if (!name) return { season, contentType };
        let n = name.trim().replace(/\s*[\[(]?(?:VF|VOSTFR|VOST|VO|DUB|SUB)[\])]?\s*/gi, ' ').replace(/\s+/g, ' ').trim();
        if (/\b(?:oav|ova)\b/i.test(n)) contentType = 'OAV';
        else if (/\b(?:film|movie)\b/i.test(n)) contentType = 'Film';
        else if (/\b(?:sp[ée]cial|special)\b/i.test(n)) contentType = 'Spécial';
        const s00Match = n.match(/S(\d+)E\d+/i);
        if (s00Match) season = parseInt(s00Match[1]);
        if (season === undefined) {
            const sMatch = n.match(/(?:\b(?:saison|season|part|cour|oav|ova|sp[ée]cial|special|volume|vol)\s+|\bS\s*)(\d+)\b/i);
            if (sMatch) season = parseInt(sMatch[1]);
        }
        if (season === undefined && !contentType) {
            const numMatch = n.match(/\d+/);
            if (numMatch && !/(?:^|[\s\W])[ÉéEe]p(?:isode)?(?:$|[\s\W])/i.test(n)) {
                season = parseInt(numMatch[0]);
            }
        }
        return { season, contentType };
    }

function detectDubStatus(url, title) {
        const text = (url || '') + ' ' + (title || '');
        if (/\/vf\b|\(VF\)|-vf$/i.test(text)) return 'dub';
        if (/\/vostfr\b|\(VOSTFR\)|-vostfr$/i.test(text)) return 'sub';
        return 'none';
    }

    // Detect dubStatus from section heading context (e.g. "Episodes VOSTFR :", "Episodes VF :")
    function detectDubStatusFromHeading(el) {
        // Walk up to find the nearest h2/h3 heading containing VF or VOSTFR
        let node = el;
        while (node) {
            let prev = node.previousElementSibling;
            while (prev) {
                const text = prev.textContent.trim();
                if (/\bVOSTFR\b/i.test(text)) return 'sub';
                if (/\bVF\b/i.test(text) && !/VOSTFR/i.test(text)) return 'dub';
                prev = prev.previousElementSibling;
            }
            node = node.parentElement;
        }
        return null;
    }

    // Parse season info from a SEASON title (not episode title)
    // e.g "Saison 1" → { season: 1 }, "Film" → { contentType: 'Film' }, "OAV 2" → { season: 2, contentType: 'OAV' }
    function parseSeasonInfo(title) {
        let season = undefined;
        let contentType = undefined;
        if (!title) return { season, contentType };
        let t = title.trim().replace(/\s*[\[(]?(?:VF|VOSTFR|VOST|VO|DUB|SUB)[\])]?\s*/gi, ' ').replace(/\s+/g, ' ').trim();
        if (!t) return { season, contentType };
        if (/\b(?:oav|ova|ona)\b/i.test(t)) contentType = 'OAV';
        else if (/\b(?:film|movie|film\s*anim[ée])\b/i.test(t)) contentType = 'Film';
        else if (/\b(?:sp[ée]cial|special)\b/i.test(t)) contentType = 'Spécial';
        const sMatch = t.match(/(?:\b(?:saison|season|part|cour|film|oav|ova|ona|sp[ée]cial|special|episode|ep|volume|vol|tome)\s+|\bS\s*)(\d+)\b/i);
        if (sMatch) season = parseInt(sMatch[1]);
        if (season === undefined) {
            const numMatch = t.match(/\d+/);
            if (numMatch) {
                const num = parseInt(numMatch[0]);
                if (!contentType) season = num;
            }
        }
        return { season, contentType };
    }

    // Determine dubStatus from the page URL (VF or VOSTFR)
    function getDubStatusFromPageUrl(pageUrl) {
        if (/\/vf\b|[-_]vf(?!o)/i.test(pageUrl)) return 'dub';
        if (/\/vostfr\b|[-_]vostfr/i.test(pageUrl)) return 'sub';
        return undefined;
    }

    // Detect season number from section heading context (e.g. "Saison 1 : Jujutsu Kaisen", "OAV", "Spécial", "Saison 2 OAV")
    function detectSeasonFromHeading(el) {
        let node = el;
        while (node) {
            let prev = node.previousElementSibling;
            while (prev) {
                const text = prev.textContent.trim();
                // Check if heading indicates a content type without season number (OAV, Special, Film standalone)
                const oavMatch = text.match(/\b(OAV|OVA|ONA|Sp[ée]cial|Special|Film)\s*(\d+)?\b/i);
                // Try "Saison X" / "Season X" pattern in headings
                const sMatch = text.match(/S(?:aison|eason)\s*(\d+)/i);
                if (sMatch) {
                    // Check if the same heading also indicates a special content type (e.g. "Saison 2 OAV")
                    let ct = undefined;
                    if (oavMatch) {
                        if (/film/i.test(oavMatch[1])) ct = 'Film';
                        else if (/sp[ée]cial|special/i.test(oavMatch[1])) ct = 'Spécial';
                        else ct = 'OAV';
                    }
                    return { season: parseInt(sMatch[1]), contentType: ct };
                }
                // OAV/Special heading without season number
                if (oavMatch) {
                    let ct = 'OAV';
                    if (/film/i.test(oavMatch[1])) ct = 'Film';
                    if (/sp[ée]cial|special/i.test(oavMatch[1])) ct = 'Spécial';
                    return { season: oavMatch[2] ? parseInt(oavMatch[2]) : undefined, contentType: ct };
                }
                prev = prev.previousElementSibling;
            }
            node = node.parentElement;
        }
        return { season: undefined, contentType: undefined };
    }

async function load(url, cb) {
    try {
        const res = await axios.get(url, { headers });
        const html = res.data;
        const doc = await parseHtml(html);
        const title = doc.querySelector('h1.Title')?.textContent.trim() || doc.querySelector('.Title')?.textContent.trim() || doc.querySelector('h1')?.textContent.trim();
        // Description: try multiple selectors (TMovie/Toroplay4 theme patterns)
        const description = doc.querySelector('.Description')?.textContent.trim() ||
            doc.querySelector('.entry-content p')?.textContent.trim() ||
            doc.querySelector('article p')?.textContent.trim() ||
            doc.querySelector('.description')?.textContent.trim() ||
            doc.querySelector('meta[name="description"]')?.getAttribute('content') ||
            doc.querySelector('meta[property="og:description"]')?.getAttribute('content');
        // Poster: .Image img is the main poster on detail pages
        const rawPoster = doc.querySelector('.Image img')?.getAttribute('data-src') ||
            doc.querySelector('.Image img')?.getAttribute('src') ||
            doc.querySelector('.film-poster-img')?.getAttribute('data-src') ||
            doc.querySelector('.film-poster-img')?.getAttribute('src') ||
            doc.querySelector('.TPostBg')?.getAttribute('src') ||
            doc.querySelector('meta[property="og:image"]')?.getAttribute('content');
        const posterUrl = (function(p){ if(!p) return ''; if(p.startsWith('http')) return p; return baseUrl + (p.startsWith('/') ? '' : '/') + p; })(rawPoster);
        // Extract metadata: year, genres, status from .Info div
        const infoEl = doc.querySelector('.Info');
        const infoText = infoEl?.textContent || '';
        const yearFromInfo = infoText.match(/(\d{4})/)?.[1];
        const yearMatch = html.match(/Ann[eé]e\s*:?\s*(\d{4})/i) || html.match(/year["']?\s*:?\s*["']?(\d{4})/i);
        const year = yearFromInfo ? parseInt(yearFromInfo) : (yearMatch ? parseInt(yearMatch[1]) : undefined);
        // Genres: try genre links, category links, or tags
        const genreEls = Array.from(doc.querySelectorAll('.sgenerx a, .genre a, .genres a, .category a, .Category a, .Tags a')).map(el => el.textContent.trim()).filter(Boolean);
        // Status: try selector first, then regex fallback
        const statusEl = doc.querySelector('.Status, .status, .statut, [class*="status"], [class*="Status"]');
        let status = statusEl?.textContent?.trim()?.toLowerCase();
        if (!status) {
            const statusMatch = html.match(/Production\s*:?\s*(Oui|Yes|Non|No|En cours|Terminé|Finished)/i);
            if (statusMatch) status = statusMatch[1].toLowerCase();
        }
        const episodes = [];
        const seenEpUrls = new Set();
        // Track (season, episode, dubStatus) triples to dedup across sections (VF/VOSTFR/All)
        const seenEpTriples = new Set();
        // Detect page-level dubStatus from URL/title
        const pageDubStatus = detectDubStatus(url, title);

        // ── Helper: extract episode number from title more reliably ──
        // Prioritizes patterns like "Episode 3", "Épisode 12", "E04" over generic first number
        function extractEpisodeNumber(title) {
            if (!title) return undefined;
            // Specific patterns (case-insensitive): Episode X, Épisode X, Ep X, E04
            const specific = title.match(/(?:Episode|Épisode|Ep|E(?!p))\s*(\d+)/i);
            if (specific) return parseInt(specific[1]);
            // Fallback: last number in the title (avoids "Saison 1 Episode 3" → 1)
            const nums = title.match(/\d+/g);
            if (nums && nums.length > 0) {
                // If multiple numbers, take the last one (most likely the episode number)
                return parseInt(nums[nums.length - 1]);
            }
            return undefined;
        }

        // Toroplay4: episode-item grouped under VF/VOSTFR headings, possibly organized by season
        doc.querySelectorAll('.episode-item').forEach(el => {
            const linkEl = el.querySelector('.episode-link') || el.querySelector('a');
            const epUrl = linkEl?.getAttribute('href');
            const epTitle = linkEl?.textContent.trim();
            if (epUrl) {
                const fullEpUrl = epUrl.startsWith('http') ? epUrl : baseUrl + epUrl;
                if (seenEpUrls.has(fullEpUrl)) return;
                seenEpUrls.add(fullEpUrl);
                // Extract episode number: prefer specific patterns, fallback to last number
                let epNum = extractEpisodeNumber(epTitle);
                // Season number: try heading context first ("Saison X" heading above this episode group)
                const headingSeason = detectSeasonFromHeading(el);
                if (epNum === undefined) {
                    // No number in title → use contentType heading for OAV/Special detection
                    if (headingSeason.contentType) {
                        epNum = 1;
                    } else {
                        epNum = episodes.length + 1; // sequential fallback
                    }
                }
                // Also try episode title detection
                const titleDetected = detectSeasonAndType(epTitle);
                // Prefer heading-based season detection (more reliable), fallback to title detection
                const seasonNum = headingSeason.season !== undefined ? headingSeason.season : titleDetected.season;
                const contentType = headingSeason.contentType || titleDetected.contentType;
                // Dub status: try episode-level, then heading context, then page-level
                let dubStatus = detectDubStatus(epUrl, epTitle);
                if (dubStatus === 'none') dubStatus = detectDubStatusFromHeading(el) || pageDubStatus;
                // Dedup by (season, episode, dubStatus) to avoid same logical episode from different sections
                const tripleKey = `${seasonNum || 1}-${epNum}-${dubStatus}`;
                if (seenEpTriples.has(tripleKey)) return;
                seenEpTriples.add(tripleKey);
                episodes.push(new Episode({
                    name: epTitle || ('Episode ' + epNum),
                    episode: epNum,
                    url: fullEpUrl,
                    season: seasonNum || 1,
                    posterUrl: posterUrl,
                    contentType: contentType,
                    dubStatus: dubStatus
                }));
            }
        });
        // Film fallback: no episodes → extract player iframe URL (trembed)
        if (episodes.length === 0) {
            const playerIframe = doc.querySelector('.TPlayerTb iframe[src], .TPlayerCn iframe[src], #player iframe[src]');
            if (playerIframe) {
                const playerUrl = playerIframe.getAttribute('src');
                if (playerUrl) {
                    episodes.push(new Episode({
                        name: title || 'Film',
                        episode: 1,
                        url: playerUrl.startsWith('http') ? playerUrl : baseUrl + playerUrl,
                        season: 1,
                        posterUrl: posterUrl,
                        contentType: 'Film',
                        dubStatus: detectDubStatus(url, title)
                    }));
                }
            }
        }
        // ── Extract recommendations from related/similar sections ──
        const recommendations = [];
        const recSeenUrls = new Set();
        // Toroplay4: recommendations in sidebar or below content
        const recSelectors = [
            '.RelatedPosts .TPostMv',
            '.RelatedPosts .TPost.C',
            '.related-posts .TPostMv',
            '.widget_related .TPostMv',
            '.widget .TPost.C:not(:first-child)',
            '.sidebar .TPostMv',
            '.sidebar .TPost.C',
            '.Wdgt .TPostMv',
            '.TPost.C',
            '[class*="related"] .TPostMv',
            '[class*="related"] .TPost.C',
            '[class*="recommend"] .TPostMv',
        ];
        for (const sel of recSelectors) {
            if (recommendations.length >= 15) break;
            doc.querySelectorAll(sel).forEach(el => {
                if (recommendations.length >= 15) return;
                const linkEl = el.querySelector('a');
                const imgEl = el.querySelector('img');
                const titleEl = el.querySelector('.Title, .TPMvCn .anmt, h3, h2');
                const recTitle = titleEl?.textContent.trim() || linkEl?.getAttribute('title');
                const recUrl = linkEl?.getAttribute('href');
                if (!recTitle || !recUrl || recUrl.includes('#')) return;
                const fullRecUrl = recUrl.startsWith('http') ? recUrl : baseUrl + recUrl;
                if (recSeenUrls.has(fullRecUrl)) return;
                recSeenUrls.add(fullRecUrl);
                // Exclude current anime by URL match
                if (fullRecUrl === url) return;
                const recPoster = imgEl?.getAttribute('data-src') || imgEl?.getAttribute('src');
                recommendations.push(new MultimediaItem({
                    title: recTitle,
                    url: fullRecUrl,
                    posterUrl: (function(p){ if(!p) return ''; if(p.startsWith('http')) return p; return baseUrl + (p.startsWith('/') ? '' : '/') + p; })(recPoster),
                    type: 'anime'
                }));
            });
            if (recommendations.length > 0) break;
        }
        // ── Fallback: try heading-based recommendation sections ──
        if (recommendations.length === 0) {
            const headingKeywords = /recommand|recommend|similaire|related|suggestion|vous aimerez|autre|also like|popular/i;
            doc.querySelectorAll('h2, h3, h4').forEach(heading => {
                if (recommendations.length >= 10) return;
                const headingText = heading.textContent.trim();
                if (!headingKeywords.test(headingText)) return;
                let container = heading.closest('.widget, section, div') || heading.parentElement;
                if (!container) return;
                container.querySelectorAll('.TPostMv, .TPost.C, .episode-item, a[href*="/animes/"]').forEach(el => {
                    if (recommendations.length >= 10) return;
                    const linkEl = el.tagName === 'A' ? el : el.querySelector('a');
                    const imgEl = el.querySelector('img');
                    const recTitle = linkEl?.getAttribute('title') || linkEl?.textContent.trim();
                    const recUrl = linkEl?.getAttribute('href');
                    if (!recTitle || !recUrl || recUrl.includes('#')) return;
                    const fullRecUrl = recUrl.startsWith('http') ? recUrl : baseUrl + recUrl;
                    if (recSeenUrls.has(fullRecUrl) || fullRecUrl === url) return;
                    recSeenUrls.add(fullRecUrl);
                    const recPoster = imgEl?.getAttribute('data-src') || imgEl?.getAttribute('src');
                    const fixPoster = function(p){ if(!p) return ''; if(p.startsWith('http')) return p; return baseUrl + (p.startsWith('/') ? '' : '/') + p; };
                    recommendations.push(new MultimediaItem({ title: recTitle, url: fullRecUrl, posterUrl: recPoster ? fixPoster(recPoster) : '', type: 'anime' }));
                });
            });
        }
        // ── Fallback 2: Genre-based recommendations ──
        if (recommendations.length === 0 && genreEls && genreEls.length > 0 && title) {
            try {
                const searchRes = await new Promise(resolve => search(genreEls[0], resolve));
                if (searchRes.success && searchRes.data) {
                    for (const item of searchRes.data) {
                        if (recommendations.length >= 10) break;
                        if (recSeenUrls.has(item.url)) continue;
                        recSeenUrls.add(item.url);
                        if (item.title === title) continue;
                        recommendations.push(item);
                    }
                }
            } catch (e) { /* Genre search failed */ }
        }

        cb({ success: true, data: new MultimediaItem({ type: "anime", title, description, posterUrl, episodes, year, status, genres: genreEls.length > 0 ? genreEls : undefined, recommendations: recommendations.length > 0 ? recommendations : undefined }) });
    } catch (e) { log('load error: ' + url, e); cb({ success: false, errorCode: 'LOAD_ERROR', message: String(e) }); }
}

async function loadStreams(url, cb) {
    try {
        // Extract movie/season ID from URL for AJAX requests (Toroplay4 pattern)
        const movieId = url.match(/\/(\d+)-/)?.[1];
        // Parallelize: fetch page + AJAX full-story simultaneously
        const [pageRes, epRes] = await Promise.all([
            axios.get(url, { headers }),
            movieId ? axios.get(`${baseUrl}/engine/ajax/full-story.php?newsId=${movieId}&d=${Date.now()}`, { headers }) : Promise.resolve({ data: '' })
        ]);
        const html = pageRes.data;
        const streams = [];
        const seenStreamUrls = new Set();

        // ── Helper: add stream result with deduplication ──
        async function tryAddStream(playerUrl, label) {
            if (!playerUrl) return;
            // Decode HTML entities
            playerUrl = playerUrl.replace(/&amp;/g, '&').replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#034;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
            // Fix protocol-relative URLs
            if (playerUrl.startsWith('//')) playerUrl = 'https:' + playerUrl;
            // Dedup
            if (seenStreamUrls.has(playerUrl)) return;
            seenStreamUrls.add(playerUrl);
            try {
                const streamRes = await Extractors.resolveStream(playerUrl);
                if (streamRes) {
                    streamRes.quality = label;
                    streams.push(streamRes);
                }
            } catch (e) { log('Stream resolve failed: ' + playerUrl, e); }
        }

        // ── Helper: clean AJAX response ──
        function cleanAjaxHtml(raw) {
            if (typeof raw === 'string') return raw.replace(/\\"/g, '"').replace(/\\'/g, "'").replace(/\\\//g, '/');
            if (raw?.html) return raw.html.replace(/\\"/g, '"').replace(/\\'/g, "'").replace(/\\\//g, '/');
            return '';
        }

        const fullStoryHtml = cleanAjaxHtml(epRes.data);

        // ── Strategy 1: Server items (data-server-id / data-embed) from AJAX or page ──
        // Toroplay4 pattern: <div data-server-id="1" data-embed="URL">
        const searchSource = fullStoryHtml || html;
        const serverIdRegexes = [
            // data-server-id BEFORE data-embed
            /data-server-id="([^"]*)"[^>]*data-embed="([^"]*)"/gi,
            // data-embed BEFORE data-server-id
            /data-embed="([^"]*)"[^>]*data-server-id="([^"]*)"/gi,
            // class="server-item" with data attributes
            /class="[^"]*server-item[^"]*"[^>]*data-server-id="([^"]*)"/gi
        ];
        for (const serverRegex of serverIdRegexes) {
            if (streams.length >= 15) break;
            let sMatch;
            while ((sMatch = serverRegex.exec(searchSource)) !== null) {
                if (streams.length >= 15) break;
                let serverId, embedUrl;
                if (sMatch[1] && sMatch[2]) {
                    const val1 = sMatch[1];
                    const val2 = sMatch[2];
                    // data-server-id is numeric, data-embed is a URL
                    if (/^\d+$/.test(val1) && !/^\d+$/.test(val2)) {
                        serverId = val1; embedUrl = val2;
                    } else {
                        serverId = val2; embedUrl = val1;
                    }
                } else if (sMatch[1]) {
                    serverId = sMatch[1];
                    // Try to find content_player_X in the AJAX response for this server
                    if (fullStoryHtml) {
                        const cpMatch = fullStoryHtml.match(new RegExp(`content_player_${serverId}[^"]*"[^>]*>([^<]*)<`, 'i'));
                        if (cpMatch && cpMatch[1].trim().length > 5) {
                            embedUrl = cpMatch[1].trim();
                        }
                    }
                } else continue;

                // Dedup by server ID
                if (streams.some(s => s.quality === 'Serveur ' + serverId)) continue;

                let playerUrl = embedUrl;
                // Try to get actual player URL from content_player_X div in AJAX
                if (fullStoryHtml && (!playerUrl || playerUrl.length <= 5)) {
                    const cpRegex = new RegExp(`content_player_${serverId}[^"]*"[^>]*>([^<]*)<`, 'i');
                    const cpMatch = fullStoryHtml.match(cpRegex);
                    if (cpMatch && cpMatch[1].trim().length > 5) {
                        playerUrl = cpMatch[1].trim();
                    }
                    // Fallback: search in raw AJAX data (not cleaned)
                    if ((!playerUrl || playerUrl.length <= 5) && typeof epRes.data === 'string') {
                        const rawMatch = epRes.data.match(new RegExp(`content_player_${serverId}[^"]*"[^>]*>([^<]*)<`, 'i'));
                        if (rawMatch && rawMatch[1].trim().length > 5) {
                            playerUrl = rawMatch[1].trim();
                        }
                    }
                }

                if (playerUrl && playerUrl.length > 5) {
                    await tryAddStream(playerUrl, 'Serveur ' + serverId);
                }
            }
            if (streams.length > 0) break;
        }

        // ── Strategy 2: content_player_X divs (film pages, DLE pattern) ──
        if (streams.length === 0) {
            const hostPatterns = {
                '1': id => 'https://myvi.ru/player/embed/html/' + id,
                '2': id => 'https://video.sibnet.ru/sh.php?video=' + id,
                '3': id => 'https://embed4me.com/e/' + id,
                '4': id => 'https://sendvid.com/embed/' + id,
                '5': id => 'https://uqload.io/embed-' + id + '.html',
                '6': id => 'https://verystream.com/e/' + id,
                '7': id => 'https://vidmoly.net/embed-' + id + '.html',
                '8': id => 'https://minochinos.com/v/' + id,
                '9': id => 'https://filemoon.sx/e/' + id
            };
            const cpRegex = /id=["']content_player_(\d+)["'][^>]*>([^<]*)</gi;
            const searchCp = fullStoryHtml || html;
            let cpMatch;
            while ((cpMatch = cpRegex.exec(searchCp)) !== null) {
                const num = cpMatch[1];
                const vid = cpMatch[2].trim();
                // Skip if content_player is for a server already resolved
                if (streams.some(s => s.quality && s.quality.includes('Serveur ' + num))) continue;
                if (vid && hostPatterns[num]) {
                    // If the content_player value looks like a full URL, use it directly
                    if (vid.startsWith('http://') || vid.startsWith('https://')) {
                        await tryAddStream(vid, 'Source ' + num);
                    } else {
                        const hostUrl = hostPatterns[num](vid);
                        await tryAddStream(hostUrl, 'Source ' + num);
                    }
                } else if (vid && vid.startsWith('http')) {
                    // Unknown host ID but content is a full URL
                    await tryAddStream(vid, 'Source ' + num);
                }
            }
        }

        // ── Strategy 3: Iframe extraction (trembed embeds, direct iframes) ──
        if (streams.length === 0) {
            // Collect all iframes from page, resolve trembed URLs, and process
            const iframeRegex = /<iframe[^>]*src=["']([^"']+)["'][^>]*>/gi;
            const embedUrls = [];
            let iframeMatch;
            while ((iframeMatch = iframeRegex.exec(html)) !== null) {
                const embedUrl = iframeMatch[1];
                if (embedUrl && !embedUrl.includes('ads') && !embedUrl.includes('google') && !embedUrl.includes('facebook') && !embedUrl.includes('doubleclick')) {
                    embedUrls.push(embedUrl);
                }
            }
            // Resolve all embed URLs in parallel
            if (embedUrls.length > 0) {
                const results = await Promise.all(embedUrls.map(async (embedUrl) => {
                    try {
                        if (embedUrl.includes('trembed=')) {
                            // Fetch trembed page to get the actual player iframe
                            const trembedRes = await axios.get(embedUrl, { headers });
                            const trembedHtml = trembedRes.data;
                            // Try to extract inner iframe from trembed response
                            const innerIframe = trembedHtml.match(/<iframe[^>]*src=["']([^"']+)["'][^>]*>/i);
                            if (innerIframe && innerIframe[1]) {
                                return await Extractors.resolveStream(innerIframe[1]);
                            }
                            // Fallback: try to find direct video URL in trembed response
                            const videoFile = trembedHtml.match(/file["']?\s*:\s*["']?([^"'\s]+(?:m3u8|mp4)[^"'\s]*)["']?/i);
                            if (videoFile) {
                                let vUrl = videoFile[1];
                                if (vUrl.startsWith('//')) {
                                    vUrl = 'https:' + vUrl;
                                } else if (!vUrl.startsWith('http')) {
                                    // Relative path: resolve against trembed page origin
                                    try {
                                        const origin = embedUrl.match(/^https?:\/\/[^\/]+/)[0];
                                        vUrl = origin + (vUrl.startsWith('/') ? '' : '/') + vUrl;
                                    } catch (e) {
                                        // Fallback: just prepend https:
                                        vUrl = 'https:' + (vUrl.startsWith('/') ? '' : '/') + vUrl;
                                    }
                                }
                                return new StreamResult({ url: "MAGIC_PROXY_v1" + encodeBase64(vUrl), quality: 'Auto', source: 'Trembed', headers: { 'Referer': embedUrl } });
                            }
                        } else {
                            return await Extractors.resolveStream(embedUrl);
                        }
                    } catch (e) { return null; }
                    return null;
                }));
                results.forEach(r => { if (r && !seenStreamUrls.has(r.url)) { seenStreamUrls.add(r.url); streams.push(r); } });
            }
        }

        // ── Strategy 4: Lazyload data-src attributes (trembed, player URLs) ──
        if (streams.length === 0) {
            const lazyRegex = /data-src=["']([^"']+(?:trembed|player)[^"']*)["']/gi;
            const lazyUrls = [];
            let lMatch;
            while ((lMatch = lazyRegex.exec(html)) !== null) {
                if (lMatch[1]) lazyUrls.push(lMatch[1]);
            }
            if (lazyUrls.length > 0) {
                const results = await Promise.all(lazyUrls.map(async (lazyUrl) => {
                    try {
                        const fullUrl = lazyUrl.startsWith('http') ? lazyUrl : baseUrl + (lazyUrl.startsWith('/') ? '' : '/') + lazyUrl;
                        if (lazyUrl.includes('trembed=')) {
                            const trembedRes = await axios.get(fullUrl, { headers });
                            const trembedHtml = trembedRes.data;
                            const innerIframe = trembedHtml.match(/<iframe[^>]*src=["']([^"']+)["'][^>]*>/i);
                            if (innerIframe && innerIframe[1]) {
                                return await Extractors.resolveStream(innerIframe[1]);
                            }
                        } else {
                            return await Extractors.resolveStream(fullUrl);
                        }
                    } catch (e) { return null; }
                    return null;
                }));
                results.forEach(r => { if (r && !seenStreamUrls.has(r.url)) { seenStreamUrls.add(r.url); streams.push(r); } });
            }
        }

        // ── Strategy 5: Direct video URLs in script tags ──
        if (streams.length === 0) {
            const searchHtml = fullStoryHtml || html;
            const videoRegexes = [
                // file|url|source = "https://...mp4|m3u8"
                /(?:file|url|source|src)["']?\s*[:=]\s*["'](https?:\/\/[^"'\s]+\.(?:mp4|m3u8|mkv|webm)[^"'\s]*)["']/gi,
                // Direct <source> tags
                /<source\s+src=["']([^"']+\.(?:mp4|m3u8|mkv|webm)[^"']*)["']/gi,
                // #EXTINF pattern from HLS playlists
                /#EXTINF[^,]*,[^\n]*\n(https?:\/\/[^\s]+)/gi
            ];
            for (const vRegex of videoRegexes) {
                if (streams.length > 0) break;
                let vMatch;
                while ((vMatch = vRegex.exec(searchHtml)) !== null) {
                    const videoUrl = vMatch[1];
                    if (videoUrl && !videoUrl.includes('.js') && !videoUrl.includes('.css') && !videoUrl.includes('analytics') && !videoUrl.includes('tracking')) {
                        await tryAddStream(videoUrl, 'Direct');
                    }
                }
            }
        }

        cb({ success: true, data: streams });
    } catch (e) { log('loadStreams error: ' + url, e); cb({ success: false, errorCode: 'STREAM_ERROR', message: String(e) }); }
}

globalThis.getHome = getHome;
globalThis.search = search;
globalThis.load = load;
globalThis.loadStreams = loadStreams;
