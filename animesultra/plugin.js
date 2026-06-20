// @ts-nocheck
import { MixDrop, StreamTape, Voe, Filemoon, DoodExtractor, HubCloud } from 'skystream-extractors/dist/index.js';
import { getPlayerUrl, encodeBase64, createFixUrl, detectDubStatus, parseSeasonInfo } from '../shared.js';

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

const fixUrl = createFixUrl(baseUrl);

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
                        res.data.match(/file\s*:\s*["']([^"']+)["']/i) ||
                        res.data.match(/property="og:video"[^>]*content="([^"]+)"/i);
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
                let vidmolyUrl = url.replace(/vidmoly\.(to|biz)/g, 'vidmoly.net');
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
                // Fallback: try original domain if vidmoly.net didn't contain sources pattern
                if ((url.includes('vidmoly.to') || url.includes('vidmoly.biz')) && !html.includes('sources')) {
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
            let proxyUrl = url.replace(/vidmoly\.(to|biz)/g, 'vidmoly.net');
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

        // --- Mail.ru ---
        if (url.includes('my.mail.ru')) {
            try {
                const videoIdMatch = url.match(/\/video\/embed\/(\d+)/i);
                if (videoIdMatch) {
                    const videoId = videoIdMatch[1];
                    const apiUrl = `https://my.mail.ru/+/video/meta/${videoId}`;
                    const apiRes = await axios.get(apiUrl, { headers: { 'Referer': 'https://my.mail.ru/' } });
                    const meta = apiRes.data;
                    if (meta && meta.videos && Array.isArray(meta.videos) && meta.videos.length > 0) {
                        const preferredOrder = ['1080p', '720p', '480p', '360p'];
                        let bestVideo = null;
                        for (const q of preferredOrder) {
                            bestVideo = meta.videos.find(v => v.key === q);
                            if (bestVideo) break;
                        }
                        if (!bestVideo) bestVideo = meta.videos[0];
                        let videoUrl = bestVideo.url;
                        if (videoUrl && videoUrl.startsWith('//')) videoUrl = 'https:' + videoUrl;
                        if (videoUrl) {
                            const quality = typeof bestVideo.key === 'string' ? bestVideo.key : 'Auto';
                            return new StreamResult({
                                url: "MAGIC_PROXY_v1" + encodeBase64(videoUrl),
                                quality: quality,
                                source: 'MailRu',
                                headers: { 'Referer': url }
                            });
                        }
                    }
                }
            } catch (e) { log('Mail.ru extraction failed', e); }
            return new StreamResult({
                url: "MAGIC_PROXY_v1" + encodeBase64(url),
                quality: 'Auto',
                source: 'MailRu',
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

        // --- Vidstream.pro (FingerprintJS anti-bot) ---
        if (url.includes('vidstream.pro')) {
            try {
                const res = await axios.get(url, { headers: { 'Referer': baseUrl } });
                if (typeof res.data === 'string') {
                    // Try to extract direct video URL from various patterns
                    const match = res.data.match(/file\s*:\s*["']([^"']+)["']/i) ||
                        res.data.match(/src\s*:\s*["']([^"']+)["']/i) ||
                        res.data.match(/<source\s+src=["']([^"']+)["']/i) ||
                        res.data.match(/<video[^>]+src=["']([^"']+)["']/i) ||
                        res.data.match(/"url":\s*"([^"]+)"/i) ||
                        res.data.match(/<iframe[^>]+src=["']([^"']+)["']/i);
                    if (match) {
                        let videoUrl = match[1];
                        videoUrl = videoUrl.replace(/&amp;/g, '&');
                        if (videoUrl.startsWith('//')) videoUrl = 'https:' + videoUrl;
                        return new StreamResult({
                            url: "MAGIC_PROXY_v1" + encodeBase64(videoUrl),
                            quality: 'Auto',
                            source: 'Vidstream',
                            headers: { 'Referer': url }
                        });
                    }
                }
            } catch (e) { }
            // Fallback: proxy the page itself (requires JS/FingerprintJS in WebView)
            return new StreamResult({
                url: "MAGIC_PROXY_v1" + encodeBase64(url),
                quality: 'Auto',
                source: 'Vidstream',
                headers: { 'Referer': baseUrl }
            });
        }

        // --- Daisukianime (JS fingerprint + XHR anti-bot) ---
        if (url.includes('daisukianime')) {
            try {
                const res = await axios.get(url, { headers: { 'Referer': baseUrl } });
                if (typeof res.data === 'string') {
                    // Try to extract direct video URL from various patterns
                    const match = res.data.match(/file\s*:\s*["']([^"']+)["']/i) ||
                        res.data.match(/src\s*:\s*["']([^"']+)["']/i) ||
                        res.data.match(/<source\s+src=["']([^"']+)["']/i) ||
                        res.data.match(/<video[^>]+src=["']([^"']+)["']/i) ||
                        res.data.match(/"url":\s*"([^"]+)"/i) ||
                        res.data.match(/<iframe[^>]+src=["']([^"']+)["']/i);
                    if (match) {
                        let videoUrl = match[1];
                        videoUrl = videoUrl.replace(/&amp;/g, '&');
                        if (videoUrl.startsWith('//')) videoUrl = 'https:' + videoUrl;
                        return new StreamResult({
                            url: "MAGIC_PROXY_v1" + encodeBase64(videoUrl),
                            quality: 'Auto',
                            source: 'Daisukianime',
                            headers: { 'Referer': url }
                        });
                    }
                }
            } catch (e) { }
            // Fallback: proxy the page itself (requires JS execution in WebView)
            return new StreamResult({
                url: "MAGIC_PROXY_v1" + encodeBase64(url),
                quality: 'Auto',
                source: 'Daisukianime',
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

        // --- StreamWish ---
        if (url.includes('streamwish') || url.includes('strwish') || url.includes('swish')) {
            try {
                const res = await axios.get(url, { headers: { 'Referer': baseUrl, 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0' } });
                let html = typeof res.data === 'string' ? res.data : '';
                if (typeof getAndUnpack !== 'undefined' && html.includes('eval(function(p,a,c,k')) {
                    try { const u = getAndUnpack(html); if (u) html += '\n' + u; } catch (e) { }
                }
                const fm = html.match(/sources\s*:\s*\[["']([^"']+)["']\]/i) ||
                    html.match(/file\s*:\s*["']([^"']+)["']/i) ||
                    html.match(/src["']?\s*:\s*["']([^"']+)["']/i) ||
                    html.match(/<source\s+src=["']([^"']+)["']/i) ||
                    html.match(/(https?:\/\/[^"'\s]+\.(?:m3u8|mp4)[^"'\s]*)/i);
                if (fm) {
                    let vUrl = fm[1];
                    if (vUrl.startsWith('//')) vUrl = 'https:' + vUrl;
                    return new StreamResult({
                        url: "MAGIC_PROXY_v1" + encodeBase64(vUrl),
                        quality: 'Auto',
                        source: 'StreamWish',
                        headers: { 'Referer': url }
                    });
                }
            } catch (e) { }
            return new StreamResult({
                url: "MAGIC_PROXY_v1" + encodeBase64(url),
                quality: 'Auto',
                source: 'StreamWish',
                headers: { 'Referer': baseUrl }
            });
        }

        // --- VidSrc (embedding API) ---
        if (url.includes('vidsrc') || url.includes('vidsrc.to') || url.includes('vidsrc.me') || url.includes('vidsrc.cc')) {
            try {
                const res = await axios.get(url, { headers: { 'Referer': baseUrl } });
                let html = typeof res.data === 'string' ? res.data : '';
                if (typeof getAndUnpack !== 'undefined' && html.includes('eval(function(p,a,c,k')) {
                    try { const u = getAndUnpack(html); if (u) html += '\n' + u; } catch (e) { }
                }
                const fm = html.match(/sources\s*:\s*\[["']([^"']+)["']\]/i) ||
                    html.match(/file\s*:\s*["']([^"']+)["']/i) ||
                    html.match(/src["']?\s*:\s*["']([^"']+)["']/i) ||
                    html.match(/<source\s+src=["']([^"']+)["']/i) ||
                    html.match(/(https?:\/\/[^"'\s]+\.(?:m3u8|mp4)[^"'\s]*)/i);
                if (fm) {
                    let vUrl = fm[1];
                    if (vUrl.startsWith('//')) vUrl = 'https:' + vUrl;
                    return new StreamResult({
                        url: "MAGIC_PROXY_v1" + encodeBase64(vUrl),
                        quality: 'Auto',
                        source: 'VidSrc',
                        headers: { 'Referer': url }
                    });
                }
                const iframe = html.match(/<iframe[^>]*src=["']([^"']+)["'][^>]*>/i);
                if (iframe && iframe[1]) {
                    const iframeUrl = iframe[1].startsWith('http') ? iframe[1] : baseUrl + (iframe[1].startsWith('/') ? '' : '/') + iframe[1];
                    return new StreamResult({
                        url: "MAGIC_PROXY_v1" + encodeBase64(iframeUrl),
                        quality: 'Auto',
                        source: 'VidSrc',
                        headers: { 'Referer': url }
                    });
                }
            } catch (e) { }
            return new StreamResult({
                url: "MAGIC_PROXY_v1" + encodeBase64(url),
                quality: 'Auto',
                source: 'VidSrc',
                headers: { 'Referer': baseUrl }
            });
        }

        // --- SuperVideo ---
        if (url.includes('supervideo') || url.includes('supervideo.cc') || url.includes('supervideo.tv')) {
            try {
                const res = await axios.get(url, { headers: { 'Referer': baseUrl } });
                let html = typeof res.data === 'string' ? res.data : '';
                if (typeof getAndUnpack !== 'undefined' && html.includes('eval(function(p,a,c,k')) {
                    try { const u = getAndUnpack(html); if (u) html += '\n' + u; } catch (e) { }
                }
                const fm = html.match(/sources\s*:\s*\[["']([^"']+)["']\]/i) ||
                    html.match(/file\s*:\s*["']([^"']+)["']/i) ||
                    html.match(/src["']?\s*:\s*["']([^"']+)["']/i) ||
                    html.match(/<source\s+src=["']([^"']+)["']/i) ||
                    html.match(/(https?:\/\/[^"'\s]+\.(?:m3u8|mp4)[^"'\s]*)/i);
                if (fm) {
                    let vUrl = fm[1];
                    if (vUrl.startsWith('//')) vUrl = 'https:' + vUrl;
                    return new StreamResult({
                        url: "MAGIC_PROXY_v1" + encodeBase64(vUrl),
                        quality: 'Auto',
                        source: 'SuperVideo',
                        headers: { 'Referer': url }
                    });
                }
            } catch (e) { }
            return new StreamResult({
                url: "MAGIC_PROXY_v1" + encodeBase64(url),
                quality: 'Auto',
                source: 'SuperVideo',
                headers: { 'Referer': baseUrl }
            });
        }

        // --- Stape (StreamWish network affiliate) ---
        if (url.includes('stape') || url.includes('stape.me') || url.includes('systpe')) {
            try {
                const res = await axios.get(url, { headers: { 'Referer': baseUrl, 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0' } });
                let html = typeof res.data === 'string' ? res.data : '';
                if (typeof getAndUnpack !== 'undefined' && html.includes('eval(function(p,a,c,k')) {
                    try { const u = getAndUnpack(html); if (u) html += '\n' + u; } catch (e) { }
                }
                const fm = html.match(/sources\s*:\s*\[["']([^"']+)["']\]/i) ||
                    html.match(/file\s*:\s*["']([^"']+)["']/i) ||
                    html.match(/src["']?\s*:\s*["']([^"']+)["']/i) ||
                    html.match(/<source\s+src=["']([^"']+)["']/i) ||
                    html.match(/(https?:\/\/[^"'\s]+\.(?:m3u8|mp4)[^"'\s]*)/i);
                if (fm) {
                    let vUrl = fm[1];
                    if (vUrl.startsWith('//')) vUrl = 'https:' + vUrl;
                    return new StreamResult({
                        url: "MAGIC_PROXY_v1" + encodeBase64(vUrl),
                        quality: 'Auto',
                        source: 'Stape',
                        headers: { 'Referer': url }
                    });
                }
            } catch (e) { }
            return new StreamResult({
                url: "MAGIC_PROXY_v1" + encodeBase64(url),
                quality: 'Auto',
                source: 'Stape',
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
        // IMPORTANT: URL and title MUST come from the same element to avoid mismatches
        // (e.g., title showing "One Piece" but URL pointing to "Great Teacher Onizuka")
        function extractFlwItem(el) {
            // Prefer getting URL from the .film-name a element (same as title source)
            const titleLinkEl = el.querySelector('.film-name a');
            // Fallback: poster link with specific class
            const posterLinkEl = el.querySelector('a.film-poster-ahref, a.film-poster');
            // Last resort: any link with href
            const anyLinkEl = el.querySelector('a[href]');
            // Title comes from .film-name a or .film-name (NOT from the poster link)
            const titleEl = el.querySelector('.film-name a, .film-name, h3 a');
            const imgEl = el.querySelector('img.film-poster-img, img');
            const epEl = el.querySelector('.tick-eps, .ep-count, .tick-item:last-child');
            const title = titleEl?.getAttribute('title') || titleEl?.textContent?.trim() || imgEl?.getAttribute('alt');
            let url = titleLinkEl?.getAttribute('href') || posterLinkEl?.getAttribute('href') || anyLinkEl?.getAttribute('href');
            // Validate URL: skip non-anime links (ads, trackers, social media, etc.)
            if (url) {
                const isAnimeUrl = /\/\d+-[\w-]+\.html/.test(url) || /\/anime-/i.test(url) || /\/catalogue\//i.test(url);
                if (!isAnimeUrl) url = undefined;
            }
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
            let url = linkEl?.getAttribute('href');
            // Validate URL: skip non-anime links
            if (url) {
                const isAnimeUrl = /\/\d+-[\w-]+\.html/.test(url) || /\/anime-/i.test(url) || /\/catalogue\//i.test(url);
                if (!isAnimeUrl) url = undefined;
            }
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

        // ── Strategy 5: GET with /anime-{format} search page ──
        if (items.length === 0) {
            try {
                const res = await axios.get(`${baseUrl}/anime-vf/?s=${encodeURIComponent(query)}`, { headers });
                if (res.data && typeof res.data === 'string' && res.data.length > 500) {
                    const parsed = await parseItems(res.data);
                    for (const p of parsed) {
                        if (!seenUrls.has(p.url)) { seenUrls.add(p.url); items.push(p); }
                    }
                }
            } catch (e) { }
        }

        // ── Strategy 6: GET with /anime-vostfr/ search page ──
        if (items.length === 0) {
            try {
                const res = await axios.get(`${baseUrl}/anime-vostfr/?s=${encodeURIComponent(query)}`, { headers });
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

// Parse season info from a SEASON title (not episode title)
// e.g. "Saison 1" → { season: 1 }, "Film" → { contentType: 'Film' }, "OAV 2" → { season: 2, contentType: 'OAV' }
// Strips VF/VOSTFR labels before parsing to avoid interference with detection
// Determine dubStatus from the page URL (VF or VOSTFR)
function getDubStatusFromPageUrl(pageUrl) {
        if (/\/anime-vf\b|[-_]vf(?!o)/i.test(pageUrl)) return 'dub';
        if (/\/anime-vostfr\b|[-_]vostfr/i.test(pageUrl)) return 'sub';
        return undefined;
    }    // Detect if the current version is VF or VOSTFR and try to find the alternative from the page HTML
function findAlternativeVersionFromPage(html, currentUrl) {
        const lowerUrl = currentUrl.toLowerCase();
        let currentVersion = null;
        let alternativeUrl = null;

        if (/\/vostfr|[-_]vostfr|\bvostfr\b/i.test(lowerUrl)) {
            currentVersion = 'VOSTFR';
        } else if (/\/vf|[-_]vf(?!o)|\bvf\b(?!o)/i.test(lowerUrl)) {
            currentVersion = 'VF';
        }
        if (!currentVersion) return { currentVersion: null, alternativeUrl: null };

        // Extract the anime name from the current URL slug to match the correct alternative
        const slugMatch = currentUrl.match(/\/\d+-([\w-]+)\.html/i);
        let animeKey = slugMatch ? slugMatch[1].toLowerCase() : '';
        // Strip known suffixes to get core anime name
        while (animeKey.match(/[-_](vf|vostfr|vost|vo|dll|au)$/i)) {
            animeKey = animeKey.replace(/[-_](vf|vostfr|vost|vo|dll|au)$/gi, '');
        }
        if (!animeKey) return { currentVersion, alternativeUrl: null };

        // Try multiple URL patterns to find the alternative version
        // Patterns: /anime-vf/1234-name, /anime_vf/1234-name, /vf/1234-name, /categorie-vf/..., etc.
        const altPath = currentVersion === 'VOSTFR' ? 'vf' : 'vostfr';
        const urlPatterns = [
            // Non-greedy [^"']+? to avoid matching the entire URL before the expected pattern
            new RegExp('href=["\']([^"\']*?/anime[-_]' + altPath + '/\\d+-[^"\']*' + animeKey + '[^"\']*)["\']', 'gi'),
            new RegExp('href=["\']([^"\']*?/' + altPath + '/\\d+-[^"\']*' + animeKey + '[^"\']*)["\']', 'gi'),
            new RegExp('href=["\']([^"\']*' + animeKey + '[-_]' + altPath + '[^"\']*\.html)["\']', 'gi'),
        ];
        for (const regex of urlPatterns) {
            if (alternativeUrl) break;
            const m = regex.exec(html);
            if (m && m[1]) {
                const href = m[1];
                alternativeUrl = href.startsWith('http') ? href : baseUrl + (href.startsWith('/') ? '' : '/') + href;
            }
        }

        return { currentVersion, alternativeUrl };
    }

// ── Sitemap fallback: find alternative anime URL from sitemap.xml ──
async function fetchSitemapFallback(pageUrl) {
    try {
        const slugMatch = pageUrl.match(/\/(?:\d+-)?([\w-]+)\.html/);
        if (!slugMatch) return null;
        const slug = slugMatch[1].toLowerCase();
        const res = await axios.get(baseUrl + '/sitemap.xml', { headers });
        if (typeof res.data === 'string' && res.data.includes('<loc>')) {
            const urlRegex = /<loc>(https?:\/\/[^<]+)<\/loc>/gi;
            let match;
            const candidates = [];
            while ((match = urlRegex.exec(res.data)) !== null) {
                const sitemapUrl = match[1];
                const sitemapLower = sitemapUrl.toLowerCase();
                if (sitemapLower.includes(slug) && /\/\d+-[\w-]+\.html/.test(sitemapUrl)) {
                    candidates.push(sitemapUrl);
                }
            }
            if (candidates.length === 0) return null;
            // Prefer same version (VF/VOSTFR)
            const isVf = /[-_]vf(?!o)/i.test(pageUrl);
            const isVostfr = /vostfr/i.test(pageUrl);
            for (const c of candidates) {
                const cLower = c.toLowerCase();
                if (isVf && /[-_]vf[^o]/.test(cLower)) return c;
                if (isVostfr && cLower.includes('vostfr')) return c;
            }
            return candidates[0];
        }
    } catch (e) { log('Sitemap fetch failed', e); }
    return null;
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
        // Status: find the .item whose .item-head contains "Statut" or "Status", then read its .name
        // Try multiple container scopes: .anisc-info, or standalone .item-title, or any .item
        let status = undefined;
        const statusSelectors = [
            '.anisc-info .item',
            '.item-title',
            '.item.item-title',
            '.sheader .item',
            '.fd-infor .info'
        ];
        for (const sel of statusSelectors) {
            const els = doc.querySelectorAll(sel);
            for (const item of els) {
                const head = item.querySelector('.item-head, .info-label, h3, h4, strong');
                if (head && /statut|status|état|state/i.test(head.textContent)) {
                    const statusVal = item.querySelector('.name')?.textContent?.trim().toLowerCase() ||
                        item.textContent.replace(head.textContent, '').trim().toLowerCase();
                    if (statusVal && statusVal.length < 30) {
                        if (/termin|complet|fini|ended|finished/i.test(statusVal)) status = 'completed';
                        else if (/cours|airing|ongoing|en cours|en_cours/i.test(statusVal)) status = 'ongoing';
                        else status = statusVal;
                        break;
                    }
                }
            }
            if (status) break;
        }

        const episodes = [];
        const seenEpUrls = new Set();
        // Parse seasons from block_area-seasons section
        const seasonLinks = [];
        // Multiple selectors to adapt to different website layouts
        const seasonSelectors = [
            '.block_area-seasons .os-item',
            '.block_area-seasons a[href*="/anime-"]',
            '.seasons a[href*="/anime-"]',
            'a.os-item',
            '.season-list a[href]',
            '#seasons a[href*="-"]',
            '.anime-seasons a[href*="-"]'
        ];
        const seenSeasonIds = new Set();
        for (const sel of seasonSelectors) {
            if (seasonLinks.length > 0) break;
            doc.querySelectorAll(sel).forEach(a => {
                const href = a.getAttribute('href');
                if (!href) return;
                const sId = href.match(/\/(\d+)-/)?.[1];
                if (!sId || seenSeasonIds.has(sId)) return;
                seenSeasonIds.add(sId);
                // Extract title with careful cleanup
                let sTitle = a.getAttribute('title') || '';
                if (!sTitle.trim()) {
                    const childTitle = a.querySelector('.title, .season-title, .name');
                    sTitle = childTitle ? childTitle.textContent.trim() : a.textContent.trim();
                }
                sTitle = sTitle.replace(/<[^>]+>/g, '').trim();
                seasonLinks.push({ id: sId, url: href.startsWith('http') ? href : baseUrl + href, title: sTitle });
            });
        }
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
        // Helper: extract episode anchor tags from HTML fragment using multiple regex patterns
        function extractEpisodeAnchors(htmlFrag) {
            const anchors = [];
            // Multiple patterns to handle different HTML structures
            const epPatterns = [
                // Class-based: class="ep-item" or class="...ep-item..."
                /<a [^>]*class=["'][^"']*\bep-item\b[^"']*["'][^>]*>/gi,
                // Class-based: class="...episode..."
                /<a [^>]*class=["'][^"']*\bepisode\b[^"']*["'][^>]*>/gi,
                // data-episode-id or data-number attribute (common in streaming sites)
                /<a [^>]*(?:data-episode-id|data-number|data-ep)[=]["'][^"']*["'][^>]*href=["'][^"']+["'][^>]*>/gi,
                // Simple anchor with href inside an episode container (generic fallback)
                /<a [^>]*href=["'][^"']*(?:episode|ep-|\/ep\/|watch)[^"']*["'][^>]*>/gi,
            ];
            for (const pattern of epPatterns) {
                if (anchors.length > 0) break;
                let m;
                while ((m = pattern.exec(htmlFrag)) !== null) {
                    anchors.push(m[0]);
                }
            }
            return anchors;
        }
        // Build a readable episode name with season + content type + dub status
        function buildEpisodeName(baseTitle, epNum, seasonNum, contentType, dubStatus) {
            let parts = [];
            // Season prefix (Saison X, Film, OAV, etc.)
            if (contentType === 'Film') {
                parts.push('Film');
            } else if (contentType === 'OAV') {
                parts.push('OAV' + (seasonNum ? ' ' + seasonNum : ''));
            } else if (contentType === 'Spécial') {
                parts.push('Spécial' + (seasonNum ? ' ' + seasonNum : ''));
            } else if (seasonNum) {
                parts.push('Saison ' + seasonNum);
            }
            // Episode title/number
            parts.push(baseTitle || ('Épisode ' + epNum));
            // Dub status suffix
            if (dubStatus === 'dub') {
                parts.push('(VF)');
            } else if (dubStatus === 'sub') {
                parts.push('(VOSTFR)');
            }
            return parts.join(' ');
        }
        // Parse episodes for each season with automatic numbering
        for (let sIdx = 0; sIdx < seasonInfos.length; sIdx++) {
            const sInfo = seasonInfos[sIdx];
            const sData = seasonResponses[sIdx];
            if (!sData) continue;
            let htmlFrag = typeof sData === 'string' ? sData : (sData.html || sData.data?.html || '');
            htmlFrag = htmlFrag.replace(/\\"/g, '"').replace(/\\'/g, "'").replace(/\\\//g, '/');
            const epAnchors = extractEpisodeAnchors(htmlFrag);
            for (const aTag of epAnchors) {
                const epUrl = aTag.match(/href=["']([^"']+)["']/)?.[1];
                const epNum = aTag.match(/data-number=["'](\d+)["']/)?.[1] || 
                    aTag.match(/data-episode-id=["'](\d+)["']/)?.[1] || "1";
                const epTitle = aTag.match(/title=["']([^"']+)["']/)?.[1] || 
                    aTag.match(/>\s*([^<]{1,100})\s*<\/a>/)?.[1];
                if (epUrl) {
                    const fullEpUrl = epUrl.startsWith('http') ? epUrl : baseUrl + epUrl;
                    if (seenEpUrls.has(fullEpUrl)) continue;
                    seenEpUrls.add(fullEpUrl);
                    // Season number and contentType come from the SEASON, not the episode title!
                    const seasonNum = sInfo.parsedInfo.season || (sIdx + 1);
                    const contentType = sInfo.parsedInfo.contentType;
                    // Determine dubStatus from the season URL, fallback to page URL
                    const seasonDubStatus = getDubStatusFromPageUrl(sInfo.url) || detectDubStatus(epUrl, epTitle);
                    const epName = buildEpisodeName(epTitle || '', parseInt(epNum), seasonNum, contentType, seasonDubStatus);
                    episodes.push(new Episode({
                        name: epName,
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
                    const altSeasonSelectors = [
                        '.block_area-seasons .os-item',
                        '.block_area-seasons a[href*="/anime-"]',
                        '.seasons a[href*="/anime-"]',
                        'a.os-item',
                        '.season-list a[href]',
                        '#seasons a[href*="-"]',
                        '.anime-seasons a[href*="-"]'
                    ];
                    const altSeenIds = new Set();
                    for (const sel of altSeasonSelectors) {
                        if (altSeasonLinks.length > 0) break;
                        altDoc.querySelectorAll(sel).forEach(a => {
                            const href = a.getAttribute('href');
                            if (!href) return;
                            const sId = href.match(/\/(\d+)-/)?.[1];
                            if (!sId || altSeenIds.has(sId)) return;
                            altSeenIds.add(sId);
                            let sTitle = a.getAttribute('title') || '';
                            if (!sTitle.trim()) {
                                const childTitle = a.querySelector('.title, .season-title, .name');
                                sTitle = childTitle ? childTitle.textContent.trim() : a.textContent.trim();
                            }
                            sTitle = sTitle.replace(/<[^>]+>/g, '').trim();
                            altSeasonLinks.push({ id: sId, url: href.startsWith('http') ? href : baseUrl + href, title: sTitle });
                        });
                    }
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
                        // Use same flexible episode anchor extraction
                        const altEpAnchors = extractEpisodeAnchors(altHtmlFrag);
                        for (const aTag of altEpAnchors) {
                            const epUrl = aTag.match(/href=["']([^"']+)["']/)?.[1];
                            const epNum = aTag.match(/data-number=["'](\d+)["']/)?.[1] || 
                                aTag.match(/data-episode-id=["'](\d+)["']/)?.[1] || "1";
                            const epTitle = aTag.match(/title=["']([^"']+)["']/)?.[1] || 
                                aTag.match(/>\s*([^<]{1,100})\s*<\/a>/)?.[1];
                            if (epUrl) {
                                const fullEpUrl = epUrl.startsWith('http') ? epUrl : baseUrl + epUrl;
                                if (seenEpUrls.has(fullEpUrl)) continue;
                                seenEpUrls.add(fullEpUrl);
                                // Use the mapped season number (matched with main) or season title
                                const altSeasonNum = altToMainSeasonMap[altSInfo.id] || altSInfo.parsedInfo.season || (altIdx + 1);
                                const altContentType = altSInfo.parsedInfo.contentType;
                                const altSeasonDubStatus = getDubStatusFromPageUrl(altSInfo.url) || detectDubStatus(epUrl, epTitle);
                                const altEpName = buildEpisodeName(epTitle || '', parseInt(epNum), altSeasonNum, altContentType, altSeasonDubStatus);
                                episodes.push(new Episode({
                                    name: altEpName,
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

        // ── Sitemap fallback: if no episodes found, try alternative URL from sitemap.xml ──
        if (episodes.length === 0) {
            try {
                const altUrl = await fetchSitemapFallback(url);
                if (altUrl && altUrl !== url) {
                    log('Sitemap fallback: trying ' + altUrl);
                    const altMovieId = altUrl.match(/\/(\d+)-/)?.[1];
                    if (altMovieId) {
                        const [altRes, altEpRes] = await Promise.all([
                            axios.get(altUrl, { headers }),
                            axios.get(`${baseUrl}/engine/ajax/full-story.php?newsId=${altMovieId}&d=${Date.now()}`, { headers })
                        ]);
                        if (altRes.status === 200 && typeof altRes.data === 'string' && altRes.data.length > 500) {
                            const altDoc = await parseHtml(altRes.data);
                            const altSeasonLinks = [];
                            for (const sel of ['.block_area-seasons .os-item', '.block_area-seasons a[href*="/anime-"]', 'a.os-item']) {
                                if (altSeasonLinks.length > 0) break;
                                altDoc.querySelectorAll(sel).forEach(a => {
                                    const href = a.getAttribute('href');
                                    if (!href) return;
                                    const sId = href.match(/\/(\d+)-/)?.[1];
                                    if (!sId) return;
                                    altSeasonLinks.push({ id: sId, url: href.startsWith('http') ? href : baseUrl + href, title: (a.getAttribute('title') || a.textContent.trim()).replace(/<[^>]+>/g, '').trim() });
                                });
                            }
                            if (altSeasonLinks.length === 0 && altMovieId) {
                                altSeasonLinks.push({ id: altMovieId, url: altUrl, title: '' });
                            }
                            const altSeasonResponses = await Promise.all(
                                altSeasonLinks.map(sInfo =>
                                    axios.get(`${baseUrl}/engine/ajax/full-story.php?newsId=${sInfo.id}&d=${Date.now()}`, { headers })
                                        .then(r => r.data).catch(() => null)
                                )
                            );
                            for (let sIdx = 0; sIdx < altSeasonLinks.length; sIdx++) {
                                const sInfo = altSeasonLinks[sIdx];
                                const sData = altSeasonResponses[sIdx];
                                if (!sData) continue;
                                let htmlFrag = typeof sData === 'string' ? sData : (sData.html || sData.data?.html || '');
                                htmlFrag = htmlFrag.replace(/\\"/g, '"').replace(/\\'/g, "'").replace(/\\\//g, '/');
                                const epAnchors = extractEpisodeAnchors(htmlFrag);
                                for (const aTag of epAnchors) {
                                    const epUrl = aTag.match(/href=["']([^"']+)["']/)?.[1];
                                    const epNum = aTag.match(/data-number=["'](\d+)["']/)?.[1] || 
                                        aTag.match(/data-episode-id=["'](\d+)["']/)?.[1] || "1";
                                    const epTitle = aTag.match(/title=["']([^"']+)["']/)?.[1] || 
                                        aTag.match(/>\s*([^<]{1,100})\s*<\/a>/)?.[1];
                                    if (epUrl) {
                                        const fullEpUrl = epUrl.startsWith('http') ? epUrl : baseUrl + epUrl;
                                        if (seenEpUrls.has(fullEpUrl)) continue;
                                        seenEpUrls.add(fullEpUrl);
                                        const seasonNum = parseSeasonInfo(sInfo.title).season || (sIdx + 1);
                                        const contentType = parseSeasonInfo(sInfo.title).contentType;
                                        const dubStatus = getDubStatusFromPageUrl(sInfo.url) || detectDubStatus(epUrl, epTitle);
                                        episodes.push(new Episode({
                                            name: buildEpisodeName(epTitle || '', parseInt(epNum), seasonNum, contentType, dubStatus),
                                            episode: parseInt(epNum),
                                            url: fullEpUrl,
                                            season: seasonNum,
                                            posterUrl: posterUrl,
                                            contentType: contentType,
                                            dubStatus: dubStatus
                                        }));
                                    }
                                }
                            }
                            if (episodes.length > 0) log(`Sitemap fallback found ${episodes.length} episodes from ${altUrl}`);
                        }
                    }
                }
            } catch (e) { log('Sitemap fallback failed', e); }
        }

        // Film fallback: no episodes → pass page URL to loadStreams for iframe extraction
        if (episodes.length === 0) {
            const fallbackDubStatus = detectDubStatus(url, title);
            episodes.push(new Episode({
                name: buildEpisodeName(title || 'Film', 1, 1, 'Film', fallbackDubStatus),
                episode: 1,
                url: url,
                season: 1,
                posterUrl: posterUrl,
                contentType: 'Film',
                dubStatus: fallbackDubStatus
            }));
        }
        // ── Extract recommendations from related/similar anime sections ──
        const recommendations = [];
        const recSeenUrls = new Set();
        // Movie ID extracted above for precise exclusion
        // Ultra-wide set of selectors to match different website layouts
        const recSelectors = [
            // Standard layout patterns
            '.block_area-recommend .flw-item',
            '.block_area_ral .flw-item',
            '.film-related .flw-item',
            '.block_area-sidebar .flw-item',
            '.block_area[class*="recommend"] .flw-item',
            '.block_area[class*="ral"] .flw-item',
            '.block_area[class*="related"] .flw-item',
            '.block_area[class*="similar"] .flw-item',
            // Generic block areas with film items
            '.block_area-section .flw-item',
            // Sidebar patterns
            '.sidebar .flw-item',
            '#sidebar .flw-item',
            '.widget .flw-item',
            // Related/recommended sections (generic)
            '[class*="recommend"] .flw-item',
            '[class*="related"] .flw-item',
            '[class*="similar"] .flw-item',
            '[class*="ral"] .flw-item',
            '[class*="suggestion"] .flw-item',
            // Page-item-detail (Dooplay theme)
            '.page-item-detail',
            // TPostMv (Toroplay theme)
            '.TPostMv',
            '.TPost.C',
            '.TPost',
            // Mov items (DLE/french-anime themes)
            '.mov.clearfix',
            '.mov',
            // Section items
            'section .flw-item',
            // Any list of linked items in the page body (broad fallback - DO NOT use this for body-level)
        ];
        // Helper to extract recommendation from a generic element
        function extractRecItem(el) {
            const linkEl = el.tagName === 'A' ? el : (el.querySelector('.film-name a, a.film-poster-ahref, a[href]') || el.querySelector('a'));
            if (!linkEl) return null;
            const imgEl = el.querySelector('img.film-poster-img') || el.querySelector('img');
            const titleEl = linkEl || el.querySelector('.film-name, .film-title, .post-title, h3, h4');
            const recTitle = titleEl?.getAttribute('title') || titleEl?.textContent?.trim() || imgEl?.getAttribute('alt');
            const rawRecUrl = linkEl.getAttribute('href');
            const recPoster = imgEl?.getAttribute('data-src') || imgEl?.getAttribute('src') || imgEl?.getAttribute('data-lazy-src');
            if (!recTitle || !rawRecUrl || rawRecUrl.includes('#') || rawRecUrl.includes('javascript:')) return null;
            const recUrl = rawRecUrl.startsWith('http') ? rawRecUrl : baseUrl + rawRecUrl;
            if (recSeenUrls.has(recUrl)) return null;
            recSeenUrls.add(recUrl);
            // Exclude current anime by its numeric ID and URL
            if (movieId) {
                const recId = rawRecUrl.match(/\/(\d+)-/)?.[1];
                if (recId === movieId) return null;
            }
            if (rawRecUrl === url || recUrl === url) return null;
            return new MultimediaItem({
                title: recTitle,
                url: recUrl,
                posterUrl: fixUrl(recPoster),
                type: 'anime'
            });
        }
        for (const sel of recSelectors) {
            if (recommendations.length >= 20) break;
            doc.querySelectorAll(sel).forEach(el => {
                if (recommendations.length >= 20) return;
                const item = extractRecItem(el);
                if (item) recommendations.push(item);
            });
            if (recommendations.length > 0) break;
        }
        // ── Fallback 1: Try to find recommendations from sidebar blocks that contain anime links ──
        if (recommendations.length === 0) {
            // Look for heading text like "Recommandations", "Similaires", "Vous aimerez aussi"
            const headingKeywords = /recommand|recommend|similaire|related|suggestion|vous aimerez|autre|also like|popular|tendance|top/i;
            doc.querySelectorAll('h2, h3, h4, .heading, .block_area-header h2, .cat-heading').forEach(heading => {
                if (recommendations.length >= 10) return;
                const headingText = heading.textContent.trim();
                if (!headingKeywords.test(headingText)) return;
                // Walk up to find a container, then find items
                let container = heading.closest('.block_area, section, div') || heading.parentElement;
                if (!container) return;
                container.querySelectorAll('.flw-item, .page-item-detail, .TPostMv, .TPost.C, .TPost, .mov, .item').forEach(el => {
                    if (recommendations.length >= 10) return;
                    const item = extractRecItem(el);
                    if (item) recommendations.push(item);
                });
            });
        }
        // ── Fallback 2: Genre-based recommendations using the search engine ──
        if (recommendations.length === 0 && genreEls && genreEls.length > 0 && title) {
            // Use the first genre to find similar anime
            const query = genreEls[0];
            try {
                const searchRes = await new Promise(resolve => search(query, resolve));
                if (searchRes.success && searchRes.data) {
                    for (const item of searchRes.data) {
                        if (recommendations.length >= 10) break;
                        if (recSeenUrls.has(item.url)) continue;
                        recSeenUrls.add(item.url);
                        // Exclude current anime
                        if (item.title === title) continue;
                        if (movieId && item.url.match(/\/(\d+)-/)?.[1] === movieId) continue;
                        recommendations.push(item);
                    }
                }
            } catch (e) { /* Genre search failed, skip */ }
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

        // ── Strategy 1: data-server-id from episode page HTML + content_player_X from AJAX ──
        let fullStoryHtml = cleanAjaxHtml(epRes.data);
        // Extract server items from the EPISODE PAGE HTML (not AJAX)
        // These are specific to the current episode, not all episodes
        const serverRegexes = [
            // class="server-item" data-server-id="N" data-embed="URL"
            /<div[^>]*class="[^"]*server-item[^"]*"[^>]*data-server-id="([^"]*)"[^>]*data-embed="([^"]*)"[^>]*>/gi,
            // data-embed BEFORE data-server-id
            /<div[^>]*data-embed="([^"]*)"[^>]*data-server-id="([^"]*)"[^>]*class="[^"]*server-item[^"]*"[^>]*>/gi,
            // Minimal: any div with data-server-id
            /<div[^>]*data-server-id="([^"]*)"[^>]*>/gi
        ];
        // First pass: collect all server IDs from the page HTML
        const serverItems = [];
        const seenServerNums = new Set();
        for (const serverRegex of serverRegexes) {
            if (serverItems.length > 0) break;
            let match;
            while ((match = serverRegex.exec(html)) !== null) {
                let serverId, embedUrl;
                if (match[1] && match[2]) {
                    if (/^\d+[a-z]*$/i.test(match[1]) && !/^\d+$/.test(match[2])) {
                        serverId = match[1]; embedUrl = match[2];
                    } else {
                        serverId = match[2]; embedUrl = match[1];
                    }
                } else if (match[1]) {
                    serverId = match[1];
                    embedUrl = '';
                } else continue;
                // Extract numeric prefix for dedup
                const numericPrefix = serverId.match(/^(\d+)/)?.[1];
                if (!numericPrefix || seenServerNums.has(numericPrefix)) continue;
                seenServerNums.add(numericPrefix);
                serverItems.push({ serverId, embedUrl, numericPrefix });
            }
        }
        // Second pass: resolve each server's player URL from AJAX content_player_X divs
        for (const item of serverItems) {
            if (streams.length >= 15) break;
            let playerUrl = item.embedUrl;
            // Try to find content_player_{serverId} in AJAX response
            // The AJAX may have content_player_1vidc for server-id="1v1"
            if (fullStoryHtml) {
                const escapedId = item.serverId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const cpRegex = new RegExp(`id=["']content_player_${escapedId}[a-z]*["'][^>]*>([^<]*)<`, 'i');
                const cpMatch = fullStoryHtml.match(cpRegex);
                if (cpMatch && cpMatch[1].trim()) {
                    const cpValue = cpMatch[1].trim();
                    if (cpValue.includes('://')) {
                        playerUrl = cpValue;
                    } else {
                        const result = getPlayerUrl(cpValue, item.numericPrefix);
                        if (result) playerUrl = result;
                    }
                }
            }
            if (playerUrl && playerUrl.length > 5) {
                await tryAddStream(playerUrl, 'Serveur ' + item.numericPrefix);
            }
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

        // ── MAGIC_PROXY_v1 fallback: no streams found → let SkyStream execute JS ──
        if (streams.length === 0) {
            const proxyUrl = "MAGIC_PROXY_v1" + encodeBase64(url);
            streams.push(new StreamResult({
                url: proxyUrl,
                quality: 'Auto',
                source: 'AnimeUltra',
                headers: { 'Referer': baseUrl }
            }));
            log('MAGIC_PROXY_v1 fallback for: ' + url);
        }

        cb({ success: true, data: streams });
    } catch (e) { log('loadStreams error: ' + url, e); cb({ success: false, errorCode: 'STREAM_ERROR', message: String(e) }); }
}


globalThis.getHome = getHome;
globalThis.search = search;
globalThis.load = load;
globalThis.loadStreams = loadStreams;
