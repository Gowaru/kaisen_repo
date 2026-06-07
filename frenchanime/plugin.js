// @ts-nocheck
import { MixDrop, StreamTape, Voe, Filemoon, DoodExtractor } from 'skystream-extractors/dist/index.js';

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

        // 2. Fallback: bundled skystream-extractors
        try {
            let extracted = [];
            if (url.includes('mixdrop')) {
                const ex = new MixDrop();
                extracted = await ex.getUrl(url);
            } else if (url.includes('streamtape')) {
                const ex = new StreamTape();
                extracted = await ex.getUrl(url);
            } else if (url.includes('voe')) {
                const ex = new Voe();
                extracted = await ex.getUrl(url);
            } else if (url.includes('filemoon')) {
                const ex = new Filemoon();
                extracted = await ex.getUrl(url);
            } else if (url.includes('dood')) {
                const ex = new DoodExtractor();
                extracted = await ex.getUrl(url);
            }
            if (extracted && extracted.length > 0) return extracted[0];
        } catch (e) { log('Extractor failed: ' + url, e); }

        if (url.includes('sibnet.ru')) {
            try {
                const res = await axios.get(url);
                const match = res.data.match(/player\.src\(\[\{src:\s*["']([^"']+)["']/i) || res.data.match(/src:\s*["'](\/v\/.*?\.mp4)["']/i);
                if (match) {
                    let vUrl = match[1];
                    if (vUrl.startsWith('//')) vUrl = 'https:' + vUrl;
                    else if (vUrl.startsWith('/')) vUrl = 'https://video.sibnet.ru' + vUrl;
                    return new StreamResult({ url: vUrl, quality: 'Auto', source: 'Sibnet', headers: { 'Referer': url } });
                }
            } catch (e) { log('Sibnet extraction failed', e); }
        }

        if (url.includes('sendvid.com')) {
            try {
                const res = await axios.get(url);
                const match = res.data.match(/<source\s+src=["']([^"']+\.mp4)["']/i) || res.data.match(/video_source\s*=\s*["']([^"']+)["']/i);            if (match) return new StreamResult({ url: match[1], quality: 'Auto', source: 'Sendvid' });
        } catch (e) { log('Sendvid extraction failed', e); }
        }

        // --- Vidmoly (domain migrated to vidmoly.net) ---
        if (url.includes('vidmoly')) {
            try {
                let vidmolyUrl = url.replace('vidmoly.to', 'vidmoly.net');
                const vmHeaders = { 'Referer': 'https://anime-sama.to/', 'Sec-Fetch-Dest': 'iframe', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0' };
                let res = await axios.get(vidmolyUrl, { headers: vmHeaders });
                let html = typeof res.data === 'string' ? res.data : '';
                if (typeof getAndUnpack !== 'undefined' && html.includes('eval(function(p,a,c,k')) {
                    try { html = html + '\n' + getAndUnpack(html); } catch (e) { }
                }
                const fileMatch = html.match(/sources\s*:\s*\[\s*\{\s*file\s*:\s*["']([^"']+)["']/i) ||
                    html.match(/file\s*:\s*["']([^"']+\.m3u8[^"']*)["']/i) ||
                    html.match(/<source\s+src=["']([^"']+)["']/i);
                if (fileMatch) {
                    let videoUrl = fileMatch[1];
                    if (videoUrl.startsWith('//')) videoUrl = 'https:' + videoUrl;
                    return new StreamResult({ url: "MAGIC_PROXY_v1" + encodeBase64(videoUrl), quality: 'Auto', source: 'Vidmoly', headers: { 'Referer': 'https://vidmoly.net/' } });
                }
            } catch (e) { }
            let proxyUrl = url.replace('vidmoly.to', 'vidmoly.net');
            return new StreamResult({ url: "MAGIC_PROXY_v1" + encodeBase64(proxyUrl), quality: 'Auto', source: 'Vidmoly', headers: { 'Referer': 'https://vidmoly.net/' } });
        }

        if (url.endsWith('.mp4') || url.endsWith('.m3u8')) {
            let host = 'Unknown'; try { host = new URL(url).hostname; } catch (e) { }
            return new StreamResult({ url: url, quality: 'Auto', source: host });
        }

        let host = 'Unknown'; try { host = new URL(url).hostname; } catch (e) { }
        return new StreamResult({ url: "MAGIC_PROXY_v1" + encodeBase64(url), quality: 'Auto', source: host + " (Proxy)" });
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
            const url = linkEl?.getAttribute('href');
            const posterUrl = imgEl?.getAttribute('src') || imgEl?.getAttribute('data-src') || linkEl?.querySelector('img')?.getAttribute('src');
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
            const url = linkEl?.getAttribute('href') || linkEl?.getAttribute('data-link');
            const posterUrl = imgEl?.getAttribute('src') || imgEl?.getAttribute('data-src') || el.querySelector('.mov-i img')?.getAttribute('src');
            if (title && url && title.length > 2 && !seenUrls.has(url)) {
                seenUrls.add(url);
                const section = langEl && langEl.classList.contains('vf') ? 'Derniers Épisodes VF' : 'Derniers Épisodes VOSTFR';
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
                const url = linkEl?.getAttribute('href') || linkEl?.getAttribute('data-link');
                const posterUrl = imgEl?.getAttribute('src') || imgEl?.getAttribute('data-src');
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
                const posterUrl = imgEl?.getAttribute('src') || imgEl?.getAttribute('data-src');
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
        // DLE CMS requires POST for search - post to the base URL
        const res = await axios.post(baseUrl, `do=search&subaction=search&search_start=0&full_search=0&result_from=1&story=${encodeURIComponent(query)}`, { headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' } });
        const html = res.data;
        const doc = await parseHtml(html);
        const items = [];
        const seenUrls = new Set();

        // DLE search results are in .mov.clearfix containers
        Array.from(doc.querySelectorAll('.mov.clearfix, .mov')).forEach(el => {
            const linkEl = el.querySelector('a');
            const titleEl = el.querySelector('h2 a, h3 a, .title a, a');
            const imgEl = el.querySelector('img');
            const title = titleEl?.textContent.trim();
            const url = linkEl?.getAttribute('href');
            const posterUrl = imgEl?.getAttribute('src') || imgEl?.getAttribute('data-src');
            if (title && url && title.length > 1 && !seenUrls.has(url)) {
                seenUrls.add(url);
                items.push(new MultimediaItem({
                    title,
                    url: url.startsWith('http') ? url : baseUrl + url,
                    posterUrl: posterUrl,
                    type: 'anime', playbackPolicy: 'none'
                }));
            }
        });

        // Fallback: try generic patterns if .mov didn't work
        if (items.length === 0) {
            Array.from(doc.querySelectorAll('article, .news-item, .short-item')).forEach(el => {
                const linkEl = el.querySelector('a');
                const title = el.querySelector('h2, h3, h4')?.textContent.trim() || linkEl?.textContent.trim();
                const url = linkEl?.getAttribute('href');
                const posterUrl = el.querySelector('img')?.getAttribute('src') || el.querySelector('img')?.getAttribute('data-src');
                if (title && url && title.length > 1 && !seenUrls.has(url)) {
                    seenUrls.add(url);
                    items.push(new MultimediaItem({
                        title,
                        url: url.startsWith('http') ? url : baseUrl + url,
                        posterUrl: posterUrl,
                        type: 'anime', playbackPolicy: 'none'
                    }));
                }
            });
        }

        cb({ success: true, data: items });
    } catch (e) { log('search error', e); cb({ success: false, errorCode: 'SEARCH_ERROR', message: String(e) }); }
}

function detectSeasonAndType(name) {
        let season = 1;
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

async function load(url, cb) {
    try {
        const res = await axios.get(url, { headers });
        const html = res.data;
        const doc = await parseHtml(html);
        const title = doc.querySelector('h1')?.textContent.trim() || doc.querySelector('.film-info .title')?.textContent.trim();
        // Description: try multiple selectors
        const description = doc.querySelector('.description')?.textContent.trim() ||
            doc.querySelector('.entry-content')?.textContent.trim() ||
            doc.querySelector('.movie-desc')?.textContent.trim() ||
            doc.querySelector('.full-text')?.textContent.trim() ||
            doc.querySelector('span[itemprop="description"]')?.textContent.trim() ||
            doc.querySelector('meta[name="description"]')?.getAttribute('content') ||
            doc.querySelector('meta[property="og:description"]')?.getAttribute('content');
        // Poster: try #posterimg, then .poster img, then og:image
        const posterUrl = doc.querySelector('#posterimg')?.getAttribute('src') ||
            doc.querySelector('.poster img')?.getAttribute('src') ||
            doc.querySelector('meta[property="og:image"]')?.getAttribute('content');
        // Extract metadata: year, genres, status
        const yearMatch = html.match(/Date de sortie\s*:?\s*(\d{4})/i) || html.match(/Ann[eé]e\s*:?\s*(\d{4})/i);
        const year = yearMatch ? parseInt(yearMatch[1]) : undefined;
        const genreEls = Array.from(doc.querySelectorAll('span[itemprop="genre"], .genre a, .genres a, .category a')).map(el => el.textContent.trim()).filter(Boolean);
        // Status
        const status = doc.querySelector('.status, .statut, [class*="status"]')?.textContent.trim().toLowerCase();
        const episodes = [];
        // Detect page-level dubStatus from metadata (itemprop=inLanguage)
        const pageDubStatus = detectPageDubStatus(doc, url);
        // DLE episode links - try multiple patterns
        const epSelectors = ['.episodes-list a', '.episode-link', 'select option', '.ep-item a', 'a[href*="episode"], a[href*="ep-"]'];
        for (const sel of epSelectors) {
            doc.querySelectorAll(sel).forEach((el, index) => {
                const epUrl = el.getAttribute('href') || el.getAttribute('value');
                const epTitle = el.textContent.trim();
                if (epUrl && epTitle) {
                    const detected = detectSeasonAndType(epTitle);
                    let dubSt = detectDubStatus(epUrl, epTitle);
                    if (dubSt === 'none') dubSt = pageDubStatus;
                    episodes.push(new Episode({
                        name: epTitle || ('Episode ' + (index + 1)),
                        episode: index + 1,
                        url: epUrl.startsWith('http') ? epUrl : baseUrl + epUrl,
                        season: detected.season,
                        posterUrl: posterUrl,
                        contentType: detected.contentType,
                        dubStatus: dubSt
                    }));
                }
            });
            if (episodes.length > 0) break;
        }
        // Fallback: parse div.eps with format "epNum!url, epNum!url"
        if (episodes.length === 0) {
            const epsDiv = doc.querySelector('.eps');
            if (epsDiv) {
                const epsData = epsDiv.textContent.trim();
                const pairs = epsData.split(',').map(s => s.trim()).filter(s => s.includes('!'));
                pairs.forEach(pair => {
                    const [epNum, epUrl] = pair.split('!');
                    if (epNum && epUrl && epUrl.startsWith('http')) {
                        let dubSt = detectDubStatus(epUrl, 'Épisode ' + epNum.trim());
                        if (dubSt === 'none') dubSt = pageDubStatus;
                        episodes.push(new Episode({
                            name: 'Épisode ' + epNum.trim(),
                            episode: parseInt(epNum.trim()),
                            url: epUrl.trim(),
                            season: 1,
                            posterUrl: posterUrl,
                            dubStatus: dubSt
                        }));
                    }
                });
            }
        }
        // Film fallback: no episodes → pass page URL to loadStreams for iframe extraction
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
        // Extract recommendations from related/similaires section
        const recommendations = [];
        const recSelectors = ['.related.tcarusel .mov.tcarusel-item', '.tcarusel-scroll .mov', '.related .mov'];
        for (const sel of recSelectors) {
            doc.querySelectorAll(sel).forEach(el => {
                const linkEl = el.querySelector('a[data-link], a[href]');
                const imgEl = el.querySelector('img');
                const titleEl = el.querySelector('.mov-t, a.mov-t');
                const recTitle = titleEl?.textContent.trim() || linkEl?.getAttribute('title');
                const recUrl = linkEl?.getAttribute('data-link') || linkEl?.getAttribute('href');
                const recPoster = imgEl?.getAttribute('src') || imgEl?.getAttribute('data-src');
                if (recTitle && recUrl) {
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

        cb({ success: true, data: new MultimediaItem({ type: "anime", title, description, posterUrl, episodes, year, status, genres: genreEls.length > 0 ? genreEls : undefined, recommendations: recommendations.length > 0 ? recommendations : undefined }) });
    } catch (e) { log('load error: ' + url, e); cb({ success: false, errorCode: 'LOAD_ERROR', message: String(e) }); }
}

async function loadStreams(url, cb) {
    try {
        const res = await axios.get(url, { headers });
        const html = res.data;
        const streams = [];
        // 1. Extract iframes for video sources (VOE, Voe, etc.)
        const iframeRegex = /<iframe[^>]*src=["']([^"']+)["'][^>]*>/gi;
        let match;
        while ((match = iframeRegex.exec(html)) !== null) {
            const embedUrl = match[1];
            if (embedUrl && !embedUrl.includes('ads') && !embedUrl.includes('google') && !embedUrl.includes('facebook')) {
                const streamRes = await Extractors.resolveStream(embedUrl);
                if (streamRes) streams.push(streamRes);
            }
        }
        // 2. Fallback: find direct video URLs in script tags (file:, sources:)
        if (streams.length === 0) {
            const videoRegex = /(?:file|source|url)["']?\s*:\s*["']?(https?:\/\/[^"'\s]+\.(m3u8|mp4)[^"'\s]*)["']?/gi;
            let vMatch;
            while ((vMatch = videoRegex.exec(html)) !== null) {
                const videoUrl = vMatch[1];
                if (videoUrl && !videoUrl.includes('.js') && !videoUrl.includes('.css') && !videoUrl.includes('analytics') && !videoUrl.includes('tracking')) {
                    streams.push(new StreamResult({ url: videoUrl, quality: 'Auto', source: 'Direct' }));
                }
            }
        }
        // 3. Fallback: extract from JW Player config (VOE CDN pages)
        if (streams.length === 0) {
            const voeMatch = html.match(/file["']?\s*:\s*["']([^"']+\.mp4[^"']*)["']/i);
            if (voeMatch && voeMatch[1] && !voeMatch[1].includes('.js')) {
                streams.push(new StreamResult({ url: voeMatch[1], quality: 'Auto', source: 'VOE' }));
            }
        }
        cb({ success: true, data: streams });
    } catch (e) { log('loadStreams error: ' + url, e); cb({ success: false, errorCode: 'STREAM_ERROR', message: String(e) }); }
}

globalThis.getHome = getHome;
globalThis.search = search;
globalThis.load = load;
globalThis.loadStreams = loadStreams;
