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
            const linkEl = el.querySelector('.film-name a, h3 a, a.film-poster-ahref, a');
            const imgEl = el.querySelector('img.film-poster-img, img');
            const epEl = el.querySelector('.tick-eps, .ep-count, .tick-item:last-child');
            const title = linkEl?.getAttribute('title') || linkEl?.textContent.trim();
            const url = linkEl?.getAttribute('href');
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
        const res = await axios.get(`${baseUrl}/?s=${encodeURIComponent(query)}`, { headers });
        const doc = await parseHtml(res.data);
        const items = [];
        const seenUrls = new Set();
        const selectors = ['.film_list-wrap .flw-item', '.film-name a', 'article', '.post-item'];
        for (const sel of selectors) {
            Array.from(doc.querySelectorAll(sel)).forEach(el => {
                const linkEl = el.querySelector('.film-name a') || el.querySelector('a');
                const imgEl = el.querySelector('img');
                const title = linkEl?.textContent.trim();
                const url = linkEl?.getAttribute('href');
                const posterUrl = imgEl?.getAttribute('data-src') || imgEl?.getAttribute('src');
                if (title && url && !seenUrls.has(url)) {
                    seenUrls.add(url);
                    items.push(new MultimediaItem({
                        title,
                        url: url.startsWith('http') ? url : baseUrl + url,
                        posterUrl: fixUrl(posterUrl),
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
        // Parse episodes for each season with automatic numbering
        for (let sIdx = 0; sIdx < seasonLinks.length; sIdx++) {
            const sInfo = seasonLinks[sIdx];
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
                    const detected = detectSeasonAndType(epTitle);
                    // Determine dubStatus from the season URL, fallback to page URL
                    const seasonDubStatus = getDubStatusFromPageUrl(sInfo.url) || detectDubStatus(epUrl, epTitle);
                    episodes.push(new Episode({
                        name: epTitle || ('Episode ' + epNum),
                        episode: parseInt(epNum),
                        url: fullEpUrl,
                        season: detected.season || (sIdx + 1),
                        posterUrl: posterUrl,
                        contentType: detected.contentType,
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
                    // Fetch episodes for all alternative seasons in parallel
                    const altSeasonResponses = await Promise.all(
                        altSeasonLinks.map(altSInfo =>
                            axios.get(`${baseUrl}/engine/ajax/full-story.php?newsId=${altSInfo.id}&d=${Date.now()}`, { headers })
                                .then(r => r.data)
                                .catch(() => null)
                        )
                    );
                    // Parse alternative version's episodes with automatic numbering
                    for (let altIdx = 0; altIdx < altSeasonLinks.length; altIdx++) {
                        const altSInfo = altSeasonLinks[altIdx];
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
                                const detected = detectSeasonAndType(epTitle);
                                const altSeasonDubStatus = getDubStatusFromPageUrl(altSInfo.url) || detectDubStatus(epUrl, epTitle);
                                episodes.push(new Episode({
                                    name: epTitle || ('Episode ' + epNum),
                                    episode: parseInt(epNum),
                                    url: fullEpUrl,
                                    season: detected.season || (altIdx + 1),
                                    posterUrl: posterUrl,
                                    contentType: detected.contentType,
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
        cb({ success: true, data: new MultimediaItem({ type: "anime", title, description, posterUrl, episodes, year, status, genres: genreEls.length > 0 ? genreEls : undefined }) });
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
        let fullStoryHtml = html;
        if (!html.includes('content_player_') && movieId) {
            fullStoryHtml = typeof epRes.data === 'string' ? epRes.data : (epRes.data.html || '');
            fullStoryHtml = fullStoryHtml.replace(/\\"/g, '"').replace(/\\'/g, "'").replace(/\\\//g, '/');
        }
        const serverRegex = /<div class="item server-item" [^>]*data-server-id="([^"]*)" [^>]*data-embed="([^"]*)">/g;
        let match;
        while ((match = serverRegex.exec(html)) !== null) {
            const serverId = match[1];
            const embedUrl = match[2];
            const cpMatch = fullStoryHtml.match(new RegExp(`id="content_player_${serverId}"[^>]*>([^<]*)<`, 'i'));
            let playerUrl = cpMatch ? cpMatch[1].trim() : embedUrl;
            if (playerUrl) {
                const streamRes = await PluginExtractors.resolveStream(playerUrl);
                if (streamRes) {
                    streamRes.quality = "Server " + serverId;
                    streams.push(streamRes);
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
