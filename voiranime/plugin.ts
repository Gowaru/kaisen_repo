// @ts-nocheck
import { MixDrop, StreamTape, Voe, Filemoon, DoodStream } from 'skystream-extractors';

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

    
    const baseUrl = typeof manifest !== 'undefined' ? manifest.baseUrl : 'https://voir-anime.to';
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

            const extractItems = (nodes) => {
                const items = [];
                nodes.forEach(el => {
                    const titleEl = el.querySelector('.post-title a, h3 a, h2 a, .title, .name');
                    const linkEl = el.querySelector('a');
                    const imgEl = el.querySelector('img');

                    if (linkEl) {
                        let itemTitle = titleEl ? titleEl.textContent.trim() : '';
                        if (!itemTitle && imgEl) itemTitle = imgEl.getAttribute('title') || imgEl.getAttribute('alt') || '';
                        itemTitle = itemTitle.replace(/Voir Anime|Anime/i, '').trim();
                        
                        const itemUrl = linkEl.getAttribute('href');
                        
                        let pUrl = '';
                        if (imgEl) {
                            const attrs = ['data-wpfc-original-src', 'data-src', 'data-lazy-src', 'data-original', 'src'];
                            for (let attr of attrs) {
                                let val = imgEl.getAttribute(attr);
                                if (val && !val.includes('data:image')) {
                                    pUrl = val;
                                    break;
                                }
                            }
                        } else {
                            const bgEl = el.querySelector('[style*="background-image"]');
                            if (bgEl) {
                                const bgStyle = bgEl.getAttribute('style');
                                const match = bgStyle.match(/url\(['"]?(.*?)['"]?\)/);
                                if (match) pUrl = match[1];
                            }
                        }

                        if (pUrl && pUrl.startsWith('//')) pUrl = 'https:' + pUrl;
                        else if (pUrl && pUrl.startsWith('/')) pUrl = baseUrl + pUrl;

                        if (itemTitle && itemUrl && itemUrl.startsWith('http') && !itemUrl.includes('void')) {
                            items.push({
                                title: itemTitle || 'Inconnu',
                                url: itemUrl,
                                posterUrl: pUrl || '',
                                type: 'anime',
                                status: 'ongoing',
                                playbackPolicy: 'none'
                            });
                        }
                    }
                });
                return items;
            };

            // 1. Slider (Tendances)
            const sliderItems = doc.querySelectorAll('.manga-slider-item, .slider__item, .swiper-slide');
            if (sliderItems.length > 0) {
                const arr = extractItems(sliderItems);
                if(arr.length) data["Tendances"] = arr;
            }

            // 2. Latest/Main content
            const mainItems = doc.querySelectorAll('.page-item-detail, article.anime-post, article.hentry, .item, .c-tabs-item__content .page-item-detail');
            if (mainItems.length > 0) {
                // Deduplicate slider items if they appear in latest
                const seenUrls = new Set((data["Tendances"] || []).map(x => x.url));
                let arr = [];
                mainItems.forEach(item => {
                    const link = item.querySelector('a');
                    if(link) {
                        const href = link.getAttribute('href');
                        if(href && !seenUrls.has(href)) {
                            seenUrls.add(href);
                            arr.push(item);
                        }
                    }
                });
                const extracted = extractItems(arr.slice(0, 40)); 
                if(extracted.length) data["Derniers Ajouts"] = extracted;
            }

            // 3. Fallback move to Trending
            if (data["Trending"] === undefined && Object.keys(data).length > 0) {
                const keys = Object.keys(data);
                if(keys.includes("Tendances")) {
                    data["Trending"] = data["Tendances"];
                    delete data["Tendances"];
                } else {
                    const firstKey = keys[0];
                    data["Trending"] = data[firstKey];
                    delete data[firstKey];
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

                let articles = doc.querySelectorAll('article.anime-post, article.hentry');
                if (!articles || articles.length === 0) {
                    articles = doc.querySelectorAll('.item, .post-item, .bsx, article, .video-block, .page-item-detail, .c-tabs-item__content');
                }
                articles.forEach(article => {
                    const titleEl = article.querySelector('.entry-title a, h2 a, h3 a, h2, h3, .name, .title, .tt, .post-title h3 a');
                    const imgEl = article.querySelector('img');
                    const linkEl = article.querySelector('a');

                    if (linkEl) {
                        let itemTitle = titleEl ? titleEl.textContent.trim() : '';
                        if (!itemTitle && imgEl) itemTitle = imgEl.getAttribute('title') || imgEl.getAttribute('alt') || '';
                        itemTitle = itemTitle.replace(/Voir Anime|Anime/i, '').trim() || 'Inconnu';
                        
                        const itemUrl = linkEl.getAttribute('href');
                        
                        let pUrl = '';
                        if (imgEl) {
                            const attrs = ['data-wpfc-original-src', 'data-src', 'data-lazy-src', 'data-original', 'src'];
                            for (let attr of attrs) {
                                let val = imgEl.getAttribute(attr);
                                if (val && !val.includes('data:image')) {
                                    pUrl = val;
                                    break;
                                }
                            }
                        }
                        
                        if (pUrl && pUrl.startsWith('//')) pUrl = 'https:' + pUrl;
                        else if (pUrl && pUrl.startsWith('/')) pUrl = baseUrl + pUrl;

                        if (itemUrl && !seen.has(itemUrl) && !itemUrl.includes('void')) {
                            seen.add(itemUrl);
                            results.push({
                                title: itemTitle,
                                url: itemUrl,
                                posterUrl: pUrl || '',
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
            
            let posterUrl = '';
            if (imgEl) {
                const attrs = ['data-wpfc-original-src', 'data-src', 'data-lazy-src', 'data-original', 'src'];
                for (let attr of attrs) {
                    let val = imgEl.getAttribute(attr);
                    if (val && !val.includes('data:image')) {
                        posterUrl = val;
                        break;
                    }
                }
            }
            if (!posterUrl && imgEl) posterUrl = imgEl.getAttribute('src') || '';
            
            if (posterUrl && posterUrl.startsWith('//')) posterUrl = 'https:' + posterUrl;
            else if (posterUrl && posterUrl.startsWith('/')) posterUrl = baseUrl + posterUrl;
            
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
            // Using parseHtml native equivalent if available
            const doc = typeof parse_html !== 'undefined' ? await parse_html(res.data) : await parseHtml(res.data);
            const streams = [];

            const iframes = doc.querySelectorAll('iframe[src*="streamtape"], iframe[src*="vidoza"], iframe[src*="dood"], iframe[src*="embed"], iframe[src*="voe"], iframe[src*="filemoon"]');
            for (let iframe of iframes) {
                let src = iframe?.getAttribute('src');
                if (src.startsWith('//')) src = 'https:' + src;
                
                try {
                    let extracted = [];
                    if (src.includes('mixdrop')) {
                        const ex = new MixDrop();
                        extracted = await ex.getUrl(src);
                    } else if (src.includes('streamtape')) {
                        const ex = new StreamTape();
                        extracted = await ex.getUrl(src);
                    } else if (src.includes('voe')) {
                        const ex = new Voe();
                        extracted = await ex.getUrl(src);
                    } else if (src.includes('filemoon')) {
                        const ex = new Filemoon();
                        extracted = await ex.getUrl(src);
                    } else if (src.includes('dood')) {
                        const ex = new DoodStream();
                        extracted = await ex.getUrl(src);
                    }

                    if (extracted && extracted.length > 0) {
                        extracted.forEach(e => streams.push(new StreamResult(e)));
                    } else {
                        // Magic proxy fallback for unhandled extractors
                        streams.push(new StreamResult({
                            url: "MAGIC_PROXY_v1" + btoa(src),
                            quality: '1080p',
                            source: new URL(src).hostname + ' (Proxy)'
                        }));
                    }
                } catch(err) {
                    streams.push(new StreamResult({
                        url: "MAGIC_PROXY_v1" + btoa(src),
                        quality: '1080p',
                        source: new URL(src).hostname + ' (Proxy)'
                    }));
                }
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
