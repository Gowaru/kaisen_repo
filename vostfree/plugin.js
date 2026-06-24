// @ts-nocheck
import { MixDrop, StreamTape, Voe, Filemoon, DoodExtractor, HubCloud } from 'skystream-extractors/dist/index.js';
import { getPlayerUrl, encodeBase64, createFixUrl, detectDubStatus } from '../shared.js';

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

        // ── 1. Hero slider (swiper, slider-poster, featured sections) ──
        const heroItems = [];
        const heroSelectors = [
            // Swiper slides first (as requested)
            '.swiper-slide',
            // DLE slider-poster (existing)
            '.slider-poster',
            // DLE carousel/hero patterns
            '.carou-hero .item',
            '.deslide-wrap .deslide-item',
            '.block_area_hero .mov.clearfix, .block_area_hero .mov',
            // Generic featured/hero containers
            '[class*="slider"] [class*="item"], [class*="hero"] [class*="item"]',
            '.featured-item, .hero-item',
            '.slide-item',
            // Fallback: any large featured image
            '.main-featured .item',
        ];

        function extractHeroItem(el) {
            const linkEl = el.querySelector('a[href]');
            const imgEl = el.querySelector('img');
            const titleEl = el.querySelector('.title, .title1, .title0, .alt, .slider-title, h3, h4, .info a, .slide-info a');
            const title = titleEl?.textContent.trim() || imgEl?.getAttribute('alt') || linkEl?.getAttribute('title') || '';
            let url = linkEl?.getAttribute('href');
            // DLE format: /{ID}-{slug}.html — only accept this format for DLE sites
            if (url && !url.match(/\/\d+-[\w-]+\.html/)) url = undefined;
            const posterUrl = imgEl?.getAttribute('data-src') || imgEl?.getAttribute('src');
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
                        title,
                        url: url.startsWith('http') ? url : baseUrl + url,
                        posterUrl: fixUrl(posterUrl),
                        type: 'anime'
                    }));
                }
            });
        }
        if (heroItems.length > 0) results['À la Une'] = heroItems;

        // ── 2. Nouvelles Séries (new-series-slider) ──
        const newSeries = [];
        Array.from(doc.querySelectorAll('#new-series-slider-content li, .new-series-slider li')).forEach(el => {
            const linkEl = el.querySelector('a');
            const imgEl = el.querySelector('img');
            const titleEl = el.querySelector('.alt, .title, .slider-title');
            const title = titleEl?.textContent.trim() || imgEl?.getAttribute('alt') || linkEl?.getAttribute('title');
            let url = linkEl?.getAttribute('href');
            // DLE format: /{ID}-{slug}.html — only accept this format for DLE sites
            if (url && !url.match(/\/\d+-[\w-]+\.html/)) url = undefined;
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
            // URL from title link first (same element as title), then fallback
            let url = el.querySelector('.title a, .info a')?.getAttribute('href') || linkEl?.getAttribute('href');
            // DLE format: /{ID}-{slug}.html — only accept this format for DLE sites
            if (url && !url.match(/\/\d+-[\w-]+\.html/)) url = undefined;
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
            let url = linkEl?.getAttribute('href');
            // DLE format: /{ID}-{slug}.html — only accept this format for DLE sites
            if (url && !url.match(/\/\d+-[\w-]+\.html/)) url = undefined;
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
                let url = el.getAttribute('href');
                // Validate URL: skip non-anime links (el IS the link, so URL and title are from same element)
                if (url && !url.match(/\/\d+-[\w-]+\.html/) && !url.includes('/anime-') && !url.includes('/manga/') && !url.includes('/series/') && !url.includes('-vostfr') && !url.includes('-vf')) url = undefined;
                const imgEl = el.querySelector('img');
                const posterUrl = imgEl?.getAttribute('data-src') || imgEl?.getAttribute('src');
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

// Find alternative VF/VOSTFR version using DLE ID pairing (VF=even ID, VOSTFR=odd ID)
function findAlternativeVostfreeUrl(url) {
    const match = url.match(/\/(\d+)-/);
    if (!match) return null;
    const id = parseInt(match[1]);
    if (id <= 0) return null;
    // VF IDs are even, VOSTFR IDs are odd (VF=1346, VOSTFR=1347)
    const isVf = id % 2 === 0;
    const altId = isVf ? id + 1 : id - 1;
    if (altId <= 0) return null;
    const altUrl = url.replace(`/${id}-`, `/${altId}-`);
    if (altUrl === url) return null;
    return { altUrl, currentIsVf: isVf, altId };
}

// Find alternative VF/VOSTFR version from the page HTML (pattern complet)
// Détecte la version actuelle depuis l'URL, cherche des liens dans le HTML,
// et fallback sur le DLE ID pairing
function findAlternativeVersionFromPage(html, currentUrl) {
    const lowerUrl = currentUrl.toLowerCase();
    let currentVersion = null;

    // 1. Detect current version from URL
    if (/\/vostfr|[-_]vostfr|\bvostfr\b/i.test(lowerUrl)) currentVersion = 'VOSTFR';
    else if (/[-_]vf(?!o)|\bvf\b(?!o)/i.test(lowerUrl)) currentVersion = 'VF';

    // If not detected from URL, use DLE ID pairing
    if (!currentVersion) {
        const idMatch = currentUrl.match(/\/(\d+)-/);
        if (!idMatch) return { currentVersion: null, alternativeUrl: null };
        const id = parseInt(idMatch[1]);
        currentVersion = id % 2 === 0 ? 'VF' : 'VOSTFR';
    }

    const altPath = currentVersion === 'VOSTFR' ? 'vf' : 'vostfr';
    let alternativeUrl = null;

    // 2. Try to find language switcher links in HTML
    // DLE sites often have language toggles in <a> tags or <select> options
    const langPatterns = [
        // <a href="..."> with class containing flag/lang/switch/change
        new RegExp('href=["\']([^"\']*' + altPath + '[^"\']*)["\'][^>]*class=["\'][^"\']*(?:flag|lang|switch|change|active|version)[^"\']*["\']', 'gi'),
        // <a href="..."> with text containing VF/VOSTFR
        new RegExp('<a[^>]+href=["\']([^"\']+(?:' + altPath + ')[^"\']*)["\'][^>]*>[^<]*' + (currentVersion === 'VOSTFR' ? 'VF' : 'VOSTFR') + '[^<]*<\/a>', 'gi'),
        // <option value="..."> containing the opposite language
        new RegExp('value=["\']([^"\']*' + altPath + '[^"\']*)["\']', 'gi'),
    ];
    for (const regex of langPatterns) {
        if (alternativeUrl) break;
        const m = regex.exec(html);
        if (m && m[1]) {
            const foundUrl = m[1].startsWith('http') ? m[1] : baseUrl + (m[1].startsWith('/') ? '' : '/') + m[1];
            if (foundUrl !== currentUrl) {
                alternativeUrl = foundUrl;
            }
        }
    }

    // 3. Fallback: DLE ID pairing (even=VF, odd=VOSTFR)
    if (!alternativeUrl) {
        const altInfo = findAlternativeVostfreeUrl(currentUrl);
        if (altInfo && altInfo.altUrl !== currentUrl) {
            alternativeUrl = altInfo.altUrl;
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
            // Return first candidate
            return candidates[0];
        }
    } catch (e) { log('Sitemap fetch failed', e); }
    return null;
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

        // ── Strategy 1: Extract episodes from <option> elements ──
        // DLE options can contain URLs (/NNN-episode-N.html) or button IDs (buttons_N)
        // buttons_N → content_player_N div → video ID/hash/URL
        function parseOptions(htmlContent, domDoc) {
            const results = [];
            const seenUrls = new Set();
            // Pattern 1: URL-type options (value contains .html or /episode)
            const urlOptRegex = /<option[^>]*value=["']([^"']+(?:\.html|\/[^"']*episode[^"']*))["'][^>]*>([^<]+)<\/option>/gi;
            let m;
            while ((m = urlOptRegex.exec(htmlContent)) !== null) {
                const epUrl = m[1];
                const epName = m[2].trim();
                if (epUrl && epName && !seenUrls.has(epUrl)) {
                    seenUrls.add(epUrl);
                    const detected = detectSeasonAndType(epName);
                    results.push(new Episode({
                        name: epName,
                        episode: parseInt(epName.match(/\d+/)?.[0] || results.length + 1),
                        url: epUrl.startsWith('http') ? epUrl : baseUrl + epUrl,
                        season: detected.season,
                        posterUrl: posterUrl,
                        contentType: detected.contentType,
                        dubStatus: detectDubStatus(epUrl, epName)
                    }));
                }
            }
            // Pattern 2: Button-type options (value="buttons_N")
            if (results.length === 0) {
                const btnOptRegex = /<option[^>]*value=["']buttons_(\d+)["'][^>]*>([^<]+)<\/option>/gi;
                while ((m = btnOptRegex.exec(htmlContent)) !== null) {
                    const btnNum = m[1];
                    const epName = m[2].trim();
                    if (!epName) continue;
                    // Find the corresponding content_player_N div
                    const cpEl = (domDoc || doc).querySelector(`[id="content_player_${btnNum}"]`);
                    if (cpEl) {
                        const playerContent = cpEl.textContent.trim();
                        const playerUrl = getPlayerUrl(playerContent, btnNum);
                        if (playerUrl && !seenUrls.has(playerUrl)) {
                            seenUrls.add(playerUrl);
                            const detected = detectSeasonAndType(epName);
                            results.push(new Episode({
                                name: epName,
                                episode: parseInt(epName.match(/\d+/)?.[0] || results.length + 1),
                                url: playerUrl,
                                season: detected.season,
                                posterUrl: posterUrl,
                                contentType: detected.contentType,
                                dubStatus: detectDubStatus(url, epName)
                            }));
                        }
                    }
                }
            }
            return results;
        }
        const optionEpisodes = parseOptions(html, doc);
        episodes.push(...optionEpisodes);

        // ── Strategy 2: Try link patterns (fallback) ──
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

        // ── Strategy 3: Sitemap fallback ──
        // If no episodes found, try to find alternative anime URL from sitemap.xml
        if (episodes.length === 0) {
            try {
                const altUrl = await fetchSitemapFallback(url);
                if (altUrl && altUrl !== url) {
                    log('Sitemap fallback: trying ' + altUrl);
                    const altRes = await axios.get(altUrl, { headers });
                    if (altRes.status === 200 && typeof altRes.data === 'string' && altRes.data.length > 500) {
                        const altHtml = altRes.data;
                        const altDoc = await parseHtml(altHtml);
                        const altEps = await parseOptions(altHtml, altDoc);
                        if (altEps.length > 0) {
                            episodes.push(...altEps);
                            log(`Sitemap fallback found ${altEps.length} episodes from ${altUrl}`);
                        }
                    }
                }
            } catch (e) { log('Sitemap fallback failed', e); }
        }

        // ── Strategy 4: Film fallback (content_player divs direct) ──
        if (episodes.length === 0) {
            for (const el of doc.querySelectorAll('[id^="content_player_"]')) {
                const num = el.id.replace('content_player_', '');
                const vid = el.textContent.trim();
                const playerUrl = getPlayerUrl(vid, num);
                if (playerUrl) {
                    episodes.push(new Episode({
                        name: title || 'Film',
                        episode: 1,
                        url: playerUrl,
                        season: 1,
                        posterUrl: posterUrl,
                        dubStatus: detectDubStatus(url, title)
                    }));
                    break;
                }
            }
            // MAGIC_PROXY_v1 ultimate fallback
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
                log('MAGIC_PROXY_v1 fallback for: ' + url);
            }
        }

        // ── Alternative VF/VOSTFR version via findAlternativeVersionFromPage ──
        // Detecte la version alternative depuis le HTML (patterns de langue) ou via DLE ID pairing
        const { currentVersion, alternativeUrl } = findAlternativeVersionFromPage(html, url);
        if (alternativeUrl && alternativeUrl !== url) {
            const altDubStatus = currentVersion === 'VF' ? 'sub' : 'dub';
            if (altDubStatus !== 'none') {
                try {
                    const altRes = await axios.get(alternativeUrl, { headers });
                    if (altRes.status === 200 && typeof altRes.data === 'string' && altRes.data.length > 500) {
                        const altHtml = altRes.data;
                        const seenEpUrls = new Set(episodes.map(e => e.url));
                        let altEpCount = 0;
                        // Parse <option> elements from alternative page (same DLE format)
                        const altEpRegex = /<option value=["']([^"']+)["'][^>]*>(.*?)<\/option>/gi;
                        let altMatch;
                        while ((altMatch = altEpRegex.exec(altHtml)) !== null) {
                            const epUrl = altMatch[1];
                            const epName = altMatch[2].trim();
                            if (epUrl && epName && (epUrl.startsWith('http') || epUrl.startsWith('/') || epUrl.includes('.html'))) {
                                const fullEpUrl = epUrl.startsWith('http') ? epUrl : baseUrl + epUrl;
                                if (!seenEpUrls.has(fullEpUrl)) {
                                    seenEpUrls.add(fullEpUrl);
                                    const detected = detectSeasonAndType(epName);
                                    episodes.push(new Episode({
                                        name: epName + (altDubStatus === 'dub' ? ' (VF)' : ' (VOSTFR)'),
                                        episode: parseInt(epName.match(/\d+/)?.[0] || episodes.length + 1),
                                        url: fullEpUrl,
                                        season: detected.season,
                                        posterUrl: posterUrl,
                                        contentType: detected.contentType,
                                        dubStatus: altDubStatus
                                    }));
                                    altEpCount++;
                                }
                            }
                        }
                        if (altEpCount > 0) {
                            log(`Alternative version loaded: ${alternativeUrl} (${altEpCount} episodes)`);
                        }
                    }
                } catch (e) { log('Alternative version not available: ' + alternativeUrl, e); }
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

        // ── Strategy 2: Heading-based recommendation sections (fallback) ──
        if (recommendations.length === 0) {
            const recSeen = new Set();
            const headingKeywords = /recommand|recommend|similaire|related|suggestion|vous aimerez|autre|also like|popular|tendance|top|similaires?|du m[êe]me genre|semblable|apparent[eé]?/i;
            doc.querySelectorAll('h2, h3, h4').forEach(heading => {
                if (recommendations.length >= 15) return;
                const headingText = heading.textContent.trim();
                if (!headingText || !headingKeywords.test(headingText)) return;
                let container = heading.nextElementSibling;
                if (!container) container = heading.parentElement;
                if (!container) return;
                // Try DLE-specific item selectors
                const itemSelectors = [
                    '.slider-poster',
                    '.movie-small li, .movie-small a',
                    '.top-vostfr',
                    '.short-item',
                    '.news-item',
                    'li a[href*=".html"]',
                    'a[href]',
                ];
                let found = false;
                for (const sel of itemSelectors) {
                    if (recommendations.length >= 15) break;
                    const items = container.querySelectorAll(sel);
                    if (items.length === 0) continue;
                    items.forEach(el => {
                        if (recommendations.length >= 15) return;
                        const linkEl = el.querySelector ? el.querySelector('a[href]') : (el.tagName === 'A' ? el : null);
                        const imgEl = el.querySelector ? el.querySelector('img') : null;
                        const title = el.querySelector('.title, .alt, .slider-title, .info a, h3, h4')?.textContent.trim() ||
                            imgEl?.getAttribute('alt') ||
                            linkEl?.getAttribute('title') ||
                            (linkEl?.textContent ? linkEl.textContent.trim() : '');
                        let url = linkEl?.getAttribute('href');
                        // DLE format: /{ID}-{slug}.html
                        if (url && !url.match(/\/\d+-[\w-]+\.html/)) url = undefined;
                        const posterUrl = imgEl?.getAttribute('data-src') || imgEl?.getAttribute('src');
                        if (title && url && title.length > 1 && !url.includes('#') && !recSeen.has(url)) {
                            recSeen.add(url);
                            recommendations.push(new MultimediaItem({
                                title,
                                url: url.startsWith('http') ? url : baseUrl + url,
                                posterUrl: posterUrl ? fixUrl(posterUrl) : '',
                                type: 'anime'
                            }));
                            found = true;
                        }
                    });
                    if (found) break;
                }
            });
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
        // Fallback: content_player_X divs via getPlayerUrl (centralized host patterns)
        if (streams.length === 0) {
            const cpRegex = /id=["']content_player_(\d+)["'][^>]*>([^<]*)</gi;
            let cpMatch;
            while ((cpMatch = cpRegex.exec(html)) !== null) {
                const num = cpMatch[1];
                const vid = cpMatch[2].trim();
                if (vid) {
                    const hostUrl = getPlayerUrl(vid, num);
                    if (hostUrl) {
                        const streamRes = await Extractors.resolveStream(hostUrl);
                        if (streamRes) { streams.push(streamRes); break; }
                    }
                }
            }
        }

        // ── MAGIC_PROXY_v1 fallback: no iframes or video found → let SkyStream execute JS ──
        if (streams.length === 0) {
            const proxyUrl = "MAGIC_PROXY_v1" + encodeBase64(url);
            streams.push(new StreamResult({
                url: proxyUrl,
                quality: 'Auto',
                source: 'Vostfree',
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
