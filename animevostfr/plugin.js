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

const baseUrl = (typeof manifest !== 'undefined' && manifest.baseUrl) ? manifest.baseUrl : 'https://v2.animevostfr.org';
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
        if (url.includes('sibnet.ru') || url.includes('video.sibnet')) {
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
        if (url.includes('vidmoly') || url.includes('vidmoly.biz')) {
            try {
                let vidmolyUrl = url.replace(/vidmoly\.(to|biz)/g, 'vidmoly.net');
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
                // Fallback: try original URL if migration didn't work
                if (url.includes('vidmoly.to') || url.includes('vidmoly.biz')) {
                    res = await axios.get(url, { headers: vmHeaders });
                    html = typeof res.data === 'string' ? res.data : '';
                    if (typeof getAndUnpack !== 'undefined' && html.includes('eval(function(p,a,c,k')) { try { html += '\n' + getAndUnpack(html); } catch (e) { } }
                    const fm = html.match(/sources\s*:\s*\[\s*\{\s*file\s*:\s*['"]([^'"]+)['"]/i) || html.match(/file\s*:\s*['"]([^'"]+)['"]/i);
                    if (fm) { let v = fm[1]; if (v.startsWith('//')) v = 'https:' + v; return new StreamResult({ url: "MAGIC_PROXY_v1" + encodeBase64(v), quality: 'Auto', source: 'Vidmoly', headers: { 'Referer': url } }); }
                }
            } catch (e) { }
            let proxyUrl = url.replace(/vidmoly\.(to|biz)/g, 'vidmoly.net');
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
                            return new StreamResult({ url: "MAGIC_PROXY_v1" + encodeBase64(videoUrl), quality: quality, source: 'MailRu', headers: { 'Referer': url } });
                        }
                    }
                }
            } catch (e) { log('Mail.ru extraction failed', e); }
            return new StreamResult({ url: "MAGIC_PROXY_v1" + encodeBase64(url), quality: 'Auto', source: 'MailRu', headers: { 'Referer': baseUrl } });
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

        // --- Embed4Me / Lpayer ---
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

        // --- Direct video URLs ---
        if (url.match(/\.(mp4|m3u8|mkv|webm)(\?|$)/i)) {
            return new StreamResult({
                url: "MAGIC_PROXY_v1" + encodeBase64(url),
                quality: 'Auto',
                source: 'Direct',
                headers: { 'Referer': baseUrl }
            });
        }

        // --- Unknown host → proxy fallback ---
        let host = 'Unknown'; try { host = url.split('/')[2] || 'Unknown'; } catch (e) { }
        return new StreamResult({
            url: "MAGIC_PROXY_v1" + encodeBase64(url),
            quality: 'Auto',
            source: host,
            headers: { 'Referer': baseUrl }
        });
    }
};

// ── Helper: validate an anime URL (accepts /animes/slug/, /animes/1234-slug, /saison/, /film/) ──
function isValidAnimeUrl(url) {
    if (!url) return false;
    return url.match(/\/animes\/|\/saison\/|\/film\/|\.html/) ? true : false;
}

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

        // Extract item from a TPostMv or TPost.C list item
        function extractItem(el) {
            const linkEl = el.querySelector('a');
            const titleEl = el.querySelector('.Title, .TPMvCn .anmt, .TPMvCn h3, h3, h2');
            const title = titleEl?.textContent.trim() || linkEl?.getAttribute('title') || '';
            let url = linkEl?.getAttribute('href');
            // Extract poster from image
            const imgEl = el.querySelector('img');
            const posterUrl = getPoster(el);
            return { title, url, posterUrl, imgEl };
        }

        // ── 1. Extract sections by heading (Dernièrs Animes, Films, Saisons, etc.) ──
        // NOTE: sections are processed FIRST to avoid seenUrls conflicts
        const headingSectionNames = {
            'Dernièrs Animes': 'Dernièrs Animes',
            'Derniers Animes': 'Derniers Animes',
            'Dernièrs Films': 'Derniers Films Ajoutés',
            'Derniers Films Ajoutés': 'Derniers Films Ajoutés',
            'Dernièrs Saisons': 'Dernièrs Saisons',
            'Episodes VOSTFR': 'Épisodes VOSTFR',
            'Episodes VF': 'Épisodes VF',
        };
        queryAll(doc, 'h2, h3, h4').forEach(heading => {
            const headingText = heading.textContent.trim();
            let sectionKey = null;
            for (const [keyword, name] of Object.entries(headingSectionNames)) {
                if (headingText.toLowerCase().startsWith(keyword.toLowerCase())) {
                    sectionKey = name;
                    break;
                }
            }
            if (!sectionKey) return;
            if (results[sectionKey]) return;

            // Items may be in different locations relative to the heading:
            // Structure: heading → div (controls) → ul.MovieList → li.TPostMv
            // Or: heading inside div.Top, items in grandparent (section)
            // Strategy: search siblings, parent, grandparent for items
            function findItemsInAncestors(headingEl) {
                const items = [];
                const sectionSeenUrls = new Set();
                // Search next siblings (up to 5)
                let sib = headingEl;
                for (let i = 0; i < 8; i++) {
                    sib = sib.nextElementSibling;
                    if (!sib || !sib.querySelectorAll) break;
                    queryAll(sib, '.TPostMv, .TPost.C, .episode-item, ul.MovieList > li, .MovieList li').forEach(el => {
                        if (items.length >= 20) return;
                        const item = extractItem(el);
                        if (item.title && isValidAnimeUrl(item.url)) {
                            const fullUrl = fixUrl(item.url);
                            if (!sectionSeenUrls.has(fullUrl)) {
                                sectionSeenUrls.add(fullUrl);
                                items.push(new MultimediaItem({
                                    title: item.title,
                                    url: fullUrl,
                                    posterUrl: item.posterUrl,
                                    type: 'anime'
                                }));
                            }
                        }
                    });
                    if (items.length > 0) break;
                }
                // Search parent and grandparent
                if (items.length === 0 && headingEl.parentElement) {
                    const parent = headingEl.parentElement;
                    queryAll(parent, '.TPostMv, .TPost.C, .episode-item, ul.MovieList > li, .MovieList li').forEach(el => {
                        if (items.length >= 20) return;
                        const item = extractItem(el);
                        if (item.title && isValidAnimeUrl(item.url)) {
                            const fullUrl = fixUrl(item.url);
                            if (!sectionSeenUrls.has(fullUrl)) {
                                sectionSeenUrls.add(fullUrl);
                                items.push(new MultimediaItem({
                                    title: item.title,
                                    url: fullUrl,
                                    posterUrl: item.posterUrl,
                                    type: 'anime'
                                }));
                            }
                        }
                    });
                }
                if (items.length === 0 && headingEl.parentElement?.parentElement) {
                    const grandparent = headingEl.parentElement.parentElement;
                    if (!grandparent.matches?.('body')) {
                        queryAll(grandparent, '.TPostMv, .TPost.C, .episode-item, ul.MovieList > li, .MovieList li').forEach(el => {
                            if (items.length >= 20) return;
                            const item = extractItem(el);
                            if (item.title && isValidAnimeUrl(item.url)) {
                                const fullUrl = fixUrl(item.url);
                                if (!sectionSeenUrls.has(fullUrl)) {
                                    sectionSeenUrls.add(fullUrl);
                                    items.push(new MultimediaItem({
                                        title: item.title,
                                        url: fullUrl,
                                        posterUrl: item.posterUrl,
                                        type: 'anime'
                                    }));
                                }
                            }
                        });
                    }
                }
                // Add found items to global seenUrls to prevent dedup cross-sections
                for (const item of items) {
                    seenUrls.add(item.url);
                }
                return items;
            }

            const items = findItemsInAncestors(heading);
            if (items.length > 0) results[sectionKey] = items;
        });

        // ── 2. Top 10 Animes sidebar (Wdgt) ──
        const top10 = [];
        queryAll(doc, '.Wdgt .TPostMv, .Wdgt .TPost.C, .Widget .TPostMv').forEach(el => {
            const item = extractItem(el);
            if (item.title && isValidAnimeUrl(item.url)) {
                const fullUrl = fixUrl(item.url);
                if (!seenUrls.has(fullUrl)) {
                    seenUrls.add(fullUrl);
                    top10.push(new MultimediaItem({
                        title: item.title,
                        url: fullUrl,
                        posterUrl: item.posterUrl,
                        type: 'anime'
                    }));
                }
            }
        });
        if (top10.length > 0) results['Top 10 Animes'] = top10;

        // ── 3. Fallback: collect any remaining TPostMv items not yet in sections ──
        if (Object.keys(results).length === 0) {
            const fallbackItems = [];
            queryAll(doc, '.TPostMv').forEach(el => {
                const item = extractItem(el);
                if (item.title && isValidAnimeUrl(item.url)) {
                    const fullUrl = fixUrl(item.url);
                    if (!seenUrls.has(fullUrl)) {
                        seenUrls.add(fullUrl);
                        fallbackItems.push(new MultimediaItem({
                            title: item.title,
                            url: fullUrl,
                            posterUrl: item.posterUrl,
                            type: 'anime'
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
        const items = [];
        const seenUrls = new Set();
        const fixUrl = p => { if (!p) return ''; if (p.startsWith('http')) return p; return baseUrl + (p.startsWith('/') ? '' : '/') + p; };

        // ── Helper: extract item from a Toroplay4 result element ──
        function extractSearchItem(el) {
            // Get URL from the first anchor
            const linkEl = el.tagName === 'A' ? el : (el.querySelector('.TPMvCn a, .Title a, h2 a, h3 a, a[href*=\"/animes/\"], a[href*=\"/saison/\"], a[href*=\"/film/\"], a[href*=\".html\"], a[href*=\"/tag/\"], a[href*=\"/category/\"], a[href*=\"/episode/\"], a[href*=\"/anime/\"], a') || el.querySelector('a'));
            if (!linkEl) return { title: null, url: null, posterUrl: null };
            const titleEl = el.querySelector('.TPMvCn .anmt, .Title, h2, h3, .episode-link') || linkEl;
            let title = titleEl?.getAttribute('title') || titleEl?.textContent?.trim() || linkEl?.textContent?.trim();
            const imgEl = el.querySelector('img');
            let url = linkEl?.getAttribute('href');
            // Validate URL: must match site URL patterns
            if (url && !isValidAnimeUrl(url)) url = undefined;
            const posterUrl = imgEl?.getAttribute('data-src') || imgEl?.getAttribute('src');
            return { title, url, posterUrl };
        }

        // ── Helper: parse items from HTML ──
        async function parseItems(html) {
            if (!html || typeof html !== 'string') return [];
            const results = [];

            // Strategy 1: Parse via DOM with Toroplay4 selectors
            if (typeof parseHtml === 'function') {
                try {
                    const dom = await parseHtml(html);
                    const searchSelectors = [
                        '.TPostMv',
                        '.TPost.C',
                        '.TPost',
                        '.page-item-detail',
                        '.episode-item',
                        'article',
                        '.search-result',
                        '.post-item'
                    ];
                    for (const sel of searchSelectors) {
                        if (results.length >= 25) break;
                        Array.from(dom.querySelectorAll(sel)).forEach(el => {
                            if (results.length >= 25) return;
                            const item = extractSearchItem(el);
                            if (item.title && item.url && !seenUrls.has(item.url)) {
                                seenUrls.add(item.url);
                                results.push(item);
                            }
                        });
                        if (results.length > 0) break;
                    }
                } catch (e) { }
            }

            // Strategy 2: Regex fallback for search result items
            if (results.length === 0 && typeof html === 'string') {
                const patterns = [
                    // TPostMv / search result with structured classes
                    /<div[^>]*class="[^"]*TPostMv[^"]*"[^>]*>[\s\S]*?<a[^>]+href="([^"]+)"[^>]*>[\s\S]*?<img[^>]+(?:data-src|src)="([^"]+)"[^>]*(?:alt="([^"]*)")?[\s\S]*?(?:anmt[^>]*>([^<]+)<|Title[^>]*>([^<]+)<)/gi,
                    // Generic item with anime/saison/film URL pattern
                    /<a[^>]+href="([^"]*(?:\/animes\/|\/saison\/|\/film\/)[^"]+)"[^>]*>[\s\S]*?<img[^>]+(?:data-src|src)="([^"]+)"[^>]*(?:alt="([^"]*)")?[\s\S]*?<\/a>/gi,
                    // Simple anchor with image
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
                            if (title) {
                                results.push({ title, url: url.startsWith('http') ? url : baseUrl + url, posterUrl });
                            }
                        }
                    }
                    if (results.length > 0) break;
                }
            }
            return results;
        }

        // ── Strategy 1: GET with ?s= (WordPress search, primary) ──
        if (items.length === 0) {
            try {
                const res = await axios.get(`${baseUrl}/?s=${encodeURIComponent(query)}`, { headers });
                if (res.data && typeof res.data === 'string' && res.data.length > 500) {
                    const parsed = await parseItems(res.data);
                    for (const p of parsed) {
                        items.push(p);
                    }
                }
            } catch (e) { }
        }

        // ── Strategy 2: GET with /search.html?keyword= ──
        if (items.length === 0) {
            try {
                const res = await axios.get(`${baseUrl}/search.html?keyword=${encodeURIComponent(query)}`, { headers });
                if (res.data && typeof res.data === 'string' && res.data.length > 500) {
                    const parsed = await parseItems(res.data);
                    for (const p of parsed) {
                        items.push(p);
                    }
                }
            } catch (e) { }
        }

        // ── Strategy 3: POST with DLE-style search ──
        if (items.length === 0) {
            try {
                const res = await axios.post(baseUrl,
                    `do=search&subaction=search&search_start=0&full_search=0&result_from=1&story=${encodeURIComponent(query)}`,
                    { headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' } }
                );
                if (res.data && typeof res.data === 'string' && res.data.length > 500) {
                    const parsed = await parseItems(res.data);
                    for (const p of parsed) {
                        items.push(p);
                    }
                }
            } catch (e) { }
        }

        // ── Strategy 4: GET with DLE sitemap-like /index.php?do=search ──
        if (items.length === 0) {
            try {
                const res = await axios.get(`${baseUrl}/index.php?do=search&subaction=search&story=${encodeURIComponent(query)}`, { headers });
                if (res.data && typeof res.data === 'string' && res.data.length > 500) {
                    const parsed = await parseItems(res.data);
                    for (const p of parsed) {
                        items.push(p);
                    }
                }
            } catch (e) { }
        }

        const results = items.map(i => new MultimediaItem({
            title: i.title,
            url: i.url.startsWith('http') ? i.url : baseUrl + i.url,
            posterUrl: (function(p){ if(!p) return ''; if(p.startsWith('http')) return p; return baseUrl + (p.startsWith('/') ? '' : '/') + p; })(i.posterUrl),
            type: 'anime',
            playbackPolicy: 'none'
        }));

        cb({ success: true, data: results });
    } catch (e) { log('search error', e); cb({ success: false, errorCode: 'SEARCH_ERROR', message: String(e) }); }
}

function detectSeasonAndType(name) {
    let season = undefined;
    let contentType = undefined;
    if (!name) return { season, contentType };
    let n = name.trim().replace(/\s*[\[(]?(?:VF|VOSTFR|VOST|VO|DUB|SUB)[\])]?\s*/gi, ' ').replace(/\s+/g, ' ').trim();
    if (/\b(?:oav|ova)\b/i.test(n)) contentType = 'OAV';
    else if (/\b(?:film|movie)\b/i.test(n)) contentType = 'Film';
    else if (/\b(?:sp[ée]cial|special)\b/i.test(n)) contentType = 'Spécial';
    const s00Match = n.match(/S(\d+)E\d+/i);
    if (s00Match) season = parseInt(s00Match[1]);
    if (season === undefined) {
        const sMatch = n.match(/(?:\b(?:saison|season|part|cour|oav|ova|sp[ée]cial|special|volume|vol)\s+|\bS\s*)(\d+)\b/i);
        if (sMatch) season = parseInt(sMatch[1]);
    }
    if (season === undefined && !contentType) {
        const numMatch = n.match(/\d+/);
        if (numMatch && !/(?:^|[\s\W])[ÉéEe]p(?:isode)?(?:$|[\s\W])/i.test(n)) {
            season = parseInt(numMatch[0]);
        }
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

// Parse season info from a SEASON title (not episode title)
function parseSeasonInfo(title) {
    let season = undefined;
    let contentType = undefined;
    if (!title) return { season, contentType };
    let t = title.trim().replace(/\s*[\[(]?(?:VF|VOSTFR|VOST|VO|DUB|SUB)[\])]?\s*/gi, ' ').replace(/\s+/g, ' ').trim();
    if (!t) return { season, contentType };
    if (/\b(?:oav|ova|ona)\b/i.test(t)) contentType = 'OAV';
    else if (/\b(?:film|movie|film\s*anim[ée])\b/i.test(t)) contentType = 'Film';
    else if (/\b(?:sp[ée]cial|special)\b/i.test(t)) contentType = 'Spécial';
    const sMatch = t.match(/(?:\b(?:saison|season|part|cour|film|oav|ova|ona|sp[ée]cial|special|episode|ep|volume|vol|tome)\s+|\bS\s*)(\d+)\b/i);
    if (sMatch) season = parseInt(sMatch[1]);
    if (season === undefined) {
        const numMatch = t.match(/\d+/);
        if (numMatch) {
            const num = parseInt(numMatch[0]);
            if (!contentType) season = num;
        }
    }
    return { season, contentType };
}

// Determine dubStatus from the page URL (VF or VOSTFR)
function getDubStatusFromPageUrl(pageUrl) {
    if (/\/vf\b|[-_]vf(?!o)/i.test(pageUrl)) return 'dub';
    if (/\/vostfr\b|[-_]vostfr/i.test(pageUrl)) return 'sub';
    return undefined;
}

// Detect season number from section heading context
function detectSeasonFromHeading(el) {
    let node = el;
    while (node) {
        let prev = node.previousElementSibling;
        while (prev) {
            const text = prev.textContent.trim();
            const oavMatch = text.match(/\b(OAV|OVA|ONA|Sp[ée]cial|Special|Film)\s*(\d+)?\b/i);
            const sMatch = text.match(/S(?:aison|eason)\s*(\d+)/i);
            if (sMatch) {
                let ct = undefined;
                if (oavMatch) {
                    if (/film/i.test(oavMatch[1])) ct = 'Film';
                    else if (/sp[ée]cial|special/i.test(oavMatch[1])) ct = 'Spécial';
                    else ct = 'OAV';
                }
                return { season: parseInt(sMatch[1]), contentType: ct };
            }
            if (oavMatch) {
                let ct = 'OAV';
                if (/film/i.test(oavMatch[1])) ct = 'Film';
                if (/sp[ée]cial|special/i.test(oavMatch[1])) ct = 'Spécial';
                return { season: oavMatch[2] ? parseInt(oavMatch[2]) : undefined, contentType: ct };
            }
            prev = prev.previousElementSibling;
        }
        node = node.parentElement;
    }
    return { season: undefined, contentType: undefined };
}

// Détecte la version alternative VF ↔ VOSTFR (format /animes/{slug}/)
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

    // Extraire le slug de l'URL (format /animes/{slug}/ ou /animes/{slug}-vf/)
    const slugMatch = currentUrl.match(/\/animes\/([\w-]+)\/?/i);
    let animeKey = slugMatch ? slugMatch[1].toLowerCase() : '';

    // Supprimer les suffixes VF/VOSTFR du slug
    if (animeKey) {
        animeKey = animeKey.replace(/[-_](vf|vostfr|vost|vo|dll|au)$/gi, '');
        animeKey = animeKey.replace(/[-_]vf$/gi, '');
        animeKey = animeKey.replace(/[-_]vostfr$/gi, '');
    }

    if (!animeKey) return { currentVersion, alternativeUrl: null };

    // Chercher dans le HTML un lien vers la version alternative
    const altPath = currentVersion === 'VOSTFR' ? 'vf' : 'vostfr';
    const urlPatterns = [
        // /animes/{slug}-vf/ or /animes/{slug}-vostfr/
        new RegExp('href=["\']([^"\']*?/animes/' + animeKey.replace(/[-_]/g, '[-_]') + '[-_]' + altPath + '/?)["\']', 'gi'),
        // Just /animes/{altPath}/{animeKey}/
        new RegExp('href=["\']([^"\']*?/animes/' + altPath + '/' + animeKey.replace(/[-_]/g, '[-_]') + '/?)["\']', 'gi'),
        // /animes/{animeKey} but with different suffix (catch-all)
        new RegExp('href=["\']([^"\']*?/animes/' + animeKey.replace(/[-_]/g, '[-_]') + '(?:-[^"\']*)?/?)["\']', 'gi'),
    ];
    for (const regex of urlPatterns) {
        if (alternativeUrl) break;
        const m = regex.exec(html);
        if (m && m[1]) {
            const href = m[1];
            // Make sure it's different from current URL
            const normalizedHref = href.startsWith('http') ? href : baseUrl + (href.startsWith('/') ? '' : '/') + href;
            if (normalizedHref !== currentUrl) {
                alternativeUrl = normalizedHref;
            }
        }
    }

    return { currentVersion, alternativeUrl };
}

async function load(url, cb) {
    try {
        const res = await axios.get(url, { headers });
        const html = res.data;
        const doc = await parseHtml(html);
        const title = doc.querySelector('h1.Title')?.textContent.trim() || doc.querySelector('.Title')?.textContent.trim() || doc.querySelector('h1')?.textContent.trim() || '';

        // Description: try meta tags first, then content selectors
        let description = doc.querySelector('meta[name="description"]')?.getAttribute('content') ||
            doc.querySelector('meta[property="og:description"]')?.getAttribute('content') ||
            doc.querySelector('.Description')?.textContent.trim() ||
            doc.querySelector('.entry-content p')?.textContent.trim() ||
            doc.querySelector('.description')?.textContent.trim();

        // Poster: .Image img is the main poster on detail pages
        const rawPoster = doc.querySelector('.Image img')?.getAttribute('data-src') ||
            doc.querySelector('.Image img')?.getAttribute('src') ||
            doc.querySelector('.film-poster-img')?.getAttribute('data-src') ||
            doc.querySelector('.film-poster-img')?.getAttribute('src') ||
            doc.querySelector('.TPostBg')?.getAttribute('src') ||
            doc.querySelector('meta[property="og:image"]')?.getAttribute('content');
        const posterUrl = (function(p){ if(!p) return ''; if(p.startsWith('http')) return p; return baseUrl + (p.startsWith('/') ? '' : '/') + p; })(rawPoster);

        // Extract metadata from .Info div (year, duration, views)
        const infoEl = doc.querySelector('.Info');
        const infoText = infoEl?.textContent || '';
        const yearFromInfo = infoText.match(/(\d{4})/)?.[1];
        const year = yearFromInfo ? parseInt(yearFromInfo) : undefined;

        // Genres: try category/tag links broadly
        const genreEls = Array.from(doc.querySelectorAll('.sgenerx a, .genre a, .genres a, .category a, .Category a, .Tags a, a[rel="tag"], a[href*="/genre/"], a[href*="/categories/"]'))
            .map(el => el.textContent.trim()).filter(Boolean);

        // Status: search in text content (handle HTML tags between label and value)
        let status = undefined;
        const statusPatterns = [
            // "En cours de Production : </strong>Yes/Oui"
            /Production\s*:\s*<[^>]+>\s*(Oui|Yes|Non|No)/i,
            // "Statut/Status : Value" (direct, no tags between)
            /(?:Statut|Status)\s*:?\s*(En cours|Terminé|Finished|Ongoing|Completed|En Cours)/i,
            // Simple text search for production/completion indicators
            /Production\s*:?\s*(Oui|Yes|Non|No)/i
        ];
        for (const sp of statusPatterns) {
            const m = html.match(sp);
            if (m) {
                const val = m[1].toLowerCase();
                if (val === 'en cours' || val === 'ongoing' || val === 'oui' || val === 'yes') status = 'ongoing';
                else if (val === 'terminé' || val === 'finished' || val === 'completed' || val === 'non' || val === 'no') status = 'completed';
                break;
            }
        }

        const episodes = [];
        const seenEpUrls = new Set();
        const seenEpTriples = new Set();
        const pageDubStatus = detectDubStatus(url, title);

        function extractEpisodeNumber(title) {
            if (!title) return undefined;
            const specific = title.match(/(?:Episode|Épisode|Ep|E(?!p))\s*(\d+)/i);
            if (specific) return parseInt(specific[1]);
            const nums = title.match(/\d+/g);
            if (nums && nums.length > 0) return parseInt(nums[nums.length - 1]);
            return undefined;
        }

        function buildEpisodeName(baseTitle, epNum, seasonNum, contentType, dubStatus) {
            let parts = [];
            if (contentType === 'Film') parts.push('Film');
            else if (contentType === 'OAV') parts.push('OAV' + (seasonNum ? ' ' + seasonNum : ''));
            else if (contentType === 'Spécial') parts.push('Spécial' + (seasonNum ? ' ' + seasonNum : ''));
            else if (seasonNum) parts.push('Saison ' + seasonNum);
            parts.push(baseTitle || ('Épisode ' + epNum));
            if (dubStatus === 'dub') parts.push('(VF)');
            else if (dubStatus === 'sub') parts.push('(VOSTFR)');
            return parts.join(' ');
        }

        // Parse episode items
        doc.querySelectorAll('.episode-item').forEach(el => {
            const linkEl = el.querySelector('.episode-link') || el.querySelector('a');
            const epUrl = linkEl?.getAttribute('href');
            const epTitle = linkEl?.textContent.trim();
            if (epUrl) {
                const fullEpUrl = epUrl.startsWith('http') ? epUrl : baseUrl + epUrl;
                if (seenEpUrls.has(fullEpUrl)) return;
                seenEpUrls.add(fullEpUrl);
                let epNum = extractEpisodeNumber(epTitle);
                const headingSeason = detectSeasonFromHeading(el);
                if (epNum === undefined) {
                    epNum = headingSeason.contentType ? 1 : (episodes.length + 1);
                }
                const titleDetected = detectSeasonAndType(epTitle);
                const seasonNum = headingSeason.season !== undefined ? headingSeason.season : titleDetected.season;
                const contentType = headingSeason.contentType || titleDetected.contentType;
                let dubStatus = detectDubStatus(epUrl, epTitle);
                if (dubStatus === 'none') dubStatus = detectDubStatusFromHeading(el) || pageDubStatus;
                const tripleKey = `${seasonNum || 1}-${epNum}-${dubStatus}`;
                if (seenEpTriples.has(tripleKey)) return;
                seenEpTriples.add(tripleKey);
                const epName = buildEpisodeName(epTitle || '', epNum, seasonNum, contentType, dubStatus);
                episodes.push(new Episode({
                    name: epName,
                    episode: epNum,
                    url: fullEpUrl,
                    season: seasonNum || 1,
                    posterUrl: posterUrl,
                    contentType: contentType,
                    dubStatus: dubStatus
                }));
            }
        });

        // ── Alternative version VF/VOSTFR ──
        const altResult = findAlternativeVersionFromPage(html, url);
        if (altResult.alternativeUrl) {
            const fullAltUrl = altResult.alternativeUrl.startsWith('http') ? altResult.alternativeUrl : baseUrl + altResult.alternativeUrl;
            try {
                const altRes = await axios.get(fullAltUrl, { headers });
                if (altRes.status === 200 && typeof altRes.data === 'string' && altRes.data.length > 500) {
                    const altDoc = await parseHtml(altRes.data);
                    const altTitle = altDoc.querySelector('h1.Title')?.textContent.trim() || altDoc.querySelector('.Title')?.textContent.trim();
                    const cleanTitle = t => t.replace(/[\s\-_]*\(?(?:VF|VOSTFR|VOST|VO)\)?[\s\-_]*$/gi, '').trim();
                    if (!altTitle || !title || cleanTitle(altTitle).toLowerCase() === cleanTitle(title).toLowerCase()) {
                        const altDubStatus = altResult.currentVersion === 'VOSTFR' ? 'dub' : 'sub';
                        altDoc.querySelectorAll('.episode-item').forEach(el => {
                            const linkEl = el.querySelector('.episode-link') || el.querySelector('a');
                            const epUrl = linkEl?.getAttribute('href');
                            const epTitle = linkEl?.textContent.trim();
                            if (epUrl) {
                                const fullEpUrl = epUrl.startsWith('http') ? epUrl : baseUrl + epUrl;
                                if (seenEpUrls.has(fullEpUrl)) return;
                                seenEpUrls.add(fullEpUrl);
                                let epNum = extractEpisodeNumber(epTitle);
                                const headingSeason = detectSeasonFromHeading(el);
                                if (epNum === undefined) epNum = headingSeason.contentType ? 1 : (episodes.length + 1);
                                const titleDetected = detectSeasonAndType(epTitle);
                                const seasonNum = headingSeason.season !== undefined ? headingSeason.season : titleDetected.season;
                                const contentType = headingSeason.contentType || titleDetected.contentType;
                                const tripleKey = `${seasonNum || 1}-${epNum}-${altDubStatus}`;
                                if (seenEpTriples.has(tripleKey)) return;
                                seenEpTriples.add(tripleKey);
                                const epName = buildEpisodeName(epTitle || '', epNum, seasonNum, contentType, altDubStatus);
                                episodes.push(new Episode({
                                    name: epName,
                                    episode: epNum,
                                    url: fullEpUrl,
                                    season: seasonNum || 1,
                                    posterUrl: posterUrl,
                                    contentType: contentType,
                                    dubStatus: altDubStatus
                                }));
                            }
                        });
                    }
                }
            } catch (e) { /* Alternative fetch failed */ }
        }

        // Film fallback: no episodes → extract player from lazy-player data-src or direct iframe
        if (episodes.length === 0) {
            const fallbackDubStatus = detectDubStatus(url, title);

            // Try lazy-player data-src first (Toroplay4 pattern)
            const lazyPlayer = doc.querySelector('.lazy-player');
            if (lazyPlayer) {
                const lazySrc = lazyPlayer.getAttribute('data-src');
                if (lazySrc) {
                    episodes.push(new Episode({
                        name: buildEpisodeName(title || 'Film', 1, 1, 'Film', fallbackDubStatus),
                        episode: 1,
                        url: lazySrc.startsWith('http') ? lazySrc : baseUrl + lazySrc,
                        season: 1,
                        posterUrl: posterUrl,
                        contentType: 'Film',
                        dubStatus: fallbackDubStatus
                    }));
                }
            }

            // Fallback: try iframe
            if (episodes.length === 0) {
                const playerIframe = doc.querySelector('.TPlayerTb iframe[src], .TPlayerCn iframe[src], #player iframe[src], iframe[src*="trembed"], iframe[src*="embed"]');
                if (playerIframe) {
                    const playerUrl = playerIframe.getAttribute('src');
                    if (playerUrl) {
                        episodes.push(new Episode({
                            name: buildEpisodeName(title || 'Film', 1, 1, 'Film', fallbackDubStatus),
                            episode: 1,
                            url: playerUrl.startsWith('http') ? playerUrl : baseUrl + playerUrl,
                            season: 1,
                            posterUrl: posterUrl,
                            contentType: 'Film',
                            dubStatus: fallbackDubStatus
                        }));
                    }
                }
            }
        }

        // ── Recommendations ──
        const recommendations = [];
        const recSeenUrls = new Set();
        const recSelectors = [
            '.RelatedPosts .TPostMv',
            '.RelatedPosts .TPost.C',
            '.related-posts .TPostMv',
            '.widget_related .TPostMv',
            '.widget .TPost.C:not(:first-child)',
            '.sidebar .TPostMv',
            '.sidebar .TPost.C',
            '.Wdgt .TPostMv',
            '.TPost.C',
            '[class*="related"] .TPostMv',
            '[class*="recommend"] .TPostMv',
        ];
        for (const sel of recSelectors) {
            if (recommendations.length >= 15) break;
            doc.querySelectorAll(sel).forEach(el => {
                if (recommendations.length >= 15) return;
                const linkEl = el.querySelector('a');
                const imgEl = el.querySelector('img');
                const titleEl = el.querySelector('.Title, .TPMvCn .anmt, h3, h2');
                const recTitle = titleEl?.textContent.trim() || linkEl?.getAttribute('title');
                const recUrl = linkEl?.getAttribute('href');
                if (!recTitle || !recUrl || recUrl.includes('#')) return;
                const fullRecUrl = recUrl.startsWith('http') ? recUrl : baseUrl + recUrl;
                if (recSeenUrls.has(fullRecUrl) || fullRecUrl === url) return;
                recSeenUrls.add(fullRecUrl);
                const recPoster = imgEl?.getAttribute('data-src') || imgEl?.getAttribute('src');
                recommendations.push(new MultimediaItem({
                    title: recTitle,
                    url: fullRecUrl,
                    posterUrl: (function(p){ if(!p) return ''; if(p.startsWith('http')) return p; return baseUrl + (p.startsWith('/') ? '' : '/') + p; })(recPoster),
                    type: 'anime'
                }));
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
        const doc = await parseHtml(html);
        const streams = [];
        const seenStreamUrls = new Set();

        async function tryAddStream(playerUrl, label) {
            if (!playerUrl || playerUrl.length < 5) return;
            playerUrl = playerUrl.replace(/&amp;/g, '&').replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#034;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
            if (playerUrl.startsWith('//')) playerUrl = 'https:' + playerUrl;
            // Normalize embed4me URLs (remove fragment from lpayer.embed4me.com)
            if (playerUrl.includes('embed4me.com/#') && !playerUrl.includes('lpayer')) {
                playerUrl = playerUrl.replace('/#', '/e/');
            }
            if (seenStreamUrls.has(playerUrl)) return;
            seenStreamUrls.add(playerUrl);
            try {
                const streamRes = await Extractors.resolveStream(playerUrl);
                if (streamRes) {
                    streamRes.quality = label || 'Lecteur';
                    streams.push(streamRes);
                }
            } catch (e) { log('Stream resolve failed: ' + playerUrl, e); }
        }

        // ── Strategy 1: Parse TPlayer system (Toroplay4) ──
        // TPlayerNv tabs with data-tplayernv → links to TPlayerCn containers
        const tabs = doc.querySelectorAll('.TPlayerNv li, [data-tplayernv]');
        if (tabs.length > 0) {
            const tabPromises = [];
            tabs.forEach(tab => {
                const tabId = tab.getAttribute('data-tplayernv');
                if (!tabId) return;
                const label = tab.textContent.trim() || 'Lecteur';
                // Find the corresponding container
                const container = doc.getElementById(tabId) || doc.querySelector(`div[data-tplayernv="${tabId}"]`);
                if (!container) return;
                // Check for lazy-player with data-src (default state)
                const lazyPlayer = container.querySelector('.lazy-player');
                if (lazyPlayer) {
                    const lazySrc = lazyPlayer.getAttribute('data-src');
                    if (lazySrc) {
                        const baseUrlObj = new URL(url);
                        const fullLazyUrl = lazySrc.startsWith('http') ? lazySrc : baseUrlObj.origin + (lazySrc.startsWith('/') ? '' : '/') + lazySrc;
                        tabPromises.push(tryAddStream(fullLazyUrl, label));
                        return;
                    }
                }
                // Check for direct iframe
                const iframe = container.querySelector('iframe[src]');
                if (iframe) {
                    const iframeSrc = iframe.getAttribute('src');
                    const baseUrlObj = new URL(url);
                    const fullIframeUrl = iframeSrc.startsWith('http') ? iframeSrc : baseUrlObj.origin + (iframeSrc.startsWith('/') ? '' : '/') + iframeSrc;
                    tabPromises.push(tryAddStream(fullIframeUrl, label));
                }
            });
            await Promise.all(tabPromises);
        }

        // ── Strategy 2: Resolve ALL embed & lazy URLs (trembed + direct) ──
        if (streams.length === 0) {
            // Collect all player URLs from page (iframes + lazy-player data-src)
            const allPlayerUrls = [];
            const seenSrcUrls = new Set();

            // 2a. Direct iframes
            const iframeRegex = /<iframe[^>]*src=["']([^"']+)["'][^>]*>/gi;
            let iframeMatch;
            while ((iframeMatch = iframeRegex.exec(html)) !== null) {
                const src = iframeMatch[1];
                if (src && !src.includes('ads') && !src.includes('google') && !src.includes('facebook') && !src.includes('doubleclick') && !src.includes('googlesyndication') && !src.includes('googletag')) {
                    allPlayerUrls.push(src);
                }
            }

            // 2b. Lazy-player data-src
            const lazyPlayers = doc.querySelectorAll('.lazy-player');
            lazyPlayers.forEach((lp, idx) => {
                const src = lp.getAttribute('data-src');
                if (src && !seenSrcUrls.has(src)) {
                    seenSrcUrls.add(src);
                    allPlayerUrls.push(src);
                }
            });

            // 2c. Resolve ALL collected URLs
            if (allPlayerUrls.length > 0) {
                const baseUrlObj = new URL(url);
                const results = await Promise.all(allPlayerUrls.map(async (playerUrl, idx) => {
                    try {
                        const fullUrl = playerUrl.startsWith('http') ? playerUrl : baseUrlObj.origin + (playerUrl.startsWith('/') ? '' : '/') + playerUrl;
                        const label = 'Lecteur ' + (idx + 1);

                        if (fullUrl.includes('trembed=')) {
                            // Fetch trembed page to get the actual player iframe
                            const trembedRes = await axios.get(fullUrl, { headers: { ...headers, 'Referer': url } });
                            const trembedHtml = trembedRes.data;
                            const innerIframe = trembedHtml.match(/<iframe[^>]*src=["']([^"']+)["'][^>]*>/i);
                            if (innerIframe && innerIframe[1]) {
                                return { url: innerIframe[1], label };
                            }
                            // Fallback: direct video URL in trembed response
                            const videoFile = trembedHtml.match(/file["']?\s*:\s*["']?([^"'\s]+(?:m3u8|mp4)[^"'\s]*)["']?/i);
                            if (videoFile) {
                                let vUrl = videoFile[1];
                                if (vUrl.startsWith('//')) vUrl = 'https:' + vUrl;
                                return { url: vUrl, label };
                            }
                        } else {
                            return { url: fullUrl, label };
                        }
                    } catch (e) { }
                    return null;
                }));

                for (const r of results) {
                    if (r && !seenStreamUrls.has(r.url)) {
                        await tryAddStream(r.url, r.label);
                    }
                }
            }
        }

        // ── Strategy 4: Direct video URLs in page ──
        if (streams.length === 0) {
            const videoRegexes = [
                /(?:file|url|source|src)["']?\s*[:=]\s*["'](https?:\/\/[^"'\s]+\.(?:mp4|m3u8|mkv|webm)[^"'\s]*)["']/gi,
                /<source\s+src=["']([^"']+\.(?:mp4|m3u8|mkv|webm)[^"']*)["']/gi,
            ];
            for (const vRegex of videoRegexes) {
                if (streams.length > 0) break;
                let vMatch;
                while ((vMatch = vRegex.exec(html)) !== null) {
                    const videoUrl = vMatch[1];
                    if (videoUrl && !videoUrl.includes('.js') && !videoUrl.includes('.css') && !videoUrl.includes('analytics') && !videoUrl.includes('tracking')) {
                        await tryAddStream(videoUrl, 'Direct');
                    }
                }
            }
        }

        // ── MAGIC_PROXY_v1 fallback: no streams found → let SkyStream execute JS ──
        if (streams.length === 0) {
            const proxyUrl = "MAGIC_PROXY_v1" + encodeBase64(url);
            streams.push(new StreamResult({
                url: proxyUrl,
                quality: 'Auto',
                source: 'AnimeVostfr',
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
