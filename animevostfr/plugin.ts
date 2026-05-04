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

const baseUrl = 'https://animevostfr.tv';
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
        } catch (e) { }

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
            } catch (e) { }
        }

        if (url.includes('sendvid.com')) {
            try {
                const res = await axios.get(url);
                const match = res.data.match(/<source\s+src=["']([^"']+\.mp4)["']/i) || res.data.match(/video_source\s*=\s*["']([^"']+)["']/i);
                if (match) return new StreamResult({ url: match[1], quality: 'Auto', source: 'Sendvid' });
            } catch (e) { }
        }

        if (url.includes('vidmoly')) {
            return new StreamResult({ url: "MAGIC_PROXY_v1" + encodeBase64(url), quality: 'Auto', source: 'Vidmoly (Proxy)', headers: { Referer: 'https://vidmoly.to/' } });
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
        const queryAll = (d, s) => Array.from(d.querySelectorAll(s));

        queryAll(doc, '.block_area').forEach(block => {
            const titleEl = block.querySelector('.cat-heading') || block.querySelector('h2');
            const sectionTitle = titleEl ? titleEl.textContent.trim() : null;
            if (!sectionTitle || sectionTitle.includes('Calendrier')) return;
            let items = [];
            queryAll(block, '.film_list-wrap .flw-item').forEach(el => {
                const linkEl = el.querySelector('.film-name a') || el.querySelector('a');
                const imgEl = el.querySelector('img');
                const epEl = el.querySelector('.tick-eps');
                const title = linkEl?.textContent.trim();
                const url = linkEl?.getAttribute('href');
                const posterUrl = imgEl?.getAttribute('data-src') || imgEl?.getAttribute('src');
                const ep = epEl?.textContent.trim();
                if (title && url) {
                    items.push({
                        title: title + (ep ? ' - ' + ep : ''),
                        url: url.startsWith('http') ? url : baseUrl + url,
                        posterUrl: (function(p){ if(!p) return ''; if(p.startsWith('http')) return p; return baseUrl + (p.startsWith('/') ? '' : '/') + p; })(posterUrl),
                        type: 'anime', playbackPolicy: 'none'
                    });
                }
            });
            if (items.length > 0 && !results[sectionTitle]) results[sectionTitle] = items;
        });
        cb({ success: true, data: results });
    } catch (e) { cb({ success: false }); }
}

async function search(query, cb) {
    try {
        const res = await axios.get(`${baseUrl}/?s=${encodeURIComponent(query)}`, { headers });
        const doc = await parseHtml(res.data);
        const items = [];
        Array.from(doc.querySelectorAll('.film_list-wrap .flw-item')).forEach(el => {
            const linkEl = el.querySelector('.film-name a') || el.querySelector('a');
            const imgEl = el.querySelector('img');
            const title = linkEl?.textContent.trim();
            const url = linkEl?.getAttribute('href');
            const posterUrl = imgEl?.getAttribute('data-src') || imgEl?.getAttribute('src');
            if (title && url) {
                items.push({
                    title,
                    url: url.startsWith('http') ? url : baseUrl + url,
                    posterUrl: (function(p){ if(!p) return ''; if(p.startsWith('http')) return p; return baseUrl + (p.startsWith('/') ? '' : '/') + p; })(posterUrl),
                    type: 'anime', playbackPolicy: 'none'
                });
            }
        });
        cb({ success: true, data: items });
    } catch (e) { cb({ success: false }); }
}

async function load(url, cb) {
    try {
        const res = await axios.get(url, { headers });
        const html = res.data;
        const doc = await parseHtml(html);
        const title = doc.querySelector('.film-name')?.textContent.trim();
        const description = doc.querySelector('.description')?.textContent.trim();
        const posterUrl = doc.querySelector('.film-poster-img')?.getAttribute('src');
        const episodes = [];
        const episodeList = doc.querySelectorAll('.ep-item');
        episodeList.forEach((el, index) => {
            const epUrl = el.getAttribute('href');
            const epNum = el.getAttribute('data-number') || (index + 1);
            const epTitle = el.getAttribute('title');
            if (epUrl) {
                episodes.push(new Episode({
                    name: epTitle || ('Episode ' + epNum),
                    episode: parseInt(epNum),
                    url: epUrl.startsWith('http') ? epUrl : baseUrl + epUrl,
                    season: 1,
                    posterUrl: posterUrl
                }));
            }
        });
        cb({ success: true, data: new MultimediaItem({ type: "anime", title, description, posterUrl, episodes }) });
    } catch (e) { cb({ success: false }); }
}

async function loadStreams(url, cb) {
    try {
        const res = await axios.get(url, { headers });
        const html = res.data;
        const streams = [];
        const serverRegex = /<div class="item server-item" [^>]*data-embed="([^"]*)"[^>]*>.*?<a[^>]*>(.*?)<\/a>/gi;
        let match;
        while ((match = serverRegex.exec(html)) !== null) {
            const embedUrl = match[1];
            const serverName = match[2].trim();
            if (embedUrl) {
                const streamRes = await Extractors.resolveStream(embedUrl);
                if (streamRes) {
                    streamRes.quality = serverName;
                    streams.push(streamRes);
                }
            }
        }
        cb({ success: true, data: streams });
    } catch (e) { cb({ success: false }); }
}

globalThis.getHome = getHome;
globalThis.search = search;
globalThis.load = load;
globalThis.loadStreams = loadStreams;
