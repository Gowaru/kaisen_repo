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
    
    const baseUrl = typeof manifest !== 'undefined' ? manifest.baseUrl : 'https://animesultra.net';
    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
        'Referer': baseUrl,
        'Origin': baseUrl
    };

    // Helper to use JSDOM like cheerio-ish (querySelectorAll)
    function queryAll(doc, selector) {
        return Array.from(doc.querySelectorAll(selector));
    }

    async function getHome(cb) {
        try {
            const res = await axios.get(baseUrl, { headers });
            const html = res.data;
            const doc = await parseHtml(html);
            const results = {};

            // 1. Trending (Carousel)
            const trendingItems = [];
            queryAll(doc, '.block_area_home .swiper-wrapper .swiper-slide').forEach((el) => {
                const titleEl = el.querySelector('.film-title');
                const linkEl = el.querySelector('a');
                const imgEl = el.querySelector('img');
                const title = titleEl?.textContent.trim();
                const url = linkEl?.getAttribute('href');
                const posterUrl = imgEl?.getAttribute('data-src') || imgEl?.getAttribute('src');
                if (title && url) {
                    trendingItems.push({
                        title,
                        url: url.startsWith('http') ? url : baseUrl + url,
                        posterUrl: (function(p){ if(!p) return ''; if(p.startsWith('http')) return p; return baseUrl + (p.startsWith('/') ? '' : '/') + p; })(posterUrl?.startsWith('http') ? posterUrl : (posterUrl?.startsWith('/') ? baseUrl + posterUrl : posterUrl)),
                        type: 'anime', playbackPolicy: 'none'
                    });
                }
            });
            if (trendingItems.length > 0) {
                results['Tendance'] = trendingItems;
            }

            // 2. Dernier épisode Ajouté (Grid)
            const latestItems = [];
            queryAll(doc, '.block_area_home .film_list-wrap .flw-item').forEach((el) => {
                const linkEl = el.querySelector('.film-name a');
                const imgEl = el.querySelector('img');
                const epEl = el.querySelector('.tick-eps');
                const title = linkEl?.textContent.trim();
                const url = linkEl?.getAttribute('href');
                const posterUrl = imgEl?.getAttribute('data-src') || imgEl?.getAttribute('src');
                const ep = epEl?.textContent.trim();
                if (title && url) {
                    latestItems.push({
                        title: (title + (ep ? ' - ' + ep : ''))?.replace(/[\n\r\t]+/g, ' ').replace(/\s\s+/g, ' ').trim(),
                        url: url.startsWith('http') ? url : baseUrl + url,
                        posterUrl: (function(p){ if(!p) return ''; if(p.startsWith('http')) return p; return baseUrl + (p.startsWith('/') ? '' : '/') + p; })(posterUrl?.startsWith('http') ? posterUrl : (posterUrl?.startsWith('/') ? baseUrl + posterUrl : posterUrl)),
                        type: 'anime', playbackPolicy: 'none'
                    });
                }
            });
            if (latestItems.length > 0) {
                results['Dernier épisode Ajouté'] = latestItems;
            }

            cb({ success: true, data: results });
        } catch (e) {
            console.error(e);
            cb({ success: false, errorCode: "HOME_ERROR" });
        }
    }

    async function search(query, cb) {
        try {
            const body = `do=search&subaction=search&story=${encodeURIComponent(query)}`;

            const res = await axios.post(baseUrl + '/index.php?do=search', body, {
                headers: {
                    ...headers,
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });
            const html = res.data;
            const doc = await parseHtml(html);
            const results = [];

            queryAll(doc, '.film_list-wrap .flw-item').forEach((el) => {
                const linkEl = el.querySelector('.film-name a');
                const imgEl = el.querySelector('img');
                const title = linkEl?.textContent.trim();
                const url = linkEl?.getAttribute('href');
                const posterUrl = imgEl?.getAttribute('data-src') || imgEl?.getAttribute('src');
                if (title && url) {
                    results.push({
                        title,
                        url: url.startsWith('http') ? url : baseUrl + url,
                        posterUrl: (function(p){ if(!p) return ''; if(p.startsWith('http')) return p; return baseUrl + (p.startsWith('/') ? '' : '/') + p; })(posterUrl?.startsWith('http') ? posterUrl : (posterUrl?.startsWith('/') ? baseUrl + posterUrl : posterUrl)),
                        type: 'anime', playbackPolicy: 'none'
                    });
                }
            });

            cb({ success: true, data: results });
        } catch (e) {
            console.error(e);
            cb({ success: false, errorCode: "SEARCH_ERROR" });
        }
    }

    async function load(url, cb) {
        try {
            const res = await axios.get(url, { headers });
            const html = res.data;
            const doc = await parseHtml(html);

            const title = doc.querySelector('.anisc-detail .film-name')?.textContent.trim();
            const description = doc.querySelector('.film-description .text')?.textContent.trim();
            const posterUrl = doc.querySelector('.film-poster img')?.getAttribute('src');
            
            let movieId = html.match(/var movie\s*=\s*{[^}]*id:\s*"(\d+)"/)?.[1];
            if (!movieId) {
                movieId = doc.querySelector('.film-poster-ahref')?.getAttribute('data-id') || doc.querySelector('[data-id]')?.getAttribute('data-id');
            }

            const episodes = [];
            if (movieId) {
                const epRes = await axios.get(`${baseUrl}/engine/ajax/full-story.php?newsId=${movieId}&d=${Date.now()}`, { headers });
                if (epRes.data && epRes.data.status) {
                    const epDoc = await parseHtml(epRes.data.html);
                    queryAll(epDoc, '.ep-item').forEach((el) => {
                        const dataNum = el.getAttribute('data-number');
                        const innerTitle = el.querySelector ? el.querySelector('.ep-name')?.textContent.trim() : null;
                        const epTitle = innerTitle || el.getAttribute('title') || el.textContent.trim();
                        const epUrl = el.getAttribute('href');
                        if (epUrl) {
                            let epNum = 0;
                            if (dataNum) {
                                epNum = parseInt(dataNum, 10);
                            } else if (epTitle && epTitle.match(/\\d+/)) {
                                epNum = parseInt(epTitle.match(/\\d+/)[0], 10);
                            }
                            if (isNaN(epNum)) epNum = 0;

                            episodes.push(new Episode({
                                name: epTitle, 
                                episode: epNum,
                                url: epUrl.startsWith('http') ? epUrl : baseUrl + epUrl,
                                season: 1
                            }));
                        }
                    });
                }
            }

            cb({
                success: true,
                data: new MultimediaItem({
                    title,
                    description,
                    posterUrl: (function(p){ if(!p) return ''; if(p.startsWith('http')) return p; return baseUrl + (p.startsWith('/') ? '' : '/') + p; })(posterUrl?.startsWith('http') ? posterUrl : (posterUrl?.startsWith('/') ? baseUrl + posterUrl : posterUrl)),
                    episodes
                })
            });
        } catch (e) {
            console.error(e);
            cb({ success: false });
        }
    }

    async function loadStreams(url, cb) {
        try {
            const res = await axios.get(url, { headers });
            const html = res.data;
            const streams = [];

            const serverRegex = /<div class="item server-item" data-class="([^"]*)" data-type="([^"]*)" data-id="([^"]*)" data-server-id="([^"]*)" data-embed="([^"]*)">/g;
            let match;
            while ((match = serverRegex.exec(html)) !== null) {
                const serverId = match[4];
                const embedUrl = match[5];
                
                const contentPlayerRegex = new RegExp(`id="content_player_${serverId}">([^<]*)<`, 'i');
                const cpMatch = html.match(contentPlayerRegex);
                let playerUrl = cpMatch ? cpMatch[1].trim() : embedUrl;

                if (playerUrl) {
                    let serverName = 'Server ' + serverId;
                    const nameRegex = new RegExp(`data-server-id="${serverId}"[^>]*>[^<]*<a[^>]*class="btn">([^<]*)<`, 'i');
                    const nameMatch = html.match(nameRegex);
                    if (nameMatch) serverName = nameMatch[1].trim();

                    
                    const streamRes = await Extractors.resolveStream(playerUrl);
                    if (streamRes) {
                        streamRes.quality = serverName;
                        streams.push(streamRes);
                    } else {
                        
                    const streamRes = await Extractors.resolveStream(playerUrl);
                    if (streamRes) {
                        streamRes.quality = serverName;
                        streams.push(streamRes);
                    } else {
                        streams.push(new StreamResult({ url: playerUrl, quality: serverName, headers: {'Referer': baseUrl } }));
                    }

                    }

                }
            }

            cb({ success: true, data: streams });
        } catch (e) {
            console.error(e);
            cb({ success: false });
        }
    }

    globalThis.getHome = getHome;
    globalThis.search = search;
    globalThis.load = load;
    globalThis.loadStreams = loadStreams;
})();
