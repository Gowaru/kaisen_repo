(function() {

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
                try { parsed = JSON.parse(r.body); } catch(e) {}
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
                try { parsed = JSON.parse(r.body); } catch(e) {}
                return { data: parsed, status: r.status };
            }
            return { data: "" };
        }
    };

    
    const baseUrl = typeof manifest !== 'undefined' ? manifest.baseUrl : 'https://voiranime.tv/';
    const headers = {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 13; SM-G981B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Sec-Ch-Ua': '"Chromium";v="116", "Not)A;Brand";v="24", "Google Chrome";v="116"',
        'Sec-Ch-Ua-Mobile': '?1',
        'Sec-Ch-Ua-Platform': '"Android"',
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
            const data = {};

            // Parsing section by section for richer home page
            const wrappers = doc.querySelectorAll('section, .module, .widget, .manga-slider, .page-item-detail');
            let usedIds = new Set();
            
            wrappers.forEach(wrap => {
                const titleEl = wrap.querySelector('.widget-title, h2, h3, .title');
                const list = wrap.querySelectorAll('article, .item, .c-tabs-item__content, .page-item-detail, .manga-slider-item');
                
                if (titleEl && list && list.length > 0) {
                    const sectionTitle = titleEl.textContent.trim().replace(/^Voir[^a-zA-Z]/i, '').trim() || "Tendances";
                    const items = [];
                    
                    list.forEach(article => {
                        const tEl = article.querySelector('.entry-title a, h2 a, h3 a, .post-title a, .name, .title, a');
                        const imgEl = article.querySelector('img');
                        const linkEl = article.querySelector('a');

                        if (imgEl && linkEl) {
                            let itemTitle = tEl ? tEl.textContent.trim() : '';
                            if (!itemTitle) itemTitle = imgEl.getAttribute('title') || imgEl.getAttribute('alt') || '';
                            itemTitle = itemTitle.replace(/Voir Anime|Anime/i, '').trim() || 'Inconnu';
                            
                            const itemUrl = linkEl.getAttribute('href');
                            let pUrl = imgEl.getAttribute('data-src') || imgEl.getAttribute('data-lazy-src') || imgEl.getAttribute('src') || '';
                            if (pUrl.startsWith('//')) pUrl = 'https:' + pUrl;
                            else if (pUrl.startsWith('/')) pUrl = baseUrl + pUrl;

                            if (itemUrl && !usedIds.has(itemUrl) && !itemUrl.includes('void')) {
                                usedIds.add(itemUrl);
                                items.push({
                                    title: itemTitle,
                                    url: itemUrl,
                                    posterUrl: pUrl,
                                    type: 'anime',
                                    status: 'ongoing',
                                    playbackPolicy: 'none'
                                });
                            }
                        }
                    });
                    
                    if (items.length > 0 && sectionTitle) {
                        data[sectionTitle] = items;
                    }
                }
            });

            // Fallback for single main list
            if (Object.keys(data).length === 0) {
                const items = [];
                let articles = doc.querySelectorAll('article.anime-post, article.hentry');
                if (!articles || articles.length === 0) {
                    articles = doc.querySelectorAll('.item, .post-item, .bsx, article, .video-block, .page-item-detail, .c-tabs-item__content');
                }
                articles.forEach(article => {
                    const titleEl = article.querySelector('.entry-title a, h2 a, h3 a, h2, h3, .name, .title, .post-title a');
                    const imgEl = article.querySelector('img');
                    const linkEl = article.querySelector('a');

                    if (imgEl && linkEl) {
                        let itemTitle = titleEl ? titleEl.textContent.trim() : '';
                        if (!itemTitle) itemTitle = imgEl.getAttribute('title') || imgEl.getAttribute('alt') || '';
                        itemTitle = itemTitle.replace(/Voir Anime|Anime/i, '').trim() || 'Inconnu';
                        
                        const itemUrl = linkEl.getAttribute('href');
                        let pUrl = imgEl.getAttribute('data-src') || imgEl.getAttribute('data-lazy-src') || imgEl.getAttribute('src') || '';
                        if (pUrl.startsWith('//')) pUrl = 'https:' + pUrl;
                        else if (pUrl.startsWith('/')) pUrl = baseUrl + pUrl;

                        if (itemUrl && !itemUrl.includes('void')) {
                            items.push({
                                title: itemTitle,
                                url: itemUrl,
                                posterUrl: pUrl,
                                type: 'anime',
                                status: 'ongoing',
                                playbackPolicy: 'none'
                            });
                        }
                    }
                });
                if (items.length > 0) {
                    data["Derniers Ajouts"] = items;
                }
            }

            // Move the first or a "tendance/popular" array to "Trending" to map properly in the UI Hero banner
            if (data["Trending"] === undefined && Object.keys(data).length > 0) {
                const firstKey = Object.keys(data)[0];
                data["Trending"] = data[firstKey];
                delete data[firstKey];
            }

            cb({ success: true, data: data });
        } catch (e) {
            console.error(e);
            cb({ success: false, errorCode: "HOME_ERROR", message: e.stack });
        }
    }

    async function getAltTitles(query) {
        try {
            const rq = await axios.post('https://graphql.anilist.co', JSON.stringify({
                query: `query ($search: String) { Media(search: $search, type: ANIME) { title { romaji english } } }`,
                variables: { search: query }
            }), { headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' } });
            let titles = [];
            if(rq.data?.data?.Media?.title) {
                const t = rq.data.data.Media.title;
                if(t.romaji) titles.push(t.romaji);
                if(t.english) titles.push(t.english);
            }
            return titles;
        } catch(e) { return []; }   
    }

    async function search(query, cb) {
        try {
            let queries = [query];
            const alt = await getAltTitles(query);
            queries = [...new Set([...queries, ...alt])];
            
            const results = [];
            const seen = new Set();

            for (let q of queries) {
                const url = `${baseUrl}?s=${encodeURIComponent(q.trim())}`;
                const res = await axios.get(url, { headers });
                const doc = await parseHtml(res.data);

                let articles = doc.querySelectorAll('article.anime-post, article.hentry');
                if (!articles || articles.length === 0) {
                    articles = doc.querySelectorAll('.item, .post-item, .bsx, article, .video-block, .page-item-detail, .c-tabs-item__content');
                }
                articles.forEach(article => {
                    const titleEl = article.querySelector('.entry-title a, h2 a, h3 a, h2, h3, .name, .title, .tt, .post-title h3 a');
                    const imgEl = article.querySelector('img');
                    const linkEl = article.querySelector('a');

                    if (imgEl && linkEl) {
                        let itemTitle = titleEl ? titleEl.textContent.trim() : '';
                        if (!itemTitle) itemTitle = imgEl.getAttribute('title') || imgEl.getAttribute('alt') || '';
                        itemTitle = itemTitle.replace(/Voir Anime|Anime/i, '').trim() || 'Inconnu';
                        
                        const itemUrl = linkEl.getAttribute('href');
                        let pUrl = imgEl.getAttribute('data-src') || imgEl.getAttribute('data-lazy-src') || imgEl.getAttribute('src') || '';
                        if (pUrl.startsWith('//')) pUrl = 'https:' + pUrl;
                        else if (pUrl.startsWith('/')) pUrl = baseUrl + pUrl;

                        if (itemUrl && !seen.has(itemUrl) && !itemUrl.includes('void')) {
                            seen.add(itemUrl);
                            results.push({
                                title: itemTitle,
                                url: itemUrl,
                                posterUrl: pUrl,
                                type: 'anime',
                                status: 'ongoing',
                                playbackPolicy: 'none'
                            });
                        }
                    }
                });
            }

            cb({ success: true, data: results });
        } catch (e) {
            console.error(e);
            cb({ success: false, errorCode: "SEARCH_ERROR", message: e.stack });
        }
    }

    async function load(url, cb) {
        try {
            const res = await axios.get(url, { headers });
            const doc = await parseHtml(res.data);

            let title = doc.querySelector('.entry-title, h1, .name, .tt, .post-title h1, .post-title')?.textContent.trim() || '';
            const description = doc.querySelector('.entry-content p, .desc, .synopsis, .summary__content p')?.textContent.trim() || '';
            const imgEl = doc.querySelector('.post-thumbnail img, .thumb img, .poster img, .sheader img, .summary_image img');
            let posterUrl = imgEl ? (imgEl.getAttribute('data-src') || imgEl.getAttribute('data-lazy-src') || imgEl.getAttribute('src') || '') : '';
            if (posterUrl.startsWith('//')) posterUrl = 'https:' + posterUrl;
            else if (posterUrl.startsWith('/')) posterUrl = baseUrl + posterUrl;
            
            if (!title && imgEl) title = imgEl.getAttribute('title') || imgEl.getAttribute('alt') || 'Inconnu';
            title = title.replace(/Voir Anime|Anime/i, '').trim();

            let year = 0;
            const yearMatch = res.data.match(/>(\d{4})<\/a>/);
            if (yearMatch) year = parseInt(yearMatch[1], 10);

            let score = 0;
            const scoreMatch = res.data.match(/score.*?(\d+(\.\d+)?)/i);
            if (scoreMatch) score = parseFloat(scoreMatch[1]);

            let status = 'ongoing';
            if (res.data.toLowerCase().includes('terminé') || res.data.toLowerCase().includes('completed')) {
                status = 'completed';
            }

            const episodes = [];
            // Many Madara themes hide true links in .wp-manga-chapter a
            const epLinks = doc.querySelectorAll('.episodes-list a, .eplist a, a[href*="/episode/"], .ep-item a, ul.episodes a, .wp-manga-chapter a, .listing-chapters_wrap a');
            
            let usedEps = new Set();
            if (epLinks.length > 0) {
                epLinks.forEach((link, idx) => {
                    const epUrl = link.getAttribute('href');
                    if(epUrl && !usedEps.has(epUrl) && /episode/i.test(epUrl)) {
                        usedEps.add(epUrl);
                        let epName = link.textContent.trim() || `Épisode`;
                        let epNum = (epLinks.length - idx);
                        // Tenter d'extraire le numéro depuis le texte ou l'URL
                        const numMatch = epName.match(/\d+(\.\d+)?/) || epUrl.match(/episode-(\d+)/i);
                        if (numMatch) epNum = parseFloat(numMatch[0] || numMatch[1]);
                        
                        episodes.push({
                            season: 1,
                            episode: epNum,
                            name: `Épisode ${epNum}`,
                            url: epUrl,
                            playbackPolicy: 'none'
                        });
                    }
                });
            }
            
            if (episodes.length === 0) {
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
                    title: title,
                    url: url,
                    type: "anime",
                    description,
                    posterUrl,
                    year,
                    score,
                    status,
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
            else if (url.includes('vidmoly')) finalStream = { url: url, quality: 'Auto', source: 'Vidmoly', headers: { 'Referer': 'https://vidmoly.to/' } };
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
            };

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
