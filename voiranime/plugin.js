(function() {

        const axios = {
        get: async (url, config = {}) => {
            const h = config.headers || {};
            if (typeof http_get !== 'undefined') {
                const r = await http_get(url, h);
                let parsed = r.body;
                try { parsed = JSON.parse(r.body); } catch(e) {}
                return { data: parsed, status: r.status };
            }
            return { data: "" };
        },
        post: async (url, data, config = {}) => {
            const h = config.headers || {};
            if (typeof http_post !== 'undefined') {
                const r = await http_post(url, h, data);
                let parsed = r.body;
                try { parsed = JSON.parse(r.body); } catch(e) {}
                return { data: parsed, status: r.status };
            }
            return { data: "" };
        }
    };

    
    const baseUrl = typeof manifest !== 'undefined' ? manifest.baseUrl : 'https://v6.voiranime.com';
const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Sec-Ch-Ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1'
    };

    async function getHome(cb) {
        try {
            const url = baseUrl;
            const res = await axios.get(url, { headers }
            const doc = await parseHtml(res.data);
            const items = [];

            const articles = doc.querySelectorAll('article.anime-post, article.hentry');
            articles.forEach(article => {
                const titleEl = article.querySelector('.entry-title a, h2 a, h3 a');
                const imgEl = article.querySelector('img');
                const linkEl = article.querySelector('a');

                if (titleEl && linkEl) {
                    items.push({
                        title: titleEl.textContent.trim().toLowerCase(),
                        url: linkEl?.getAttribute('href'),
                        posterUrl: imgEl ? imgEl?.getAttribute('src') : '',
                        type: 'anime',
                        status: 'ongoing',
                        playbackPolicy: 'none'
                    }
                }
            });

            cb({ success: true, data: { "Derniers Ajouts": items } });
        } catch (e) {
            console.error(e);
            cb({ success: false, errorCode: "HOME_ERROR", message: e.stack });
        }
    }

    async function search(query, cb) {
        try {
            const url = `${baseUrl}?s=${encodeURIComponent(query)}`;
            const res = await axios.get(url, { headers });
            const doc = await parseHtml(res.data);
            const items = [];

            const articles = doc.querySelectorAll('article.anime-post, article.hentry');
            articles.forEach(article => {
                const titleEl = article.querySelector('.entry-title a, h2 a, h3 a');
                const imgEl = article.querySelector('img');
                const linkEl = article.querySelector('a');

                if (titleEl && linkEl) {
                    items.push({
                        title: titleEl.textContent.trim().toLowerCase(),
                        url: linkEl?.getAttribute('href'),
                        posterUrl: imgEl ? imgEl?.getAttribute('src') : '',
                        type: 'anime',
                        status: 'ongoing',
                        playbackPolicy: 'none'
                    });
                }
            });

            cb({ success: true, data: items });
        } catch (e) {
            console.error(e);
            cb({ success: false, errorCode: "SEARCH_ERROR", message: e.stack });
        }
    }

    async function load(url, cb) {
        try {
            const res = await axios.get(url, { headers });
            const doc = await parseHtml(res.data);

            const title = doc.querySelector('.entry-title')?.textContent.trim() || '';
            const description = doc.querySelector('.entry-content p')?.textContent.trim() || '';
            const posterUrl = doc.querySelector('.post-thumbnail img')?.src || '';

            const episodes = [];
            const epLinks = doc.querySelectorAll('.episodes-list a, .eplist a, a[href*="/episode/"]');
            
            if (epLinks.length > 0) {
                epLinks.forEach((link, idx) => {
                    const epName = link.textContent.trim() || `Épisode ${idx + 1}`;
                    episodes.push({
                        season: 1,
                        episode: parseInt(epName.match(/\d+/) ? epName.match(/\d+/)[0] : 0, 10),
                        name: epName,
                        url: link?.getAttribute('href'),
                        playbackPolicy: 'none'
                    });
                });
            } else {
                const epNumMatch = url.match(/episode-(\d+)/i);
                if (epNumMatch) {
                    episodes.push({
                        season: 1,
                        episode: parseInt(epNumMatch[1], 10),
                        name: `Épisode ${epNumMatch[1]}`,
                        url: url,
                        playbackPolicy: 'none'
                    });
                }
            }

            cb({
                success: true,
                data: {
                    title,
                    description,
                    posterUrl,
                    episodes: episodes.sort((a, b) => a.episode - b.episode)
                }
            });
        } catch (e) {
            console.error(e);
            cb({ success: false, errorCode: "LOAD_ERROR", message: e.stack });
        }
    }

    
    const Extractors = {
        async extractVidoza(url) {
            try {
                const res = await axios.get(url);
                const match = res.data.match(/source\s+src=["'](https?:\/\/[^"']+\.mp4)["']/i);
                if (match) return { url: match[1], quality: 'Auto', source: 'Vidoza' };
            } catch (e) {} return null;
        },
        async extractSibnet(url) {
            try {
                const res = await axios.get(url);
                const match = res.data.match(/player\.src\(\[\{src:\s*["']([^"']+)["']/i) || res.data.match(/src:\s*["'](\/v\/.*?\.mp4)["']/i);
                if (match) {
                    let videoUrl = match[1];
                    if (videoUrl.startsWith('//')) videoUrl = 'https:' + videoUrl;
                    else if (videoUrl.startsWith('/')) videoUrl = 'https://video.sibnet.ru' + videoUrl;
                    return { url: videoUrl, quality: 'Auto', source: 'Sibnet', headers: { 'Referer': url } };
                }
            } catch (e) {} return null;
        },
        async extractSendvid(url) {
            try {
                const res = await axios.get(url);
                const match = res.data.match(/<source\s+src=["']([^"']+\.mp4)["']/i) || res.data.match(/video_source\s*=\s*["']([^"']+)["']/i);
                if (match) return { url: match[1], quality: 'Auto', source: 'Sendvid' };
            } catch (e) {} return null;
        },
        async extractStreamtape(url) {
            try {
                const res = await axios.get(url);
                const match = res.data.match(/document\.getElementById\('robotlink'\)\.innerHTML\s*=\s*'\/\/([^']+)'\s*\+\s*'([^']+)'/i);
                if (match) {
                    const videoUrl = 'https://' + match[1] + match[2].substring(3);
                    return { url: videoUrl, quality: 'Auto', source: 'Streamtape' };
                }
            } catch (e) {} return null;
        },
        async extractUqload(url) {
            try {
                const res = await axios.get(url);
                const match = res.data.match(/sources:\s*\["([^"]+)"\]/i);
                if (match) return { url: match[1], quality: 'Auto', source: 'Uqload' };
            } catch (e) {} return null;
        },
        async resolveStream(url) {
            if (!url) return null;
            let finalStream = null;
            if (url.includes('vidoza.net')) finalStream = await this.extractVidoza(url);
            else if (url.includes('sibnet.ru')) finalStream = await this.extractSibnet(url);
            else if (url.includes('sendvid.com')) finalStream = await this.extractSendvid(url);
            else if (url.includes('streamtape.com')) finalStream = await this.extractStreamtape(url);
            else if (url.includes('uqload')) finalStream = await this.extractUqload(url);
            
            if (finalStream) {
                return new StreamResult({
                    url: finalStream.url, quality: finalStream.quality, source: finalStream.source,
                    headers: finalStream.headers || {}
                });
            }
            let host = 'Unknown'; try { host = new URL(url).hostname; } catch(e) {}
            return new StreamResult({ url: url, quality: 'Auto', source: host });
        }
    };

    async function loadStreams(url, cb) {
        try {
            const res = await axios.get(url, { headers });
            const doc = await parseHtml(res.data);
            const streams = [];

            const iframes = doc.querySelectorAll('iframe[src*="streamtape"], iframe[src*="vidoza"], iframe[src*="dood"], iframe[src*="embed"]');
            for (let iframe of iframes) {
                let src = iframe?.getAttribute('src');
                if (src.startsWith('//')) src = 'https:' + src;
                
                streams.push(new StreamResult({
                    url: src,
                    quality: '1080p',
                    source: new URL(src).hostname
                }));
            });

            cb({ success: true, data: streams });
        } catch (e) {
            console.error(e);
            cb({ success: false, errorCode: "STREAM_ERROR", message: e.stack });
        }
    }

    globalThis.getHome = getHome;
    globalThis.search = search;
    globalThis.load = load;
    globalThis.loadStreams = loadStreams;
})();
