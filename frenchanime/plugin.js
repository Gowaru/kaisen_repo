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

const PLUGIN_ID = 'frenchanime';
function log(msg, data) { try { console.log(`[${PLUGIN_ID}] ${msg}`, data || ''); } catch (_) { } }

const baseUrl = (typeof manifest !== 'undefined' && manifest.baseUrl) ? manifest.baseUrl : 'https://french-anime.com';
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

        // --- Embed4Me / Lplayer ---
        if (url.includes('embed4me') || url.includes('lpayer')) {
            return new StreamResult({ url: "MAGIC_PROXY_v1" + encodeBase64(url), quality: 'Auto', source: 'Embed4Me', headers: { 'Referer': baseUrl } });
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
                    return new StreamResult({ url: "MAGIC_PROXY_v1" + encodeBase64(fm[1]), quality: 'Auto', source: 'YourUpload', headers: { 'Referer': url } });
                }
            } catch (e) { }
            return new StreamResult({ url: "MAGIC_PROXY_v1" + encodeBase64(url), quality: 'Auto', source: 'YourUpload', headers: { 'Referer': baseUrl } });
        }

        // --- Streamruby / StreamSB ---
        if (url.includes('streamruby') || url.includes('streamsb') || url.includes('sbplay')) {
            try {
                const res = await axios.get(url, { headers: { 'Referer': baseUrl, 'Accept': 'application/json,text/html,*/*' } });
                let html = typeof res.data === 'string' ? res.data : (typeof res.data?.stream_url === 'string' ? res.data.stream_url : '');
                if (res.data?.stream_url) {
                    return new StreamResult({ url: "MAGIC_PROXY_v1" + encodeBase64(res.data.stream_url), quality: 'Auto', source: 'StreamSB', headers: { 'Referer': url } });
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
                        return new StreamResult({ url: "MAGIC_PROXY_v1" + encodeBase64(vUrl), quality: 'Auto', source: 'StreamSB', headers: { 'Referer': url } });
                    }
                }
            } catch (e) { }
            return new StreamResult({ url: "MAGIC_PROXY_v1" + encodeBase64(url), quality: 'Auto', source: 'StreamSB', headers: { 'Referer': baseUrl } });
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
                    return new StreamResult({ url: "MAGIC_PROXY_v1" + encodeBase64(vUrl), quality: 'Auto', source: 'Mp4Upload', headers: { 'Referer': url } });
                }
            } catch (e) { }
            return new StreamResult({ url: "MAGIC_PROXY_v1" + encodeBase64(url), quality: 'Auto', source: 'Mp4Upload', headers: { 'Referer': baseUrl } });
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
                                return new StreamResult({ url: "MAGIC_PROXY_v1" + encodeBase64(child.link), quality: 'Auto', source: 'GoFile', headers: { 'Referer': url } });
                            }
                        }
                    }
                }
            } catch (e) { }
            return new StreamResult({ url: "MAGIC_PROXY_v1" + encodeBase64(url), quality: 'Auto', source: 'GoFile', headers: { 'Referer': baseUrl } });
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
                    return new StreamResult({ url: "MAGIC_PROXY_v1" + encodeBase64(vUrl), quality: 'Auto', source: 'SpeedoStream', headers: { 'Referer': url } });
                }
            } catch (e) { }
            return new StreamResult({ url: "MAGIC_PROXY_v1" + encodeBase64(url), quality: 'Auto', source: 'SpeedoStream', headers: { 'Referer': baseUrl } });
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
                    return new StreamResult({ url: "MAGIC_PROXY_v1" + encodeBase64(vUrl), quality: 'Auto', source: 'Vembed', headers: { 'Referer': url } });
                }
            } catch (e) { }
            return new StreamResult({ url: "MAGIC_PROXY_v1" + encodeBase64(url), quality: 'Auto', source: 'Vembed', headers: { 'Referer': baseUrl } });
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
        }

        // --- Direct video URLs ---
        if (url.match(/\.(mp4|m3u8|mkv|webm)(\?|$)/i)) {
            return new StreamResult({ url: "MAGIC_PROXY_v1" + encodeBase64(url), quality: 'Auto', source: 'Direct', headers: { 'Referer': baseUrl } });
        }

        // --- Unknown host → proxy fallback ---
        let host = 'Unknown'; try { host = url.split('/')[2] || 'Unknown'; } catch (e) { }
        return new StreamResult({ url: "MAGIC_PROXY_v1" + encodeBase64(url), quality: 'Auto', source: host, headers: { 'Referer': baseUrl } });
    }
};

async function getHome(cb) {
    try {
        const res = await axios.get(baseUrl, { headers });
        const html = res.data;
        const doc = await parseHtml(html);
        const results = {};
        const seenUrls = new Set();

        // ── 1. Top Animes carousel ──
        const topItems = [];
        Array.from(doc.querySelectorAll('.caroustyle .item')).forEach(el => {
            const linkEl = el.querySelector('a');
            const imgEl = el.querySelector('img');
            const title = el.querySelector('.title1')?.textContent.trim();
            const subTitle = el.querySelector('.title0')?.textContent.trim();
            // URL from title link first (same element as title), then fallback
            let url = el.querySelector('.title1 a, .title0 a')?.getAttribute('href') || linkEl?.getAttribute('href');
            // Validate URL: skip non-anime links
            if (url && !url.match(/\/\d+-[\w-]+\.html/) && !url.includes('/anime/') && !url.includes('/anime-') && !url.includes('/manga/') && !url.includes('/series/')) url = undefined;
            const posterUrl = imgEl?.getAttribute('data-src') || imgEl?.getAttribute('data-lazy-src') || imgEl?.getAttribute('src') || linkEl?.querySelector('img')?.getAttribute('data-src') || linkEl?.querySelector('img')?.getAttribute('data-lazy-src') || linkEl?.querySelector('img')?.getAttribute('src');
            if (title && url && !seenUrls.has(url)) {
                seenUrls.add(url);
                topItems.push(new MultimediaItem({
                    title: subTitle ? title + ' (' + subTitle + ')' : title,
                    url: url.startsWith('http') ? url : baseUrl + url,
                    posterUrl: fixUrl(posterUrl), type: 'anime'
                }));
            }
        });
        if (topItems.length > 0) results['Top Animes'] = topItems;

        // ── 2. Derniers Épisodes (blocklastadded + mov.clearfix) ──
        Array.from(doc.querySelectorAll('.blocklastadded .mov.clearfix, .blocklastadded li')).forEach(el => {
            const langEl = el.querySelector('.langue.vostfr, .langue.vf, i.langue.vostfr, i.langue.vf');
            const linkEl = el.querySelector('a.full-link, a[href]');
            const imgEl = el.querySelector('img');
            const title = el.querySelector('.mov-t, .mov-m')?.textContent.trim() || imgEl?.getAttribute('alt') || linkEl?.textContent.trim();
            // URL from title link if available, otherwise from poster/link element
            let url = el.querySelector('.mov-t a, .mov-m a')?.getAttribute('href') || linkEl?.getAttribute('href') || linkEl?.getAttribute('data-link');
            // Validate URL: skip non-anime links
            if (url && !url.match(/\/\d+-[\w-]+\.html/) && !url.includes('/anime/') && !url.includes('/anime-') && !url.includes('/manga/') && !url.includes('/series/')) url = undefined;
            const posterUrl = imgEl?.getAttribute('data-src') || imgEl?.getAttribute('data-lazy-src') || imgEl?.getAttribute('src') || el.querySelector('.mov-i img')?.getAttribute('data-src') || el.querySelector('.mov-i img')?.getAttribute('data-lazy-src') || el.querySelector('.mov-i img')?.getAttribute('src');
            if (title && url && title.length > 2 && !seenUrls.has(url)) {
                seenUrls.add(url);
                const section = langEl?.classList?.contains('vf') ? 'Derniers Épisodes VF' : 'Derniers Épisodes VOSTFR';
                if (!results[section]) results[section] = [];
                results[section].push(new MultimediaItem({
                    title: title.trim(), url: url.startsWith('http') ? url : baseUrl + url,
                    posterUrl: fixUrl(posterUrl), type: 'anime'
                }));
            }
        });

        // ── 3. Content sections by headings ──
        Array.from(doc.querySelectorAll('h2, h3, h4')).forEach(heading => {
            const sectionTitle = heading.textContent.trim();
            if (!sectionTitle || sectionTitle.length < 2 || results[sectionTitle]) return;
            let container = heading.nextElementSibling;
            if (!container) container = heading.parentElement;
            if (!container) return;
            const items = [];
            Array.from(container.querySelectorAll('.mov.clearfix, .mov-i, a[href]')).forEach(el => {
                const linkEl = el.querySelector('a[href], a.full-link') || el;
                const imgEl = el.querySelector('img');
                const title = el.querySelector('.mov-t')?.textContent.trim() || imgEl?.getAttribute('alt') || linkEl?.textContent.trim();
                // URL from title link first, then from link element
                let url = el.querySelector('.mov-t a')?.getAttribute('href') || linkEl?.getAttribute('href') || linkEl?.getAttribute('data-link');
                // Validate URL: skip non-anime links
                if (url && !url.match(/\/\d+-[\w-]+\.html/) && !url.includes('/anime/') && !url.includes('/anime-') && !url.includes('/manga/') && !url.includes('/series/')) url = undefined;
                const posterUrl = imgEl?.getAttribute('data-src') || imgEl?.getAttribute('data-lazy-src') || imgEl?.getAttribute('src');
                if (title && url && title.length > 2 && !url.includes('#') && !seenUrls.has(url)) {
                    seenUrls.add(url);
                    items.push(new MultimediaItem({
                        title, url: url.startsWith('http') ? url : baseUrl + url,
                        posterUrl: fixUrl(posterUrl), type: 'anime'
                    }));
                }
            });
            if (items.length > 0) results[sectionTitle] = items;
        });

        // ── 4. Fallback ──
        if (Object.keys(results).length === 0) {
            const fallbackItems = [];
            Array.from(doc.querySelectorAll('.mov.clearfix a, .mov-i a, article a, .post-title a')).forEach(el => {
                const title = el.textContent.trim();
                const url = el.getAttribute('href');
                const imgEl = el.querySelector('img');
                const posterUrl = imgEl?.getAttribute('data-src') || imgEl?.getAttribute('data-lazy-src') || imgEl?.getAttribute('src');
                if (title && url && !url.includes('#') && title.length > 2 && !seenUrls.has(url)) {
                    seenUrls.add(url);
                    fallbackItems.push(new MultimediaItem({
                        title, url: url.startsWith('http') ? url : baseUrl + url,
                        posterUrl: fixUrl(posterUrl), type: 'anime'
                    }));
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

        // ── Helper: extract item from a DLE / Toroplay result element ──
        function extractSearchItem(el) {
            // URL from title-related link first (same element as title), then fall back
            const titleLinkEl = el.querySelector('.mov-t a, h2 a, h3 a, .title a, .anmt a, a.full-link');
            const posterLinkEl = el.querySelector('a.mov-img, a.poster, a[href*="/anime/"], a[href*="/anime-"], a[href*="/manga/"]');
            const anyLinkEl = el.tagName === 'A' ? el : el.querySelector('a[href]');
            const linkEl = titleLinkEl || posterLinkEl || anyLinkEl;
            // Title from .mov-t, h2, h3, .title, img alt, or link text
            const titleEl = el.querySelector('.mov-t, h2, h3, .title, .anmt, .film-name');
            const imgEl = el.querySelector('img');
            let title = titleEl?.textContent?.trim() || linkEl?.getAttribute('title') || imgEl?.getAttribute('alt') || linkEl?.textContent?.trim();
            let url = linkEl?.getAttribute('href') || linkEl?.getAttribute('data-link');
            // Validate URL: skip non-anime links (ads, social, etc.)
            if (url) {
                const isAnimeUrl = /\/\d+-[\w-]+\.html/.test(url) ||
                    /\/anime[-\/]/i.test(url) ||
                    url.includes('/manga/') ||
                    url.includes('/series/') ||
                    url.includes('-vostfr') ||
                    url.includes('-vf') ||
                    /^[a-z0-9][a-z0-9-]+$/i.test(url.replace(baseUrl, '').replace(/^\//, '').replace(/\/$/, ''));
                if (!isAnimeUrl) url = undefined;
            }
            const posterUrl = imgEl?.getAttribute('data-src') || imgEl?.getAttribute('src') || imgEl?.getAttribute('data-lazy-src');
            return { title, url, posterUrl };
        }

        // ── Helper: parse items from HTML ──
        async function parseItems(html) {
            if (!html || typeof html !== 'string') return [];
            const results = [];

            // Strategy 1: Parse via DOM with DLE selectors
            if (typeof parseHtml === 'function') {
                try {
                    const dom = await parseHtml(html);
                    // DLE-specific selectors (most likely first, site confirmed DLE-based)
                    const searchSelectors = [
                        '.mov.clearfix',          // DLE primary result container
                        '.mov',                    // DLE fallback
                        '.search-result',          // Generic search result
                        'article',                 // Semantic fallback
                        '.TPostMv',                // Toroplay4 theme
                        '.TPost.C',                // Toroplay4 film cards
                        '.page-item-detail',       // Dooplay theme
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
                    // mov.clearfix / mov-t pattern
                    /<div[^>]*class="[^"]*mov[^"]*clearfix[^"]*"[^>]*>[\s\S]*?<a[^>]+href="([^"]+)"[^>]*>[\s\S]*?<img[^>]+(?:data-src|data-lazy-src|src)="([^"]+)"[^>]*(?:alt="([^"]*)")?[\s\S]*?(?:mov-t[^>]*>([^<]+)<|class="[^"]*title[^"]*"[^>]*>([^<]+)<)/gi,
                    // Generic item with anime URL pattern
                    /<a[^>]+href="([^"]*(?:\/anime[-\/]|\/manga\/|\/series\/)[^"]+)"[^>]*>[\s\S]*?<img[^>]+(?:data-src|data-lazy-src|src)="([^"]+)"[^>]*(?:alt="([^"]*)")?[\s\S]*?<\/a>/gi,
                    // Simple anchor with image
                    /<a[^>]+href="([^"]+)"[^>]*>\s*<img[^>]+(?:data-src|data-lazy-src|src)="([^"]+)"[^>]+alt="([^"]*)"[^>]*>/gi
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

        // ── Phase 1: Run the 2 most likely DLE POST strategies IN PARALLEL ──
        // These are the primary DLE search endpoints — run simultaneously for speed
        const dleBody = `do=search&subaction=search&search_start=0&full_search=0&result_from=1&story=${encodeURIComponent(query)}`;
        const dleHeaders = { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' };
        const parallelResults = await Promise.allSettled([
            axios.post(baseUrl, dleBody, { headers: dleHeaders }),
            axios.post(baseUrl + '/index.php', dleBody, { headers: dleHeaders })
        ]);
        for (const result of parallelResults) {
            if (items.length > 0) break;
            if (result.status === 'fulfilled' && result.value.data) {
                const data = result.value.data;
                if (typeof data === 'string' && data.length > 500) {
                    const parsed = await parseItems(data);
                    for (const p of parsed) {
                        items.push(p);
                    }
                }
            }
        }

        // ── Phase 2: Sequential GET fallbacks (only if DLE POST failed) ──
        if (items.length === 0) {
            const getEndpoints = [
                `${baseUrl}/?s=${encodeURIComponent(query)}`,
                `${baseUrl}/search.html?keyword=${encodeURIComponent(query)}`,
                `${baseUrl}/search/${encodeURIComponent(query)}/`
            ];
            for (const endpoint of getEndpoints) {
                if (items.length > 0) break;
                try {
                    const res = await axios.get(endpoint, { headers });
                    if (res.data && typeof res.data === 'string' && res.data.length > 500) {
                        const parsed = await parseItems(res.data);
                        for (const p of parsed) {
                            items.push(p);
                        }
                    }
                } catch (e) { }
            }
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

function fixUrl(p) { if (!p) return ''; if (p.startsWith('http')) return p; return baseUrl + (p.startsWith('/') ? '' : '/') + p; }

function detectDubStatus(url, title) {
        const text = (url || '') + ' ' + (title || '');
        if (/\/vf\b|\(VF\)|-vf$/i.test(text)) return 'dub';
        if (/\/vostfr\b|\(VOSTFR\)|-vostfr$/i.test(text)) return 'sub';
        return 'none';
    }

    // Detect page-level dubStatus from itemprop=inLanguage metadata
    function detectPageDubStatus(doc, url) {
        // Try <span itemprop="inLanguage">VOSTFR</span> / VF
        const langEl = doc.querySelector('[itemprop="inLanguage"]');
        if (langEl) {
            const lang = langEl.textContent.trim().toUpperCase();
            if (lang === 'VF') return 'dub';
            if (lang === 'VOSTFR') return 'sub';
        }
        // Fallback: page URL
        return detectDubStatus(url, '');
    }

    // Determine dubStatus from the page URL pattern (VF or VOSTFR)
    function getDubStatusFromPageUrl(pageUrl) {
        if (/\/animes-vf\b|[-_]vf(?!o)/i.test(pageUrl)) return 'dub';
        if (/\/animes-vostfr\b|[-_]vostfr/i.test(pageUrl)) return 'sub';
        return undefined;
    }

    // Detect season number from section heading context (e.g. "Saison 1 : Jujutsu Kaisen", "OAV", "Spécial", "Saison 2 OAV")
    function detectSeasonFromHeading(el) {
        let node = el;
        while (node) {
            let prev = node.previousElementSibling;
            while (prev) {
                const text = prev.textContent.trim();
                const oavMatch = text.match(/\b(OAV|OVA|ONA|Sp[ée]cial|Special|Film)\s*(\d+)?\b/i);
                const sMatch = text.match(/S(?:aison|eason)\s*(\d+)/i);
                if (sMatch) {
                    let ct = undefined;
                    if (oavMatch) {
                        if (/film/i.test(oavMatch[1])) ct = 'Film';
                        else if (/sp[ée]cial|special/i.test(oavMatch[1])) ct = 'Spécial';
                        else ct = 'OAV';
                    }
                    return { season: parseInt(sMatch[1]), contentType: ct };
                }
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

    // Extract episode number from title more reliably
    // Prioritizes specific patterns ("Episode 3", "Épisode 12", "E04") over generic first number
    function extractEpisodeNumber(title) {
        if (!title) return undefined;
        const specific = title.match(/(?:Episode|Épisode|Ep|E(?!p))\s*(\d+)/i);
        if (specific) return parseInt(specific[1]);
        const nums = title.match(/\d+/g);
        if (nums && nums.length > 0) {
            return parseInt(nums[nums.length - 1]);
        }
        return undefined;
    }

    // Find alternative VF/VOSTFR version from the page HTML
    function findAlternativeVersionFromPage(html, currentUrl) {
        const lowerUrl = currentUrl.toLowerCase();
        let currentVersion = null;
        if (/\/animes-vostfr|[-_]vostfr|\bvostfr\b/i.test(lowerUrl)) currentVersion = 'VOSTFR';
        else if (/\/animes-vf|[-_]vf(?!o)|\bvf\b(?!o)/i.test(lowerUrl)) currentVersion = 'VF';
        if (!currentVersion) return { currentVersion: null, alternativeUrl: null };

        // Extract anime slug/ID from current URL
        const idMatch = currentUrl.match(/\/(\d+-[\w-]+)\.html/i);
        const altPath = currentVersion === 'VOSTFR' ? 'vf' : 'vostfr';
        let alternativeUrl = null;

        if (idMatch) {
            const animeId = idMatch[1];
            // Try to find the alternative version link in the page
            const altPatterns = [
                new RegExp('href=["\']([^"\']*animes-' + altPath + '/' + animeId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[^"\']*)["\']', 'gi'),
                new RegExp('href=["\']([^"\']*' + altPath + '[^"\']*' + animeId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[^"\']*)["\']', 'gi'),
            ];
            for (const regex of altPatterns) {
                if (alternativeUrl) break;
                const m = regex.exec(html);
                if (m && m[1]) {
                    alternativeUrl = m[1].startsWith('http') ? m[1] : baseUrl + (m[1].startsWith('/') ? '' : '/') + m[1];
                }
            }
        }
        // Try to find by language switcher or flags
        if (!alternativeUrl) {
            const linkPatterns = [
                new RegExp('href=["\']([^"\']*(?:vf|vostfr)[^"\']*)["\'][^>]*class=["\'][^"\']*(?:flag|lang|switch|change)[^"\']*["\']', 'gi'),
                new RegExp('href=["\']([^"\']*animes-' + altPath + '[^"\']*\.html)["\']', 'gi'),
            ];
            for (const regex of linkPatterns) {
                if (alternativeUrl) break;
                const m = regex.exec(html);
                if (m && m[1] && !m[1].includes(currentUrl)) {
                    alternativeUrl = m[1].startsWith('http') ? m[1] : baseUrl + (m[1].startsWith('/') ? '' : '/') + m[1];
                }
            }
        }
        return { currentVersion, alternativeUrl };
    }

async function load(url, cb) {
    try {
        const res = await axios.get(url, { headers });
        const html = res.data;
        const doc = await parseHtml(html);
        const title = doc.querySelector('h1')?.textContent.trim() || doc.querySelector('.film-info .title')?.textContent.trim();
        // Description: try multiple selectors
        const description = doc.querySelector('.description')?.textContent.trim() ||
            doc.querySelector('span[itemprop="description"]')?.textContent.trim() ||
            doc.querySelector('.entry-content p')?.textContent.trim() ||
            doc.querySelector('.movie-desc')?.textContent.trim() ||
            doc.querySelector('.full-text')?.textContent.trim() ||
            doc.querySelector('article p')?.textContent.trim() ||
            doc.querySelector('meta[name="description"]')?.getAttribute('content') ||
            doc.querySelector('meta[property="og:description"]')?.getAttribute('content');
        // Poster: try #posterimg, then .poster img, then og:image (with data-src/data-lazy-src fallback for lazy-loaded)
        let rawPoster = doc.querySelector('#posterimg')?.getAttribute('src') ||
            doc.querySelector('#posterimg')?.getAttribute('data-src') ||
            doc.querySelector('#posterimg')?.getAttribute('data-lazy-src') ||
            doc.querySelector('.poster img')?.getAttribute('src') ||
            doc.querySelector('.poster img')?.getAttribute('data-src') ||
            doc.querySelector('.poster img')?.getAttribute('data-lazy-src') ||
            doc.querySelector('.mov-img img')?.getAttribute('src') ||
            doc.querySelector('.mov-img img')?.getAttribute('data-src') ||
            doc.querySelector('.mov-img img')?.getAttribute('data-lazy-src') ||
            doc.querySelector('.TPostBg')?.getAttribute('src') ||
            doc.querySelector('.TPostBg')?.getAttribute('data-src') ||
            doc.querySelector('[itemprop="image"]')?.getAttribute('content') ||
            doc.querySelector('[itemprop="image"] img')?.getAttribute('src') ||
            doc.querySelector('[itemprop="image"] img')?.getAttribute('data-src') ||
            doc.querySelector('.entry-content img')?.getAttribute('src') ||
            doc.querySelector('.entry-content img')?.getAttribute('data-src') ||
            doc.querySelector('article img')?.getAttribute('src') ||
            doc.querySelector('article img')?.getAttribute('data-src') ||
            doc.querySelector('meta[property="og:image"]')?.getAttribute('content') ||
            doc.querySelector('meta[name="twitter:image"]')?.getAttribute('content');
        // Regex fallback: extract posterimg src from raw HTML if DOM selectors failed
        if (!rawPoster) {
            const posterMatch = html.match(/id=["']posterimg["'][^>]*src=["']([^"']+)["']/i) ||
                html.match(/src=["']([^"']+)["'][^>]*id=["']posterimg["']/i) ||
                html.match(/<img[^>]+class=["'][^"']*poster[^"']*["'][^>]+src=["']([^"']+)["']/i) ||
                html.match(/<img[^>]+src=["']([^"']+)["'][^>]*class=["'][^"']*poster[^"']*["']/i) ||
                html.match(/property=["']og:image["'][^>]*content=["']([^"']+)["']/i) ||
                html.match(/name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i);
            if (posterMatch) rawPoster = posterMatch[1];
        }
        const posterUrl = fixUrl(rawPoster);
        // Extract metadata: year, genres, status, score
        // Year: try DOM selectors first, then regex on HTML
        const yearFromDOM = doc.querySelector('.fdi-year a, .fdi-item.fdi-year a, .year, [itemprop="datePublished"], .Info a[href*="year"]')?.textContent.trim();
        const yearFromDOMNum = yearFromDOM ? parseInt(yearFromDOM.match(/\d{4}/)?.[0] || '0') : undefined;
        const yearMatch = html.match(/Date de sortie\s*:?\s*(\d{4})/i) || html.match(/Ann[eé]e\s*:?\s*(\d{4})/i) || html.match(/year["']?\s*:?\s*["']?(\d{4})/i) || html.match(/datePublished["']?\s*:?\s*["']?(\d{4})/i) || html.match(/<(?:span|div)[^>]*class=["'][^"']*year[^"']*["'][^>]*>\s*(\d{4})\s*<\/(?:span|div)>/i);
        const year = yearFromDOMNum || (yearMatch ? parseInt(yearMatch[1]) : undefined);
        // Genres: try multiple selector strategies
        const genreEls = Array.from(doc.querySelectorAll('span[itemprop="genre"], .sgenerx a, .genre a, .genres a, .category a, .Tags a, .wdgt-cat a, [class*="genre"] a, .Info a[href*="genre"]')).map(el => el.textContent.trim()).filter(Boolean);
        // Status: try selectors then regex fallback
        const statusEl = doc.querySelector('.status, .statut, [class*="status"], [class*="Status"], .Status, .Statut');
        let status = statusEl?.textContent?.trim()?.toLowerCase();
        if (!status) {
            const statusMatch = html.match(/Production\s*:?\s*(Oui|Yes|Non|No|En cours|Terminé|Finished)/i) ||
                html.match(/Statut\s*:?\s*([^<\n]+)/i) ||
                html.match(/Status\s*:?\s*([^<\n]+)/i) ||
                html.match(/\b(En cours|Termin[ée]|Finished|Ongoing|Completed|Airing)\b/i);
            if (statusMatch) status = statusMatch[1]?.trim().toLowerCase() || statusMatch[0]?.toLowerCase();
        }
        if (status) {
            if (/termin|complet|fini|ended|finished/i.test(status)) status = 'completed';
            else if (/cours|airing|ongoing|en cours/i.test(status)) status = 'ongoing';
        }
        // Score: try multiple selectors then regex fallback
        const scoreEl = doc.querySelector('.rating, .ratig-layer, [class*="rating"], [class*="score"], [itemprop="ratingValue"], .post-item .rating, .total_votes, .rating-number');
        const rawScore = scoreEl?.textContent ? parseFloat(scoreEl.textContent.replace(/[^\d.]/g, '')) || undefined : undefined;
        const scoreMatch = !rawScore ? html.match(/"ratingValue"\s*:\s*([\d.]+)/i) || html.match(/<meta[^>]*itemprop=["']ratingValue["'][^>]*content=["']([\d.]+)["']/i) || html.match(/>\s*([\d.]+)\s*\/\s*10\s*<\/span>/i) : null;
        const score = rawScore || (scoreMatch ? parseFloat(scoreMatch[1]) : undefined);
        const episodes = [];
        const seenEpUrls = new Set();
        const seenEpTriples = new Set();
        // Detect page-level dubStatus: URL first, then metadata, then default
        const pageDubStatus = getDubStatusFromPageUrl(url) || detectPageDubStatus(doc, url) || 'none';

        // ── DLE episode links: try multiple selectors ──
        const epSelectors = [
            '.episodes-list a',
            '.episode-link',
            'select option',
            '.ep-item a',
            '.mov-ep a',
            'a[href*="episode"], a[href*="ep-"]'
        ];
        for (const sel of epSelectors) {
            if (episodes.length > 0) break;
            doc.querySelectorAll(sel).forEach(el => {
                const epUrl = el.getAttribute('href') || el.getAttribute('value');
                const epTitle = el.textContent.trim();
                if (epUrl) {
                    const fullEpUrl = epUrl.startsWith('http') ? epUrl : baseUrl + epUrl;
                    if (seenEpUrls.has(fullEpUrl)) return;
                    seenEpUrls.add(fullEpUrl);
                    // Season from heading context first, then from episode title
                    const headingSeason = detectSeasonFromHeading(el);
                    const titleDetected = detectSeasonAndType(epTitle);
                    // Extract episode number with specific patterns
                    let epNum = extractEpisodeNumber(epTitle);
                    if (epNum === undefined) {
                        if (headingSeason.contentType) {
                            epNum = 1;
                        } else {
                            epNum = episodes.length + 1;
                        }
                    }
                    const seasonNum = headingSeason.season !== undefined ? headingSeason.season : titleDetected.season;
                    const contentType = headingSeason.contentType || titleDetected.contentType;
                    // Dub status detection
                    let dubSt = detectDubStatus(epUrl, epTitle);
                    if (dubSt === 'none') dubSt = pageDubStatus;
                    // Dedup by (season, epNum, dubStatus) to avoid duplicates across sections
                    const tripleKey = `${seasonNum || 1}-${epNum}-${dubSt}`;
                    if (seenEpTriples.has(tripleKey)) return;
                    seenEpTriples.add(tripleKey);
                    episodes.push(new Episode({
                        name: epTitle || ('Episode ' + epNum),
                        episode: epNum,
                        url: fullEpUrl,
                        season: seasonNum || 1,
                        posterUrl: posterUrl,
                        contentType: contentType,
                        dubStatus: dubSt
                    }));
                }
            });
        }

        // ── Fallback: parse div.eps with format "epNum!url, epNum!url" ──
        if (episodes.length === 0) {
            const epsDiv = doc.querySelector('.eps');
            if (epsDiv) {
                const epsData = epsDiv.textContent.trim();
                const pairs = epsData.split(',').map(s => s.trim()).filter(s => s.includes('!'));
                pairs.forEach(pair => {
                    const [epNum, epUrl] = pair.split('!');
                    if (epNum && epUrl && epUrl.startsWith('http')) {
                        const fullEpUrl = epUrl.trim();
                        if (seenEpUrls.has(fullEpUrl)) return;
                        seenEpUrls.add(fullEpUrl);
                        let dubSt = detectDubStatus(fullEpUrl, 'Épisode ' + epNum.trim());
                        if (dubSt === 'none') dubSt = pageDubStatus;
                        const tripleKey = `1-${parseInt(epNum.trim())}-${dubSt}`;
                        if (seenEpTriples.has(tripleKey)) return;
                        seenEpTriples.add(tripleKey);
                        episodes.push(new Episode({
                            name: 'Épisode ' + epNum.trim(),
                            episode: parseInt(epNum.trim()),
                            url: fullEpUrl,
                            season: 1,
                            posterUrl: posterUrl,
                            dubStatus: dubSt
                        }));
                    }
                });
            }
        }

        // ── Film fallback: no episodes → pass page URL to loadStreams ──
        if (episodes.length === 0) {
            let filmDubSt = detectDubStatus(url, title);
            if (filmDubSt === 'none') filmDubSt = pageDubStatus;
            episodes.push(new Episode({
                name: title || 'Film',
                episode: 1,
                url: url,
                season: 1,
                posterUrl: posterUrl,
                dubStatus: filmDubSt
            }));
        }

        // ── Alternative VF/VOSTFR version detection ──
        const { currentVersion, alternativeUrl } = findAlternativeVersionFromPage(html, url);
        if (alternativeUrl && episodes.length > 0) {
            const altDubStatus = currentVersion === 'VF' ? 'sub' : 'dub';
            // Add alternative dubStatus to existing episodes if not already present
            const episodesByTriple = new Map();
            for (const ep of episodes) {
                const key = `${ep.season}-${ep.episode}`;
                if (!episodesByTriple.has(key)) episodesByTriple.set(key, []);
                episodesByTriple.get(key).push(ep.dubStatus);
            }
            // Try to fetch the alternative version page to get its episode URLs
            try {
                const altRes = await axios.get(alternativeUrl, { headers });
                if (altRes.status === 200 && typeof altRes.data === 'string' && altRes.data.length > 500) {
                    const altDoc = await parseHtml(altRes.data);
                    // Parse alternative version's episodes using the same selectors
                    let altFound = 0;
                    for (const sel of epSelectors) {
                        if (altFound > 0) break;
                        altDoc.querySelectorAll(sel).forEach(el => {
                            const altEpUrl = el.getAttribute('href') || el.getAttribute('value');
                            const altEpTitle = el.textContent.trim();
                            if (altEpUrl) {
                                const fullAltEpUrl = altEpUrl.startsWith('http') ? altEpUrl : baseUrl + altEpUrl;
                                if (seenEpUrls.has(fullAltEpUrl)) return;
                                seenEpUrls.add(fullAltEpUrl);
                                const altSeason = detectSeasonFromHeading(el);
                                const altDetected = detectSeasonAndType(altEpTitle);
                                let altEpNum = extractEpisodeNumber(altEpTitle);
                                if (altEpNum === undefined) {
                                    if (altSeason.contentType) altEpNum = 1;
                                    else altEpNum = altFound + 1;
                                }
                                const altSeasonNum = altSeason.season !== undefined ? altSeason.season : altDetected.season;
                                const altCt = altSeason.contentType || altDetected.contentType;
                                const altTripleKey = `${altSeasonNum || 1}-${altEpNum}-${altDubStatus}`;
                                if (seenEpTriples.has(altTripleKey)) return;
                                seenEpTriples.add(altTripleKey);
                                altFound++;
                                episodes.push(new Episode({
                                    name: altEpTitle || ('Episode ' + altEpNum),
                                    episode: altEpNum,
                                    url: fullAltEpUrl,
                                    season: altSeasonNum || 1,
                                    posterUrl: posterUrl,
                                    contentType: altCt,
                                    dubStatus: altDubStatus
                                }));
                            }
                        });
                        if (altFound > 0) break;
                    }
                    // Fallback: div.eps alternative
                    if (altDoc.querySelector('.eps')) {
                        const epsData = altDoc.querySelector('.eps').textContent.trim();
                        const pairs = epsData.split(',').map(s => s.trim()).filter(s => s.includes('!'));
                        pairs.forEach(pair => {
                            const [epNum, epUrl] = pair.split('!');
                            if (epNum && epUrl && epUrl.startsWith('http')) {
                                const fullAltEpUrl = epUrl.trim();
                                if (seenEpUrls.has(fullAltEpUrl)) return;
                                seenEpUrls.add(fullAltEpUrl);
                                const altTripleKey = `1-${parseInt(epNum.trim())}-${altDubStatus}`;
                                if (seenEpTriples.has(altTripleKey)) return;
                                seenEpTriples.add(altTripleKey);
                                episodes.push(new Episode({
                                    name: 'Épisode ' + epNum.trim(),
                                    episode: parseInt(epNum.trim()),
                                    url: fullAltEpUrl,
                                    season: 1,
                                    posterUrl: posterUrl,
                                    dubStatus: altDubStatus
                                }));
                            }
                        });
                    }
                }
            } catch (e) { /* Alternative version not available */ }
        }

        // ── Extract recommendations from related/similaires sections ──
        const recommendations = [];
        const recSeenUrls = new Set();

        // Strategy 1: Specific carousel selectors (primary)
        const recSelectors = [
            '.related.tcarusel .mov.tcarusel-item',
            '.related.tcarusel .mov',
            '.related .mov.clearfix',
            '.related .mov',
            '.tcarusel-scroll .mov',
            '.carou-top .mov',
            '.tcarusel .mov',
            '[class*="related"] .mov',
            '[class*="similaire"] .mov',
        ];
        for (const sel of recSelectors) {
            if (recommendations.length >= 15) break;
            doc.querySelectorAll(sel).forEach(el => {
                if (recommendations.length >= 15) return;
                const linkEl = el.querySelector('a[data-link], a[href]');
                const imgEl = el.querySelector('img');
                const titleEl = el.querySelector('.mov-t, a.mov-t, .title, h3, h4');
                const recTitle = titleEl?.textContent.trim() || linkEl?.getAttribute('title') || imgEl?.getAttribute('alt');
                const recUrl = linkEl?.getAttribute('data-link') || linkEl?.getAttribute('href');
                if (!recTitle || !recUrl || recUrl.includes('#') || recUrl.includes('javascript:')) return;
                const fullRecUrl = recUrl.startsWith('http') ? recUrl : baseUrl + recUrl;
                if (recSeenUrls.has(fullRecUrl) || fullRecUrl === url) return;
                recSeenUrls.add(fullRecUrl);
                const recPoster = imgEl?.getAttribute('data-src') || imgEl?.getAttribute('src');
                recommendations.push(new MultimediaItem({
                    title: recTitle,
                    url: fullRecUrl,
                    posterUrl: recPoster ? fixUrl(recPoster) : '',
                    type: 'anime'
                }));
            });
            if (recommendations.length > 0) break;
        }

        // ── Strategy 2: Heading-based recommendation sections ──
        if (recommendations.length === 0) {
            const headingKeywords = /recommand|recommend|similaire|related|suggestion|vous aimerez|autre|also like|popular/i;
            doc.querySelectorAll('h2, h3, h4').forEach(heading => {
                if (recommendations.length >= 10) return;
                const headingText = heading.textContent.trim();
                if (!headingKeywords.test(headingText)) return;
                let container = heading.closest('section, div, .block') || heading.parentElement;
                if (!container) return;
                container.querySelectorAll('.mov.clearfix, .mov, .tcarusel-item, a[href*="/anime"]').forEach(el => {
                    if (recommendations.length >= 10) return;
                    const linkEl = el.tagName === 'A' ? el : el.querySelector('a[data-link], a[href]');
                    const imgEl = el.querySelector('img');
                    const titleEl = el.querySelector('.mov-t, h3, h4, .title');
                    const recTitle = titleEl?.textContent.trim() || linkEl?.getAttribute('title') || imgEl?.getAttribute('alt') || linkEl?.textContent.trim();
                    const recUrl = linkEl?.getAttribute('data-link') || linkEl?.getAttribute('href');
                    if (!recTitle || !recUrl || recUrl.includes('#')) return;
                    const fullRecUrl = recUrl.startsWith('http') ? recUrl : baseUrl + recUrl;
                    if (recSeenUrls.has(fullRecUrl) || fullRecUrl === url) return;
                    recSeenUrls.add(fullRecUrl);
                    const recPoster = imgEl?.getAttribute('data-src') || imgEl?.getAttribute('src');
                    recommendations.push(new MultimediaItem({
                        title: recTitle,
                        url: fullRecUrl,
                        posterUrl: recPoster ? fixUrl(recPoster) : '',
                        type: 'anime'
                    }));
                });
            });
        }

        // ── Strategy 3: Genre-based recommendations using search ──
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

        cb({ success: true, data: new MultimediaItem({ type: "anime", title, description, posterUrl, episodes, year, score, status, genres: genreEls.length > 0 ? genreEls : undefined, recommendations: recommendations.length > 0 ? recommendations : undefined }) });
    } catch (e) { log('load error: ' + url, e); cb({ success: false, errorCode: 'LOAD_ERROR', message: String(e) }); }
}

async function loadStreams(url, cb) {
    try {
        // Extract movie/season ID from URL for AJAX requests (DLE Toroplay4 pattern)
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
        // DLE/Toroplay4 pattern: <div data-server-id="1" data-embed="URL">
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
                    if (/^\d+$/.test(val1) && !/^\d+$/.test(val2)) {
                        serverId = val1; embedUrl = val2;
                    } else {
                        serverId = val2; embedUrl = val1;
                    }
                } else if (sMatch[1]) {
                    serverId = sMatch[1];
                    if (fullStoryHtml) {
                        const cpMatch = fullStoryHtml.match(new RegExp(`content_player_${serverId}[^"]*"[^>]*>([^<]*)<`, 'i'));
                        if (cpMatch && cpMatch[1].trim().length > 5) {
                            embedUrl = cpMatch[1].trim();
                        }
                    }
                } else continue;

                if (streams.some(s => s.quality === 'Serveur ' + serverId)) continue;

                let playerUrl = embedUrl;
                if (fullStoryHtml && (!playerUrl || playerUrl.length <= 5)) {
                    const cpRegex = new RegExp(`content_player_${serverId}[^"]*"[^>]*>([^<]*)<`, 'i');
                    const cpMatch = fullStoryHtml.match(cpRegex);
                    if (cpMatch && cpMatch[1].trim().length > 5) {
                        playerUrl = cpMatch[1].trim();
                    }
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
                if (streams.some(s => s.quality && s.quality.includes('Serveur ' + num))) continue;
                if (vid && hostPatterns[num]) {
                    if (vid.startsWith('http://') || vid.startsWith('https://')) {
                        await tryAddStream(vid, 'Source ' + num);
                    } else {
                        const hostUrl = hostPatterns[num](vid);
                        await tryAddStream(hostUrl, 'Source ' + num);
                    }
                } else if (vid && vid.startsWith('http')) {
                    await tryAddStream(vid, 'Source ' + num);
                }
            }
        }

        // ── Strategy 3: Iframe extraction (trembed embeds, direct iframes) ──
        if (streams.length === 0) {
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
                        if (embedUrl.includes('trembed=') || embedUrl.includes('tremor=')) {
                            const trembedRes = await axios.get(embedUrl, { headers });
                            const trembedHtml = trembedRes.data;
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
                                    try {
                                        const origin = embedUrl.match(/^https?:\/\/[^\/]+/)[0];
                                        vUrl = origin + (vUrl.startsWith('/') ? '' : '/') + vUrl;
                                    } catch (e) {
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
            const lazyRegex = /data-src=["']([^"']+(?:trembed|tremor|player|embed)[^"']*)["']/gi;
            const lazyUrls = [];
            let lMatch;
            while ((lMatch = lazyRegex.exec(html)) !== null) {
                if (lMatch[1]) lazyUrls.push(lMatch[1]);
            }
            if (lazyUrls.length > 0) {
                const results = await Promise.all(lazyUrls.map(async (lazyUrl) => {
                    try {
                        const fullUrl = lazyUrl.startsWith('http') ? lazyUrl : baseUrl + (lazyUrl.startsWith('/') ? '' : '/') + lazyUrl;
                        if (lazyUrl.includes('trembed=') || lazyUrl.includes('tremor=')) {
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
