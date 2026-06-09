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
                r = await http_post(url, h, data);
            } catch (e) {
                r = { status: 403, body: 'cloudflare' };
            }
            if (r.status === 403 || r.status === 503 || (typeof r.body === 'string' && (r.body.includes('Just a moment') || r.body.toLowerCase().includes('cloudflare') || r.body.includes('Challenge Validation')))) {
                if (typeof solveCaptcha !== 'undefined') {
                    await solveCaptcha('cloudflare', url);
                    try {
                        r = await http_post(url, h, data);
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

const PLUGIN_ID = 'animesultra';
function log(msg, data) { try { console.log(`[${PLUGIN_ID}] ${msg}`, data || ''); } catch (_) { } }

const baseUrl = (typeof manifest !== 'undefined' && manifest.baseUrl) ? manifest.baseUrl : 'https://ww.animesultra.org';
const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
    'Referer': baseUrl,
    'Origin': baseUrl
};

function fixUrl(p) { if (!p) return ''; if (p.startsWith('http')) return p; return baseUrl + (p.startsWith('/') ? '' : '/') + p; }

const PluginExtractors = {

    async resolveStream(url) {
        if (!url) return null;

        // ──────────────────────────────────────────────────────────
        // 1. Try SkyStream built-in loadExtractor() first
        // ──────────────────────────────────────────────────────────
        if (typeof loadExtractor !== 'undefined') {
            try {
                const streams = await loadExtractor(url);
                if (streams && streams.length > 0) return streams[0];
            } catch (e) { }
        }

        // ──────────────────────────────────────────────────────────
        // 2. Bundled skystream-extractors library
        // ──────────────────────────────────────────────────────────
        try {
            let extracted = [];
            if (url.includes('mixdrop')) {
                extracted = await new MixDrop().getUrl(url);
            } else if (url.includes('streamtape')) {
                extracted = await new StreamTape().getUrl(url);
            } else if (url.includes('voe')) {
                extracted = await new Voe().getUrl(url);
            } else if (url.includes('filemoon')) {
                extracted = await new Filemoon().getUrl(url);
            } else if (url.includes('dood')) {
                extracted = await new DoodExtractor().getUrl(url);
            } else if (url.includes('hubcloud') || url.includes('hd-runtv')) {
                extracted = await new HubCloud().getUrl(url);
            }
            if (extracted && extracted.length > 0) {
                return extracted[0];
            }
        } catch (e) { log('Extractor failed: ' + url, e); }

        // ──────────────────────────────────────────────────────────
        // 3. Manual extraction for hosts not covered above
        // ──────────────────────────────────────────────────────────

        // --- Sibnet ---
        if (url.includes('sibnet.ru')) {
            try {
                const res = await axios.get(url, { headers: { 'Referer': url } });
                if (typeof res.data === 'string') {
                    const match = res.data.match(/player\.src\(\[\{src:\s*["']([^"']+)["']/i) ||
                        res.data.match(/src:\s*["'](\/v\/.*?\.mp4)["']/i) ||
                        res.data.match(/["']?src["']?\s*:\s*["']([^"']+\.mp4)["']/i);
                    if (match) {
                        let videoUrl = match[1];
                        if (videoUrl.startsWith('//')) videoUrl = 'https:' + videoUrl;
                        else if (videoUrl.startsWith('/')) videoUrl = 'https://video.sibnet.ru' + videoUrl;
                        return new StreamResult({
                            url: "MAGIC_PROXY_v1" + encodeBase64(videoUrl),
                            quality: 'Auto',
                            source: 'Sibnet',
                            headers: { 'Referer': url }
                        });
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
                        let videoUrl = match[1];
                        if (videoUrl.startsWith('//')) videoUrl = 'https:' + videoUrl;
                        return new StreamResult({
                            url: "MAGIC_PROXY_v1" + encodeBase64(videoUrl),
                            quality: 'Auto',
                            source: 'Sendvid',
                            headers: { 'Referer': url }
                        });
                    }
                }
            } catch (e) { log('Sendvid extraction failed', e); }
        }

        // --- Vidmoly (domain migrated to vidmoly.net) ---
        if (url.includes('vidmoly')) {
            try {
                let vidmolyUrl = url.replace(/vidmoly\.to/g, 'vidmoly.net');
                const vidmolyHeaders = {
                    'Referer': baseUrl,
                    'Sec-Fetch-Dest': 'iframe',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0'
                };
                let res = await axios.get(vidmolyUrl, { headers: vidmolyHeaders });
                let html = typeof res.data === 'string' ? res.data : '';
                if (typeof getAndUnpack !== 'undefined' && html.includes('eval(function(p,a,c,k')) {
                    try {
                        const unpacked = getAndUnpack(html);
                        if (unpacked) html = html + '\n' + unpacked;
                    } catch (e) { }
                }
                const fileMatch = html.match(/sources\s*:\s*\[\s*\{\s*file\s*:\s*["']([^"']+)["']/i) ||
                    html.match(/file\s*:\s*["']([^"']+\.m3u8[^"']*)["']/i) ||
                    html.match(/file\s*:\s*["']([^"']+\.mp4[^"']*)["']/i) ||
                    html.match(/<source\s+src=["']([^"']+)["']/i);
                if (fileMatch) {
                    let videoUrl = fileMatch[1];
                    if (videoUrl.startsWith('//')) videoUrl = 'https:' + videoUrl;
                    return new StreamResult({
                        url: "MAGIC_PROXY_v1" + encodeBase64(videoUrl),
                        quality: 'Auto',
                        source: 'Vidmoly',
                        headers: { 'Referer': vidmolyUrl }
                    });
                }
                // Fallback: try vidmoly.to domain if vidmoly.net didn't contain sources pattern
                if (url.includes('vidmoly.to') && !html.includes('sources')) {
                    res = await axios.get(url, { headers: vidmolyHeaders });
                    html = typeof res.data === 'string' ? res.data : '';
                    if (typeof getAndUnpack !== 'undefined' && html.includes('eval(function(p,a,c,k')) {
                        try { html = html + '\n' + getAndUnpack(html); } catch (e) { }
                    }
                    const fallbackMatch = html.match(/sources\s*:\s*\[\s*\{\s*file\s*:\s*['"]([^'"]+)['"]/i) ||
                        html.match(/file\s*:\s*['"]([^'"]+)['"]/i);
                    if (fallbackMatch) {
                        let videoUrl = fallbackMatch[1];
                        if (videoUrl.startsWith('//')) videoUrl = 'https:' + videoUrl;
                        return new StreamResult({
                            url: "MAGIC_PROXY_v1" + encodeBase64(videoUrl),
                            quality: 'Auto',
                            source: 'Vidmoly',
                            headers: { 'Referer': url }
                        });
                    }
                }
            } catch (e) { }
            let proxyUrl = url.replace('vidmoly.to', 'vidmoly.net');
            return new StreamResult({
                url: "MAGIC_PROXY_v1" + encodeBase64(proxyUrl),
                quality: 'Auto',
                source: 'Vidmoly',
                headers: { 'Referer': baseUrl }
            });
        }

        // --- Minochinos / Vidhide (P.A.C.K.E.R. obfuscated) ---
        if (url.includes('minochinos') || url.includes('vidhide') || url.includes('vidhidepre')) {
            try {
                const res = await axios.get(url, { headers: { 'Referer': baseUrl } });
                let html = typeof res.data === 'string' ? res.data : '';
                if (typeof getAndUnpack !== 'undefined' && html.includes('eval(function(p,a,c,k')) {
                    try {
                        const unpacked = getAndUnpack(html);
                        if (unpacked) html = html + '\n' + unpacked;
                    } catch (e) { }
                }
                const fileMatch = html.match(/file\s*:\s*"(https?:\/\/[^"]+)"/i) ||
                    html.match(/sources\s*:\s*\[\{[^}]*file\s*:\s*"(https?:\/\/[^"]+)"/i) ||
                    html.match(/<source\s+src=["'](https?:\/\/[^"']+)["']/i);
                if (fileMatch) {
                    const videoUrl = fileMatch[1];
                    return new StreamResult({
                        url: "MAGIC_PROXY_v1" + encodeBase64(videoUrl),
                        quality: 'Auto',
                        source: 'Minochinos',
                        headers: { 'Referer': url }
                    });
                }
            } catch (e) { }
            return new StreamResult({
                url: "MAGIC_PROXY_v1" + encodeBase64(url),
                quality: 'Auto',
                source: 'Minochinos',
                headers: { 'Referer': baseUrl }
            });
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
                    return new StreamResult({
                        url: "MAGIC_PROXY_v1" + encodeBase64(vidMatch[1]),
                        quality: 'Auto',
                        source: 'Myvi',
                        headers: { 'Referer': url }
                    });
                }
            } catch (e) { }
            return new StreamResult({
                url: "MAGIC_PROXY_v1" + encodeBase64(url),
                quality: 'Auto',
                source: 'Myvi',
                headers: { 'Referer': baseUrl }
            });
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
                        return new StreamResult({
                            url: "MAGIC_PROXY_v1" + encodeBase64(videoUrl),
                            quality: 'Auto',
                            source: 'Uqload',
                            headers: { 'Referer': url }
                        });
                    }
                }
            } catch (e) { }
            return new StreamResult({
                url: "MAGIC_PROXY_v1" + encodeBase64(url),
                quality: 'Auto',
                source: 'Uqload',
                headers: { 'Referer': baseUrl }
            });
        }

        // --- Verystream ---
        if (url.includes('verystream')) {
            try {
                const res = await axios.get(url, { headers: { 'Referer': baseUrl } });
                if (typeof res.data === 'string') {
                    // Try to extract direct video URL from various patterns
                    const match = res.data.match(/file\s*:\s*["']([^"']+)["']/i) ||
                        res.data.match(/src\s*:\s*["']([^"']+)["']/i) ||
                        res.data.match(/<source\s+src=["']([^"']+)["']/i) ||
                        res.data.match(/<video[^>]+src=["']([^"']+)["']/i) ||
                        // Verystream direct download pattern
                        res.data.match(/href=["']([^"']+\/get\/[^"']+)["'][^>]*>Direct/i) ||
                        res.data.match(/"url":\s*"([^"]+)"/i);
                    if (match) {
                        let videoUrl = match[1];
                        // Decode common HTML entities
                        videoUrl = videoUrl.replace(/&amp;/g, '&');
                        if (videoUrl.startsWith('//')) videoUrl = 'https:' + videoUrl;
                        return new StreamResult({
                            url: "MAGIC_PROXY_v1" + encodeBase64(videoUrl),
                            quality: 'Auto',
                            source: 'Verystream',
                            headers: { 'Referer': url }
                        });
                    }
                }
            } catch (e) { }
            return new StreamResult({
                url: "MAGIC_PROXY_v1" + encodeBase64(url),
                quality: 'Auto',
                source: 'Verystream',
                headers: { 'Referer': baseUrl }
            });
        }

        // --- Embed4Me / Lplayer ---
        if (url.includes('embed4me') || url.includes('lpayer')) {
            return new StreamResult({
                url: "MAGIC_PROXY_v1" + encodeBase64(url),
                quality: 'Auto',
                source: 'Embed4Me',
                headers: { 'Referer': baseUrl }
            });
        }

        // ──────────────────────────────────────────────────────────
        // 4. Direct video file URLs → proxy with headers
        // ──────────────────────────────────────────────────────────
        if (url.match(/\.(mp4|m3u8|mkv|webm)(\?|$)/i)) {
            return new StreamResult({
                url: "MAGIC_PROXY_v1" + encodeBase64(url),
                quality: 'Auto',
                source: 'Direct',
                headers: { 'Referer': baseUrl }
            });
        }

        // ──────────────────────────────────────────────────────────
        // 5. Unknown host → fallback to proxy
        // ──────────────────────────────────────────────────────────
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

        // Helper: extract items from a flw-item element
        function extractFlwItem(el) {
            // URL comes from the poster link (a.film-poster-ahref) OR any link with href
            const urlEl = el.querySelector('a.film-poster-ahref, a[href]');
            // Title comes from .film-name a or .film-name (NOT from the poster link, which appears first in DOM)
            const titleEl = el.querySelector('.film-name a, .film-name, h3 a');
            const imgEl = el.querySelector('img.film-poster-img, img');
            const epEl = el.querySelector('.tick-eps, .ep-count, .tick-item:last-child');
            const title = titleEl?.getAttribute('title') || titleEl?.textContent?.trim() || imgEl?.getAttribute('alt');
            const url = urlEl?.getAttribute('href');
            const posterUrl = imgEl?.getAttribute('data-src') || imgEl?.getAttribute('src');
            const ep = epEl?.textContent.trim();
            return { title, url, posterUrl: fixUrl(posterUrl), ep };
        }

        // Helper: extract items from a swiper-slide.item-qtip element
        function extractTrendingItem(el) {
            const linkEl = el.querySelector('a.film-poster, a');
            const titleEl = el.querySelector('.film-title, .dynamic-name');
            const imgEl = el.querySelector('img.film-poster-img, img');
            const title = titleEl?.textContent.trim();
            const url = linkEl?.getAttribute('href');
            const posterUrl = imgEl?.getAttribute('data-src') || imgEl?.getAttribute('src');
            return { title, url, posterUrl: fixUrl(posterUrl) };
        }

        // ── 1. Tendance (trending swiper carousel) ──
        const trendingItems = [];
        queryAll(doc, '.block_area_trending .swiper-slide.item-qtip, .block_area_trending .flw-item').forEach(el => {
            const { title, url, posterUrl } = extractTrendingItem(el);
            if (title && url && !seenUrls.has(url)) {
                seenUrls.add(url);
                trendingItems.push(new MultimediaItem({ title, url: url.startsWith('http') ? url : baseUrl + url, posterUrl, type: 'anime' }));
            }
        });
        if (trendingItems.length > 0) results['Tendance'] = trendingItems;

        // ── 2. Hero slider (deslide) ──
        const heroItems = [];
        queryAll(doc, '.deslide-wrap .deslide-item, .deslide-cover').forEach(el => {
            const linkEl = el.querySelector('a');
            const titleEl = el.querySelector('.desi-head-title, h2, h3');
            const imgEl = el.querySelector('img');
            const title = titleEl?.textContent.trim();
            const url = linkEl?.getAttribute('href');
            const posterUrl = imgEl?.getAttribute('data-src') || imgEl?.getAttribute('src');
            if (title && url && !seenUrls.has(url)) {
                seenUrls.add(url);
                heroItems.push(new MultimediaItem({ title, url: url.startsWith('http') ? url : baseUrl + url, posterUrl: fixUrl(posterUrl), type: 'anime' }));
            }
        });
        if (heroItems.length > 0 && !results['À la Une']) results['À la Une'] = heroItems;

        // ── 3. All block areas (Derniers Épisodes, Derniers Animes, Les Plus Regardés, etc.) ──
        queryAll(doc, 'section.block_area').forEach(block => {
            const titleEl = block.querySelector('.cat-heading, .block_area-header h2, h3');
            const sectionTitle = titleEl ? titleEl.textContent.trim() : null;
            if (!sectionTitle || results[sectionTitle]) return;
            // Skip genres sidebar
            if (/genre/i.test(sectionTitle)) return;
            const items = [];
            // Try flw-item elements (film list items)
            queryAll(block, '.flw-item').forEach(el => {
                if (items.length >= 20) return;
                const { title, url, posterUrl, ep } = extractFlwItem(el);
                if (title && url && !seenUrls.has(url)) {
                    seenUrls.add(url);
                    items.push(new MultimediaItem({
                        title: title + (ep ? ' - ' + ep : ''),
                        url: url.startsWith('http') ? url : baseUrl + url,
                        posterUrl, type: 'anime'
                    }));
                }
            });
            // Fallback: try swiper-slide items
            if (items.length === 0) {
                queryAll(block, '.swiper-slide').forEach(el => {
                    if (items.length >= 20) return;
                    const { title, url, posterUrl } = extractTrendingItem(el);
                    if (title && url && !seenUrls.has(url)) {
                        seenUrls.add(url);
                        items.push(new MultimediaItem({ title, url: url.startsWith('http') ? url : baseUrl + url, posterUrl, type: 'anime' }));
                    }
                });
            }
            if (items.length > 0) results[sectionTitle] = items;
        });

        // ── 4. Fallback ──
        if (Object.keys(results).length === 0) {
            const fallbackItems = [];
            queryAll(doc, '.flw-item').forEach(el => {
                const { title, url, posterUrl } = extractFlwItem(el);
                if (title && url && !seenUrls.has(url)) {
                    seenUrls.add(url);
                    fallbackItems.push(new MultimediaItem({ title, url: url.startsWith('http') ? url : baseUrl + url, posterUrl, type: 'anime' }));
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

        // ── Helper: extract item from an element ──
        function extractItem(el) {
            // If el is an <a> tag directly, use it as linkEl
            let linkEl = el.tagName === 'A' ? el : (el.querySelector('.film-name a') || el.querySelector('a[href]') || el.querySelector('h3 a') || el.querySelector('h2 a'));
            // For flw-item elements, also try the specific film-poster link for URL
            const posterLink = el.querySelector('a.film-poster-ahref, a.film-poster');
            const url = linkEl?.getAttribute('href') || posterLink?.getAttribute('href');
            let title = linkEl?.getAttribute('title') || linkEl?.textContent?.trim();
            if (!title) title = el.querySelector('.film-name')?.textContent?.trim() || el.querySelector('.film-title')?.textContent?.trim();
            const imgEl = el.querySelector('img.film-poster-img') || el.querySelector('img');
            const posterUrl = imgEl?.getAttribute('data-src') || imgEl?.getAttribute('src') || imgEl?.getAttribute('data-lazy-src');
            return { title, url, posterUrl: fixUrl(posterUrl) };
        }

        // ── Helper: parse items from HTML with multiple selector strategies ──
        async function parseItems(html) {
            if (!html || typeof html !== 'string') return [];
            const results = [];

            // Strategy 1: Parse via DOM if available
            if (typeof parseHtml === 'function') {
                try {
                    const dom = await parseHtml(html);
                    // Try various selectors that match search results structure
                    const searchSelectors = [
                        '.film_list-wrap .flw-item',
                        '.flw-item',
                        '.page-item-detail',
                        '.TPostMv',
                        '.TPost.C',
                        '.TPost',
                        'article',
                        '.post-item',
                        '.short-item',
                        '.news-item',
                        '.search-result'
                    ];
                    // Track seen CSS-class-level URLs to avoid duplicates
                    const cssSeen = new Set();
                    for (const sel of searchSelectors) {
                        if (results.length >= 25) break;
                        const els = dom.querySelectorAll ? Array.from(dom.querySelectorAll(sel)) : [];
                        for (const el of els) {
                            if (results.length >= 25) break;
                            const item = extractItem(el);
                            if (item.title && item.url && !cssSeen.has(item.url)) {
                                cssSeen.add(item.url);
                                results.push(item);
                            }
                        }
                    }
                } catch (e) { }
            }

            // Strategy 2: Regex fallback from raw HTML for items not caught by DOM
            if (results.length === 0 && typeof html === 'string') {
                // Try multiple HTML patterns commonly used in search results
                const patterns = [
                    // flw-item pattern
                    /<div[^>]*class="[^"]*flw-item[^"]*"[^>]*>[\s\S]*?<a[^>]+href="([^"]+)"[^>]*>[\s\S]*?<img[^>]+(?:data-src|src)="([^"]+)"[^>]*(?:alt="([^"]*)")?[\s\S]*?(?:film-name[^>]*>([^<]+)<|class="[^"]*film-title[^"]*"[^>]*>([^<]+)<)/gi,
                    // Generic item with poster pattern
                    /<a[^>]+href="([^"]*(?:\/anime-\/|\/series\/|\/manga\/|\/catalogue\/)[^"]+)"[^>]*>[\s\S]*?<img[^>]+(?:data-src|src)="([^"]+)"[^>]*(?:alt="([^"]*)")?[\s\S]*?<\/a>/gi,
                    // Simple img in link pattern
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
                            // Try to find a better title nearby
                            const nearbyTitle = html.substring(Math.max(0, m.index - 100), m.index + 200);
                            const titleMatch = nearbyTitle.match(/(?:film-name|film-title|post-title|title)["']?\s*[>]\s*([^<]{2,80})\s*<\//i);
                            if (titleMatch && titleMatch[1].trim().length > 2) {
                                title = titleMatch[1].trim();
                            }
                            if (title) {
                                results.push({ title, url: url.startsWith('http') ? url : baseUrl + url, posterUrl: fixUrl(posterUrl) });
                            }
                        }
                    }
                    if (results.length > 0) break;
                }
            }
            return results;
        }

        // ── Strategy 1: GET with ?s= query (WordPress-style, current approach) ──
        if (items.length === 0) {
            try {
                const res = await axios.get(`${baseUrl}/?s=${encodeURIComponent(query)}`, { headers });
                if (res.data && typeof res.data === 'string' && res.data.length > 500) {
                    const parsed = await parseItems(res.data);
                    for (const p of parsed) {
                        if (!seenUrls.has(p.url)) { seenUrls.add(p.url); items.push(p); }
                    }
                }
            } catch (e) { }
        }

        // ── Strategy 2: GET with DLE-style search URL ──
        if (items.length === 0) {
            try {
                const res = await axios.get(`${baseUrl}/index.php?do=search&subaction=search&story=${encodeURIComponent(query)}`, { headers });
                if (res.data && typeof res.data === 'string' && res.data.length > 500) {
                    const parsed = await parseItems(res.data);
                    for (const p of parsed) {
                        if (!seenUrls.has(p.url)) { seenUrls.add(p.url); items.push(p); }
                    }
                }
            } catch (e) { }
        }

        // ── Strategy 3: POST with DLE-style form body ──
        if (items.length === 0) {
            try {
                const res = await axios.post(baseUrl + '/index.php', 
                    `do=search&subaction=search&search_start=0&full_search=0&result_from=1&story=${encodeURIComponent(query)}`,
                    { headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' } }
                );
                if (res.data && typeof res.data === 'string' && res.data.length > 500) {
                    const parsed = await parseItems(res.data);
                    for (const p of parsed) {
                        if (!seenUrls.has(p.url)) { seenUrls.add(p.url); items.push(p); }
                    }
                }
            } catch (e) { }
        }

        // ── Strategy 4: POST to base URL without /index.php ──
        if (items.length === 0) {
            try {
                const res = await axios.post(baseUrl,
                    `do=search&subaction=search&search_start=0&full_search=0&result_from=1&story=${encodeURIComponent(query)}`,
                    { headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' } }
                );
                if (res.data && typeof res.data === 'string' && res.data.length > 500) {
                    const parsed = await parseItems(res.data);
                    for (const p of parsed) {
                        if (!seenUrls.has(p.url)) { seenUrls.add(p.url); items.push(p); }
                    }
                }
            } catch (e) { }
        }

        // ── Strategy 5: GET with /search.html endpoint ──
        if (items.length === 0) {
            try {
                const res = await axios.get(`${baseUrl}/search.html?keyword=${encodeURIComponent(query)}`, { headers });
                if (res.data && typeof res.data === 'string' && res.data.length > 500) {
                    const parsed = await parseItems(res.data);
                    for (const p of parsed) {
                        if (!seenUrls.has(p.url)) { seenUrls.add(p.url); items.push(p); }
                    }
                }
            } catch (e) { }
        }

        // ── Strategy 6: GET with /search/QUERY format ──
        if (items.length === 0) {
            try {
                const res = await axios.get(`${baseUrl}/search/${encodeURIComponent(query)}/`, { headers });
                if (res.data && typeof res.data === 'string' && res.data.length > 500) {
                    const parsed = await parseItems(res.data);
                    for (const p of parsed) {
                        if (!seenUrls.has(p.url)) { seenUrls.add(p.url); items.push(p); }
                    }
                }
            } catch (e) { }
        }

        // Convert to MultimediaItem format
        const results = items.map(i => new MultimediaItem({
            title: i.title,
            url: i.url.startsWith('http') ? i.url : baseUrl + i.url,
            posterUrl: i.posterUrl,
            type: 'anime',
            playbackPolicy: 'none'
        }));

        cb({ success: true, data: results });
    } catch (e) { log('search error', e); cb({ success: false, errorCode: 'SEARCH_ERROR', message: String(e) }); }
}

function detectSeasonAndType(name) {
        let season = undefined;
        let contentType = undefined;
        if (name) {
            const sMatch = name.match(/(?:saison|season|part|cour|s)\s*(\d+)/i);
            if (sMatch) season = parseInt(sMatch[1]);
            const s00Match = name.match(/S(\d+)E\d+/i);
            if (s00Match) season = parseInt(s00Match[1]);
            if (/\b(?:oav|ova|ona)\b/i.test(name)) contentType = 'OAV';
            else if (/\bfilm\b/i.test(name)) contentType = 'Film';
            else if (/\b(?:special|spécial)\b/i.test(name)) contentType = 'Spécial';
        }
        return { season, contentType };
    }

// Parse season info from a SEASON title (not episode title)
// e.g. "Saison 1" → { season: 1 }, "Film" → { contentType: 'Film' }, "OAV 2" → { season: 2, contentType: 'OAV' }
function parseSeasonInfo(title) {
    let season = undefined;
    let contentType = undefined;
    if (!title) return { season, contentType };
    const t = title.trim();
    // Detect content type from season title first
    if (/\b(?:oav|ova|ona)\b/i.test(t)) contentType = 'OAV';
    else if (/\bfilm\b/i.test(t)) contentType = 'Film';
    else if (/\b(?:special|spécial)\b/i.test(t)) contentType = 'Spécial';
    // Extract season number: "Saison 1", "Season 2", "Part 3", "Cour 4", "S 5", "Film 2", "OAV 3"
    const sMatch = t.match(/(?:saison|season|part|cour|s|film|oav|ova|ona|special|sp[ée]cial)\s*(\d+)/i);
    if (sMatch) season = parseInt(sMatch[1]);
    // If no explicit number but has a digit, use it as season number
    if (season === undefined) {
        const numMatch = t.match(/\d+/);
        if (numMatch && !contentType) season = parseInt(numMatch[0]);
    }
    return { season, contentType };
}

function detectDubStatus(url, title) {
        const text = (url || '') + ' ' + (title || '');
        if (/\/vf\b|\(VF\)|-vf$/i.test(text)) return 'dub';
        if (/\/vostfr\b|\(VOSTFR\)|-vostfr$/i.test(text)) return 'sub';
        return 'none';
    }

// Determine dubStatus from the page URL (VF or VOSTFR)
function getDubStatusFromPageUrl(pageUrl) {
        if (/\/anime-vf\b|[-_]vf(?!o)/i.test(pageUrl)) return 'dub';
        if (/\/anime-vostfr\b|[-_]vostfr/i.test(pageUrl)) return 'sub';
        return undefined;
    }

// Detect if the current version is VF or VOSTFR and try to find the alternative from the page HTML
function findAlternativeVersionFromPage(html, currentUrl) {
        const lowerUrl = currentUrl.toLowerCase();
        let currentVersion = null;
        let alternativeUrl = null;

        if (/\/vostfr|[-_]vostfr/i.test(lowerUrl)) {
            currentVersion = 'VOSTFR';
        } else if (/\/vf|[-_]vf(?!o)/i.test(lowerUrl)) {
            currentVersion = 'VF';
        }
        if (!currentVersion) return { currentVersion: null, alternativeUrl: null };

        // Extract the anime name from the current URL slug to match the correct alternative
        const slugMatch = currentUrl.match(/\/\d+-([\w-]+)\.html/i);
        let animeKey = slugMatch ? slugMatch[1].toLowerCase() : '';
        // Strip known suffixes to get core anime name
        animeKey = animeKey.replace(/[-_](vf|vostfr|dll|au)$/gi, '').replace(/[-_](vf|vostfr|dll|au)$/gi, '');

        // Search the raw HTML for a link to the alternative version of the SAME anime
        if (animeKey && typeof html === 'string') {
            const regex = currentVersion === 'VOSTFR'
                ? new RegExp('href=["\']([^"\']*\\/anime[-_]vf\\/\\d+-[^"]*' + animeKey + '[^"\']*)["\']', 'gi')
                : new RegExp('href=["\']([^"\']*\\/anime[-_]vostfr\\/\\d+-[^"]*' + animeKey + '[^"\']*)["\']', 'gi');
            const m = regex.exec(html);
            if (m && m[1]) {
                const href = m[1];
                alternativeUrl = href.startsWith('http') ? href : baseUrl + (href.startsWith('/') ? '' : '/') + href;
            }
        }

        return { currentVersion, alternativeUrl };
    }

async function load(url, cb) {
    try {
        const movieId = url.match(/\/(\d+)-/)?.[1];
        // Parallelize: fetch page + AJAX episodes simultaneously
        const [pageRes, epRes] = await Promise.all([
            axios.get(url, { headers }),
            movieId ? axios.get(`${baseUrl}/engine/ajax/full-story.php?newsId=${movieId}&d=${Date.now()}`, { headers }) : Promise.resolve({ data: '' })
        ]);
        const html = pageRes.data;
        const doc = await parseHtml(html);
        const title = doc.querySelector('.film-name')?.textContent.trim() || doc.querySelector('h1')?.textContent.trim();
        // Description: try multiple selectors
        const description = doc.querySelector('.film-description .text')?.textContent.trim() ||
            doc.querySelector('.film-description')?.textContent.trim() ||
            doc.querySelector('.description')?.textContent.trim() ||
            doc.querySelector('.ani_description .text')?.textContent.trim() ||
            doc.querySelector('meta[property="og:description"]')?.getAttribute('content');
        // Poster: try film-poster-img with data-src (lazy-loaded), then src, then og:image
        const rawPoster = doc.querySelector('.film-poster-img')?.getAttribute('data-src') ||
            doc.querySelector('.film-poster-img')?.getAttribute('src') ||
            doc.querySelector('.film-poster img')?.getAttribute('data-src') ||
            doc.querySelector('.film-poster img')?.getAttribute('src') ||
            doc.querySelector('meta[property="og:image"]')?.getAttribute('content');
        const posterUrl = fixUrl(rawPoster);
        // Metadata: year, genres, status from anisc-info and fd-infor
        const yearEl = doc.querySelector('.fdi-item.fdi-year a, .fdi-year a');
        const year = yearEl ? parseInt(yearEl.textContent.trim()) : undefined;
        const genreEls = Array.from(doc.querySelectorAll('.anisc-info .item a[href*="genre"], .genres a, .sgenerx a, .mgen a, .genre-info a, .fd-infor a[href*="genre"]')).map(el => el.textContent.trim()).filter(Boolean);
        // Status: find the .item whose .item-head contains "Statut", then read its .name
        let status = undefined;
        const statusItem = Array.from(doc.querySelectorAll('.anisc-info .item')).find(item =>
            /statut|status/i.test(item.querySelector('.item-head')?.textContent)
        );
        if (statusItem) {
            const statusVal = statusItem.querySelector('.name')?.textContent.trim().toLowerCase();
            if (statusVal) {
                if (/termin|complet|fini|ended|finished/i.test(statusVal)) status = 'completed';
                else if (/cours|airing|ongoing|en cours/i.test(statusVal)) status = 'ongoing';
                else status = statusVal;
            }
        }

        const episodes = [];
        const seenEpUrls = new Set();
        // Parse seasons from block_area-seasons section
        const seasonLinks = [];
        doc.querySelectorAll('.block_area-seasons .os-item, .block_area-seasons a[href*="/anime-"]').forEach(a => {
            const href = a.getAttribute('href');
            if (href) {
                const sId = href.match(/\/(\d+)-/)?.[1];
                const sTitle = a.getAttribute('title') || a.querySelector('.title')?.textContent.trim() || a.textContent.trim();
                if (sId && !seasonLinks.find(s => s.id === sId)) {
                    seasonLinks.push({ id: sId, url: href.startsWith('http') ? href : baseUrl + href, title: sTitle });
                }
            }
        });
        // Always include current page as first season if not already found
        if (movieId && !seasonLinks.find(s => s.id === movieId)) {
            seasonLinks.unshift({ id: movieId, url: url, title: '' });
        }
        // If no seasons found, use current page only
        if (seasonLinks.length === 0 && movieId) {
            seasonLinks.push({ id: movieId, url: url, title: '' });
        }
        // Fetch episodes for all seasons in parallel
        const seasonResponses = await Promise.all(
            seasonLinks.map(sInfo =>
                axios.get(`${baseUrl}/engine/ajax/full-story.php?newsId=${sInfo.id}&d=${Date.now()}`, { headers })
                    .then(r => r.data)
                    .catch(() => null)
            )
        );
        // Pre-parse season info from season titles (e.g. "Saison 1", "Film", "OAV", "Spécial")
        const seasonInfos = seasonLinks.map(sInfo => ({
            ...sInfo,
            parsedInfo: parseSeasonInfo(sInfo.title)
        }));
        // Parse episodes for each season with automatic numbering
        for (let sIdx = 0; sIdx < seasonInfos.length; sIdx++) {
            const sInfo = seasonInfos[sIdx];
            const sData = seasonResponses[sIdx];
            if (!sData) continue;
            let htmlFrag = typeof sData === 'string' ? sData : (sData.html || sData.data?.html || '');
            htmlFrag = htmlFrag.replace(/\\"/g, '"').replace(/\\'/g, "'").replace(/\\\//g, '/');
            const epRegex = /<a [^>]*class=["'][^"']*ep-item[^"']*["'][^>]*>/gi;
            let match;
            while ((match = epRegex.exec(htmlFrag)) !== null) {
                const aTag = match[0];
                const epUrl = aTag.match(/href=["']([^"']+)["']/)?.[1];
                const epNum = aTag.match(/data-number=["'](\d+)["']/)?.[1] || "1";
                const epTitle = aTag.match(/title=["']([^"']+)["']/)?.[1];
                if (epUrl) {
                    const fullEpUrl = epUrl.startsWith('http') ? epUrl : baseUrl + epUrl;
                    if (seenEpUrls.has(fullEpUrl)) continue;
                    seenEpUrls.add(fullEpUrl);
                    // Season number and contentType come from the SEASON, not the episode title!
                    const seasonNum = sInfo.parsedInfo.season || (sIdx + 1);
                    const contentType = sInfo.parsedInfo.contentType;
                    // Determine dubStatus from the season URL, fallback to page URL
                    const seasonDubStatus = getDubStatusFromPageUrl(sInfo.url) || detectDubStatus(epUrl, epTitle);
                    episodes.push(new Episode({
                        name: epTitle || ('Episode ' + epNum),
                        episode: parseInt(epNum),
                        url: fullEpUrl,
                        season: seasonNum,
                        posterUrl: posterUrl,
                        contentType: contentType,
                        dubStatus: seasonDubStatus
                    }));
                }
            }
        }
        // Detect alternative VF/VOSTFR version from page links and fetch its episodes to merge
        const { currentVersion, alternativeUrl } = findAlternativeVersionFromPage(html, url);
        if (alternativeUrl) {
            const fullAltUrl = alternativeUrl.startsWith('http') ? alternativeUrl : baseUrl + alternativeUrl;
            try {
                const altRes = await axios.get(fullAltUrl, { headers });
                if (altRes.status === 200 && typeof altRes.data === 'string' && altRes.data.includes('film-name')) {
                    const altDoc = await parseHtml(altRes.data);
                    // Parse alternative version's seasons
                    const altSeasonLinks = [];
                    altDoc.querySelectorAll('.block_area-seasons .os-item, .block_area-seasons a[href*="/anime-"]').forEach(a => {
                        const href = a.getAttribute('href');
                        if (href) {
                            const sId = href.match(/\/(\d+)-/)?.[1];
                            const sTitle = a.getAttribute('title') || a.querySelector('.title')?.textContent.trim() || a.textContent.trim();
                            if (sId && !altSeasonLinks.find(s => s.id === sId)) {
                                altSeasonLinks.push({ id: sId, url: href.startsWith('http') ? href : baseUrl + href, title: sTitle });
                            }
                        }
                    });
                    // Fallback: use the alternative page itself if no season links found
                    const altMovieId = fullAltUrl.match(/\/(\d+)-/)?.[1];
                    if (altSeasonLinks.length === 0 && altMovieId) {
                        altSeasonLinks.push({ id: altMovieId, url: fullAltUrl, title: '' });
                    }
                    // Pre-parse alternative season info
                    const altSeasonInfos = altSeasonLinks.map(altSInfo => ({
                        ...altSInfo,
                        parsedInfo: parseSeasonInfo(altSInfo.title)
                    }));
                    // Find matching main seasons to keep season numbering consistent
                    // Map alternative seasons to their corresponding main season numbers
                    const altToMainSeasonMap = {};
                    for (const altSInfo of altSeasonInfos) {
                        let matchedSeason = altSInfo.parsedInfo.season;
                        if (matchedSeason === undefined) {
                            // Try to find a main season with matching content type (e.g., both are 'Film')
                            // Only match if at least one field is defined to avoid false matches
                            const hasAltType = altSInfo.parsedInfo.contentType !== undefined;
                            if (hasAltType) {
                                const matchingMain = seasonInfos.find(s => 
                                    s.parsedInfo.contentType === altSInfo.parsedInfo.contentType
                                );
                                if (matchingMain) {
                                    matchedSeason = matchingMain.parsedInfo.season;
                                }
                            }
                        }
                        altToMainSeasonMap[altSInfo.id] = matchedSeason;
                    }
                    // Fetch episodes for all alternative seasons in parallel
                    const altSeasonResponses = await Promise.all(
                        altSeasonInfos.map(altSInfo =>
                            axios.get(`${baseUrl}/engine/ajax/full-story.php?newsId=${altSInfo.id}&d=${Date.now()}`, { headers })
                                .then(r => r.data)
                                .catch(() => null)
                        )
                    );
                    // Parse alternative version's episodes with automatic numbering
                    for (let altIdx = 0; altIdx < altSeasonInfos.length; altIdx++) {
                        const altSInfo = altSeasonInfos[altIdx];
                        const altData = altSeasonResponses[altIdx];
                        if (!altData) continue;
                        let altHtmlFrag = typeof altData === 'string' ? altData : (altData.html || altData.data?.html || '');
                        altHtmlFrag = altHtmlFrag.replace(/\\"/g, '"').replace(/\\'/g, "'").replace(/\\\//g, '/');
                        const altEpRegex = /<a [^>]*class=["'][^"']*ep-item[^"']*["'][^>]*>/gi;
                        let altMatch;
                        while ((altMatch = altEpRegex.exec(altHtmlFrag)) !== null) {
                            const aTag = altMatch[0];
                            const epUrl = aTag.match(/href=["']([^"']+)["']/)?.[1];
                            const epNum = aTag.match(/data-number=["'](\d+)["']/)?.[1] || "1";
                            const epTitle = aTag.match(/title=["']([^"']+)["']/)?.[1];
                            if (epUrl) {
                                const fullEpUrl = epUrl.startsWith('http') ? epUrl : baseUrl + epUrl;
                                if (seenEpUrls.has(fullEpUrl)) continue;
                                seenEpUrls.add(fullEpUrl);
                                // Use the mapped season number (matched with main) or season title
                                const altSeasonNum = altToMainSeasonMap[altSInfo.id] || altSInfo.parsedInfo.season || (altIdx + 1);
                                const altContentType = altSInfo.parsedInfo.contentType;
                                const altSeasonDubStatus = getDubStatusFromPageUrl(altSInfo.url) || detectDubStatus(epUrl, epTitle);
                                episodes.push(new Episode({
                                    name: epTitle || ('Episode ' + epNum),
                                    episode: parseInt(epNum),
                                    url: fullEpUrl,
                                    season: altSeasonNum,
                                    posterUrl: posterUrl,
                                    contentType: altContentType,
                                    dubStatus: altSeasonDubStatus
                                }));
                            }
                        }
                    }
                }
            } catch (e) { /* Alternative doesn't exist, skip */ }
        }
        // Film fallback: no episodes → pass page URL to loadStreams for iframe extraction
        if (episodes.length === 0) {
            episodes.push(new Episode({
                name: title || 'Film',
                episode: 1,
                url: url,
                season: 1,
                posterUrl: posterUrl,
                contentType: 'Film',
                dubStatus: detectDubStatus(url, title)
            }));
        }
        // Extract recommendations from related/similar anime sections
        const recommendations = [];
        const recSeenUrls = new Set();
        // movieId already extracted above from url.match(/\/(\d+)-/) for precise exclusion
        // Multiple selector strategies for animesultra's layout
        const recSelectors = [
            '.block_area-recommend .flw-item',
            '.block_area_ral .flw-item',
            '.film-related .flw-item',
            '.block_area-sidebar .flw-item',
            '.block_area[class*="recommend"] .flw-item',
            '.block_area[class*="ral"] .flw-item',
            '.block_area[class*="related"] .flw-item',
            '.block_area[class*="similar"] .flw-item',
            // Fallback: sidebar or secondary block areas
            '.sidebar .flw-item',
            '.block_area-section .flw-item',
        ];
        for (const sel of recSelectors) {
            if (recommendations.length >= 20) break;
            doc.querySelectorAll(sel).forEach(el => {
                if (recommendations.length >= 20) return;
                const linkEl = el.querySelector('.film-name a, a.film-poster-ahref, a[href]');
                const imgEl = el.querySelector('img.film-poster-img, img');
                const titleEl = linkEl || el.querySelector('.film-name');
                const recTitle = titleEl?.getAttribute('title') || titleEl?.textContent?.trim();
                const rawRecUrl = linkEl?.getAttribute('href');
                const recPoster = imgEl?.getAttribute('data-src') || imgEl?.getAttribute('src');
                if (recTitle && rawRecUrl) {
                    // Normalize URL to absolute for consistent dedup
                    const recUrl = rawRecUrl.startsWith('http') ? rawRecUrl : baseUrl + rawRecUrl;
                    if (recSeenUrls.has(recUrl)) return;
                    recSeenUrls.add(recUrl);
                    // Exclude current anime by its numeric ID
                    const recId = rawRecUrl.match(/\/(\d+)-/)?.[1];
                    if (recId && recId === movieId) return;
                    recommendations.push(new MultimediaItem({
                        title: recTitle,
                        url: recUrl,
                        posterUrl: fixUrl(recPoster),
                        type: 'anime'
                    }));
                }
            });
            if (recommendations.length > 0) break;
        }

        cb({ success: true, data: new MultimediaItem({ type: "anime", title, description, posterUrl, episodes, year, status, genres: genreEls.length > 0 ? genreEls : undefined, recommendations: recommendations.length > 0 ? recommendations : undefined }) });
    } catch (e) { log('load error: ' + url, e); cb({ success: false, errorCode: 'LOAD_ERROR', message: String(e) }); }
}

async function loadStreams(url, cb) {
    try {
        const movieId = url.match(/\/(\d+)-/)?.[1];
        // Parallelize: fetch page + AJAX content simultaneously
        const [pageRes, epRes] = await Promise.all([
            axios.get(url, { headers }),
            movieId ? axios.get(`${baseUrl}/engine/ajax/full-story.php?newsId=${movieId}&d=${Date.now()}`, { headers }) : Promise.resolve({ data: '' })
        ]);
        const html = pageRes.data;
        const streams = [];
        // ── Helper: decode HTML entities in URLs ──
        function decodeHtmlEntities(str) {
            return str.replace(/&amp;/g, '&').replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#034;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
        }
        // ── Helper: clean AJAX response ──
        function cleanAjaxHtml(raw) {
            if (typeof raw === 'string') return raw.replace(/\\"/g, '"').replace(/\\'/g, "'").replace(/\\\//g, '/');
            if (raw?.html) return raw.html.replace(/\\"/g, '"').replace(/\\'/g, "'").replace(/\\\//g, '/');
            return '';
        }
        // ── Helper: add stream result ──
        async function tryAddStream(playerUrl, label) {
            if (!playerUrl) return;
            playerUrl = decodeHtmlEntities(playerUrl);
            // Fix protocol-relative URLs
            if (playerUrl.startsWith('//')) playerUrl = 'https:' + playerUrl;
            try {
                const streamRes = await PluginExtractors.resolveStream(playerUrl);
                if (streamRes) {
                    streamRes.quality = label;
                    streams.push(streamRes);
                }
            } catch (e) { log('Stream resolve failed: ' + playerUrl, e); }
        }

        // ── Strategy 1: Server items (data-server-id / data-embed) ──
        let fullStoryHtml = cleanAjaxHtml(epRes.data);
        // Try both attribute orders: data-server-id first OR data-embed first
        const serverRegexes = [
            // data-server-id BEFORE data-embed
            /<div[^>]*data-server-id="([^"]*)"[^>]*data-embed="([^"]*)"[^>]*>/gi,
            // data-embed BEFORE data-server-id
            /<div[^>]*data-embed="([^"]*)"[^>]*data-server-id="([^"]*)"[^>]*>/gi,
            // Simpler fallback: any div.server-item with data attributes
            /<div[^>]*class="[^"]*server-item[^"]*"[^>]*data-server-id="([^"]*)"[^>]*>/gi
        ];
        for (const serverRegex of serverRegexes) {
            let match;
            while ((match = serverRegex.exec(html)) !== null) {
                if (streams.length >= 15) break;
                let serverId, embedUrl;
                // 2 capture groups: could be (server-id, embed) or (embed, server-id)
                if (match[1] && match[2]) {
                    const val1 = match[1];
                    const val2 = match[2];
                    // data-server-id is numeric ("1", "2"), data-embed is a URL
                    if (/^\d+$/.test(val1) && !/^\d+$/.test(val2)) {
                        serverId = val1; embedUrl = val2;
                    } else {
                        serverId = val2; embedUrl = val1;
                    }
                } else if (match[1]) {
                    // 1 capture group: server-id only (3rd regex fallback)
                    serverId = match[1];
                    embedUrl = '';
                } else continue;
                // Build a dedup key from serverId to avoid pushing the same server twice
                const dedupKey = 'srv_' + serverId;
                if (streams.some(s => s.quality === 'Serveur ' + serverId)) continue;
                // Try to get the actual player URL from content_player_X div in AJAX response
                let playerUrl = embedUrl;
                if (fullStoryHtml) {
                    const cpMatch = fullStoryHtml.match(new RegExp(`id=["']content_player_${serverId}["'][^>]*>([^<]*)<`, 'i'));
                    if (cpMatch && cpMatch[1].trim()) {
                        playerUrl = cpMatch[1].trim();
                    }
                    // Fallback: try raw (non-cleaned) AJAX HTML
                    if ((!playerUrl || playerUrl.length <= 5) && typeof epRes.data === 'string') {
                        const rawMatch = epRes.data.match(new RegExp(`content_player_${serverId}[^"]*"[^>]*>([^<]*)<`, 'i'));
                        if (rawMatch && rawMatch[1].trim()) {
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

        // ── Strategy 2: Iframe extraction (fallback if no server items found) ──
        if (streams.length === 0) {
            const iframeRegex = /<iframe[^>]*src=["']([^"']+)["'][^>]*>/gi;
            let iframeMatch;
            while ((iframeMatch = iframeRegex.exec(html)) !== null) {
                const iframeSrc = iframeMatch[1];
                if (iframeSrc && !iframeSrc.includes('ads') && !iframeSrc.includes('google') && !iframeSrc.includes('facebook') && !iframeSrc.includes('doubleclick')) {
                    await tryAddStream(iframeSrc, 'IFrame');
                }
            }
        }

        // ── Strategy 3: Direct video URLs in script tags (fallback) ──
        if (streams.length === 0) {
            const videoRegex = /(?:file|url|src)["']?\s*[:=]\s*["'](https?:\/\/[^"'\s]+\.(?:mp4|m3u8|mkv|webm)[^"'\s]*)["']/gi;
            let vMatch;
            const searchHtml = fullStoryHtml || html;
            while ((vMatch = videoRegex.exec(searchHtml)) !== null) {
                const videoUrl = vMatch[1];
                if (videoUrl && !videoUrl.includes('.js') && !videoUrl.includes('.css') && !videoUrl.includes('analytics') && !videoUrl.includes('tracking')) {
                    await tryAddStream(videoUrl, 'Direct');
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
