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
            const data = {};

            // Parse sections like "Derniers Animes", "Derniers Films", etc.
            const wrappers = doc.querySelectorAll('section, .Wdgt');
            wrappers.forEach(wrap => {
                const titleEl = wrap.querySelector('.Title');
                const list = wrap.querySelector('ul.MovieList');
                
                if (titleEl && list) {
                    const sectionTitle = titleEl.textContent.trim();
                    const items = [];
                    const entries = list.querySelectorAll('.TPost');
                    
                    entries.forEach(entry => {
                        const tEl = entry.querySelector('.Title');
                        const imgEl = entry.querySelector('img');
                        const linkEl = entry.querySelector('a');

                        if (tEl && linkEl) {
                            items.push(new (typeof MultimediaItem !== 'undefined' ? MultimediaItem : Object)({
                                title: tEl.textContent.trim().replace('Anime', '').trim(),
                                url: linkEl.getAttribute('href'),
                                posterUrl: imgEl ? imgEl.getAttribute('src') : '',
                                type: 'anime',
                                status: 'ongoing',
                                playbackPolicy: 'none'
                            }));
                        }
                    });
                    
                    if (items.length > 0 && sectionTitle) {
                        data[sectionTitle] = items;
                    }
                }
            });

            // Fallback if structure changes
            if (Object.keys(data).length === 0) {
                const items = [];
                const entries = doc.querySelectorAll('article.TPost');
                entries.forEach(entry => {
                    const titleEl = entry.querySelector('h3.Title, .Title');
                    const imgEl = entry.querySelector('img');
                    const linkEl = entry.querySelector('a');

                    if (titleEl && linkEl) {
                        items.push(new (typeof MultimediaItem !== 'undefined' ? MultimediaItem : Object)({
                            title: titleEl.textContent.trim().replace('Anime', '').trim(),
                            url: linkEl.getAttribute('href'),
                            posterUrl: imgEl ? imgEl.getAttribute('src') : '',
                            type: 'anime',
                            status: 'ongoing',
                            playbackPolicy: 'none'
                        }));
                    }
                });
                if (items.length > 0) {
                    data["Derniers Ajouts"] = items;
                }
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

                const entries = doc.querySelectorAll('article.TPost');
                entries.forEach(entry => {
                    const titleEl = entry.querySelector('h3.Title, .Title');
                    const imgEl = entry.querySelector('img');
                    const linkEl = entry.querySelector('a');

                    if (titleEl && linkEl) {
                        const itemUrl = linkEl.getAttribute('href');
                        if (!seen.has(itemUrl)) {
                            seen.add(itemUrl);
                            results.push(new (typeof MultimediaItem !== 'undefined' ? MultimediaItem : Object)({
                                title: titleEl.textContent.trim().replace('Anime', '').trim(),
                                url: itemUrl,
                                posterUrl: imgEl ? imgEl.getAttribute('src') : '',
                                type: 'anime',
                                status: 'ongoing',
                                playbackPolicy: 'none'
                            }));
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

            const title = doc.querySelector('h1.Title, .Title')?.textContent.trim() || '';
            const description = doc.querySelector('.Description p, .Synopsis p, .Description, .Synopsis, p')?.textContent.trim() || '';
            const posterUrl = doc.querySelector('.Image figure img, .poster img')?.getAttribute('src') || '';

            let year = 0;
            const yearStr = doc.querySelector('.Date, .Year')?.textContent;
            if (yearStr) {
                const yMatch = yearStr.match(/\d{4}/);
                if (yMatch) year = parseInt(yMatch[0], 10);
            }

            let duration = 0;
            const durationStr = doc.querySelector('.Time, .Duration')?.textContent;
            if (durationStr) {
                const dMatch = durationStr.match(/\d+/);
                if (dMatch) duration = parseInt(dMatch[0], 10);
            }

            const episodes = [];
            const seasonBlocks = doc.querySelectorAll('h2');
            let blocksFound = false;

            seasonBlocks.forEach((h2) => {
                const text = h2.textContent.trim();
                const seasonMatch = text.match(/Saison\s+(\d+)/i);
                if (seasonMatch) {
                    blocksFound = true;
                    const parsedSeason = parseInt(seasonMatch[1], 10);
                    const parent = h2.parentElement;
                    const epLinks = parent ? parent.querySelectorAll('.episode-link, .ep-list-all a, .episodes a') : [];
                    
                    if (epLinks.length > 0) {
                        Array.from(epLinks).reverse().forEach((link, idx) => {
                            const epName = link.textContent.trim() || `S${parsedSeason} Épisode ${idx + 1}`;
                            const episodeNumMatch = epName.match(/Episode\s+(\d+)/i) || epName.match(/\d+/);
                            const episodeNum = episodeNumMatch ? parseInt(episodeNumMatch[1] || episodeNumMatch[0], 10) : (idx + 1);
                            
                            episodes.push(new Episode({
                                season: parsedSeason,
                                name: epName,
                                episode: episodeNum,
                                url: link.getAttribute('href'),
                                posterUrl: posterUrl,
                                dubStatus: link.getAttribute('href').includes('vostfr') ? 'sub' : (link.getAttribute('href').includes('vf') ? 'dub' : 'sub'),
                                playbackPolicy: 'none'
                            }));
                        });
                    }
                }
            });

            // Fallback for single season / older structure
            if (!blocksFound) {
                const epLinks = doc.querySelectorAll('.episode-link, .ep-list-all a, .episodes a');
                if (epLinks.length > 0) {
                    Array.from(epLinks).reverse().forEach((link, idx) => {
                        const epName = link.textContent.trim() || `Épisode ${idx + 1}`;
                        const episodeNumMatch = epName.match(/Episode\s+(\d+)/i) || epName.match(/\d+/);
                        const episodeNum = episodeNumMatch ? parseInt(episodeNumMatch[1] || episodeNumMatch[0], 10) : (idx + 1);
                        
                        episodes.push(new Episode({
                            season: 1,
                            name: epName,
                            episode: episodeNum,
                            url: link.getAttribute('href'),
                            posterUrl: posterUrl,
                            dubStatus: link.getAttribute('href').includes('vostfr') ? 'sub' : (link.getAttribute('href').includes('vf') ? 'dub' : 'sub'),
                            playbackPolicy: 'none'
                        }));
                    });
                }
            }

            // Sort episodes correctly: first by season ascending, then by episode ascending
            episodes.sort((a, b) => {
                if (a.season !== b.season) return a.season - b.season;
                return a.episode - b.episode;
            });

            cb({
                success: true,
                data: new (typeof MultimediaItem !== 'undefined' ? MultimediaItem : Object)({
                    title,
                    description,
                    posterUrl,
                    year,
                    duration,
                    type: episodes.length > 1 ? "series" : "movie",
                    episodes: episodes
                })
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
                
                streams.push(await Extractors.resolveStream(src));
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
