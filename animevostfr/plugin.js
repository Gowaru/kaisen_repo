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

    
    const baseUrl = typeof manifest !== 'undefined' ? manifest.baseUrl : 'https://animevostfr.org';
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
            const res = await axios.get(url, { headers });
            const doc = await parseHtml(res.data);
            const items = [];

            // Targeted selectors for AnimeVOSTFR
            const entries = doc.querySelectorAll('article.TPost');
            entries.forEach(entry => {
                const titleEl = entry.querySelector('h3.Title, .Title');
                const imgEl = entry.querySelector('img');
                const linkEl = entry.querySelector('a');

                if (titleEl && linkEl) {
                    items.push({
                        title: titleEl.textContent.trim().replace('Anime', '').trim().toLowerCase(),
                        url: linkEl?.getAttribute('href'),
                        posterUrl: imgEl ? imgEl?.getAttribute('src') : '',
                        type: 'anime',
                        status: 'ongoing',
                        playbackPolicy: 'none'
                    });
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

            const entries = doc.querySelectorAll('article.TPost');
            entries.forEach(entry => {
                const titleEl = entry.querySelector('h3.Title, .Title');
                const imgEl = entry.querySelector('img');
                const linkEl = entry.querySelector('a');

                if (titleEl && linkEl) {
                    items.push({
                        title: titleEl.textContent.trim().replace('Anime', '').trim().toLowerCase(),
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

            const title = doc.querySelector('h1.Title, .Title')?.textContent.trim() || '';
            const description = doc.querySelector('.Description, .Synopsis, p')?.textContent.trim() || '';
            const posterUrl = doc.querySelector('.Image figure img, .poster img')?.getAttribute('src') || '';

            const episodes = [];
            const epLinks = doc.querySelectorAll('.episode-link, .ep-list-all a, .episodes a');
            
            if (epLinks.length > 0) {
                epLinks.forEach((link, idx) => {
                    episodes.push({
                        season: 1,
                        name: link.textContent.trim() || `Épisode ${epLinks.length - idx}`, // Correcting reversing order possibly
                        url: link?.getAttribute('href'),
                        playbackPolicy: 'none'
                    });
                });
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

    async function loadStreams(url, cb) {
        try {
            const res = await axios.get(url, { headers });
            const doc = await parseHtml(res.data);
            const streams = [];

            const iframes = doc.querySelectorAll('iframe');
            for (let iframe of iframes) {
                let src = iframe?.getAttribute('src');
                if (!src) continue;
                if (src.startsWith('//')) src = 'https:' + src;
                
                // Resolve internal embeds like ?trembed=0...
                if (src.includes('trembed') || src.includes('animevostfr.org')) {
                    try {
                        const embedRes = await axios.get(src, { headers: { ...headers, 'Referer': url } });
                        const embedMatch = embedRes.data.match(/<iframe[^>]+src="([^"]+)"/i);
                        if (embedMatch && embedMatch[1]) {
                            src = embedMatch[1];
                            if (src.startsWith('//')) src = 'https:' + src;
                        }
                    } catch (e) { console.error('Failed to resolve internal embed', e); }
                }

                let hostname = 'Lecteur';
                try { hostname = new URL(src).hostname; } catch(e) {}
                
                streams.push(new StreamResult({
                    url: src,
                    quality: '1080p',
                    source: hostname
                }));
            }

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
