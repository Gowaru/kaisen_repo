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
            } catch (e) { }
        }

        // --- Vidmoly (domain changed to vidmoly.net, sources pattern extraction) ---
        if (url.includes('vidmoly')) {
            try {
                // vidmoly.to → vidmoly.net domain migration
                let vidmolyUrl = url.replace(/vidmoly\.(to|biz)/g, 'vidmoly.net');
                const vidmolyHeaders = {
                    'Referer': 'https://anime-sama.to/',
                    'Sec-Fetch-Dest': 'iframe',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0'
                };
                let res = await axios.get(vidmolyUrl, { headers: vidmolyHeaders });
                let html = typeof res.data === 'string' ? res.data : '';

                // Try getAndUnpack for packed JS
                if (typeof getAndUnpack !== 'undefined' && html.includes('eval(function(p,a,c,k')) {
                    try {
                        const unpacked = getAndUnpack(html);
                        if (unpacked) html = html + '\n' + unpacked;
                    } catch (e) { }
                }

                // Primary: sources [{file: '...'}] pattern (vStream-style)
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
            // Vidmoly: extraction failed, fallback to proxy with vidmoly.net domain
            let proxyUrl = url.replace(/vidmoly\.(to|biz)/g, 'vidmoly.net');
            return new StreamResult({
                url: "MAGIC_PROXY_v1" + encodeBase64(proxyUrl),
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
            return new StreamResult({
                url: "MAGIC_PROXY_v1" + encodeBase64(url),
                quality: 'Auto',
                source: 'Daisukianime',
                headers: { 'Referer': baseUrl }
            });
        }

        // --- Embed4Me / Lpayer ---
        // SPA with AES-encrypted API + dynamic JS loading; direct extraction not feasible.
        // Falls back to MAGIC_PROXY for client-side rendering in the app's webview.
        if (url.includes('embed4me') || url.includes('lpayer')) {
            return new StreamResult({
                url: "MAGIC_PROXY_v1" + encodeBase64(url),
                quality: 'Auto',
                source: 'Embed4Me',
                headers: { 'Referer': 'https://anime-sama.to/' }
            });
        }

        // --- YourUpload / VidGuard ---
        if (url.includes('yourupload') || url.includes('vidguard') || url.includes('vgfplay')) {
            try {
                const res = await axios.get(url, { headers: { 'Referer': 'https://anime-sama.to/' } });
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
                headers: { 'Referer': 'https://anime-sama.to/' }
            });
        }

        // --- Streamruby / StreamSB ---
        if (url.includes('streamruby') || url.includes('streamsb') || url.includes('sbplay')) {
            try {
                const res = await axios.get(url, { headers: { 'Referer': 'https://anime-sama.to/', 'Accept': 'application/json,text/html,*/*' } });
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
                headers: { 'Referer': 'https://anime-sama.to/' }
            });
        }

        // --- Mp4Upload ---
        if (url.includes('mp4upload') || url.includes('mp4u')) {
            try {
                const res = await axios.get(url, { headers: { 'Referer': 'https://anime-sama.to/' } });
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
                headers: { 'Referer': 'https://anime-sama.to/' }
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
                headers: { 'Referer': 'https://anime-sama.to/' }
            });
        }

        // --- Speedostream / SpeedoCDN ---
        if (url.includes('speedostream') || url.includes('speedocdn')) {
            try {
                const res = await axios.get(url, { headers: { 'Referer': 'https://anime-sama.to/' } });
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
                headers: { 'Referer': 'https://anime-sama.to/' }
            });
        }

        // --- Vembed.net ---
        if (url.includes('vembed') || url.includes('vembed.net')) {
            try {
                const res = await axios.get(url, { headers: { 'Referer': 'https://anime-sama.to/' } });
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
                headers: { 'Referer': 'https://anime-sama.to/' }
            });
        }

        // --- StreamWish ---
        if (url.includes('streamwish') || url.includes('strwish') || url.includes('swish')) {
            try {
                const res = await axios.get(url, { headers: { 'Referer': 'https://anime-sama.to/', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0' } });
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
                headers: { 'Referer': 'https://anime-sama.to/' }
            });
        }

        // --- VidSrc (embedding API) ---
        if (url.includes('vidsrc') || url.includes('vidsrc.to') || url.includes('vidsrc.me') || url.includes('vidsrc.cc')) {
            try {
                const res = await axios.get(url, { headers: { 'Referer': 'https://anime-sama.to/' } });
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
                headers: { 'Referer': 'https://anime-sama.to/' }
            });
        }

        // --- SuperVideo ---
        if (url.includes('supervideo') || url.includes('supervideo.cc') || url.includes('supervideo.tv')) {
            try {
                const res = await axios.get(url, { headers: { 'Referer': 'https://anime-sama.to/' } });
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
                headers: { 'Referer': 'https://anime-sama.to/' }
            });
        }

        // --- Stape (StreamWish network affiliate) ---
        if (url.includes('stape') || url.includes('stape.me') || url.includes('systpe')) {
            try {
                const res = await axios.get(url, { headers: { 'Referer': 'https://anime-sama.to/', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0' } });
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
        const slideParts = html.split(/<div[^>]*class="[^"]*\bak-slide(?!\w|-)[^"]*"[^>]*>/gi);
        for (let si = 1; si < slideParts.length; si++) {
            const block = slideParts[si];
            // Must contain ak-slide-title (skip cloned/empty slides)
            const titleM = block.match(/<h2[^>]*class="ak-slide-title"[^>]*>([^<]+)<\/h2>/i);
            if (!titleM) continue;
            const title = titleM[1].trim();
            // Poster: try ak-slide-bg img (data-src for lazy-loaded, then src), then construct from title slug
            const bgM = block.match(/ak-slide-bg[\s\S]*?<img[^>]+(?:data-src|src)="([^"]+)"/i);
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
            // Extract day title: try inside <h2> span, then between </a> and next <a>, then after </h2>
            const dayTitleMatch = block.match(/<[^>]+class="titreJours[^"]*"[^>]*>([^<]+)</i) ||
                block.match(/<\/svg>[\s\S]*?<\/a>\s*([^\s<][^<]+)\s*<a/i) ||
                block.match(/<\/h2>\s*([^\n]+?)\s*<br/i);
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

            const baseItemUrl = toRootUrl(url);
            if (!seenURLs.has(baseItemUrl)) {
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

            const baseItemUrl = toRootUrl(url);
            if (!seenURLs.has(baseItemUrl)) {
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

            const baseItemUrl = toRootUrl(url);
            if (!seenURLs.has(baseItemUrl)) {
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
            const regex = /<a href="([^"]+)" class="asn-search-result"><img[^>]+(?:data-src|src)="([^"]+)"[^>]*><div[^>]*><h3[^>]*>([^<]+)<\/h3>(?:[^<]*<p[^>]*>([^<]+)<\/p>)?/gi;
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
        const imgMatch = html.match(/id="imgOeuvre"[^>]+(?:data-src|src)="([^"]+)"/i) || html.match(/property="og:image"[^>]*content="([^"]+)"/i);
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

        // Extract genres (modern div/span structure)
        const genres = [];
        const genreRegex = /<span class="genre-pill">([^<]+)<\/span>/gi;
        let gMatch;
        while ((gMatch = genreRegex.exec(html)) !== null) {
            const g = gMatch[1].trim();
            if (g) genres.push(g);
        }

        // Extract status (En cours / Terminé) from modern div/span structure
        let status = undefined;
        const statusMatch = html.match(/info-lbl[\s\S]*?État[\s\S]*?<span class="info-val">([^<]+)<\/span>/i);
        if (statusMatch) {
            const raw = statusMatch[1].trim().toLowerCase();
            if (/en\s*cours/i.test(raw)) status = 'ongoing';
            else if (/termin|fini|complet/i.test(raw)) status = 'completed';
            else status = raw;
        }

        // ── Parse season info from titles like animesultra ──
        // e.g. "Saison 1" → { season: 1 }, "Film" → { contentType: 'Film' }, "OAV" → { contentType: 'OAV' }
        function parseSeasonInfo(title) {
            let season = undefined;
            let contentType = undefined;
            if (!title) return { season, contentType };
            const t = title.trim();
            // Detect content type
            if (/\b(?:oav|ova|ona)\b/i.test(t)) contentType = 'OAV';
            else if (/\bfilm\b/i.test(t)) contentType = 'Film';
            else if (/\b(?:special|spécial)\b/i.test(t)) contentType = 'Spécial';
            // Extract season number
            const sMatch = t.match(/(?:saison|season|part|cour|s|film|oav|ova|ona|special|sp[ée]cial)\s*(\d+)/i);
            if (sMatch) season = parseInt(sMatch[1]);
            if (season === undefined) {
                const numMatch = t.match(/\d+/);
                if (numMatch && !contentType) season = parseInt(numMatch[0]);
            }
            return { season, contentType };
        }

        // ── Parse season entries grouped by TITLE (unlike old code that treated VF/VOSTFR as separate) ──
        // Each unique season title gets ONE season with both VF and VOSTFR variants
        const cleanedHtml = html.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*panneauAnime.*$/gm, '').replace(/<!--[\s\S]*?-->/g, '');
        const seasonRegex = /panneauAnime\s*\(\s*["']([^"']+)["']\s*,\s*["']([^"']+)["']\s*\)/gi;
        // Group by title: { title: { vfPath, vostfrPath, parsedInfo } }
        const seasonGroup = {};
        let sMatch;
        while ((sMatch = seasonRegex.exec(cleanedHtml)) !== null) {
            const seasonTitle = sMatch[1].trim();
            const seasonPath = sMatch[2].trim();
            // Only process entries with VF or VOSTFR in the path
            const isVf = seasonPath.includes('/vf') || seasonPath.endsWith('vf');
            const isVostfr = seasonPath.includes('vostfr');
            if (!isVf && !isVostfr) continue;
            
            if (!seasonGroup[seasonTitle]) {
                seasonGroup[seasonTitle] = {
                    title: seasonTitle,
                    parsedInfo: parseSeasonInfo(seasonTitle),
                    vfPath: null,
                    vostfrPath: null
                };
            }
            if (isVf) seasonGroup[seasonTitle].vfPath = seasonPath;
            if (isVostfr) seasonGroup[seasonTitle].vostfrPath = seasonPath;
        }

        // Inject opposite language if only one was found (e.g., site lists only VOSTFR but VF exists at same path)
        for (const sInfo of Object.values(seasonGroup)) {
            if (sInfo.vostfrPath && !sInfo.vfPath) {
                sInfo.vfPath = sInfo.vostfrPath.replace('vostfr', 'vf');
            }
            if (sInfo.vfPath && !sInfo.vostfrPath) {
                sInfo.vostfrPath = sInfo.vfPath.includes('/vf')
                    ? sInfo.vfPath.replace('/vf', '/vostfr')
                    : sInfo.vfPath.replace('vf', 'vostfr');
            }
        }

        const seasonList = Object.values(seasonGroup);
        if (seasonList.length === 0) {
            return cb({ success: false, message: "Aucun épisode animé trouvé. Il s'agit peut-être d'un scan..." });
        }

        // ── Build fetch requests for all VF and VOSTFR paths ──
        // Each path variant (VF, VOSTFR) may have its own episodes.js
        const fetchRequests = [];
        const fetchIndex = []; // maps each request to { seasonIdx, dubStatus }
        for (let sIdx = 0; sIdx < seasonList.length; sIdx++) {
            const sInfo = seasonList[sIdx];
            // Always try VOSTFR first, then VF
            if (sInfo.vostfrPath) {
                let jsUrl = rootUrl + sInfo.vostfrPath;
                if (!jsUrl.endsWith('/')) jsUrl += '/';
                fetchRequests.push({ url: jsUrl + 'episodes.js' });
                fetchIndex.push({ seasonIdx: sIdx, dubStatus: 'sub' });
            }
            if (sInfo.vfPath) {
                let jsUrl = rootUrl + sInfo.vfPath;
                if (!jsUrl.endsWith('/')) jsUrl += '/';
                fetchRequests.push({ url: jsUrl + 'episodes.js' });
                fetchIndex.push({ seasonIdx: sIdx, dubStatus: 'dub' });
            }
        }

        // Fetch all episode JS files in parallel
        let fetchResponses = [];
        if (typeof http_parallel !== 'undefined' && fetchRequests.length > 1) {
            try {
                fetchResponses = await http_parallel(fetchRequests);
            } catch (e) {
                fetchResponses = [];
            }
        }
        // Fallback: sequential fetches if parallel failed or wasn't available
        if (fetchResponses.length < fetchRequests.length) {
            for (const req of fetchRequests) {
                try {
                    const r = await axios.get(req.url);
                    fetchResponses.push({ body: typeof r.data === 'string' ? r.data : JSON.stringify(r.data) });
                } catch (e) {
                    fetchResponses.push({ body: '' });
                }
            }
        }

        // ── Parse episodes for each VF/VOSTFR variant ──
        const eps = [];
        const seenEpSets = new Set(); // dedup by first episode URL per season variant

        for (let fi = 0; fi < fetchIndex.length; fi++) {
            const { seasonIdx, dubStatus } = fetchIndex[fi];
            const sInfo = seasonList[seasonIdx];
            const jsData = fetchResponses[fi]?.body || '';
            if (!jsData) continue;

            // Determine season number and content type from parsed season info
            const seasonNum = sInfo.parsedInfo.season || (seasonIdx + 1);
            const contentType = sInfo.parsedInfo.contentType;

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

                        // Dedup: if we've already added this episode for another language variant, skip
                        const dedupKey = seasonNum + '-' + (i + 1) + '-' + dubStatus;
                        if (seenEpSets.has(dedupKey)) continue;
                        seenEpSets.add(dedupKey);

                        // Build episode name based on season content type
                        let epName = "";
                        const sTitle = sInfo.title.trim();
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
                            season: seasonNum,
                            contentType: contentType,
                            dubStatus: dubStatus
                        }));
                    }
                }
            } catch (e) { }
        }

        if (eps.length === 0) {
            return cb({ success: false, errorCode: 'EPISODES_NOT_FOUND', message: 'Impossible de parser les liens.' });
        }

        // ── Extract related/recommended anime from page ──
        const recommendations = [];
        const recSeen = new Set();
        // Try to find a section with similaire/related items
        const recSection = html.match(/<section[^>]*>(?:[\s\S]*?Similaire[\s\S]*?)<\/section>/i) ||
            html.match(/<div[^>]*class="[^"]*similar[^"]*"[^>]*>[\s\S]*?<\/div>/i) ||
            html.match(/<div[^>]*class="[^"]*related[^"]*"[^>]*>[\s\S]*?<\/div>/i);
        let recHtml = recSection ? recSection[0] : html;
        const recRegex = /<a[^>]+href="([^"]*\/catalogue\/(?!scan)[^"]+)"[^>]*>[\s\S]*?<img[^>]+(?:data-src|src)="([^"]+)"[^>]*(?:alt="([^"]+)")?/gi;
        let recMatch;
        while ((recMatch = recRegex.exec(recHtml)) !== null && recommendations.length < 12) {
            let recUrl = recMatch[1];
            if (!recUrl.startsWith('http')) {
                recUrl = baseUrl.replace(/\/$/, '') + '/' + recUrl.replace(/^\//, '');
            }
            const recRoot = recUrl.match(/(https?:\/\/[^\/]+\/catalogue\/[^\/]+)/);
            const normalizedRecUrl = recRoot ? recRoot[1] + '/' : recUrl;
            if (!recSeen.has(normalizedRecUrl) && normalizedRecUrl !== rootUrl) {
                recSeen.add(normalizedRecUrl);
                let recPoster = recMatch[2];
                if (!recPoster.startsWith('http')) recPoster = baseUrl + recPoster;
                let recTitle = recMatch[3] ? recMatch[3].trim() : '';
                if (!recTitle) {
                    const slugMatch = normalizedRecUrl.match(/\/catalogue\/([^\/]+)/);
                    if (slugMatch) recTitle = slugMatch[1].replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                }
                recommendations.push(new MultimediaItem({
                    title: recTitle + ' (Anime-Sama)',
                    url: normalizedRecUrl,
                    posterUrl: recPoster,
                    type: "anime"
                }));
            }
        }

        cb({
            success: true,
            data: new MultimediaItem({
                title: actualTitle,
                url: rootUrl,
                type: "anime",
                posterUrl: posterUrl,
                description: description,
                status: status,
                genres: genres,
                episodes: eps,
                recommendations: recommendations.length > 0 ? recommendations : undefined
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
                else if (streamUrl.includes('myvi.ru')) sourceName = "Myvi";
                else if (streamUrl.includes('uqload')) sourceName = "Uqload";
                else if (streamUrl.includes('verystream')) sourceName = "Verystream";
                else if (streamUrl.includes('vidstream.pro')) sourceName = "Vidstream";
                else if (streamUrl.includes('daisukianime')) sourceName = "Daisukianime";

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

        // ── MAGIC_PROXY_v1 fallback: no streams found → let SkyStream execute JS ──
        if (results.length === 0) {
            const proxyUrl = "MAGIC_PROXY_v1" + encodeBase64(url);
            results.push(new StreamResult({
                url: proxyUrl,
                quality: 'Auto',
                source: 'AnimeSama',
                headers: { 'Referer': 'https://anime-sama.to/' }
            }));
            log('MAGIC_PROXY_v1 fallback for: ' + url);
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
