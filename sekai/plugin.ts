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
            const r = await http_get(url, h);
            let parsed = r.body;
            try { parsed = JSON.parse(r.body); } catch (e) { }
            return { data: parsed, status: r.status };
        }
        return { data: "" };
    },
    post: async (url, data, config = {}) => {
        const h = config.headers || {};
        if (typeof http_post !== 'undefined') {
            const r = await http_post(url, h, data);
            let parsed = r.body;
            try { parsed = JSON.parse(r.body); } catch (e) { }
            return { data: parsed, status: r.status };
        }
        return { data: "" };
    }
};

const baseUrl = typeof manifest !== 'undefined' ? manifest.baseUrl : 'https://sekai.fr';
const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
    'Referer': baseUrl,
    'Origin': baseUrl
};

async function getHome(cb) {
    try {
        const res = await axios.get(baseUrl + '/?v=15', { headers });
        const html = res.data;
        const doc = await parseHtml(html);
        const items = [];

        const slides = Array.from(doc.querySelectorAll('.swiper-slide'));
        slides.forEach(slide => {
            const link = slide.querySelector('a');
            if (!link) return;
            const href = link.getAttribute('href');
            const titleEl = slide.querySelector('.series-name');
            const title = titleEl ? titleEl.textContent.trim() : (link.getAttribute('title') || link.textContent.trim());
            const imgEl = slide.querySelector('img');
            const posterUrl = imgEl ? (imgEl.getAttribute('src') || imgEl.getAttribute('data-src')) : '';

            if (href && !href.startsWith('http') && !href.startsWith('/') && href !== 'android' && href !== 'contact') {
                items.push(new MultimediaItem({
                    title: (title || href.split('?')[0].replace(/-/g)?.replace(/[\n\r\t]+/g, ' ').replace(/\s\s+/g, ' ').trim(), ' '),
                    url: baseUrl + '/' + href,
                    posterUrl: (function (p) { if (!p) return ''; if (p.startsWith('http')) return p; return baseUrl + (p.startsWith('/') ? '' : '/') + p; })(posterUrl ? (posterUrl.startsWith('http') ? posterUrl : baseUrl + (posterUrl.startsWith('/') ? '' : '/') + posterUrl) : ''),
                    type: 'anime',
                    playbackPolicy: 'none'
                }));
            }
        });

        // Also scrape from the embedded autocomplete array for missing items
        const regex = /{ *label:s*"([^"]+)",s*image:s*"([^"]+)",s*url:s*"([^"]+)"/g;
        let match;
        while ((match = regex.exec(html)) !== null) {
            const title = match[1];
            let posterUrl = match[2];
            let href = match[3];
            // simple duplicate check based on url
            let fullUrl = baseUrl + '/' + href;
            if (!items.find(i => i.url === fullUrl)) {
                if (href && !href.startsWith('http') && !href.startsWith('/') && href !== 'android' && href !== 'contact') {
                    items.push(new MultimediaItem({
                        title: (title)?.replace(/[\n\r\t]+/g, ' ').replace(/\s\s+/g, ' ').trim(),
                        url: fullUrl,
                        posterUrl: (function (p) { if (!p) return ''; if (p.startsWith('http')) return p; return baseUrl + (p.startsWith('/') ? '' : '/') + p; })(posterUrl ? (posterUrl.startsWith('http') ? posterUrl : baseUrl + (posterUrl.startsWith('/') ? '' : '/') + posterUrl) : ''),
                        type: 'anime',
                        playbackPolicy: 'none'
                    }));
                }
            }
        }

        cb({
            success: true,
            data: {
                "Catalogue Sekai": items
            }
        });
    } catch (e) {
        cb({ success: false, errorCode: "PARSE_ERROR", message: e.stack });
    }
}

async function search(query, cb) {
    try {
        // Re-use home scraping and filter
        const res = await axios.get(baseUrl + '/?v=15', { headers });
        const html = res.data;
        const doc = await parseHtml(html);
        const items = [];

        // Fetch from swiper-slides to get covers properly
        const slides = Array.from(doc.querySelectorAll('.swiper-slide'));
        slides.forEach(slide => {
            const link = slide.querySelector('a');
            if (!link) return;
            const href = link.getAttribute('href');
            const titleEl = slide.querySelector('.series-name');
            const title = titleEl ? titleEl.textContent.trim() : (link.getAttribute('title') || link.textContent.trim());
            const cleanTitle = title || href.split('?')[0].replace(/-/g, ' ');
            const imgEl = slide.querySelector('img');
            const posterUrl = imgEl ? (imgEl.getAttribute('src') || imgEl.getAttribute('data-src')) : '';

            if (href && !href.startsWith('http') && !href.startsWith('/') && href !== 'android' && href !== 'contact') {
                if (cleanTitle.toLowerCase().includes(query.toLowerCase())) {
                    items.push(new MultimediaItem({
                        title: (cleanTitle)?.replace(/[\n\r\t]+/g, ' ').replace(/\s\s+/g, ' ').trim(),
                        url: baseUrl + '/' + href,
                        posterUrl: (function (p) { if (!p) return ''; if (p.startsWith('http')) return p; return baseUrl + (p.startsWith('/') ? '' : '/') + p; })(posterUrl ? (posterUrl.startsWith('http') ? posterUrl : baseUrl + (posterUrl.startsWith('/') ? '' : '/') + posterUrl) : ''),
                        type: 'anime',
                        playbackPolicy: 'none'
                    }));
                }
            }
        });

        // Also scrape from the embedded autocomplete array for missing items
        const regex = /{ *label:s*"([^"]+)",s*image:s*"([^"]+)",s*url:s*"([^"]+)"/g;
        let match;
        while ((match = regex.exec(html)) !== null) {
            const title = match[1];
            let posterUrl = match[2];
            let href = match[3];
            // simple duplicate check based on url
            let fullUrl = baseUrl + '/' + href;
            if (!items.find(i => i.url === fullUrl)) {
                if (href && !href.startsWith('http') && !href.startsWith('/') && href !== 'android' && href !== 'contact') {
                    if (title.toLowerCase().includes(query.toLowerCase())) {
                        items.push(new MultimediaItem({
                            title: (title)?.replace(/[\n\r\t]+/g, ' ').replace(/\s\s+/g, ' ').trim(),
                            url: fullUrl,
                            posterUrl: (function (p) { if (!p) return ''; if (p.startsWith('http')) return p; return baseUrl + (p.startsWith('/') ? '' : '/') + p; })(posterUrl ? (posterUrl.startsWith('http') ? posterUrl : baseUrl + (posterUrl.startsWith('/') ? '' : '/') + posterUrl) : ''),
                            type: 'anime',
                            playbackPolicy: 'none'
                        }));
                    }
                }
            }
        }

        cb({ success: true, data: items });
    } catch (e) {
        cb({ success: false, errorCode: "SEARCH_ERROR", message: e.stack });
    }
}

async function load(url, cb) {
    try {
        const res = await axios.get(url, { headers });
        const html = res.data;
        const doc = await parseHtml(html);

        const title = doc.querySelector('title')?.textContent.replace('Sekai', '').trim();
        const description = doc.querySelector('meta[property="og:description"]')?.getAttribute('content');
        const posterUrl = doc.querySelector('meta[property="og:image"]')?.getAttribute('content');

        // Extract episode count from last episode selection
        const lastSoloMatch = html.match(/var last[a-zA-Z0-9]+\s*=\s*(\d+)/i);
        const epCount = lastSoloMatch ? parseInt(lastSoloMatch[1]) : 1;

        const episodes = [];
        for (let i = 1; i <= epCount; i++) {
            episodes.push(new Episode({
                name: `Épisode ${i}`,
                episode: i,
                url: url + (url.includes('?') ? '&' : '?') + `ep=${i}`,
                season: 1
            }));
        }

        cb({
            success: true,
            data: new MultimediaItem({
                title,
                description,
                posterUrl,
                type: 'anime',
                episodes
            })
        });
    } catch (e) {
        cb({ success: false, errorCode: "LOAD_ERROR", message: e.stack });
    }
}

function decodeBase64(str) {
    if (typeof atob !== 'undefined') return atob(str);
    var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    var output = '';
    str = String(str).replace(/=+$/, '');
    for (var bc = 0, bs, buffer, idx = 0; buffer = str.charAt(idx++); ~buffer && (bs = bc % 4 ? bs * 64 + buffer : buffer, bc++ % 4) ? output += String.fromCharCode(255 & bs >> (-2 * bc & 6)) : 0) {
        buffer = chars.indexOf(buffer);
    }
    return output;
}

async function loadStreams(url, cb) {
    try {
        const res = await axios.get(url, { headers });
        const html = res.data;
        const streams = [];

        // Extract mu variables (base URLs)
        const muMap = {};
        const muRegex = /var (mu\d+)\s*=\s*atob\("([^"]+)"\)/g;
        let muMatch;
        while ((muMatch = muRegex.exec(html)) !== null) {
            // simple base64 decode for the known mugiwara URLs
            let b64 = muMatch[2];
            let decoded = "";
            if (b64 === "aHR0cHM6Ly8yMi5tdWdpd2FyYS5vbmUv") decoded = "https://22.mugiwara.one/";
            else if (b64 === "aHR0cHM6Ly8yNi5tdWdpd2FyYS5vbmUv") decoded = "https://26.mugiwara.one/";
            else if (b64 === "aHR0cHM6Ly8yNy5tdWdpd2FyYS5vbmUv") decoded = "https://27.mugiwara.one/";

            if (decoded) muMap[muMatch[1]] = decoded;
        }

        // Extract slug from URL or HTML
        const slug = url.split('/').pop().split('?')[0];
        const epMatch = url.match(/[?&]ep=(\d+)/);
        const epNum = epMatch ? epMatch[1] : "1";

        // Reconstruct stream URLs based on patterns found
        // e.g., episode[num] = mu22 + "solo/solo-" + num + ".mp4";
        const pathRegex = /episode\[[^\]]+\]\s*=\s*(mu\d+)\s*\+\s*["']([^"']+)["']\s*\+\s*[^;]+/g;
        let pathMatch;
        while ((pathMatch = pathRegex.exec(html)) !== null) {
            const muKey = pathMatch[1];
            const basePath = pathMatch[2]; // e.g., "solo/solo-"
            if (muMap[muKey]) {
                streams.push(new StreamResult({
                    url: muMap[muKey] + basePath + epNum + ".mp4",
                    source: "Sekai " + muKey.replace('mu', 'Server '),
                    quality: "1080p",
                    headers: { "Referer": "https://sekai.one/", "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36" }
                }));
            }
        }

        // Fallback: if no patterns found, try some common ones
        if (streams.length === 0) {
            const servers = Object.keys(muMap);
            servers.forEach(s => {
                streams.push(new StreamResult({
                    url: muMap[s] + slug + "/" + slug + "-" + epNum + ".mp4",
                    source: "Sekai " + s.replace('mu', 'Server '),
                    quality: "1080p",
                    headers: { "Referer": "https://sekai.one/", "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36" }
                }));
            });
        }

        cb({ success: true, data: streams });
    } catch (e) {
        cb({ success: false, errorCode: "STREAM_ERROR", message: String(e) });
    }
}

globalThis.getHome = getHome;
globalThis.search = search;
globalThis.load = load;
globalThis.loadStreams = loadStreams;
