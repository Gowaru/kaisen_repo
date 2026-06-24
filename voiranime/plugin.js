// @ts-nocheck
import { MixDrop, StreamTape, Voe, Filemoon, DoodExtractor, HubCloud } from 'skystream-extractors/dist/index.js';
import { encodeBase64, createFixUrl, detectDubStatus } from '../shared.js';

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
                if ((url.includes('vidmoly.to') || url.includes('vidmoly.biz')) && !html.includes('sources')) {
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
                        // Select best quality: prefer 1080p over 720p, 480p, 360p
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

        // --- Embed4Me / Lplayer ---
        if (url.includes('embed4me') || url.includes('lpayer')) {
            return new StreamResult({ url: "MAGIC_PROXY_v1" + encodeBase64(url), quality: 'Auto', source: 'Embed4Me', headers: { 'Referer': baseUrl } });
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
                    return new StreamResult({ url: "MAGIC_PROXY_v1" + encodeBase64(fm[1]), quality: 'Auto', source: 'YourUpload', headers: { 'Referer': url } });
                }
            } catch (e) { }
            return new StreamResult({ url: "MAGIC_PROXY_v1" + encodeBase64(url), quality: 'Auto', source: 'YourUpload', headers: { 'Referer': baseUrl } });
        }

        // --- Streamruby / StreamSB ---
        if (url.includes('streamruby') || url.includes('streamsb') || url.includes('sbplay')) {
            try {
                const res = await axios.get(url, { headers: { 'Referer': baseUrl, 'Accept': 'application/json,text/html,*/*' } });
                let html = typeof res.data === 'string' ? res.data : (typeof res.data?.stream_url === 'string' ? res.data.stream_url : '');
                // Try direct API response first
                if (res.data?.stream_url) {
                    return new StreamResult({ url: "MAGIC_PROXY_v1" + encodeBase64(res.data.stream_url), quality: 'Auto', source: 'StreamSB', headers: { 'Referer': url } });
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
                        return new StreamResult({ url: "MAGIC_PROXY_v1" + encodeBase64(vUrl), quality: 'Auto', source: 'StreamSB', headers: { 'Referer': url } });
                    }
                }
            } catch (e) { }
            return new StreamResult({ url: "MAGIC_PROXY_v1" + encodeBase64(url), quality: 'Auto', source: 'StreamSB', headers: { 'Referer': baseUrl } });
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
                    return new StreamResult({ url: "MAGIC_PROXY_v1" + encodeBase64(vUrl), quality: 'Auto', source: 'Mp4Upload', headers: { 'Referer': url } });
                }
            } catch (e) { }
            return new StreamResult({ url: "MAGIC_PROXY_v1" + encodeBase64(url), quality: 'Auto', source: 'Mp4Upload', headers: { 'Referer': baseUrl } });
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
                                return new StreamResult({ url: "MAGIC_PROXY_v1" + encodeBase64(child.link), quality: 'Auto', source: 'GoFile', headers: { 'Referer': url } });
                            }
                        }
                    }
                }
            } catch (e) { }
            return new StreamResult({ url: "MAGIC_PROXY_v1" + encodeBase64(url), quality: 'Auto', source: 'GoFile', headers: { 'Referer': baseUrl } });
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
                    return new StreamResult({ url: "MAGIC_PROXY_v1" + encodeBase64(vUrl), quality: 'Auto', source: 'SpeedoStream', headers: { 'Referer': url } });
                }
            } catch (e) { }
            return new StreamResult({ url: "MAGIC_PROXY_v1" + encodeBase64(url), quality: 'Auto', source: 'SpeedoStream', headers: { 'Referer': baseUrl } });
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
                    return new StreamResult({ url: "MAGIC_PROXY_v1" + encodeBase64(vUrl), quality: 'Auto', source: 'Vembed', headers: { 'Referer': url } });
                }
            } catch (e) { }
            return new StreamResult({ url: "MAGIC_PROXY_v1" + encodeBase64(url), quality: 'Auto', source: 'Vembed', headers: { 'Referer': baseUrl } });
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
                    return new StreamResult({ url: "MAGIC_PROXY_v1" + encodeBase64(vUrl), quality: 'Auto', source: 'StreamWish', headers: { 'Referer': url } });
                }
            } catch (e) { }
            return new StreamResult({ url: "MAGIC_PROXY_v1" + encodeBase64(url), quality: 'Auto', source: 'StreamWish', headers: { 'Referer': baseUrl } });
        }

        // --- VidSrc (embedding API) ---
        if (url.includes('vidsrc') || url.includes('vidsrc.to') || url.includes('vidsrc.me') || url.includes('vidsrc.cc')) {
            try {
                const res = await axios.get(url, { headers: { 'Referer': baseUrl } });
                let html = typeof res.data === 'string' ? res.data : '';
                if (typeof getAndUnpack !== 'undefined' && html.includes('eval(function(p,a,c,k')) {
                    try { const u = getAndUnpack(html); if (u) html += '\n' + u; } catch (e) { }
                }
                // Try direct patterns first
                const fm = html.match(/sources\s*:\s*\[["']([^"']+)["']\]/i) ||
                    html.match(/file\s*:\s*["']([^"']+)["']/i) ||
                    html.match(/src["']?\s*:\s*["']([^"']+)["']/i) ||
                    html.match(/<source\s+src=["']([^"']+)["']/i) ||
                    html.match(/(https?:\/\/[^"'\s]+\.(?:m3u8|mp4)[^"'\s]*)/i);
                if (fm) {
                    let vUrl = fm[1];
                    if (vUrl.startsWith('//')) vUrl = 'https:' + vUrl;
                    return new StreamResult({ url: "MAGIC_PROXY_v1" + encodeBase64(vUrl), quality: 'Auto', source: 'VidSrc', headers: { 'Referer': url } });
                }
                // Fallback: try to extract iframe pointing to content
                const iframe = html.match(/<iframe[^>]*src=["']([^"']+)["'][^>]*>/i);
                if (iframe && iframe[1]) {
                    const iframeUrl = iframe[1].startsWith('http') ? iframe[1] : baseUrl + (iframe[1].startsWith('/') ? '' : '/') + iframe[1];
                    return new StreamResult({ url: "MAGIC_PROXY_v1" + encodeBase64(iframeUrl), quality: 'Auto', source: 'VidSrc', headers: { 'Referer': url } });
                }
            } catch (e) { }
            return new StreamResult({ url: "MAGIC_PROXY_v1" + encodeBase64(url), quality: 'Auto', source: 'VidSrc', headers: { 'Referer': baseUrl } });
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
                    return new StreamResult({ url: "MAGIC_PROXY_v1" + encodeBase64(vUrl), quality: 'Auto', source: 'SuperVideo', headers: { 'Referer': url } });
                }
            } catch (e) { }
            return new StreamResult({ url: "MAGIC_PROXY_v1" + encodeBase64(url), quality: 'Auto', source: 'SuperVideo', headers: { 'Referer': baseUrl } });
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
                    return new StreamResult({ url: "MAGIC_PROXY_v1" + encodeBase64(vUrl), quality: 'Auto', source: 'Stape', headers: { 'Referer': url } });
                }
            } catch (e) { }
            return new StreamResult({ url: "MAGIC_PROXY_v1" + encodeBase64(url), quality: 'Auto', source: 'Stape', headers: { 'Referer': baseUrl } });
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

        // ── 1. Hero slider (swiper, slider, featured sections) ──
        const heroItems = [];
        const heroSelectors = [
            // Swiper slides first
            '.swiper-slide',
            // Madara theme sliders
            '.manga-slider .slider__item',
            '.popular-slider .slider__item',
            '.featured-slider .slider__item',
            // Madara c-blog carousel / featured areas
            '.c-blog__heading + .c-blog-listing .page-item-detail',
            // Generic hero/featured containers
            '[class*="hero"] .page-item-detail',
            '[class*="featured"] .page-item-detail',
            '[class*="slider"] .page-item-detail',
            '[class*="carousel"] .page-item-detail',
        ];

        function extractHeroItem(el) {
            const linkEl = el.querySelector('a[href]');
            const imgEl = el.querySelector('img');
            const titleEl = el.querySelector('.post-title a, h3 a, h4 a, h5 a, .title a');
            let title = titleEl?.textContent?.trim() || linkEl?.getAttribute('title') || imgEl?.getAttribute('alt') || '';
            let url = titleEl?.getAttribute('href') || linkEl?.getAttribute('href');
            if (url && !isValidAnimeUrl(url)) url = undefined;
            const posterUrl = imgEl?.getAttribute('data-src') || imgEl?.getAttribute('src') || imgEl?.getAttribute('data-lazy-src');
            return { title, url, posterUrl };
        }

        for (const sel of heroSelectors) {
            if (heroItems.length > 0) break;
            Array.from(doc.querySelectorAll(sel)).forEach(el => {
                if (heroItems.length >= 12) return;
                const { title, url, posterUrl } = extractHeroItem(el);
                if (title && url && !seenUrls.has(url)) {
                    seenUrls.add(url);
                    heroItems.push(new MultimediaItem({
                        title: title.replace(/\s+/g, ' ').trim(),
                        url: url.startsWith('http') ? url : baseUrl + url,
                        posterUrl: fixUrl(posterUrl),
                        type: 'anime'
                    }));
                }
            });
        }
        if (heroItems.length > 0) results['À la Une'] = heroItems;

        // ── 2. VF/VOSTFR sections (from page-item-detail) ──
        // Note: The Madara theme uses ?filter=subbed / ?filter=dubbed query params.
        // On the homepage, VF/VOSTFR is detected from the anime title/URL suffix.
        const vfItems = [];
        const vostfrItems = [];
        Array.from(doc.querySelectorAll('.page-item-detail')).forEach(el => {
            const linkEl = el.querySelector('a');
            const titleEl = el.querySelector('.post-title a, h3 a, h5 a, .title a');
            const imgEl = el.querySelector('img');
            const title = titleEl?.textContent.trim();
            let url = titleEl?.getAttribute('href') || linkEl?.getAttribute('href');
            if (!isValidAnimeUrl(url)) url = undefined;
            if (!title || !url || seenUrls.has(url)) return;
            // Check if title or URL indicates VF/VOSTFR
            const text = title + ' ' + url;
            const isVf = /\bVF\b|\(VF\)|-vf$/i.test(text);
            const isVostfr = /\bVOSTFR\b|\(VOSTFR\)|-vostfr$/i.test(text);
            const fullUrl = url.startsWith('http') ? url : baseUrl + url;
            const posterUrl = fixUrl(imgEl?.getAttribute('data-src') || imgEl?.getAttribute('src') || imgEl?.getAttribute('data-lazy-src'));
            if (isVf) {
                seenUrls.add(url);
                vfItems.push(new MultimediaItem({ title: title + ' (VF)', url: fullUrl, posterUrl, type: 'anime' }));
            } else if (isVostfr) {
                seenUrls.add(url);
                vostfrItems.push(new MultimediaItem({ title: title + ' (VOSTFR)', url: fullUrl, posterUrl, type: 'anime' }));
            }
            // Items that are neither VF nor VOSTFR remain available for Section 2
        });
        if (vfItems.length > 0) results['Animes VF'] = vfItems;
        if (vostfrItems.length > 0) results['Animes VOSTFR'] = vostfrItems;
        // ── 2. Animes (page-item-detail) ──
        const items = [];
        Array.from(doc.querySelectorAll('#loop-content .page-item-detail, .page-item-detail')).forEach(el => {
            const linkEl = el.querySelector('a');
            const titleEl = el.querySelector('.post-title a, h3 a, h5 a, .title a');
            const imgEl = el.querySelector('img');
            const title = titleEl?.textContent.trim();
            // URL from title element first (same source), then fallback
            let url = titleEl?.getAttribute('href') || linkEl?.getAttribute('href');
            // Validate URL: skip non-anime links (ads, trackers, social, etc.)
            if (!isValidAnimeUrl(url)) url = undefined;
            const posterUrl = fixUrl(imgEl?.getAttribute('data-src') || imgEl?.getAttribute('src') || imgEl?.getAttribute('data-lazy-src'));
            if (title && url && !seenUrls.has(url)) {
                seenUrls.add(url);
                items.push(new MultimediaItem({
                    title, url: url.startsWith('http') ? url : baseUrl + url,
                    posterUrl: posterUrl, type: 'anime'
                }));
            }
        });
        if (items.length > 0) results['Animes'] = items;

        // ── 3. Madara block areas (c-blog__heading with c-blog-listing) ──
        Array.from(doc.querySelectorAll('.c-blog__heading')).forEach(heading => {
            const sectionTitle = heading.textContent.trim();
            if (!sectionTitle || sectionTitle.length < 2 || results[sectionTitle]) return;
            // The structure is: .c-blog__heading → .c-nav-tabs (optional) → .c-blog-listing (items)
            // Try to find .c-blog-listing in siblings
            let container = heading.parentElement?.querySelector('.c-blog-listing');
            if (!container) {
                // Fallback: iterate siblings up to 8 to find the content container
                let sib = heading.nextElementSibling;
                for (let i = 0; i < 8 && sib; i++) {
                    if (sib.classList?.contains('c-blog-listing') || sib.classList?.contains('manga_content') || sib.querySelector('.page-item-detail')) {
                        container = sib;
                        break;
                    }
                    sib = sib.nextElementSibling;
                }
            }
            if (!container) container = heading.closest('.c-blog')?.querySelector('.c-blog-listing');
            if (!container) container = heading.parentElement;
            if (!container) return;
            const blockItems = [];
            Array.from(container.querySelectorAll('.page-item-detail, .c-tabs-item__content, .swiper-slide')).forEach(el => {
                if (blockItems.length >= 20) return;
                const linkEl = el.querySelector('a[href]');
                const titleEl = el.querySelector('.post-title a, h3 a, h4 a, h5 a, .title a');
                const imgEl = el.querySelector('img');
                const title = titleEl?.textContent.trim() || linkEl?.getAttribute('title') || imgEl?.getAttribute('alt');
                let url = titleEl?.getAttribute('href') || linkEl?.getAttribute('href');
                if (!isValidAnimeUrl(url)) url = undefined;
                const posterUrl = fixUrl(imgEl?.getAttribute('data-src') || imgEl?.getAttribute('src') || imgEl?.getAttribute('data-lazy-src'));
                if (title && url && title.length > 2 && !seenUrls.has(url)) {
                    seenUrls.add(url);
                    blockItems.push(new MultimediaItem({
                        title, url: url.startsWith('http') ? url : baseUrl + url,
                        posterUrl, type: 'anime'
                    }));
                }
            });
            if (blockItems.length > 0) results[sectionTitle] = blockItems;
        });

        // ── 4. Fallback: Derniers Ajouts from remaining anime links ──
        if (Object.keys(results).length < 3) {
            const fallbackItems = [];
            Array.from(doc.querySelectorAll('a[href*="/manga/"], a[href*="/series/"], a[href*="/anime/"], a[href*="/anime-"], a[href*="-manga-"]')).forEach(el => {
                if (fallbackItems.length >= 25) return;
                const title = el.textContent.trim();
                const url = el.getAttribute('href');
                if (title && url && title.length > 2 && !seenUrls.has(url)) {
                    const imgEl = el.querySelector('img') || el.parentElement?.querySelector('img') || el.closest('.page-item-detail, .c-tabs-item__content, .post-title, article')?.querySelector('img');
                    const posterUrl = fixUrl(imgEl?.getAttribute('data-src') || imgEl?.getAttribute('src') || imgEl?.getAttribute('data-lazy-src'));
                    seenUrls.add(url);
                    fallbackItems.push(new MultimediaItem({
                        title, url: url.startsWith('http') ? url : baseUrl + url,
                        posterUrl, type: 'anime'
                    }));
                }
            });
            if (fallbackItems.length > 0) results['Derniers Ajouts'] = fallbackItems;
        }

        // ── 5. Content sections by headings (skip if heading is inside a content item) ──
        Array.from(doc.querySelectorAll('h2, h3, h4')).forEach(heading => {
            // Skip if this heading is inside a content item or section heading
            if (heading.closest?.('.page-item-detail, .c-tabs-item__content, .post-title, .item-summary, .c-blog__heading, .c-nav-tabs, .block_area-header, .widget-heading')) return;
            const sectionTitle = heading.textContent.trim();
            if (!sectionTitle || sectionTitle.length < 2 || results[sectionTitle]) return;
            let container = heading.nextElementSibling;
            if (!container) container = heading.parentElement;
            if (!container) return;
            // Skip containers with no actual items (empty divs, navs, etc.)
            const itemCount = container.querySelectorAll('.page-item-detail, .c-tabs-item__content').length;
            if (itemCount < 2) return; // Must have at least 2 items to be a section
            const sectionItems = [];
            Array.from(container.querySelectorAll('.post-title a, h3 a, a[href*="/manga/"], a[href*="/anime/"], .page-item-detail, .c-tabs-item__content')).forEach(el => {
                // If el is a container, extract from inside; if it's a link, use directly
                const linkEl = el.tagName === 'A' ? el : el.querySelector('a[href]');
                const title = linkEl?.textContent.trim() || el.querySelector('img')?.getAttribute('alt');
                let url = linkEl?.getAttribute('href');
                if (!isValidAnimeUrl(url)) url = undefined;
                const imgEl = el.querySelector('img');
                const posterUrl = fixUrl(imgEl?.getAttribute('data-src') || imgEl?.getAttribute('src') || imgEl?.getAttribute('data-lazy-src'));
                if (title && url && title.length > 2 && !seenUrls.has(url)) {
                    seenUrls.add(url);
                    sectionItems.push(new MultimediaItem({
                        title, url: url.startsWith('http') ? url : baseUrl + url,
                        posterUrl: posterUrl, type: 'anime'
                    }));
                }
            });
            if (sectionItems.length >= 2) results[sectionTitle] = sectionItems;
        });

        cb({ success: true, data: results });
    } catch (e) { log('getHome error', e); cb({ success: false, errorCode: 'HOME_ERROR', message: String(e) }); }
}

async function search(query, cb) {
    try {
        const items = [];
        const seenUrls = new Set();

        // ── Helper: parse items from HTML DOM ──
        async function parseSearchHtml(html) {
            if (!html || typeof html !== 'string' || html.length < 200) return [];
            const results = [];
            try {
                const dom = await parseHtml(html);
                // Try Madara-specific selectors first
                const searchSelectors = [
                    '.c-tabs-item__content',
                    '.row.c-tabs-item__content',
                    '.post-title',
                    '.page-item-detail',
                    '.c-tabs-item',
                    '.tab-content .tab-pane',
                    'article',
                    '.search-item'
                ];
                for (const sel of searchSelectors) {
                    if (results.length >= 25) break;
                    Array.from(dom.querySelectorAll(sel)).forEach(el => {
                        if (results.length >= 25) return;
                        const linkEl = el.querySelector('a[href]');
                        const titleEl = el.querySelector('.post-title a, h4 a, h3 a, h5 a, .entry-title a');
                        const imgEl = el.querySelector('img');
                        const title = titleEl?.textContent.trim() || linkEl?.getAttribute('title') || imgEl?.getAttribute('alt');
                        let url = titleEl?.getAttribute('href') || linkEl?.getAttribute('href');
                        // Validate URL: skip non-anime links
                        if (url && !isValidAnimeUrl(url)) url = undefined;
                        if (!title || !url || seenUrls.has(url)) return;
                        seenUrls.add(url);
                        const posterUrl = imgEl?.getAttribute('data-src') || imgEl?.getAttribute('src') || imgEl?.getAttribute('data-lazy-src');
                        results.push({ title, url: url.startsWith('http') ? url : baseUrl + url, posterUrl: fixUrl(posterUrl) });
                    });
                    if (results.length > 0) break;
                }
                // Fallback: generic link patterns in DOM
                if (results.length === 0) {
                    Array.from(dom.querySelectorAll('a[href*="/manga/"], a[href*="/series/"], a[href*="/anime/"], a[href*="/manga-"]')).forEach(el => {
                        if (results.length >= 25) return;
                        const title = el.textContent.trim();
                        const url = el.getAttribute('href');
                        if (title && url && title.length > 2 && !seenUrls.has(url)) {
                            const imgEl = el.querySelector('img') || el.parentElement?.querySelector('img') || el.closest('.page-item-detail, .c-tabs-item__content, .post-title, article')?.querySelector('img');
                            const posterUrl = imgEl?.getAttribute('data-src') || imgEl?.getAttribute('src') || imgEl?.getAttribute('data-lazy-src');
                            seenUrls.add(url);
                            results.push({ title, url: url.startsWith('http') ? url : baseUrl + url, posterUrl: fixUrl(posterUrl) });
                        }
                    });
                }
            } catch (e) { }
            return results;
        }

        // ── Strategy 1: Primary Madara GET search ──
        if (items.length === 0) {
            try {
                const res = await axios.get(`${baseUrl}/?s=${encodeURIComponent(query)}&post_type=wp-manga`, { headers });
                if (res.data && typeof res.data === 'string' && res.data.length > 500) {
                    const parsed = await parseSearchHtml(res.data);
                    for (const p of parsed) items.push(p);
                }
            } catch (e) { }
        }

        // ── Strategy 2: GET without post_type (generic WordPress) ──
        if (items.length === 0) {
            try {
                const res = await axios.get(`${baseUrl}/?s=${encodeURIComponent(query)}`, { headers });
                if (res.data && typeof res.data === 'string' && res.data.length > 500) {
                    const parsed = await parseSearchHtml(res.data);
                    for (const p of parsed) items.push(p);
                }
            } catch (e) { }
        }

        // ── Strategy 3: GET with page and try /search/ endpoint ──
        // Note: admin-ajax.php returns 400 (disabled). We skip it and use GET endpoints.
        if (items.length === 0) {
            const endpoints = [
                `${baseUrl}/search/${encodeURIComponent(query)}/`,
                `${baseUrl}/page-search.html?s=${encodeURIComponent(query)}`
            ];
            for (const endpoint of endpoints) {
                if (items.length > 0) break;
                try {
                    const res = await axios.get(endpoint, { headers });
                    if (res.data && typeof res.data === 'string' && res.data.length > 500) {
                        const parsed = await parseSearchHtml(res.data);
                        for (const p of parsed) items.push(p);
                    }
                } catch (e) { }
            }
        }

        // ── Strategy 4: POST to admin-ajax.php (Madara AJAX search - may return 400) ──
        if (items.length === 0) {
            try {
                const res = await axios.post(`${baseUrl}/wp-admin/admin-ajax.php`, 
                    `action=wp-manga-search&s=${encodeURIComponent(query)}`,
                    { headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' } }
                );
                const data = res.data;
                if (data && typeof data === 'string' && data.length > 200) {
                    const parsed = await parseSearchHtml(data);
                    for (const p of parsed) items.push(p);
                } else if (data?.success && data?.data) {
                    // Handle JSON response from admin-ajax
                    const jsonItems = data.data;
                    if (Array.isArray(jsonItems)) {
                        for (const item of jsonItems) {
                            if (items.length >= 25) break;
                            const title = item.title || '';
                            const url = item.url || item.link || '';
                            const posterUrl = item.thumbnail || item.image || item.poster || '';
                            if (title && url && !seenUrls.has(url)) {
                                seenUrls.add(url);
                                items.push(new MultimediaItem({
                                    title, url: url.startsWith('http') ? url : baseUrl + url,
                                    posterUrl: fixUrl(posterUrl), type: 'anime', playbackPolicy: 'none'
                                }));
                            }
                        }
                    }
                }
            } catch (e) { }
        }

        // Convert to MultimediaItem format
        const results = items.map(i => new MultimediaItem({
            title: i.title,
            url: i.url,
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

const fixUrl = createFixUrl(baseUrl);

function isValidAnimeUrl(url) {
    if (!url) return false;
    // Skip non-content URLs (ads, social, trackers, etc.)
    if (url.includes('#') || url.includes('javascript:') || url.includes('facebook') || url.includes('twitter') ||
        url.includes('google') || url.includes('doubleclick') || url.includes('ads') || url.includes('feed/')) return false;
    // Accept main anime page URLs: /anime/{slug}/
    // Accept episode URLs: /anime/{slug}/{episode-slug}/
    if (url.includes('/anime/')) return true;
    if (url.includes('/manga/')) return true;
    if (url.includes('/series/')) return true;
    // Accept old DLE format: /1234-slug.html
    if (url.match(/\/\d+-[\w-]+\.html/)) return true;
    return false;
}

// Extract episode number from title more reliably
// Prioritizes patterns like "Episode 3", "Épisode 12", "E04" over generic first number
function extractEpisodeNumber(title) {
    if (!title) return undefined;
    const specific = title.match(/(?:Episode|Épisode|Ep|E(?!p))\s*(\d+)/i);
    if (specific) return parseInt(specific[1]);
    const nums = title.match(/\d+/g);
    if (nums && nums.length > 0) {
        return parseInt(nums[nums.length - 1]);
    }
    return undefined;
}

// Determine dubStatus from the page URL (VF or VOSTFR)
function getDubStatusFromPageUrl(pageUrl) {
    if (/\/vf\b|[-_]vf(?!o)/i.test(pageUrl)) return 'dub';
    if (/\/vostfr\b|[-_]vostfr/i.test(pageUrl)) return 'sub';
    return undefined;
}

// Find alternative VF/VOSTFR version from the page HTML
function findAlternativeVersionFromPage(html, currentUrl) {
    const lowerUrl = currentUrl.toLowerCase();
    let currentVersion = null;
    if (/\/vostfr|[-_]vostfr|\bvostfr\b/i.test(lowerUrl)) currentVersion = 'VOSTFR';
    else if (/\/vf|[-_]vf(?!o)|\bvf\b(?!o)/i.test(lowerUrl)) currentVersion = 'VF';
    if (!currentVersion) return { currentVersion: null, alternativeUrl: null };

    const altPath = currentVersion === 'VOSTFR' ? 'vf' : 'vostfr';
    let alternativeUrl = null;

    // Try Madara language switcher — look for <a> or <option> with the opposite language
    const langPatterns = [
        new RegExp('href=["\']([^"\']*' + altPath + '[^"\']*)["\'][^>]*class=["\'][^"\']*(?:flag|lang|switch|change|active)[^"\']*["\']', 'gi'),
        new RegExp('href=["\']([^"\']*(?:ano|autre|other|lang|langue)\/' + altPath + '[^"\']*)["\']', 'gi'),
        new RegExp('value=["\']([^"\']*' + altPath + '[^"\']*)["\']', 'gi'),
    ];
    for (const regex of langPatterns) {
        if (alternativeUrl) break;
        const m = regex.exec(html);
        if (m && m[1] && !m[1].includes(lowerUrl)) {
            alternativeUrl = m[1].startsWith('http') ? m[1] : baseUrl + (m[1].startsWith('/') ? '' : '/') + m[1];
        }
    }

    // Fallback: construct from current URL by replacing vf↔vostfr
    if (!alternativeUrl) {
        if (currentVersion === 'VOSTFR') {
            alternativeUrl = lowerUrl.replace(/vostfr/gi, 'vf');
        } else {
            alternativeUrl = lowerUrl.replace(/\/vf\b/gi, '/vostfr').replace(/-vf(?!o)/gi, '-vostfr');
        }
        if (alternativeUrl === currentUrl) alternativeUrl = null;
    }
    return { currentVersion, alternativeUrl };
}

async function load(url, cb) {
    try {
        const res = await axios.get(url, { headers });
        const html = res.data;
        const doc = await parseHtml(html);
        const title = doc.querySelector('.post-title h1, h1.entry-title, h1')?.textContent.trim() ||
            doc.querySelector('meta[property="og:title"]')?.getAttribute('content') ||
            doc.querySelector('meta[name="twitter:title"]')?.getAttribute('content');
        // Description: try multiple selectors (Madara theme patterns)
        const description = doc.querySelector('.description-summary .summary__content')?.textContent.trim() ||
            doc.querySelector('.entry-content .summary__content')?.textContent.trim() ||
            doc.querySelector('.manga-excerpt')?.textContent.trim() ||
            doc.querySelector('.summary__content')?.textContent.trim() ||
            doc.querySelector('.post-content_item .summary-content')?.textContent.trim() ||
            doc.querySelector('.entry-content p')?.textContent.trim() ||
            doc.querySelector('article p')?.textContent.trim() ||
            doc.querySelector('.description p')?.textContent.trim() ||
            doc.querySelector('.wp-manga .description')?.textContent.trim() ||
            // Meta tags as last resort
            doc.querySelector('meta[name="description"]')?.getAttribute('content') ||
            doc.querySelector('meta[property="og:description"]')?.getAttribute('content');
        // Poster: try multiple selectors with data-src first (lazy-loaded Madara theme)            const posterEl = doc.querySelector('.summary_image img') || doc.querySelector('.post-thumbnail img') ||
            doc.querySelector('.poster img') || doc.querySelector('.wp-post-image') || doc.querySelector('.entry-content img');
        const rawPoster = posterEl?.getAttribute('data-src') || posterEl?.getAttribute('src') || posterEl?.getAttribute('data-lazy-src') ||
            doc.querySelector('meta[property="og:image"]')?.getAttribute('content') ||
            doc.querySelector('meta[name="twitter:image"]')?.getAttribute('content');
        const posterUrl = fixUrl(rawPoster);
        // Extract metadata: year, genres, status
        // Year: extract from multiple sources, prefer specific ones
        let year = undefined;
        // 1. From "Start date" in post-content_item (most reliable - actual anime start year)
        const startDateItem = Array.from(doc.querySelectorAll('.post-content_item')).find(item => {
            const heading = item.querySelector('.summary-heading h5, .summary-heading');
            return heading && /start date|d[eé]but|premi[èe]re|release/i.test(heading.textContent);
        });
        if (startDateItem) {
            const startText = startDateItem.querySelector('.summary-content')?.textContent;
            const startYear = startText?.match(/\b(\d{4})\b/);
            if (startYear) year = parseInt(startYear[1]);
        }
        // 2. From "Année" label
        if (!year || year < 1900 || year > 2030) {
            const anneeMatch = html.match(/Ann[eé]e\s*:?\s*(\d{4})/i);
            if (anneeMatch) year = parseInt(anneeMatch[1]);
        }
        // 3. From JSON-LD datePublished (WordPress publish date, less reliable)
        if (!year || year < 1900 || year > 2030) {
            const jsonLdYear = html.match(/"datePublished"\s*:\s*"(\d{4})/i);
            if (jsonLdYear) year = parseInt(jsonLdYear[1]);
        }
        // 4. Generic first 19xx/20xx (fallback with year filter)
        if (!year || year < 1900 || year > 2030) {
            const genericMatch = html.match(/\b(?:19|20)\d{2}\b/);
            if (genericMatch) year = parseInt(genericMatch[0]);
        }
        // Filter out invalid years
        const displayYear = (year && year >= 1900 && year <= 2030) ? year : undefined;
        const genreEls = Array.from(doc.querySelectorAll('.genres-content a, .wp-manga-genre a, .tag-summary a, .summary-content a[href*="genre"], .wp-manga-tags a, [itemprop="genre"], .manga-category a')).map(el => el.textContent.trim()).filter(Boolean);
        // Status: try multiple selectors then regex fallback
        // Madara stores status in .post-content_item with heading "Status" → .summary-content
        let status = doc.querySelector('.post-content_item .summary-content')?.textContent?.trim()?.toLowerCase();
        // Make sure we got the actual status, not another summary field
        // Check if the parent heading contains "Status" or if the value looks like a status
        if (status && !/termin|complet|fini|ended|finished|cours|airing|ongoing|en cours/i.test(status)) {
            // Try more specific: find post-content_item whose heading says "Status"
            const statusItem = Array.from(doc.querySelectorAll('.post-content_item')).find(item => {
                const heading = item.querySelector('.summary-heading h5, .summary-heading');
                return heading && /status|statut/i.test(heading.textContent);
            });
            status = statusItem?.querySelector('.summary-content')?.textContent?.trim()?.toLowerCase();
        }
        if (!status) {
            status = doc.querySelector('.post-status .summary-content, .post-status .genres-content, .status .summary-content')?.textContent?.trim()?.toLowerCase();
        }
        if (!status) {
            const statusMatch = html.match(/<h5>\s*(?:Statut|Status)\s*<\/h5>[\s\S]*?<div[^>]*class="summary-content"[^>]*>\s*([^<]+)\s*</i) ||
                html.match(/Statut\s*:?\s*<[^>]+>\s*([^<]+)/i) ||
                html.match(/Status\s*:?\s*<[^>]+>\s*([^<]+)/i) ||
                html.match(/\b(En cours|Termin[ée]|Finished|Ongoing|Completed|Airing)\b/i);
            if (statusMatch) status = statusMatch[1]?.trim().toLowerCase() || statusMatch[0].toLowerCase();
        }
        // Normalize status
        if (status) {
            if (/termin|complet|fini|ended|finished/i.test(status)) status = 'completed';
            else if (/cours|airing|ongoing|en cours/i.test(status)) status = 'ongoing';
        }
        // Extract score from multiple Madara selectors
        const scoreEl = doc.querySelector('.score.font-meta.total_votes, .post-total-rating .score, .rating-number, .total_votes, [itemprop="ratingValue"]');
        const rawScore = scoreEl?.textContent ? parseFloat(scoreEl.textContent.replace(/[^\d.]/g, '')) || undefined : undefined;
        // Regex fallback for score in HTML/JSON-LD
        const scoreMatch = !rawScore ? html.match(/"ratingValue"\s*:\s*([\d.]+)/i) || html.match(/<meta[^>]*itemprop="ratingValue"[^>]*content="([\d.]+)"/i) : null;
        const score = rawScore || (scoreMatch ? parseFloat(scoreMatch[1]) : undefined);
        const episodes = [];
        const seenEpUrls = new Set();
        const seenEpTriples = new Set();
        // Detect page-level dubStatus from URL/title
        const pageDubStatus = detectDubStatus(url, title);

        // Madara theme: .wp-manga-chapter or li.chapter-item
        const epSelectors = [
            '.wp-manga-chapter a',
            'li.version-chap a',
            '.listing-chapters_wrap a',
            '.chapter-list a',
            '.wp-manga-chapter li',
            '.chapter-item'
        ];
        for (const sel of epSelectors) {
            if (episodes.length > 0) break;
            doc.querySelectorAll(sel).forEach(el => {
                const linkEl = el.tagName === 'A' ? el : el.querySelector('a');
                const epUrl = linkEl?.getAttribute('href');
                const epTitle = linkEl?.textContent.trim() || el.querySelector('.chapter-name')?.textContent.trim() || el.textContent.trim();
                if (epUrl) {
                    const fullEpUrl = epUrl.startsWith('http') ? epUrl : baseUrl + epUrl;
                    if (seenEpUrls.has(fullEpUrl)) return;
                    seenEpUrls.add(fullEpUrl);
                    // Extract episode number reliably
                    let epNum = extractEpisodeNumber(epTitle);
                    if (epNum === undefined) {
                        epNum = episodes.length + 1; // sequential fallback
                    }
                    // Season and type from title detection
                    const detected = detectSeasonAndType(epTitle);
                    // Dub status from URL and title, fallback to page level
                    let dubSt = detectDubStatus(epUrl, epTitle);
                    if (dubSt === 'none') dubSt = pageDubStatus;
                    // Dedup by (season, episode, dubStatus) to avoid duplicates across VF/VOSTFR sections
                    const tripleKey = `${detected.season || 1}-${epNum}-${dubSt}`;
                    if (seenEpTriples.has(tripleKey)) return;
                    seenEpTriples.add(tripleKey);
                    episodes.push(new Episode({
                        name: epTitle || ('Episode ' + epNum),
                        episode: epNum,
                        url: fullEpUrl,
                        season: detected.season || 1,
                        posterUrl: posterUrl,
                        contentType: detected.contentType,
                        dubStatus: dubSt
                    }));
                }
            });
        }

        // ── Alternative VF/VOSTFR version detection ──
        const { currentVersion, alternativeUrl } = findAlternativeVersionFromPage(html, url);
        if (alternativeUrl && episodes.length > 0) {
            const altDubStatus = currentVersion === 'VF' ? 'sub' : 'dub';
            try {
                const altRes = await axios.get(alternativeUrl, { headers });
                if (altRes.status === 200 && typeof altRes.data === 'string' && altRes.data.length > 500) {
                    const altDoc = await parseHtml(altRes.data);
                    // Parse alternative version's episodes using same selectors
                    for (const sel of epSelectors) {
                        if (episodes.length >= 100) break;
                        altDoc.querySelectorAll(sel).forEach(el => {
                            const linkEl = el.tagName === 'A' ? el : el.querySelector('a');
                            const altEpUrl = linkEl?.getAttribute('href');
                            const altEpTitle = linkEl?.textContent.trim() || el.querySelector('.chapter-name')?.textContent.trim() || el.textContent.trim();
                            if (altEpUrl) {
                                const fullAltEpUrl = altEpUrl.startsWith('http') ? altEpUrl : baseUrl + altEpUrl;
                                if (seenEpUrls.has(fullAltEpUrl)) return;
                                seenEpUrls.add(fullAltEpUrl);
                                let altEpNum = extractEpisodeNumber(altEpTitle);
                                if (altEpNum === undefined) altEpNum = episodes.length + 1;
                                const altDetected = detectSeasonAndType(altEpTitle);
                                const altTripleKey = `${altDetected.season || 1}-${altEpNum}-${altDubStatus}`;
                                if (seenEpTriples.has(altTripleKey)) return;
                                seenEpTriples.add(altTripleKey);
                                episodes.push(new Episode({
                                    name: altEpTitle || ('Episode ' + altEpNum),
                                    episode: altEpNum,
                                    url: fullAltEpUrl,
                                    season: altDetected.season || 1,
                                    posterUrl: posterUrl,
                                    contentType: altDetected.contentType,
                                    dubStatus: altDubStatus
                                }));
                            }
                        });
                    }
                }
            } catch (e) { /* Alternative version not available */ }
        }

        // ── Reverse episodes if in descending order (Madara lists newest first: 13→1) ──
        if (episodes.length > 1) {
            const firstEp = episodes[0].episode;
            const lastEp = episodes[episodes.length - 1].episode;
            if (firstEp > lastEp) {
                episodes.reverse();
            }
        }

        // ── Direct stream URL fallback: try extracting direct video URLs from raw HTML ──
        if (episodes.length === 0) {
            const streamPatterns = [
                // Quoted URLs with video extensions
                /["'](https?:\/\/[^"']+\.(?:mp4|m3u8|mkv|webm)[^"']*)["']/gi,
                // HTML5 <source> tags
                /<source\s+src=["']([^"']+\.(?:mp4|m3u8|mkv|webm)[^"']*)["']/gi,
                // data-src video URLs (WordPress lazy loading)
                /data-src=["']([^"']+\.(?:mp4|m3u8|mkv|webm)[^"']*)["']/gi,
                // JS object file/url/source properties
                /(?:file|url|source)["']?\s*[:=]\s*["']([^"']+\.(?:mp4|m3u8|mkv|webm)[^"']*)["']/gi,
            ];
            const seenStreams = new Set();
            for (const pattern of streamPatterns) {
                if (episodes.length > 0) break;
                let sm;
                while ((sm = pattern.exec(html)) !== null) {
                    if (episodes.length >= 10) break;
                    const streamUrl = sm[1];
                    // Filter out non-video URLs (js, css, analytics, etc.)
                    if (!streamUrl ||
                        streamUrl.includes('.js') || streamUrl.includes('.css') ||
                        streamUrl.includes('analytics') || streamUrl.includes('tracking') ||
                        streamUrl.includes('facebook') || streamUrl.includes('google')) continue;
                    if (seenStreams.has(streamUrl)) continue;
                    seenStreams.add(streamUrl);
                    episodes.push(new Episode({
                        name: title || 'Film',
                        episode: episodes.length + 1,
                        url: streamUrl.startsWith('http') ? streamUrl : baseUrl + streamUrl,
                        season: 1,
                        posterUrl: posterUrl,
                        contentType: 'Film',
                        dubStatus: 'none'
                    }));
                }
            }
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

        // ── Extract recommendations from Madara related/similar section ──
        const recommendations = [];
        const recSeenUrls = new Set();

        // Strategy 1: Specific Madara selectors (primary)
        const recSelectors = [
            '.related .page-item-detail',
            '.c-blog__heading + .row .page-item-detail',
            '.manga-slider .slider__item',
            '.popular-slider .slider__item',
            '.related .c-tabs-item__content',
            '[class*="related"] .page-item-detail',
            '[class*="related"] .c-tabs-item__content',
            '[class*="recommend"] .page-item-detail',
            '[class*="similaire"] .page-item-detail',
            '.widget .page-item-detail',
            '.sidebar .page-item-detail',
            '.post-title a',
            '.c-tabs-item__content'
        ];
        for (const sel of recSelectors) {
            if (recommendations.length >= 20) break;
            doc.querySelectorAll(sel).forEach(el => {
                if (recommendations.length >= 20) return;
                const linkEl = el.querySelector('a[href]');
                const imgEl = el.querySelector('img');
                const titleEl = el.querySelector('.post-title a, h3 a, h5 a, h4 a');
                const recTitle = titleEl?.textContent.trim() || linkEl?.getAttribute('title') || imgEl?.getAttribute('alt') || linkEl?.textContent.trim();
                const recUrl = linkEl?.getAttribute('href');
                if (!recTitle || !recUrl || recUrl.includes('#') || recUrl.includes('javascript:')) return;
                const fullRecUrl = recUrl.startsWith('http') ? recUrl : baseUrl + recUrl;
                if (recSeenUrls.has(fullRecUrl) || fullRecUrl === url) return;
                recSeenUrls.add(fullRecUrl);
                const recPoster = imgEl?.getAttribute('data-src') || imgEl?.getAttribute('src') || imgEl?.getAttribute('data-lazy-src');
                recommendations.push(new MultimediaItem({
                    title: recTitle,
                    url: fullRecUrl,
                    posterUrl: recPoster ? fixUrl(recPoster) : '',
                    type: 'anime'
                }));
            });
            if (recommendations.length > 0) break;
        }

        // ── Strategy 2: Heading-based recommendation sections ──
        if (recommendations.length === 0) {
            const headingKeywords = /recommand|recommend|similaire|related|suggestion|vous aimerez|autre|also like|popular/i;
            doc.querySelectorAll('h2, h3, h4').forEach(heading => {
                if (recommendations.length >= 10) return;
                const headingText = heading.textContent.trim();
                if (!headingKeywords.test(headingText)) return;
                let container = heading.closest('.widget, section, div, .block') || heading.parentElement;
                if (!container) return;
                container.querySelectorAll('.page-item-detail, .c-tabs-item__content, .post-title, a[href*="/anime/"], a[href*="/manga/"]').forEach(el => {
                    if (recommendations.length >= 10) return;
                    const imgEl = el.querySelector('img');
                    const titleEl = el.querySelector('.post-title a, h3 a, h4 a, h5 a') || el;
                    const linkEl = el.tagName === 'A' ? el : el.querySelector('a[href]');
                    const recTitle = titleEl?.textContent?.trim() || linkEl?.textContent?.trim() || imgEl?.getAttribute('alt');
                    const recUrl = linkEl?.getAttribute('href');
                    if (!recTitle || !recUrl || recUrl.includes('#')) return;
                    const fullRecUrl = recUrl.startsWith('http') ? recUrl : baseUrl + recUrl;
                    if (recSeenUrls.has(fullRecUrl) || fullRecUrl === url) return;
                    recSeenUrls.add(fullRecUrl);
                    const recPoster = imgEl?.getAttribute('data-src') || imgEl?.getAttribute('src') || imgEl?.getAttribute('data-lazy-src');
                    recommendations.push(new MultimediaItem({ title: recTitle, url: fullRecUrl, posterUrl: recPoster ? fixUrl(recPoster) : '', type: 'anime' }));
                });
            });
        }

        // ── Strategy 3: Genre-based recommendations using search ──
        if (recommendations.length === 0 && genreEls && genreEls.length > 0 && title) {
            try {
                const searchRes = await new Promise(resolve => search(genreEls[0], resolve));
                if (searchRes.success && searchRes.data) {
                    for (const item of searchRes.data) {
                        if (recommendations.length >= 10) break;
                        if (recSeenUrls.has(item.url)) continue;
                        recSeenUrls.add(item.url);
                        if (item.title === title) continue;
                        recommendations.push(item);
                    }
                }
            } catch (e) { /* Genre search failed */ }
        }

        cb({ success: true, data: new MultimediaItem({ type: "anime", title, description, posterUrl, episodes, year: displayYear, score, status, genres: genreEls.length > 0 ? genreEls : undefined, recommendations: recommendations.length > 0 ? recommendations : undefined }) });
    } catch (e) { log('load error: ' + url, e); cb({ success: false, errorCode: 'LOAD_ERROR', message: String(e) }); }
}

async function loadStreams(url, cb) {
    try {
        const res = await axios.get(url, { headers });
        const html = res.data;
        const streams = [];
        const seenStreamUrls = new Set();

        // ── Helper: decode HTML entities in URLs ──
        function decodeHtmlEntities(str) {
            return str.replace(/&amp;/g, '&').replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#034;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
        }

        // ── Helper: add stream result with deduplication ──
        async function tryAddStream(playerUrl, label) {
            if (!playerUrl) return;
            playerUrl = decodeHtmlEntities(playerUrl);
            // Fix protocol-relative URLs
            if (playerUrl.startsWith('//')) playerUrl = 'https:' + playerUrl;
            // Dedup
            if (seenStreamUrls.has(playerUrl)) return;
            seenStreamUrls.add(playerUrl);
            try {
                const streamRes = await Extractors.resolveStream(playerUrl);
                if (streamRes) {
                    streamRes.quality = label;
                    streams.push(streamRes);
                }
            } catch (e) { log('Stream resolve failed: ' + playerUrl, e); }
        }

        // ── Strategy 1: Iframe extraction with trembed/tremor support ──
        // Collect all iframes from HTML <iframe> tags + thisChapterSources JS variable
        const iframeRegex = /<iframe[^>]*src=["']([^"']+)["'][^>]*>/gi;
        const embedUrls = [];
        let iframeMatch;
        while ((iframeMatch = iframeRegex.exec(html)) !== null) {
            const embedUrl = iframeMatch[1];
            if (embedUrl && !embedUrl.includes('ads') && !embedUrl.includes('google') && !embedUrl.includes('facebook') && !embedUrl.includes('doubleclick')) {
                embedUrls.push(embedUrl);
            }
        }
        // Also parse thisChapterSources/theChapterSources for ALL player options (hidden in JS object)
        // These contain up to 5 players (vidmoly, voe, streamtape, etc.) of which only 1 is visible
        const chapterSourcesMatch = html.match(/(?:var|let|const|window\.)?\s*(?:thisChapterSources|theChapterSources)\s*=\s*(\{[\s\S]*?\});?/i);
        if (chapterSourcesMatch) {
            try {
                // Unescape JSON: replace \\/ with / and extract all iframe src URLs
                const sourcesStr = chapterSourcesMatch[1].replace(/\\\//g, '/').replace(/\\"/g, '"');
                const sourceIframeRegex = /<iframe[^>]*src=["']([^"']+)["'][^>]*>/gi;
                let srcMatch;
                while ((srcMatch = sourceIframeRegex.exec(sourcesStr)) !== null) {
                    const extraUrl = srcMatch[1];
                    if (extraUrl && !embedUrls.includes(extraUrl) && !extraUrl.includes('ads') && !extraUrl.includes('google')) {
                        embedUrls.push(extraUrl);
                        log('Found extra player: ' + extraUrl);
                    }
                }
            } catch (e) { log('Failed to parse chapter sources', e); }
        }
        // Resolve all embed URLs in parallel for speed
        if (embedUrls.length > 0) {
            const results = await Promise.all(embedUrls.map(async (embedUrl) => {
                try {
                    // trembed/tremor URLs need to be fetched first to resolve the actual player iframe
                    if (embedUrl.includes('trembed=') || embedUrl.includes('tremor=')) {
                        const trembedRes = await axios.get(embedUrl, { headers });
                        const trembedHtml = trembedRes.data;
                        // Extract inner iframe from trembed response
                        const innerIframe = trembedHtml.match(/<iframe[^>]*src=["']([^"']+)["'][^>]*>/i);
                        if (innerIframe && innerIframe[1]) {
                            return await Extractors.resolveStream(innerIframe[1]);
                        }
                        // Fallback: find direct video URL in trembed response
                        const videoFile = trembedHtml.match(/file["']?\s*:\s*["']?([^"'\s]+(?:m3u8|mp4)[^"'\s]*)["']?/i);
                        if (videoFile) {
                            let vUrl = videoFile[1];
                            if (vUrl.startsWith('//')) vUrl = 'https:' + vUrl;
                            else if (!vUrl.startsWith('http')) {
                                try {
                                    const origin = embedUrl.match(/^https?:\/\/[^\/]+/)[0];
                                    vUrl = origin + (vUrl.startsWith('/') ? '' : '/') + vUrl;
                                } catch (e) {
                                    vUrl = 'https:' + (vUrl.startsWith('/') ? '' : '/') + vUrl;
                                }
                            }
                            return new StreamResult({ url: "MAGIC_PROXY_v1" + encodeBase64(vUrl), quality: 'Auto', source: 'Trembed', headers: { 'Referer': embedUrl } });
                        }
                    } else {
                        return await Extractors.resolveStream(embedUrl);
                    }
                } catch (e) { return null; }
                return null;
            }));
            results.forEach(r => { if (r && !seenStreamUrls.has(r.url)) { seenStreamUrls.add(r.url); streams.push(r); } });
        }

        // ── Strategy 2: Lazyload data-src attributes (trembed, player URLs) ──
        if (streams.length === 0) {
            const lazyRegex = /data-src=["']([^"']+(?:trembed|tremor|player|embed)[^"']*)["']/gi;
            const lazyUrls = [];
            let lMatch;
            while ((lMatch = lazyRegex.exec(html)) !== null) {
                if (lMatch[1]) lazyUrls.push(lMatch[1]);
            }
            if (lazyUrls.length > 0) {
                const results = await Promise.all(lazyUrls.map(async (lazyUrl) => {
                    try {
                        const fullUrl = lazyUrl.startsWith('http') ? lazyUrl : baseUrl + (lazyUrl.startsWith('/') ? '' : '/') + lazyUrl;
                        if (lazyUrl.includes('trembed=') || lazyUrl.includes('tremor=')) {
                            const trembedRes = await axios.get(fullUrl, { headers });
                            const trembedHtml = trembedRes.data;
                            const innerIframe = trembedHtml.match(/<iframe[^>]*src=["']([^"']+)["'][^>]*>/i);
                            if (innerIframe && innerIframe[1]) {
                                return await Extractors.resolveStream(innerIframe[1]);
                            }
                        } else {
                            return await Extractors.resolveStream(fullUrl);
                        }
                    } catch (e) { return null; }
                    return null;
                }));
                results.forEach(r => { if (r && !seenStreamUrls.has(r.url)) { seenStreamUrls.add(r.url); streams.push(r); } });
            }
        }

        // ── Strategy 3: Direct video URLs in script tags ──
        if (streams.length === 0) {
            const videoRegexes = [
                // file|url|source|src = "https://...mp4|m3u8"
                /(?:file|url|source|src)["']?\s*[:=]\s*["'](https?:\/\/[^"'\s]+\.(?:mp4|m3u8|mkv|webm)[^"'\s]*)["']/gi,
                // Direct <source> tags
                /<source\s+src=["']([^"']+\.(?:mp4|m3u8|mkv|webm)[^"']*)["']/gi,
                // #EXTINF pattern from HLS playlists
                /#EXTINF[^,]*,[^\n]*\n(https?:\/\/[^\s]+)/gi,
                // Simple file: pattern (common in WordPress video embedders)
                /["']file["']?\s*[:=]\s*["'](https?:\/\/[^"']+)["']/gi
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

        // ── Strategy 4: WordPress video shortcode embeds [video] and wp-playlist ──
        if (streams.length === 0) {
            // WordPress [video src="..."] shortcode
            const wpVideo = html.match(/\[video[^\]]*src=["']([^"']+)["'][^\]]*\]/i);
            if (wpVideo && wpVideo[1]) {
                await tryAddStream(wpVideo[1], 'Video');
            }
            // WordPress wp-playlist items
            const playlistRegex = /src="(https?:\/\/[^"]+\.(?:mp4|m3u8)[^"]*)"[^>]*\bitem\b/gi;
            let plMatch;
            while ((plMatch = playlistRegex.exec(html)) !== null) {
                if (streams.length >= 5) break;
                await tryAddStream(plMatch[1], 'Playlist');
            }
        }

        // ── Strategy 5: MAGIC_PROXY_v1 fallback — page is SSR with dynamic JS-loaded video ──
        // The episode page HTML contains NO iframes or video elements (loaded dynamically by Madara JS).
        // MAGIC_PROXY_v1 lets SkyStream execute the page JS and intercept XHR/Fetch calls
        // to admin-ajax.php (e.g. manga_get_chapter), capturing the response HTML with iframes.
        if (streams.length === 0) {
            const proxyUrl = "MAGIC_PROXY_v1" + encodeBase64(url);
            streams.push(new StreamResult({
                url: proxyUrl,
                quality: 'Auto',
                source: 'VoirAnime',
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
