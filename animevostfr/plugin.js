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
        }

        // --- Embed4Me / Lplayer ---
        if (url.includes('embed4me') || url.includes('lpayer')) {
            return new StreamResult({ url: "MAGIC_PROXY_v1" + encodeBase64(url), quality: 'Auto', source: 'Embed4Me', headers: { 'Referer': baseUrl } });
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
            const url = linkEl?.getAttribute('href');
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
            const url = linkEl?.getAttribute('href');
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
        const res = await axios.get(`${baseUrl}/?s=${encodeURIComponent(query)}`, { headers });
        const doc = await parseHtml(res.data);
        const items = [];
        const seenUrls = new Set();
        // Toroplay4 theme: try multiple selectors for search results
        const selectors = ['.TPostMv', '.episode-item', 'article', 'a[href*="/catalogue/"]'];
        for (const sel of selectors) {
            Array.from(doc.querySelectorAll(sel)).forEach(el => {
                const linkEl = el.querySelector ? el.querySelector('a') : el;
                const imgEl = el.querySelector ? el.querySelector('img') : null;
                const titleEl = el.querySelector('.TPMvCn .anmt') || el.querySelector('.episode-link') || el.querySelector('h2') || el.querySelector('h3');
                const title = titleEl?.textContent.trim() || linkEl?.textContent.trim();
                const url = linkEl?.getAttribute('href');
                const posterUrl = imgEl?.getAttribute('data-src') || imgEl?.getAttribute('src');
                if (title && url && title.length > 1 && !seenUrls.has(url)) {
                    seenUrls.add(url);
                    items.push(new MultimediaItem({
                        title,
                        url: url.startsWith('http') ? url : baseUrl + url,
                        posterUrl: (function(p){ if(!p) return ''; if(p.startsWith('http')) return p; return baseUrl + (p.startsWith('/') ? '' : '/') + p; })(posterUrl),
                        type: 'anime', playbackPolicy: 'none'
                    }));
                }
            });
            if (items.length > 0) break;
        }
        cb({ success: true, data: items });
    } catch (e) { log('search error', e); cb({ success: false, errorCode: 'SEARCH_ERROR', message: String(e) }); }
}

function detectSeasonAndType(name) {
        let season = undefined;
        let contentType = undefined;
        if (name) {
            const sMatch = name.match(/(?:saison|season|s)\s*(\d+)/i);
            if (sMatch) season = parseInt(sMatch[1]);
            const s00Match = name.match(/S(\d+)E\d+/i);
            if (s00Match) season = parseInt(s00Match[1]);
            if (/\b(?:oav|ova)\b/i.test(name)) contentType = 'OAV';
            else if (/\bfilm\b/i.test(name)) contentType = 'Film';
            else if (/\b(?:special|spécial)\b/i.test(name)) contentType = 'Spécial';
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
        // Detect page-level dubStatus from URL/title
        const pageDubStatus = detectDubStatus(url, title);
        // Toroplay4: episode-item grouped under VF/VOSTFR headings
        doc.querySelectorAll('.episode-item').forEach((el, index) => {
            const linkEl = el.querySelector('.episode-link') || el.querySelector('a');
            const epUrl = linkEl?.getAttribute('href');
            const epTitle = linkEl?.textContent.trim();
            const epNum = epTitle?.match(/\d+/)?.[0] || (index + 1);
            if (epUrl) {
                const detected = detectSeasonAndType(epTitle);
                // Try episode-level detection first, then heading context, then page-level fallback
                let dubStatus = detectDubStatus(epUrl, epTitle);
                if (dubStatus === 'none') dubStatus = detectDubStatusFromHeading(el) || pageDubStatus;
                episodes.push(new Episode({
                    name: epTitle || ('Episode ' + epNum),
                    episode: parseInt(epNum),
                    url: epUrl.startsWith('http') ? epUrl : baseUrl + epUrl,
                    season: detected.season,
                    posterUrl: posterUrl,
                    contentType: detected.contentType,
                    dubStatus: dubStatus
                }));
            }
        });
        // Film fallback: no episodes → extract player iframe URL (trembed)
        if (episodes.length === 0) {
            const playerIframe = doc.querySelector('.TPlayerTb iframe[src], .TPlayerCn iframe[src], #player iframe[src]');
            if (playerIframe) {
                const playerUrl = playerIframe.getAttribute('src');
                if (playerUrl) {                    episodes.push(new Episode({
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
        cb({ success: true, data: new MultimediaItem({ type: "anime", title, description, posterUrl, episodes, year, status, genres: genreEls.length > 0 ? genreEls : undefined }) });
    } catch (e) { log('load error: ' + url, e); cb({ success: false, errorCode: 'LOAD_ERROR', message: String(e) }); }
}

async function loadStreams(url, cb) {
    try {
        const res = await axios.get(url, { headers });
        const html = res.data;
        const streams = [];
        // Toroplay4 theme: TPlayerCn with iframes and lazy-player data-src
        // First try to find iframes (direct embeds) and resolve trembed URLs in parallel
        const iframeRegex = /<iframe[^>]*src=["']([^"']+)["'][^>]*>/gi;
        const embedUrls = [];
        let match;
        while ((match = iframeRegex.exec(html)) !== null) {
            const embedUrl = match[1];
            if (embedUrl && !embedUrl.includes('ads') && !embedUrl.includes('google')) {
                embedUrls.push(embedUrl);
            }
        }
        // Resolve all embed URLs in parallel
        if (embedUrls.length > 0) {
            const results = await Promise.all(embedUrls.map(async (embedUrl) => {
                try {
                    if (embedUrl.includes('trembed=')) {
                        const trembedRes = await axios.get(embedUrl, { headers });
                        const trembedHtml = trembedRes.data;
                        const innerIframe = trembedHtml.match(/<iframe[^>]*src=["']([^"']+)["'][^>]*>/i);
                        if (innerIframe && innerIframe[1]) {
                            return await Extractors.resolveStream(innerIframe[1]);
                        }
                    } else {
                        return await Extractors.resolveStream(embedUrl);
                    }
                } catch (e) { return null; }
            }));
            results.forEach(r => { if (r) streams.push(r); });
        }
        // Fallback: look for lazy-player data-src attributes
        if (streams.length === 0) {
            const lazyRegex = /data-src=["']([^"']+trembed[^"']*)["']/gi;
            const lazyUrls = [];
            let lMatch;
            while ((lMatch = lazyRegex.exec(html)) !== null) {
                if (lMatch[1]) lazyUrls.push(lMatch[1]);
            }
            // Resolve all lazy trembed URLs in parallel
            if (lazyUrls.length > 0) {
                const results = await Promise.all(lazyUrls.map(async (trembedUrl) => {
                    try {
                        const fullUrl = trembedUrl.includes('http') ? trembedUrl : baseUrl + trembedUrl;
                        const trembedRes = await axios.get(fullUrl, { headers });
                        const trembedHtml = trembedRes.data;
                        const innerIframe = trembedHtml.match(/<iframe[^>]*src=["']([^"']+)["'][^>]*>/i);
                        if (innerIframe && innerIframe[1]) {
                            return await Extractors.resolveStream(innerIframe[1]);
                        }
                    } catch (e) { return null; }
                    return null;
                }));
                results.forEach(r => { if (r) streams.push(r); });
            }
        }
        // Fallback: direct video URLs
        if (streams.length === 0) {
            const videoRegex = /file["']?\s*:\s*["']?(https?:\/\/[^"'\s]+\.m3u8[^"'\s]*|https?:\/\/[^"'\s]+\.mp4[^"'\s]*)["']?/gi;
            let vMatch;
            while ((vMatch = videoRegex.exec(html)) !== null) {
                streams.push(new StreamResult({ url: vMatch[1], quality: 'Auto', source: 'Direct' }));
            }
        }
        cb({ success: true, data: streams });
    } catch (e) { log('loadStreams error: ' + url, e); cb({ success: false, errorCode: 'STREAM_ERROR', message: String(e) }); }
}

globalThis.getHome = getHome;
globalThis.search = search;
globalThis.load = load;
globalThis.loadStreams = loadStreams;
