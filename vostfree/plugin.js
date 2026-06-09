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

const PLUGIN_ID = 'vostfree';
function log(msg, data) { try { console.log(`[${PLUGIN_ID}] ${msg}`, data || ''); } catch (_) { } }

const baseUrl = (typeof manifest !== 'undefined' && manifest.baseUrl) ? manifest.baseUrl : 'https://vostfree.ws';
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
                // Try to extract direct video URL from page
                const vidMatch = html.match(/videoUrl["']?\s*:\s*["'](https?:\/\/[^"']+\.mp4[^"']*)["']/i) ||
                    html.match(/src["']?\s*:\s*["'](https?:\/\/[^"']+\.mp4[^"']*)["']/i) ||
                    html.match(/file["']?\s*:\s*["'](https?:\/\/[^"']+\.mp4[^"']*)["']/i);
                if (vidMatch) {
                    return new StreamResult({ url: "MAGIC_PROXY_v1" + encodeBase64(vidMatch[1]), quality: 'Auto', source: 'Myvi', headers: { 'Referer': url } });
                }
            } catch (e) { }
            return new StreamResult({ url: "MAGIC_PROXY_v1" + encodeBase64(url), quality: 'Auto', source: 'Myvi', headers: { 'Referer': baseUrl } });
        }

        // --- Embed4Me / Lplayer ---
        if (url.includes('embed4me') || url.includes('lpayer')) {
            return new StreamResult({ url: "MAGIC_PROXY_v1" + encodeBase64(url), quality: 'Auto', source: 'Embed4Me', headers: { 'Referer': baseUrl } });
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

        // ── 1. À la Une (slider-poster) ──
        const featured = [];
        Array.from(doc.querySelectorAll('.slider-poster')).forEach(el => {
            const linkEl = el.querySelector('a');
            const imgEl = el.querySelector('img');
            const title = imgEl?.getAttribute('alt') || linkEl?.getAttribute('title') || linkEl?.textContent.trim();
            const url = linkEl?.getAttribute('href');
            const posterUrl = imgEl?.getAttribute('data-src') || imgEl?.getAttribute('src');
            if (title && url && !seenUrls.has(url)) {
                seenUrls.add(url);
                featured.push(new MultimediaItem({
                    title,
                    url: url.startsWith('http') ? url : baseUrl + url,
                    posterUrl: fixUrl(posterUrl), type: 'anime'
                }));
            }
        });
        if (featured.length > 0) results['À la Une'] = featured;

        // ── 2. Nouvelles Séries (new-series-slider) ──
        const newSeries = [];
        Array.from(doc.querySelectorAll('#new-series-slider-content li, .new-series-slider li')).forEach(el => {
            const linkEl = el.querySelector('a');
            const imgEl = el.querySelector('img');
            const titleEl = el.querySelector('.alt, .title, .slider-title');
            const title = titleEl?.textContent.trim() || imgEl?.getAttribute('alt') || linkEl?.getAttribute('title');
            const url = linkEl?.getAttribute('href');
            const posterUrl = imgEl?.getAttribute('data-src') || imgEl?.getAttribute('src');
            if (title && url && !seenUrls.has(url)) {
                seenUrls.add(url);
                newSeries.push(new MultimediaItem({
                    title, url: url.startsWith('http') ? url : baseUrl + url,
                    posterUrl: fixUrl(posterUrl), type: 'anime'
                }));
            }
        });
        if (newSeries.length > 0) results['Nouvelles Séries'] = newSeries;

        // ── 3. Top VOSTFR/VF (top-vostfr) ──
        const topItems = [];
        Array.from(doc.querySelectorAll('.top-vostfr')).forEach(el => {
            const linkEl = el.querySelector('a');
            const imgEl = el.querySelector('img');
            const title = el.querySelector('.title, .info a')?.textContent.trim() || imgEl?.getAttribute('alt') || linkEl?.getAttribute('title');
            const url = linkEl?.getAttribute('href');
            const posterUrl = imgEl?.getAttribute('data-src') || imgEl?.getAttribute('src');
            if (title && url && !seenUrls.has(url)) {
                seenUrls.add(url);
                topItems.push(new MultimediaItem({
                    title,
                    url: url.startsWith('http') ? url : baseUrl + url,
                    posterUrl: fixUrl(posterUrl), type: 'anime'
                }));
            }
        });
        if (topItems.length > 0) results['Populaires'] = topItems;

        // ── 4. Recommandations (movie-small) ──
        const smallItems = [];
        Array.from(doc.querySelectorAll('.movie-small li, .movie-small a')).forEach(el => {
            const linkEl = el.querySelector ? el.querySelector('a') : el;
            const imgEl = el.querySelector ? el.querySelector('img') : null;
            const title = imgEl?.getAttribute('alt') || linkEl?.getAttribute('title') || linkEl?.textContent.trim();
            const url = linkEl?.getAttribute('href');
            const posterUrl = imgEl?.getAttribute('data-src') || imgEl?.getAttribute('src');
            if (title && url && title.length > 1 && !seenUrls.has(url)) {
                seenUrls.add(url);
                smallItems.push(new MultimediaItem({
                    title, url: url.startsWith('http') ? url : baseUrl + url,
                    posterUrl: fixUrl(posterUrl), type: 'anime'
                }));
            }
        });
        if (smallItems.length > 0) results['Recommandés'] = smallItems;

        // ── 5. Content sections by headings (VF, VOSTFR, etc.) ──
        Array.from(doc.querySelectorAll('h2, h3')).forEach(heading => {
            const sectionTitle = heading.textContent.trim();
            if (!sectionTitle || sectionTitle.length < 2 || results[sectionTitle]) return;
            let container = heading.nextElementSibling;
            if (!container) container = heading.parentElement;
            if (!container) return;
            const sectionItems = [];
            Array.from(container.querySelectorAll('a[href]')).forEach(el => {
                const title = el.textContent.trim();
                const url = el.getAttribute('href');
                const imgEl = el.querySelector('img');            const posterUrl = imgEl?.getAttribute('data-src') || imgEl?.getAttribute('src');
            if (title && url && title.length > 2 && !url.includes('#') && !seenUrls.has(url)) {
                seenUrls.add(url);
                    sectionItems.push(new MultimediaItem({
                        title, url: url.startsWith('http') ? url : baseUrl + url,
                        posterUrl: fixUrl(posterUrl), type: 'anime'
                    }));
                }
            });
            if (sectionItems.length > 0) results[sectionTitle] = sectionItems;
        });

        // ── 6. Fallback ──
        if (Object.keys(results).length === 0) {
            const fallbackItems = [];
            Array.from(doc.querySelectorAll('.movie-big a, article a, h3 a, h2 a')).forEach(el => {
                const title = el.textContent.trim();
                const url = el.getAttribute('href');
                if (title && url && title.length > 2 && !url.includes('#') && !seenUrls.has(url)) {
                    seenUrls.add(url);
                    fallbackItems.push(new MultimediaItem({
                        title, url: url.startsWith('http') ? url : baseUrl + url,
                        posterUrl: '', type: 'anime'
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
        const res = await axios.post(`${baseUrl}/index.php?do=search`, `do=search&subaction=search&search_start=0&full_search=0&result_from=1&story=${encodeURIComponent(query)}`, { headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' } });
        const doc = await parseHtml(res.data);
        const items = [];
        // DLE search results - try multiple patterns
        const selectors = ['.slider-poster', '.movie-small li', '.short-item', '.search-result', 'article', '.news-item'];
        for (const sel of selectors) {
            Array.from(doc.querySelectorAll(sel)).forEach(el => {
                const linkEl = el.querySelector ? el.querySelector('a') : el;
                const imgEl = el.querySelector ? el.querySelector('img') : null;
                const title = imgEl?.getAttribute('alt') || linkEl?.getAttribute('title') || el.querySelector('h3, h2')?.textContent.trim() || linkEl?.textContent.trim();
                const url = linkEl?.getAttribute('href');
                const posterUrl = imgEl?.getAttribute('data-src') || imgEl?.getAttribute('src');
                if (title && url && title.length > 1) {
                    const exists = items.find(i => i.title === title);
                    if (!exists) {
                        items.push(new MultimediaItem({
                            title,
                            url: url.startsWith('http') ? url : baseUrl + url,
                            posterUrl: fixUrl(posterUrl),
                            type: 'anime', playbackPolicy: 'none'
                        }));
                    }
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

function fixUrl(p) { if (!p) return ''; if (p.startsWith('http')) return p; return baseUrl + (p.startsWith('/') ? '' : '/') + p; }

function detectDubStatus(url, title) {
        const text = (url || '') + ' ' + (title || '');
        if (/\/vf\b|\(VF\)|-vf$/i.test(text)) return 'dub';
        if (/\/vostfr\b|\(VOSTFR\)|-vostfr$/i.test(text)) return 'sub';
        return 'none';
    }

async function load(url, cb) {
    try {
        const res = await axios.get(url, { headers });
        const html = res.data;
        const doc = await parseHtml(html);
        const title = doc.querySelector('h1')?.textContent.trim() || doc.querySelector('.movie-title')?.textContent.trim();
        // Description: try multiple selectors (DLE common patterns)
        const description = doc.querySelector('.full-text')?.textContent.trim() ||
            doc.querySelector('.movie-desc')?.textContent.trim() ||
            doc.querySelector('.entry-content')?.textContent.trim() ||
            doc.querySelector('.full-story')?.textContent.trim() ||
            doc.querySelector('meta[name="description"]')?.getAttribute('content') ||
            doc.querySelector('meta[property="og:description"]')?.getAttribute('content');
        // Poster: try .slide-poster img, then .movie-poster img, then og:image (with data-src for lazy-loaded)
        const rawPoster = doc.querySelector('.slide-poster img')?.getAttribute('data-src') ||
            doc.querySelector('.slide-poster img')?.getAttribute('src') ||
            doc.querySelector('.movie-poster img')?.getAttribute('data-src') ||
            doc.querySelector('.movie-poster img')?.getAttribute('src') ||
            doc.querySelector('.slide-info img')?.getAttribute('data-src') ||
            doc.querySelector('.slide-info img')?.getAttribute('src') ||
            doc.querySelector('meta[property="og:image"]')?.getAttribute('content');
        const posterUrl = fixUrl(rawPoster);
        // Extract metadata: year, genres, rating
        const yearEl = doc.querySelector('.slide-info p');
        const yearFromSlide = yearEl ? parseInt(yearEl.textContent.match(/\d{4}/)?.[0] || '0') : undefined;
        const yearMatch = html.match(/Ann[eé]e\s*:?\s*(\d{4})/i);
        const year = yearFromSlide || (yearMatch ? parseInt(yearMatch[1]) : undefined);
        const genreEls = Array.from(doc.querySelectorAll('.slide-top a, .genre a, .genres a, .category a, .short-tag a, .sgenerx a')).map(el => el.textContent.trim()).filter(Boolean);
        const ratingEl = doc.querySelector('.rating, .ratig-layer, [class*="ratig"], [class*="rating"]');
        const rawScore = ratingEl?.textContent ? parseFloat(ratingEl.textContent.replace(/[^\d.]/g, '')) || undefined : undefined;
        const score = rawScore && rawScore <= 10 ? rawScore : undefined;
        const statusEl = doc.querySelector('.Status, .status, .statut, [class*="status"], [class*="Status"]');
        const status = statusEl?.textContent?.trim()?.toLowerCase();
        const episodes = [];
        // DLE episode patterns - option elements and links
        const epRegex = /<option value=["']([^"']+)["'][^>]*>(.*?)<\/option>/gi;
        let match;
        while ((match = epRegex.exec(html)) !== null) {
            const epUrl = match[1];
            const epName = match[2].trim();
            // Skip non-URL values (e.g. player button IDs like 'buttons_1' for films)
            if (epUrl && epName && (epUrl.startsWith('http') || epUrl.startsWith('/') || epUrl.includes('.html'))) {
                const detected = detectSeasonAndType(epName);
                episodes.push(new Episode({
                    name: epName,
                    episode: parseInt(epName.match(/\d+/)?.[0] || episodes.length + 1),
                    url: epUrl.startsWith('http') ? epUrl : baseUrl + epUrl,
                    season: detected.season,
                    posterUrl: posterUrl,
                    contentType: detected.contentType,
                    dubStatus: detectDubStatus(epUrl, epName)
                }));
            }
        }
        // Fallback: try link patterns
        if (episodes.length === 0) {
            doc.querySelectorAll('a[href*="episode"], a[href*="ep-"], a[href*="/ep"]').forEach((el, index) => {
                const epUrl = el.getAttribute('href');
                const epTitle = el.textContent.trim();
                if (epUrl && epTitle) {
                    const detected = detectSeasonAndType(epTitle);
                    episodes.push(new Episode({
                        name: epTitle,
                        episode: index + 1,
                        url: epUrl.startsWith('http') ? epUrl : baseUrl + epUrl,
                        season: detected.season,
                        posterUrl: posterUrl,
                        contentType: detected.contentType,
                        dubStatus: detectDubStatus(epUrl, epTitle)
                    }));
                }
            });
        }
        // Film fallback: no episodes → extract player IDs from content_player_X divs
        if (episodes.length === 0) {
            // Host embed URL patterns (from vostfree anime.js)
            const hostPatterns = {
                '1': id => 'https://myvi.ru/player/embed/html/' + id,
                '2': id => 'https://video.sibnet.ru/sh.php?video=' + id,
                '5': id => 'https://uqload.io/embed-' + id + '.html',
                '6': id => 'https://verystream.com/e/' + id
            };
            for (const el of doc.querySelectorAll('[id^="content_player_"]')) {
                const num = el.id.replace('content_player_', '');
                const vid = el.textContent.trim();
                if (vid && hostPatterns[num]) {
                    episodes.push(new Episode({
                        name: title || 'Film',
                        episode: 1,
                        url: hostPatterns[num](vid),
                        season: 1,
                        posterUrl: posterUrl,
                        dubStatus: detectDubStatus(url, title)
                    }));
                    break;
                }
            }
            // Fallback: pass page URL to loadStreams for iframe extraction
            if (episodes.length === 0) {
                episodes.push(new Episode({
                    name: title || 'Film',
                    episode: 1,
                    url: url,
                    season: 1,
                    posterUrl: posterUrl,
                    dubStatus: detectDubStatus(url, title)
                }));
            }
        }
        // Extract recommendations from 'Animes Similaires' section
        const recommendations = [];
        const recItems = doc.querySelectorAll('.related-movies ul.content li, .related-movies li');
        recItems.forEach(el => {
            const linkEl = el.querySelector('a[href]');
            const imgEl = el.querySelector('span.image img, img');
            const recTitle = linkEl?.getAttribute('title') || linkEl?.textContent.trim();
            const recUrl = linkEl?.getAttribute('href');
            const recPoster = imgEl?.getAttribute('data-src') || imgEl?.getAttribute('src');
            if (recTitle && recUrl) {
                recommendations.push(new MultimediaItem({
                    title: recTitle,
                    url: recUrl.startsWith('http') ? recUrl : baseUrl + recUrl,
                    posterUrl: recPoster ? fixUrl(recPoster) : '',
                    type: 'anime'
                }));
            }
        });

        cb({ success: true, data: new MultimediaItem({ type: "anime", title, description, posterUrl, episodes, year, score, status, genres: genreEls.length > 0 ? genreEls : undefined, recommendations: recommendations.length > 0 ? recommendations : undefined }) });
    } catch (e) { log('load error: ' + url, e); cb({ success: false, errorCode: 'LOAD_ERROR', message: String(e) }); }
}

async function loadStreams(url, cb) {
    try {
        const res = await axios.get(url, { headers });
        const html = res.data;
        const streams = [];
        // Extract iframes for video sources
        const iframeRegex = /<iframe[^>]*src=["']([^"']+)["'][^>]*>/gi;
        let match;
        while ((match = iframeRegex.exec(html)) !== null) {
            const embedUrl = match[1];
            if (embedUrl && !embedUrl.includes('ads') && !embedUrl.includes('google') && !embedUrl.includes('facebook')) {
                const streamRes = await Extractors.resolveStream(embedUrl);
                if (streamRes) streams.push(streamRes);
            }
        }
        // Fallback: try to find direct video URLs in script tags
        const videoRegex = /file["']?\s*:\s*["']?(https?:\/\/[^"'\s]+\.m3u8[^"'\s]*|https?:\/\/[^"'\s]+\.mp4[^"'\s]*)["']?/gi;
        let vMatch;
        while ((vMatch = videoRegex.exec(html)) !== null) {
            streams.push(new StreamResult({
                url: vMatch[1],
                quality: 'Auto',
                source: 'Direct'
            }));
        }
        // Fallback: content_player_X divs (films with host embed IDs)
        if (streams.length === 0) {
            const hostPatterns = {
                '1': id => 'https://myvi.ru/player/embed/html/' + id,
                '2': id => 'https://video.sibnet.ru/sh.php?video=' + id,
                '5': id => 'https://uqload.io/embed-' + id + '.html',
                '6': id => 'https://verystream.com/e/' + id
            };
            const cpRegex = /id=["']content_player_(\d+)["'][^>]*>([^<]*)</gi;
            let cpMatch;
            while ((cpMatch = cpRegex.exec(html)) !== null) {
                const num = cpMatch[1];
                const vid = cpMatch[2].trim();
                if (vid && hostPatterns[num]) {
                    const hostUrl = hostPatterns[num](vid);
                    const streamRes = await Extractors.resolveStream(hostUrl);
                    if (streamRes) streams.push(streamRes);
                    break;
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
