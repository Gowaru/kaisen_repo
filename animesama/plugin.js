// @ts-nocheck
import { MixDrop, StreamTape, Voe, Filemoon, DoodExtractor, HubCloud } from 'skystream-extractors/dist/index.js';

function encodeBase64(str) {
    try {
        if (typeof btoa === 'function') return btoa(str);
    } catch (e) { }
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
    let output = "";
    let i = 0;
    str = encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, function (match, p1) {
        return String.fromCharCode(parseInt(p1, 16));
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

const PLUGIN_ID = 'animesama';
function log(msg, data) { try { console.log(`[${PLUGIN_ID}] ${msg}`, data || ''); } catch (_) { } }

const baseUrl = typeof manifest !== 'undefined' ? manifest.baseUrl : 'https://anime-sama.to';
const axios = {
    get: async (url, config = {}) => {
        const h = config.headers || {};
        if (!h['User-Agent']) h['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

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
            let parsed = r.body || "";
            try { if (typeof r.body === 'string' && r.body.trim().startsWith('{')) parsed = JSON.parse(r.body); } catch (e) { }
            return { data: parsed, status: r.status };
        }
        return { data: "" };
    },
    post: async (url, data, config = {}) => {
        const h = config.headers || {};
        if (!h['User-Agent']) h['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

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
            let parsed = r.body || "";
            try { if (typeof r.body === 'string' && r.body.trim().startsWith('{')) parsed = JSON.parse(r.body); } catch (e) { }
            return { data: parsed, status: r.status };
        }
        return { data: "" };
    }
};

const Extractors = {

    async resolveStream(url) {
        if (!url) return null;

        // ──────────────────────────────────────────────────────────
        // 1. Try the SkyStream built-in loadExtractor() first.
        //    It handles many common hosts natively (MixDrop, Voe, etc.)
        // ──────────────────────────────────────────────────────────
        if (typeof loadExtractor !== 'undefined') {
            try {
                const streams = await loadExtractor(url);
                if (streams && streams.length > 0) return streams[0];
            } catch (e) { }
        }

        // ──────────────────────────────────────────────────────────
        // 2. Fallback: try bundled skystream-extractors library
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
        } catch (e) { }

        // ──────────────────────────────────────────────────────────
        // 3. Manual extraction for hosts not covered above
        // ──────────────────────────────────────────────────────────

        // --- Sibnet ---
        if (url.includes('sibnet.ru')) {
            try {
                const res = await axios.get(url, {
                    headers: { 'Referer': url }
                });
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
            } catch (e) { }
        }

        // --- Sendvid ---
        if (url.includes('sendvid.com')) {
            try {
                const res = await axios.get(url, {
                    headers: { 'Referer': 'https://anime-sama.to/' }
                });
                if (typeof res.data === 'string') {
                    const match = res.data.match(/<source\s+src=["']([^"']+)["']/i) ||
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
            } catch (e) { }
        }

        // --- Vidmoly (JWT redirect + file extraction) ---
        if (url.includes('vidmoly')) {
            try {
                let res = await axios.get(url, { headers: { 'Referer': 'https://anime-sama.to/' } });
                let html = typeof res.data === 'string' ? res.data : '';

                // Handle JS redirect (JWT protection)
                const redirMatch = html.match(/window\.location\.replace\(['"]([^'"]+)['"]\)/i);
                if (redirMatch) {
                    let redirUrl = redirMatch[1];
                    // Reconstruct absolute URL from relative redirect
                    if (!redirUrl.startsWith('http')) {
                        const baseMatch = url.match(/(https?:\/\/[^\/]+)/);
                        const origin = baseMatch ? baseMatch[1] : 'https://vidmoly.to';
                        if (redirUrl.startsWith('?')) {
                            redirUrl = url.split('?')[0] + redirUrl;
                        } else if (redirUrl.startsWith('/')) {
                            redirUrl = origin + redirUrl;
                        } else {
                            redirUrl = origin + '/' + redirUrl;
                        }
                    }
                    res = await axios.get(redirUrl, { headers: { 'Referer': url } });
                    html = typeof res.data === 'string' ? res.data : '';
                }

                // Try getAndUnpack for packed JS
                if (typeof getAndUnpack !== 'undefined' && html.includes('eval(function(p,a,c,k')) {
                    try {
                        const unpacked = getAndUnpack(html);
                        if (unpacked) html = html + '\n' + unpacked;
                    } catch (e) { }
                }

                const fileMatch = html.match(/file\s*:\s*"(https?:\/\/[^"]+)"/i) ||
                    html.match(/sources\s*:\s*\[\{[^}]*file\s*:\s*"(https?:\/\/[^"]+)"/i);
                if (fileMatch) {
                    const videoUrl = fileMatch[1];
                    return new StreamResult({
                        url: "MAGIC_PROXY_v1" + encodeBase64(videoUrl),
                        quality: 'Auto',
                        source: 'Vidmoly',
                        headers: { 'Referer': url }
                    });
                }
            } catch (e) { }
            // Vidmoly: extraction failed, fallback to proxy
            return new StreamResult({
                url: "MAGIC_PROXY_v1" + encodeBase64(url),
                quality: 'Auto',
                source: 'Vidmoly',
                headers: { 'Referer': 'https://anime-sama.to/' }
            });
        }

        // --- Minochinos / Vidhide (P.A.C.K.E.R. obfuscated) ---
        if (url.includes('minochinos') || url.includes('vidhide') || url.includes('vidhidepre')) {
            try {
                const res = await axios.get(url, { headers: { 'Referer': 'https://anime-sama.to/' } });
                let html = typeof res.data === 'string' ? res.data : '';

                // Use native getAndUnpack() to deobfuscate P.A.C.K.E.R. packed JS
                if (typeof getAndUnpack !== 'undefined' && html.includes('eval(function(p,a,c,k')) {
                    try {
                        const unpacked = getAndUnpack(html);
                        if (unpacked) html = html + '\n' + unpacked;
                    } catch (e) { }
                }

                // Search for direct video URL (must be https://...  not a relative path)
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
            // Extraction failed, fallback to proxy
            return new StreamResult({
                url: "MAGIC_PROXY_v1" + encodeBase64(url),
                quality: 'Auto',
                source: 'Minochinos',
                headers: { 'Referer': 'https://anime-sama.to/' }
            });
        }

        // --- Embed4Me / Lpayer ---
        if (url.includes('embed4me') || url.includes('lpayer')) {
            return new StreamResult({
                url: "MAGIC_PROXY_v1" + encodeBase64(url),
                quality: 'Auto',
                source: 'Embed4Me',
                headers: { 'Referer': 'https://anime-sama.to/' }
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
                headers: { 'Referer': 'https://anime-sama.to/' }
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
            headers: { 'Referer': 'https://anime-sama.to/' }
        });
    }

};

async function getHome(cb) {
    try {
        const response = await axios.get(baseUrl);
        const html = response.data;
        if (!html || typeof html !== 'string') return cb({ success: false, message: "Impossible de récupérer la page d'accueil." });

        const data = {};
        const seenURLs = new Set();

        // Helper: normalize a catalogue URL to its root
        function toRootUrl(url) {
            if (!url.startsWith('http')) url = url.startsWith('/') ? baseUrl + url : baseUrl + '/' + url;
            const rootMatch = url.match(/(https?:\/\/[^\/]+\/catalogue\/[^\/]+)/);
            return rootMatch ? rootMatch[1] + '/' : url;
        }

        // ──────────────────────────────────────────────────────────
        // 1. CAROUSEL / À la Une
        // ──────────────────────────────────────────────────────────
        const carouselItems = [];
        // Split HTML into slide blocks by ak-slide divs
        const slideParts = html.split(/<div[^>]*class="[^"]*\bak-slide\b[^"]*"[^>]*>/gi);
        for (let si = 1; si < slideParts.length; si++) {
            const block = slideParts[si];
            // Must contain ak-slide-title (skip cloned/empty slides)
            const titleM = block.match(/<h2[^>]*class="ak-slide-title"[^>]*>([^<]+)<\/h2>/i);
            if (!titleM) continue;
            const title = titleM[1].trim();
            // Poster: try ak-slide-bg img first, then construct from title slug
            const bgM = block.match(/ak-slide-bg[\s\S]*?<img[^>]+src="([^"]+)"/i);
            let posterUrl = bgM ? bgM[1] : '';
            if (!posterUrl || posterUrl.includes('flag_') || posterUrl.includes('flag-')) {
                // Construct poster from title slug (anime-sama convention)
                const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
                posterUrl = baseUrl + '/img/contenu/' + slug + '.jpg';
            }
            if (posterUrl && !posterUrl.startsWith('http')) posterUrl = baseUrl + posterUrl;
            // Description from ak-slide-synopsis
            const synM = block.match(/ak-slide-synopsis[^>]*>([\s\S]*?)<\/p>/i);
            const description = synM ? synM[1].replace(/<[^>]+>/g, '').trim() : '';
            // CTA link (prefer VOSTFR)
            const ctaBlock = block.match(/ak-slide-ctas[\s\S]*$/i);
            let ctaUrl = '';
            if (ctaBlock) {
                const ctaLinks = [...ctaBlock[0].matchAll(/href="([^"]+)"/gi)];
                for (const cl of ctaLinks) {
                    if (cl[1].includes('/catalogue/')) {
                        ctaUrl = cl[1];
                        if (cl[1].includes('vostfr')) break;
                    }
                }
            }
            if (ctaUrl) {
                const rootUrl = toRootUrl(ctaUrl);
                if (!seenURLs.has(rootUrl)) {
                    seenURLs.add(rootUrl);
                    carouselItems.push(new MultimediaItem({
                        title: title,
                        url: rootUrl,
                        posterUrl: posterUrl,
                        description: description,
                        type: "anime"
                    }));
                }
            }
        }
        if (carouselItems.length > 0) data['À la Une'] = carouselItems;

        // ──────────────────────────────────────────────────────────
        // 2. DAILY RELEASES (jour par jour)
        // ──────────────────────────────────────────────────────────
        const dayBlocks = html.split(/<h2 class="titreJours[^>]*>/gi);
        for (let i = 1; i < dayBlocks.length; i++) {
            const block = dayBlocks[i];
            const dayTitleMatch = block.match(/<\/svg>[\s\S]*?<\/a>\s*([^\s<][^<]+)\s*<a/i);
            if (!dayTitleMatch) continue;
            const dayTitle = dayTitleMatch[1].trim();

            const items = [];
            const regex = /<div class="[^"]*(Anime|Scan)[^"]*(VF|VOSTFR)?[^"]*"[\s\S]*?<a[^>]+href="([^"]*\/catalogue\/[^"]+)"[^>]*>[\s\S]*?<img[^>]+src="([^"]+)"[\s\S]*?alt="([^"]+)"/gi;
            let match;
            const daySeen = new Set();
            while ((match = regex.exec(block)) !== null) {
                if (match[1] && match[1].toLowerCase() === 'scan') continue;

                let lang = match[2] ? match[2] : '';
                let url = match[3];
                let posterUrl = match[4];
                let title = match[5].trim();

                if (lang === 'VF') title += ' (VF)';
                else if (lang === 'VOSTFR') title += ' (VOSTFR)';
                else if (url.includes('/vf/')) title += ' (VF)';
                else if (url.includes('/vostfr/')) title += ' (VOSTFR)';

                const baseItemUrl = toRootUrl(url);
                const uniqueKey = baseItemUrl + "_" + lang;

                if (!daySeen.has(uniqueKey)) {
                    daySeen.add(uniqueKey);
                    seenURLs.add(baseItemUrl);
                    if (!posterUrl.startsWith('http')) posterUrl = baseUrl + posterUrl;
                    items.push(new MultimediaItem({
                        title: title,
                        url: baseItemUrl,
                        posterUrl: posterUrl,
                        type: "anime"
                    }));
                }
            }
            if (items.length > 0) data[dayTitle] = items;
        }

        // ──────────────────────────────────────────────────────────
        // 3. SCANS / MANGA
        // ──────────────────────────────────────────────────────────
        const scanItems = [];
        const scanRegex = /<div[^>]*class="[^"]*scan-card-premium[^"]*"[^>]*>[\s\S]*?<a[^>]+href="([^"]+)"[^>]*>[\s\S]*?<img[^>]+src="([^"]+)"[^>]*alt="([^"]+)"[\s\S]*?<\/a>[\s\S]*?<\/div>/gi;
        let scanMatch;
        while ((scanMatch = scanRegex.exec(html)) !== null && scanItems.length < 20) {
            let url = scanMatch[1];
            let posterUrl = scanMatch[2];
            let title = scanMatch[3].trim();

            const baseItemUrl = toRootUrl(url);                if (!seenURLs.has(baseItemUrl)) {
                    seenURLs.add(baseItemUrl);
                    if (!posterUrl.startsWith('http')) posterUrl = baseUrl + posterUrl;
                    scanItems.push(new MultimediaItem({
                    title: title + ' (Scan)',
                    url: baseItemUrl,
                    posterUrl: posterUrl,
                    type: "anime"
                }));
            }
        }
        if (scanItems.length > 0) data['Scans / Manga'] = scanItems;

        // ──────────────────────────────────────────────────────────
        // 4. VF ANIME (hors day blocks)
        // ──────────────────────────────────────────────────────────
        const vfItems = [];
        const vfRegex = /<div[^>]*class="[^"]*anime-card-premium[^"]*Anime\s+VF[^"]*"[^>]*>[\s\S]*?<a[^>]+href="([^"]+)"[^>]*>[\s\S]*?<img[^>]+src="([^"]+)"[^>]*alt="([^"]+)"[\s\S]*?<\/a>[\s\S]*?<\/div>/gi;
        let vfMatch;
        while ((vfMatch = vfRegex.exec(html)) !== null && vfItems.length < 20) {
            let url = vfMatch[1];
            let posterUrl = vfMatch[2];
            let title = vfMatch[3].trim();

            const baseItemUrl = toRootUrl(url);                if (!seenURLs.has(baseItemUrl)) {
                    seenURLs.add(baseItemUrl);
                    if (!posterUrl.startsWith('http')) posterUrl = baseUrl + posterUrl;
                    vfItems.push(new MultimediaItem({
                    title: title + ' (VF)',
                    url: baseItemUrl,
                    posterUrl: posterUrl,
                    type: "anime"
                }));
            }
        }
        if (vfItems.length > 0) data['Anime VF'] = vfItems;

        // ──────────────────────────────────────────────────────────
        // 5. VOSTFR ANIME (hors day blocks)
        // ──────────────────────────────────────────────────────────
        const vostfrItems = [];
        const vostfrRegex = /<div[^>]*class="[^"]*anime-card-premium[^"]*Anime\s+VOSTFR[^"]*"[^>]*>[\s\S]*?<a[^>]+href="([^"]+)"[^>]*>[\s\S]*?<img[^>]+src="([^"]+)"[^>]*alt="([^"]+)"[\s\S]*?<\/a>[\s\S]*?<\/div>/gi;
        let vostfrMatch;
        while ((vostfrMatch = vostfrRegex.exec(html)) !== null && vostfrItems.length < 20) {
            let url = vostfrMatch[1];
            let posterUrl = vostfrMatch[2];
            let title = vostfrMatch[3].trim();

            const baseItemUrl = toRootUrl(url);                if (!seenURLs.has(baseItemUrl)) {
                    seenURLs.add(baseItemUrl);
                    if (!posterUrl.startsWith('http')) posterUrl = baseUrl + posterUrl;
                    vostfrItems.push(new MultimediaItem({
                    title: title + ' (VOSTFR)',
                    url: baseItemUrl,
                    posterUrl: posterUrl,
                    type: "anime"
                }));
            }
        }
        if (vostfrItems.length > 0) data['Anime VOSTFR'] = vostfrItems;

        // ──────────────────────────────────────────────────────────
        // 6. FALLBACK: if nothing was parsed, try generic catalogue links
        // ──────────────────────────────────────────────────────────
        if (Object.keys(data).length === 0) {
            const items = [];
            const regex = /<a[^>]+href="([^"]*\/catalogue\/[^"]+)"[^>]*>[\s\S]*?<img[^>]+src="([^"]+)"[\s\S]*?alt="([^"]+)"/gi;
            let match;
            let count = 0;
            while ((match = regex.exec(html)) !== null && count < 15) {
                let url = match[1];
                if (url.includes('/scan/')) continue;
                const baseItemUrl = toRootUrl(url);
                if (!seenURLs.has(baseItemUrl)) {
                    seenURLs.add(baseItemUrl);
                    let posterUrl = match[2].startsWith('http') ? match[2] : baseUrl + match[2];
                    items.push(new MultimediaItem({
                        title: match[3].trim(),
                        url: baseItemUrl,
                        posterUrl: posterUrl,
                        type: "anime"
                    }));
                    count++;
                }
            }
            data["Dernières Sorties"] = items;
        }

        cb({ success: true, data: data });
    } catch (e) {
        log('getHome error', e); cb({ success: false, errorCode: 'PARSE_ERROR', message: String(e) }); }
}


async function search(query, cb) {
    try {
        let results = [];

        // Try standard fetch.php 
        try {
            const postBody = 'query=' + encodeURIComponent(query);
            const response = await axios.post(baseUrl + '/template-php/defaut/fetch.php', postBody, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
                }
            });
            const html = response.data;
            const regex = /<a href="([^"]+)" class="asn-search-result"><img[^>]+src="([^"]+)"[^>]*><div[^>]*><h3[^>]*>([^<]+)<\/h3>(?:[^<]*<p[^>]*>([^<]+)<\/p>)?/gi;
            let match;
            while ((match = regex.exec(html)) !== null && results.length < 25) {
                if (match[1].includes('/scan/')) continue;

                let itemUrl = match[1].endsWith('/') ? match[1] : match[1] + '/';
                if (!itemUrl.startsWith('http')) {
                    itemUrl = baseUrl.replace(/\/$/, '') + '/' + itemUrl.replace(/^\//, '');
                }

                let posterUrl = match[2];
                if (!posterUrl.startsWith('http')) {
                    posterUrl = baseUrl.replace(/\/$/, '') + '/' + posterUrl.replace(/^\//, '');
                }

                let title = match[3].trim();
                if (match[4] && match[4].trim()) {
                    title += " (" + match[4].trim().replace(/&#039;/g, "'").replace(/&amp;/g, "&") + ")";
                }

                results.push(new MultimediaItem({
                    title: title,
                    url: itemUrl,
                    posterUrl: posterUrl,
                    type: "anime"
                }));
            }
        } catch (err1) { }

        // Fallback to sitemap if fetch.php fails or returns empty in mobile environment
        if (results.length === 0) {
            const sitemapRes = await axios.get(baseUrl + '/sitemap.xml');
            const xml = sitemapRes.data;

            const queryClean = query.toLowerCase().replace(/[^a-z0-9]/g, '-');
            const sitemapRegex = /<loc>(https?:\/\/anime-sama\.to\/catalogue\/([^<]+)\/)<\/loc>/gi;
            let sMatch;

            while ((sMatch = sitemapRegex.exec(xml)) !== null && results.length < 25) {
                let url = sMatch[1];
                let slug = sMatch[2];

                if (slug.includes('scan')) continue; // Skip scans

                // If slug matches query
                if (slug.includes(queryClean)) {
                    let title = slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                    results.push(new MultimediaItem({
                        title: title,
                        url: url,
                        posterUrl: baseUrl + '/img/contenu/' + slug + '.jpg',
                        type: "anime"
                    }));
                }
            }
        }

        cb({ success: true, data: results });
    } catch (e) {
        log('search error', e); cb({ success: false, errorCode: 'SEARCH_ERROR', message: String(e) });
    }
}


async function load(url, cb) {
    try {
        let rootUrl = url;
        const rootMatch = url.match(/(https?:\/\/[^\/]+\/catalogue\/[^\/]+)/);
        if (rootMatch) rootUrl = rootMatch[1] + '/';

        const htmlRes = await axios.get(rootUrl);
        const html = htmlRes.data;

        let posterUrl = "";
        const imgMatch = html.match(/id="imgOeuvre"[^>]*src="([^"]+)"/i) || html.match(/property="og:image"[^>]*content="([^"]+)"/i);
        if (imgMatch) posterUrl = imgMatch[1];

        let actualTitle = "Anime-Sama";
        const titleMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/i) || html.match(/<title>([^<]+)<\/title>/i);
        if (titleMatch) {
            actualTitle = titleMatch[1].split('- Saison')[0].replace('Anime-Sama', '').replace(/\|/g, '').replace('Streaming et catalogage', '').trim();
        }

        let description = "";
        const descMatch = html.match(/<h2[^>]*>Synopsis<\/h2>\s*<p[^>]*>([\s\S]*?)<\/p>/i);
        if (descMatch) {
            description = descMatch[1].replace(/<[^>]+>/g, '').trim();
        }

        const cleanHtml = html.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*panneauAnime.*$/gm, '').replace(/<!--[\s\S]*?-->/g, '');
        const seasonRegex = /panneauAnime\s*\(\s*["']([^"']+)["']\s*,\s*["']([^"']+)["']\s*\)/gi;
        let sMatch;
        const seasonEntries = [];
        while ((sMatch = seasonRegex.exec(cleanHtml)) !== null) {
            const seasonTitle = sMatch[1].trim();
            const seasonPath = sMatch[2].trim();
            if (seasonPath.includes('vf') || seasonPath.includes('vostfr')) {
                seasonEntries.push({ title: seasonTitle, path: seasonPath });

                // Automatically inject the opposite language if it's explicitly 'vostfr' or 'vf'
                // This allows discovering VF links that are hidden in the player interface natively.
                if (seasonPath.includes('vostfr')) {
                    seasonEntries.push({ title: seasonTitle, path: seasonPath.replace('vostfr', 'vf') });
                } else if (seasonPath.includes('/vf')) {
                    seasonEntries.push({ title: seasonTitle, path: seasonPath.replace('/vf', '/vostfr') });
                }
            }
        }

        // Deduplicate to avoid fetching same URL twice if Anime-Sama explicitly listed both panels in HTML somehow
        const uniquePaths = new Set();
        const deduplicatedEntries = [];
        for (const entry of seasonEntries) {
            if (!uniquePaths.has(entry.path)) {
                uniquePaths.add(entry.path);
                deduplicatedEntries.push(entry);
            }
        }

        if (seasonEntries.length === 0) {
            return cb({ success: false, message: "Aucun épisode animé trouvé. Il s'agit peut-être d'un scan..." });
        }

        const eps = [];
        let baseSeasonNumber = 1;
        const titleToSeasonNumber = {};

        // Fetch episodes for all seasons found
        const seasonRequests = deduplicatedEntries.map(sEntry => {
            let jsUrl = rootUrl + sEntry.path;
            if (!jsUrl.endsWith('/')) jsUrl += '/';
            return { url: jsUrl + 'episodes.js' };
        });

        let responses = [];
        if (typeof http_parallel !== 'undefined' && seasonRequests.length > 1) {
            responses = await http_parallel(seasonRequests);
        } else {
            for (const req of seasonRequests) {
                const r = await axios.get(req.url);
                responses.push({ body: typeof r.data === 'string' ? r.data : JSON.stringify(r.data) });
            }
        }

        for (let sIdx = 0; sIdx < deduplicatedEntries.length; sIdx++) {
            const sEntry = deduplicatedEntries[sIdx];
            const jsData = responses[sIdx]?.body || "";

            let currentSeasonNumber = titleToSeasonNumber[sEntry.title];
            if (!currentSeasonNumber) {
                currentSeasonNumber = baseSeasonNumber++;
                titleToSeasonNumber[sEntry.title] = currentSeasonNumber;
            }

            try {
                const epsRegex = /var\s+eps\d+\s*=\s*\[([\s\S]*?)\]/gi;
                let ematch;
                const players = [];

                while ((ematch = epsRegex.exec(jsData)) !== null) {
                    const rawLinks = ematch[1].split(',').map(s => s.replace(/['"\s\n\r]+/g, '').trim());
                    const cleanLinks = rawLinks.filter(l => l.length > 5);
                    if (cleanLinks.length > 0) {
                        players.push(cleanLinks);
                    }
                }

                if (players.length > 0) {
                    const epCount = players[0].length;
                    for (let i = 0; i < epCount; i++) {
                        const episodeStreams = [];
                        for (let p = 0; p < players.length; p++) {
                            if (players[p][i]) {
                                episodeStreams.push(players[p][i]);
                            }
                        }

                        let epName = "";
                        const sTitle = sEntry.title.trim();
                        const isFilmOrOav = /film|films|oav|special|spécial/i.test(sTitle);

                        if (/^saison \d+$/i.test(sTitle)) {
                            epName = "Épisode " + (i + 1);
                        } else if (isFilmOrOav && epCount === 1) {
                            let tName = "Film";
                            if (/oav/i.test(sTitle)) tName = "OAV";
                            else if (/special|spécial/i.test(sTitle)) tName = "Spécial";
                            epName = tName;
                        } else if (isFilmOrOav) {
                            let tName = "Film";
                            if (/oav/i.test(sTitle)) tName = "OAV";
                            else if (/special|spécial/i.test(sTitle)) tName = "Spécial";
                            epName = tName + " " + (i + 1);
                        } else if (epCount === 1) {
                            epName = sTitle;
                        } else {
                            epName = sTitle + " - Ép. " + (i + 1);
                        }

                        eps.push(new Episode({
                            name: epName,
                            episode: i + 1,
                            posterUrl: posterUrl,
                            url: JSON.stringify(episodeStreams),
                            season: currentSeasonNumber,
                            dubStatus: sEntry.path.includes('/vf') || sEntry.path.endsWith('vf') ? 'dub' : 'sub'
                        }));
                    }
                }
            } catch (e) { }
        }

        if (eps.length === 0) {
            return cb({ success: false, errorCode: 'EPISODES_NOT_FOUND', message: 'Impossible de parser les liens.' });
        }

        cb({
            success: true,
            data: new MultimediaItem({
                title: actualTitle,
                url: rootUrl,
                type: "anime",
                posterUrl: posterUrl,
                description: description,
                episodes: eps
            })
        });
    } catch (e) {
        log('load error: ' + url, e); cb({ success: false, errorCode: 'LOAD_ERROR', message: String(e.message) });
    }
}


async function loadStreams(url, cb) {
    try {
        // Parse the streams packed in the load() step
        let episodeStreams = [];
        try {
            episodeStreams = JSON.parse(url);
        } catch (ign) {
            episodeStreams = [url];
        }

        // Parallelize stream extraction to prevent timeouts
        const promises = episodeStreams.map(async (streamUrl, i) => {
            try {
                let sourceName = "Lecteur " + (i + 1);
                if (streamUrl.includes('sibnet')) sourceName = "Sibnet";
                else if (streamUrl.includes('sendvid')) sourceName = "Sendvid";
                else if (streamUrl.includes('vk.com')) sourceName = "VK";
                else if (streamUrl.includes('dood')) sourceName = "DoodStream";
                else if (streamUrl.includes('vidmoly')) sourceName = "Vidmoly";
                else if (streamUrl.includes('mixdrop')) sourceName = "MixDrop";
                else if (streamUrl.includes('streamtape')) sourceName = "StreamTape";
                else if (streamUrl.includes('voe')) sourceName = "Voe";
                else if (streamUrl.includes('filemoon')) sourceName = "Filemoon";
                else if (streamUrl.includes('hubcloud') || streamUrl.includes('hd-runtv')) sourceName = "HubCloud";
                else if (streamUrl.includes('minochinos') || streamUrl.includes('vidhide')) sourceName = "Minochinos";
                else if (streamUrl.includes('embed4me') || streamUrl.includes('lpayer')) sourceName = "Embed4Me";

                const extracted = await Extractors.resolveStream(streamUrl);
                if (extracted) {
                    // Set the source name on the result
                    if (!extracted.source) extracted.source = sourceName;
                    return [extracted];
                }
            } catch (err) { }
            return [];
        });

        const allResults = await Promise.all(promises);
        const results = allResults.flat();

        if (results.length === 0) {
            return cb({ success: false, errorCode: 'NO_STREAMS', message: "Aucune source n'a pu être extraite." });
        }

        cb({ success: true, data: results });
    } catch (e) {
        log('loadStreams error: ' + url, e); cb({ success: false, errorCode: 'STREAM_ERROR', message: String(e) });
    }
}



globalThis.getHome = getHome;
globalThis.search = search;
globalThis.load = load;
globalThis.loadStreams = loadStreams;
