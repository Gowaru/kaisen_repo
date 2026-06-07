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

const PLUGIN_ID = 'voiranime';
function log(msg, data) { try { console.log(`[${PLUGIN_ID}] ${msg}`, data || ''); } catch (_) { } }

const baseUrl = (typeof manifest !== 'undefined' && manifest.baseUrl) ? manifest.baseUrl : 'https://voir-anime.to';
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

        // ── 1. Animes (page-item-detail) ──
        const items = [];
        Array.from(doc.querySelectorAll('#loop-content .page-item-detail, .page-item-detail')).forEach(el => {
            const linkEl = el.querySelector('a');
            const titleEl = el.querySelector('.post-title a, h3 a, h5 a, .title a');
            const imgEl = el.querySelector('img');
            const title = titleEl?.textContent.trim();
            const url = linkEl?.getAttribute('href') || titleEl?.getAttribute('href');
            const posterUrl = imgEl?.getAttribute('data-src') || imgEl?.getAttribute('src');
            if (title && url && !seenUrls.has(url)) {
                seenUrls.add(url);
                items.push(new MultimediaItem({
                    title, url: url.startsWith('http') ? url : baseUrl + url,
                    posterUrl: fixUrl(posterUrl), type: 'anime'
                }));
            }
        });
        if (items.length > 0) results['Animes'] = items;

        // ── 2. VF/VOSTFR sections (c-tabs-item with language badges) ──
        const vfItems = [];
        const vostfrItems = [];
        Array.from(doc.querySelectorAll('.c-tabs-item .c-tabs-item__content, .tab-content .tab-pane')).forEach(el => {
            const linkEl = el.querySelector('a');
            const titleEl = el.querySelector('.post-title a, h4 a, h3 a');
            const imgEl = el.querySelector('img');
            const title = titleEl?.textContent.trim();
            const url = linkEl?.getAttribute('href');
            if (!title || !url || seenUrls.has(url)) return;
            const badgeEl = el.querySelector('.mg_status, .post-status .summary-content');
            const badgeText = badgeEl?.textContent.trim().toUpperCase() || '';
            const isVf = badgeText === 'VF' || /VF/.test(el.querySelector('.tabs-content')?.textContent || '');
            const isVostfr = badgeText === 'VOSTFR' || /VOSTFR/.test(el.querySelector('.tabs-content')?.textContent || '');
            seenUrls.add(url);
            const fullUrl = url.startsWith('http') ? url : baseUrl + url;
            const posterUrl = fixUrl(imgEl?.getAttribute('data-src') || imgEl?.getAttribute('src'));
            if (isVf) vfItems.push(new MultimediaItem({ title: title + ' (VF)', url: fullUrl, posterUrl, type: 'anime' }));
            else if (isVostfr) vostfrItems.push(new MultimediaItem({ title: title + ' (VOSTFR)', url: fullUrl, posterUrl, type: 'anime' }));
        });
        if (vfItems.length > 0) results['Animes VF'] = vfItems;
        if (vostfrItems.length > 0) results['Animes VOSTFR'] = vostfrItems;



        // ── 5. Content sections by headings ──
        Array.from(doc.querySelectorAll('h2, h3, h4')).forEach(heading => {
            const sectionTitle = heading.textContent.trim();
            if (!sectionTitle || sectionTitle.length < 2 || results[sectionTitle]) return;
            let container = heading.nextElementSibling;
            if (!container) container = heading.parentElement;
            if (!container) return;
            const sectionItems = [];
            Array.from(container.querySelectorAll('.post-title a, h3 a, a[href*="/manga/"], a[href*="/anime/"]')).forEach(el => {
                const title = el.textContent.trim();
                const url = el.getAttribute('href');
                if (title && url && title.length > 2 && !seenUrls.has(url)) {
                    seenUrls.add(url);
                    sectionItems.push(new MultimediaItem({
                        title, url: url.startsWith('http') ? url : baseUrl + url,
                        posterUrl: '', type: 'anime'
                    }));
                }
            });
            if (sectionItems.length > 0) results[sectionTitle] = sectionItems;
        });

        cb({ success: true, data: results });
    } catch (e) { log('getHome error', e); cb({ success: false, errorCode: 'HOME_ERROR', message: String(e) }); }
}

async function search(query, cb) {
    try {
        // Madara theme uses ajax search
        const res = await axios.get(`${baseUrl}/?s=${encodeURIComponent(query)}&post_type=wp-manga`, { headers });
        const doc = await parseHtml(res.data);
        const items = [];
        const seenUrls = new Set();
        // Madara theme selectors with fallbacks
        const selectors = ['.c-tabs-item__content', '.row.c-tabs-item__content', '.post-title', '.page-item-detail'];
        for (const sel of selectors) {
            Array.from(doc.querySelectorAll(sel)).forEach(el => {
                const linkEl = el.querySelector('a');
                const title = el.querySelector('.post-title a, h4 a, h3 a')?.textContent.trim();
                const url = linkEl?.getAttribute('href');
                const posterUrl = el.querySelector('img')?.getAttribute('data-src') || el.querySelector('img')?.getAttribute('src');
                if (title && url && !seenUrls.has(url)) {
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
        // Fallback: generic link patterns
        if (items.length === 0) {
            Array.from(doc.querySelectorAll('a[href*="/manga/"], a[href*="/series/"], a[href*="/anime/"]')).forEach(el => {
                const title = el.textContent.trim();
                const url = el.getAttribute('href');
                if (title && url && title.length > 2 && !seenUrls.has(url)) {
                    seenUrls.add(url);
                    items.push(new MultimediaItem({
                        title,
                        url: url.startsWith('http') ? url : baseUrl + url,
                        posterUrl: '',
                        type: 'anime', playbackPolicy: 'none'
                    }));
                }
            });
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
        const title = doc.querySelector('.post-title h1, h1.entry-title, h1')?.textContent.trim();
        // Description: try multiple selectors (Madara theme patterns)
        const description = doc.querySelector('.description-summary .summary__content')?.textContent.trim() ||
            doc.querySelector('.entry-content .summary__content')?.textContent.trim() ||
            doc.querySelector('.manga-excerpt')?.textContent.trim() ||
            doc.querySelector('.summary__content')?.textContent.trim() ||
            doc.querySelector('meta[name="description"]')?.getAttribute('content') ||
            doc.querySelector('meta[property="og:description"]')?.getAttribute('content');
        // Poster: try multiple selectors with data-src first (lazy-loaded Madara theme)
        const posterEl = doc.querySelector('.summary_image img') || doc.querySelector('.post-thumbnail img');
        const posterUrl = posterEl?.getAttribute('data-src') || posterEl?.getAttribute('src') ||
            doc.querySelector('meta[property="og:image"]')?.getAttribute('content');
        // Extract metadata: year, genres, status
        const yearEl = doc.querySelector('.post-content_item .summary-content, .post-status .summary-content');
        const yearFromEl = yearEl ? parseInt(yearEl.textContent.match(/\d{4}/)?.[0] || '0') : undefined;
        const yearMatch = html.match(/datePublished["']?\s*:?\s*["']?(\d{4})/i) || html.match(/Ann[eé]e\s*:?\s*(\d{4})/i);
        const year = yearFromEl || (yearMatch ? parseInt(yearMatch[1]) : undefined);
        const genreEls = Array.from(doc.querySelectorAll('.genres-content a, .wp-manga-genre a, .tag-summary a, .summary-content a[href*="genre"]')).map(el => el.textContent.trim()).filter(Boolean);
        const statusEl = doc.querySelector('.post-status .summary-content, .post-status .genres-content');
        const status = statusEl?.textContent?.trim()?.toLowerCase();
        // Extract score from .score element
        const scoreEl = doc.querySelector('.score.font-meta.total_votes');
        const parsedScore = scoreEl ? parseFloat(scoreEl.textContent.trim()) : NaN;
        const score = Number.isFinite(parsedScore) ? parsedScore : undefined;
        const episodes = [];
        // Madara theme: .wp-manga-chapter or li.chapter-item
        doc.querySelectorAll('.wp-manga-chapter a, li.version-chap a, .listing-chapters_wrap a, .chapter-list a').forEach((el, index) => {
            const epUrl = el.getAttribute('href');
            const epTitle = el.textContent.trim();
            if (epUrl) {
                const detected = detectSeasonAndType(epTitle);
                episodes.push(new Episode({
                    name: epTitle || ('Episode ' + (index + 1)),
                    episode: index + 1,
                    url: epUrl.startsWith('http') ? epUrl : baseUrl + epUrl,
                    season: detected.season,
                    posterUrl: posterUrl,
                    contentType: detected.contentType,
                    dubStatus: detectDubStatus(epUrl, epTitle)
                }));
            }
        });
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
        // Extract recommendations from Madara related/similar section
        const recommendations = [];
        const recSelectors = ['.related .page-item-detail', '.c-blog__heading + .row .page-item-detail', '.manga-slider .slider__item', '.popular-slider .slider__item'];
        for (const sel of recSelectors) {
            doc.querySelectorAll(sel).forEach(el => {
                const linkEl = el.querySelector('a[href]');
                const imgEl = el.querySelector('img');
                const titleEl = el.querySelector('.post-title a, h3 a, h5 a');
                const recTitle = titleEl?.textContent.trim() || linkEl?.getAttribute('title');
                const recUrl = linkEl?.getAttribute('href');
                const recPoster = imgEl?.getAttribute('data-src') || imgEl?.getAttribute('src');
                if (recTitle && recUrl && !recUrl.includes('#')) {
                    recommendations.push(new MultimediaItem({
                        title: recTitle,
                        url: recUrl.startsWith('http') ? recUrl : baseUrl + recUrl,
                        posterUrl: recPoster ? fixUrl(recPoster) : '',
                        type: 'anime'
                    }));
                }
            });
            if (recommendations.length > 0) break;
        }

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
        cb({ success: true, data: streams });
    } catch (e) { log('loadStreams error: ' + url, e); cb({ success: false, errorCode: 'STREAM_ERROR', message: String(e) }); }
}

globalThis.getHome = getHome;
globalThis.search = search;
globalThis.load = load;
globalThis.loadStreams = loadStreams;
