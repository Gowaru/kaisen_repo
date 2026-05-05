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
            } else if (url.includes('hubcloud') || url.includes('hd-runtv')) {
                const ex = new HubCloud();
                extracted = await ex.getUrl(url);
            }

            if (extracted && extracted.length > 0) {
                return extracted[0];
            }
        } catch (e) { }

        // Manual Extraction for Sibnet
        if (url.includes('sibnet.ru')) {
            try {
                const res = await axios.get(url, {
                    headers: { 'Referer': 'https://anime-sama.to/' }
                });
                const match = res.data.match(/player\.src\(\[\{src:\s*["']([^"']+)["']/i) ||
                    res.data.match(/src:\s*["'](\/v\/.*?\.mp4)["']/i) ||
                    res.data.match(/["']?src["']?\s*:\s*["']([^"']+\.mp4)["']/i);
                if (match) {
                    let videoUrl = match[1];
                    if (videoUrl.startsWith('//')) videoUrl = 'https:' + videoUrl;
                    else if (videoUrl.startsWith('/')) videoUrl = 'https://video.sibnet.ru' + videoUrl;
                    return new StreamResult({
                        url: videoUrl,
                        quality: 'Auto',
                        source: 'Sibnet',
                        headers: { 'Referer': url, 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
                    });
                }
            } catch (e) { }
        }

        // Manual Extraction for Sendvid
        if (url.includes('sendvid.com')) {
            try {
                const res = await axios.get(url, {
                    headers: { 'Referer': 'https://anime-sama.to/' }
                });
                const html = res.data;
                const match = html.match(/<source\s+src=["']([^"']+)["']/i) ||
                    html.match(/video_source\s*=\s*["']([^"']+)["']/i) ||
                    html.match(/file\s*:\s*["']([^"']+)["']/i) ||
                    html.match(/["']?file["']?\s*,\s*["']([^"']+)["']/i);
                if (match) {
                    let videoUrl = match[1];
                    if (videoUrl.startsWith('//')) videoUrl = 'https:' + videoUrl;
                    return new StreamResult({
                        url: videoUrl,
                        quality: 'Auto',
                        source: 'Sendvid',
                        headers: { 'Referer': url, 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
                    });
                }
            } catch (e) { }
        }

        // Manual Extraction for Vidmoly
        if (url.includes('vidmoly')) {
            try {
                let res = await axios.get(url, { headers: { 'Referer': 'https://anime-sama.to/' } });
                let html = res.data;

                // Handle JS redirect (JWT protection)
                const redirMatch = html.match(/window\.location\.replace\(['"]([^'"]+)['"]\)/i);
                if (redirMatch) {
                    let redirUrl = redirMatch[1];
                    if (redirUrl.startsWith('?')) {
                        redirUrl = url.split('?')[0] + redirUrl;
                    } else if (redirUrl.startsWith('/')) {
                        try {
                            const urlObj = new URL(url);
                            redirUrl = urlObj.origin + redirUrl;
                        } catch (e) {
                            if (url.includes('vidmoly.to')) redirUrl = 'https://vidmoly.to' + redirUrl;
                            else redirUrl = 'https://vidmoly.net' + redirUrl;
                        }
                    }
                    res = await axios.get(redirUrl, { headers: { 'Referer': url } });
                    html = res.data;
                }

                const fileMatch = html.match(/file["']?\s*:\s*["']([^"']+)["']/i) ||
                    html.match(/["']?sources["']?\s*:\s*\[\{["']?file["']?\s*:\s*["']([^"']+)["']/i);
                if (fileMatch) {
                    return new StreamResult({
                        url: fileMatch[1],
                        quality: 'Auto',
                        source: 'Vidmoly',
                        headers: { 'Referer': url, 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
                    });
                }
            } catch (e) { }

            return new StreamResult({
                url: "MAGIC_PROXY_v1" + encodeBase64(url),
                quality: 'Auto',
                source: 'Vidmoly (Proxy)',
                headers: { 'Referer': 'https://vidmoly.to/', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
            });
        }

        // Manual Extraction for Minochinos / Vidhide clones
        if (url.includes('minochinos') || url.includes('vidhide') || url.includes('vidhidepre')) {
            try {
                let res = await axios.get(url, { headers: { 'Referer': 'https://anime-sama.to/' } });
                let html = res.data;
                const fileMatch = html.match(/file["']?\s*:\s*["']([^"']+)["']/i) ||
                    html.match(/["']?sources["']?\s*:\s*\[\{["']?file["']?\s*:\s*["']([^"']+)["']/i);
                if (fileMatch) {
                    return new StreamResult({
                        url: fileMatch[1],
                        quality: 'Auto',
                        source: 'Minochinos',
                        headers: { 'Referer': url, 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36' }
                    });
                }
            } catch (e) { }
            return new StreamResult({
                url: "MAGIC_PROXY_v1" + encodeBase64(url),
                quality: 'Auto',
                source: 'Minochinos (Proxy)',
                headers: { 'Referer': url, 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36' }
            });
        }

        // Manual Extraction for Embed4Me / Lpayer
        if (url.includes('embed4me') || url.includes('lpayer')) {
            return new StreamResult({
                url: "MAGIC_PROXY_v1" + encodeBase64(url),
                quality: 'Auto',
                source: 'Embed4Me (Proxy)',
                headers: { 'Referer': 'https://anime-sama.to/', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36' }
            });
        }

        if (url.endsWith('.mp4') || url.endsWith('.m3u8')) {
            let host = 'Unknown'; try { host = new URL(url).hostname; } catch (e) { }
            return new StreamResult({ url: url, quality: 'Auto', source: host });
        }

        // Magic proxy for anything else (Unknown iframes)
        let host = 'Unknown'; try { host = new URL(url).hostname; } catch (e) { }
        return new StreamResult({
            url: "MAGIC_PROXY_v1" + encodeBase64(url),
            quality: 'Auto',
            source: host + " (Proxy)",
            headers: { 'Referer': 'https://anime-sama.to/' }
        });
    }

};

async function getHome(cb) {
    try {
        const response = await axios.get(baseUrl);
        const html = response.data;
        if (!html || typeof html !== 'string') return cb({ success: false, message: "Impossible de récupérer la page d'accueil." });

        // Extract days blocks
        const dayBlocks = html.split(/<h2 class="titreJours[^>]*>/gi);
        // The first element is before any day, let's process it for "Dernières Sorties"

        const data = {};

        // We iterate through all day blocks, starting from 1
        for (let i = 1; i < dayBlocks.length; i++) {
            const block = dayBlocks[i];

            // Extract the day title
            const dayTitleMatch = block.match(/<\/svg>[\s\S]*?<\/a>\s*([^\s<][^<]+)\s*<a/i);
            if (!dayTitleMatch) continue;
            const dayTitle = dayTitleMatch[1].trim();

            const items = [];
            // Regex to catch cards with VOSTFR or VF indicators inside the block
            const regex = /<div class="[^"]*(Anime|Scan)[^"]*(VF|VOSTFR)?[^"]*"[\s\S]*?<a[^>]+href="([^"]*\/catalogue\/[^"]+)"[^>]*>[\s\S]*?<img[^>]+src="([^"]+)"[\s\S]*?alt="([^"]+)"/gi;

            let match;
            const seenURLs = new Set();
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

                if (!url.startsWith('http')) {
                    if (url.startsWith('/')) url = baseUrl + url;
                    else url = baseUrl + '/' + url;
                }

                let baseItemUrl = url;
                // Keep only root catalogue url to fetch description correctly in load()
                const rootMatch = url.match(/(https?:\/\/[^\/]+\/catalogue\/[^\/]+)/);
                if (rootMatch) baseItemUrl = rootMatch[1] + '/';

                const uniqueKey = baseItemUrl + "_" + lang;

                if (!seenURLs.has(uniqueKey)) {
                    seenURLs.add(uniqueKey);

                    if (!posterUrl.startsWith('http')) {
                        posterUrl = baseUrl + posterUrl;
                    }

                    items.push(new MultimediaItem({
                        title: title,
                        url: baseItemUrl,
                        posterUrl: posterUrl,
                        type: "anime"
                    }));
                }
            }

            if (items.length > 0) {
                // Determine day, if "Mardi", make sure it comes nicely. We put it in the map.
                data[dayTitle] = items;
            }
        }

        // If no days were processed (format change), fallback to the original latest logic for "Dernières Sorties"
        if (Object.keys(data).length === 0) {
            const items = [];
            const regex = /<a[^>]+href="([^"]*\/catalogue\/[^"]+)"[^>]*>[\s\S]*?<img[^>]+src="([^"]+)"[\s\S]*?alt="([^"]+)"/gi;
            let match;
            let count = 0;
            const seenURLs = new Set();

            while ((match = regex.exec(html)) !== null && count < 15) {
                let url = match[1];
                if (url.includes('/scan/')) continue; // Skip scans

                if (!url.startsWith('http')) {
                    if (url.startsWith('/')) url = baseUrl + url;
                    else url = baseUrl + '/' + url;
                }

                let baseItemUrl = url;
                const rootMatch = url.match(/(https?:\/\/[^\/]+\/catalogue\/[^\/]+)/);
                if (rootMatch) baseItemUrl = rootMatch[1] + '/';

                if (!seenURLs.has(baseItemUrl)) {
                    seenURLs.add(baseItemUrl);
                    items.push(new MultimediaItem({
                        title: match[3].trim(),
                        url: baseItemUrl,
                        posterUrl: match[2].startsWith('http') ? match[2] : baseUrl + match[2],
                        type: "anime"
                    }));
                    count++;
                }
            }
            data["Dernières Sorties"] = items;
        }

        cb({
            success: true,
            data: data
        });
    } catch (e) {
        cb({ success: false, errorCode: "PARSE_ERROR", message: String(e) });
    }
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
        cb({ success: false, errorCode: "SEARCH_ERROR", message: String(e) });
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
            return cb({ success: false, message: "Auncun épisode animé trouvé. Il s'agit peut-être d'un scan..." });
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
            return cb({ success: false, errorCode: "EPISODES_NOT_FOUND", message: "Impossible de parser les liens." });
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
        cb({ success: false, errorCode: "LOAD_ERROR", message: String(e.message) });
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
                else if (streamUrl.includes('minochinos')) sourceName = "Minochinos";
                else if (streamUrl.includes('embed4me')) sourceName = "Inne (Embed4me)";

                const extracted = await Extractors.resolveStream(streamUrl);
                if (extracted) {
                    extracted.source = sourceName;
                    const resBatch = [extracted];

                    // Only add a proxy version if the extracted URL is NOT already a proxy
                    if (!extracted.url.startsWith("MAGIC_PROXY_v1")) {
                        const proxyStream = new StreamResult({
                            url: "MAGIC_PROXY_v1" + encodeBase64(extracted.url),
                            source: sourceName + " (Proxy)",
                            quality: extracted.quality || 'Auto'
                        });
                        if (extracted.headers) proxyStream.headers = extracted.headers;
                        else proxyStream.headers = { 'Referer': streamUrl, 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36' };
                        resBatch.push(proxyStream);
                    }
                    return resBatch;
                }
            } catch (err) {
                console.log("Error extracting stream: " + err);
            }
            return [];
        });

        const allResults = await Promise.all(promises);
        const results = allResults.flat();

        if (results.length === 0) {
            return cb({ success: false, errorCode: "NO_STREAMS", message: "Aucune source n'a pu être extraite." });
        }

        cb({ success: true, data: results });
    } catch (e) {
        cb({ success: false, errorCode: "STREAM_ERROR", message: String(e) });
    }
}



globalThis.getHome = getHome;
globalThis.search = search;
globalThis.load = load;
globalThis.loadStreams = loadStreams;
