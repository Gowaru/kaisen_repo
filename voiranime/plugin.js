(function() {
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
            const url = manifest.baseUrl;
            const res = await axios.get(url, { headers });
            const dom = new JSDOM(res.data);
            const doc = dom.window.document;
            const items = [];

            const articles = doc.querySelectorAll('article.anime-post, article.hentry');
            articles.forEach(article => {
                const titleEl = article.querySelector('.entry-title a, h2 a, h3 a');
                const imgEl = article.querySelector('img');
                const linkEl = article.querySelector('a');

                if (titleEl && linkEl) {
                    items.push({
                        title: titleEl.textContent.trim().toLowerCase(),
                        url: linkEl.href,
                        posterUrl: imgEl ? imgEl.src : '',
                        type: 'anime',
                        status: 'ongoing',
                        playbackPolicy: 'none'
                    });
                }
            });

            cb({ success: true, data: items });
        } catch (e) {
            console.error(e);
            cb({ success: false, errorCode: "HOME_ERROR", message: e.stack });
        }
    }

    async function search(query, cb) {
        try {
            const url = `${manifest.baseUrl}?s=${encodeURIComponent(query)}`;
            const res = await axios.get(url, { headers });
            const dom = new JSDOM(res.data);
            const doc = dom.window.document;
            const items = [];

            const articles = doc.querySelectorAll('article.anime-post, article.hentry');
            articles.forEach(article => {
                const titleEl = article.querySelector('.entry-title a, h2 a, h3 a');
                const imgEl = article.querySelector('img');
                const linkEl = article.querySelector('a');

                if (titleEl && linkEl) {
                    items.push({
                        title: titleEl.textContent.trim().toLowerCase(),
                        url: linkEl.href,
                        posterUrl: imgEl ? imgEl.src : '',
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
            const dom = new JSDOM(res.data);
            const doc = dom.window.document;

            const title = doc.querySelector('.entry-title')?.textContent.trim() || '';
            const description = doc.querySelector('.entry-content p')?.textContent.trim() || '';
            const posterUrl = doc.querySelector('.post-thumbnail img')?.src || '';

            const episodes = [];
            const epLinks = doc.querySelectorAll('.episodes-list a, .eplist a, a[href*="/episode/"]');
            
            if (epLinks.length > 0) {
                epLinks.forEach((link, idx) => {
                    episodes.push({
                        season: 1,
                        episode: idx + 1,
                        name: link.textContent.trim() || `Épisode ${idx + 1}`,
                        url: link.href,
                        playbackPolicy: 'none'
                    });
                });
            } else {
                const epNumMatch = url.match(/episode-(\d+)/i);
                if (epNumMatch) {
                    episodes.push({
                        season: 1,
                        episode: parseInt(epNumMatch[1]) || 1,
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

    async function loadStreams(url, cb) {
        try {
            const res = await axios.get(url, { headers });
            const dom = new JSDOM(res.data);
            const doc = dom.window.document;
            const streams = [];

            const iframes = doc.querySelectorAll('iframe[src*="streamtape"], iframe[src*="vidoza"], iframe[src*="dood"], iframe[src*="embed"]');
            iframes.forEach(iframe => {
                let src = iframe.src;
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
