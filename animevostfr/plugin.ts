// @ts-nocheck
import { MixDrop, StreamTape, Voe, Filemoon, DoodStream } from 'skystream-extractors';

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

    function formatTitle(title, url) {
        let t = title.trim().replace(/^Anime|Anime$/ig, '').trim();
        const u = url.toLowerCase();
        if (u.includes('vostfr')) {
            if (!t.toLowerCase().includes('vostfr')) t += ' (VOSTFR)';
        } else if (u.includes('-vf') || u.includes('vf-')) {
            if (!t.toLowerCase().includes('vf')) t += ' (VF)';
        }
        return t;
    }

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
                            const urlStr = linkEl.getAttribute('href') || linkEl.getAttribute('data-href') || '';
                            items.push({
                                title: formatTitle(tEl.textContent.trim(), urlStr),
                                url: urlStr,
                                posterUrl: imgEl ? imgEl.getAttribute('src') : '',
                                type: 'anime',
                                status: 'ongoing',
                                playbackPolicy: 'none'
                            });
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
                        const urlStr = linkEl.getAttribute('href') || linkEl.getAttribute('data-href') || '';
                        items.push({
                            title: formatTitle(titleEl.textContent.trim(), urlStr),
                            url: urlStr,
                            posterUrl: imgEl ? imgEl.getAttribute('src') : '',
                            type: 'anime',
                            status: 'ongoing',
                            playbackPolicy: 'none'
                        });
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
                        const itemUrl = linkEl.getAttribute('href') || linkEl.getAttribute('data-href') || '';
                        if (!seen.has(itemUrl)) {
                            seen.add(itemUrl);
                            results.push({
                                title: formatTitle(titleEl.textContent.trim(), itemUrl),
                                url: itemUrl,
                                posterUrl: imgEl ? imgEl.getAttribute('src') : '',
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

            const titleRaw = doc.querySelector('h1.Title, .Title')?.textContent.trim() || '';
            const title = formatTitle(titleRaw, url);
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
            const seenUrls = new Set();
            const streamElements = doc.querySelectorAll('h2, .episode-link, .ep-list-all a, .episodes a');
            let currentSeason = 1;
            
            if (streamElements.length > 0) {
                Array.from(streamElements).forEach((el) => {
                    if (el.tagName && el.tagName.toUpperCase() === 'H2') {
                        const sMatch = el.textContent.trim().match(/Saison\s+(\d+)/i);
                        if (sMatch) currentSeason = parseInt(sMatch[1], 10);
                        return;
                    }
                    
                    const hrefText = el.getAttribute('href') || '';
                    if (!hrefText || seenUrls.has(hrefText)) return;
                    seenUrls.add(hrefText);

                    const titleText = el.textContent.trim();
                    let seasonNum = currentSeason;
                    const fallbackSMatch = titleText.match(/Saison\s+(\d+)/i) || hrefText.match(/saison-(\d+)/i);
                    if (fallbackSMatch) seasonNum = parseInt(fallbackSMatch[1], 10);
                    
                    let epName = titleText || `S${seasonNum} Épisode`;
                    const episodeNumMatch = titleText.match(/Episode\s+(\d+)/i) || hrefText.match(/(?:ep|episode)-?(\d+)/i) || epName.match(/\d+/);
                    const episodeNum = episodeNumMatch ? parseInt(episodeNumMatch[1] || episodeNumMatch[0], 10) : (episodes.length + 1);
                    
                    episodes.push({
                        season: seasonNum,
                        name: epName,
                        episode: episodeNum,
                        url: hrefText,
                        posterUrl: posterUrl,
                        dubStatus: hrefText.includes('vostfr') ? 'sub' : (hrefText.includes('vf') ? 'dub' : 'sub'),
                        playbackPolicy: 'none'
                    });
                });
            }

            // Sort episodes correctly: first by season ascending, then by episode ascending
            episodes.sort((a, b) => {
                if (a.season !== b.season) return a.season - b.season;
                return a.episode - b.episode;
            });

            cb({
                success: true,
                data: {
                    title,
                    description,
                    posterUrl,
                    year,
                    duration,
                    type: episodes.length > 1 ? "series" : "movie",
                    episodes: episodes
                }
            });
        } catch (e) {
            console.error(e);
            cb({ success: false, errorCode: "LOAD_ERROR", message: e.stack });
        }
    }

    
    
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
                    const ex = new DoodStream();
                    extracted = await ex.getUrl(url);
                }
                
                if (extracted && extracted.length > 0) {
                    return extracted[0]; // return first stream or modify to return all
                }
            } catch (e) {}
            
            // Fallbacks for local / standard proxying
            let finalStream = null;
            if (url.includes('vidmoly')) finalStream = { url: url, quality: 'Auto', source: 'Vidmoly', headers: { Referer: 'https://vidmoly.to/' } };
            
            if (finalStream) {
                return new StreamResult({
                    url: finalStream.url, quality: finalStream.quality, source: finalStream.source,
                    headers: finalStream.headers || {}
                });
            }
            if (url.endsWith('.mp4') || url.endsWith('.m3u8')) {
                let host = 'Unknown'; try { host = new URL(url).hostname; } catch(e) {}
                return new StreamResult({ url: url, quality: 'Auto', source: host });
            }
            
            // Magic proxy for anything else
            let host = 'Unknown'; try { host = new URL(url).hostname; } catch(e) {}
            return new StreamResult({
                url: "MAGIC_PROXY_v1" + btoa(url),
                quality: 'Auto',
                source: host + " (Proxy)"
            });
        }
    };

    async function loadStreams(url, cb) {
        try {
            const res = await axios.get(url, { headers });
            const doc = await parseHtml(res.data);
            const streams = [];

            const sources = [];
            doc.querySelectorAll('iframe').forEach(i => {
                let src = i.getAttribute('src');
                if (src) sources.push(src);
            });
            doc.querySelectorAll('.lazy-player, [data-src]').forEach(el => {
                let src = el.getAttribute('data-src');
                if (src) sources.push(src);
            });

            const uniqueSources = [...new Set(sources)];

            for (let src of uniqueSources) {
                if (!src) continue;
                if (src.startsWith('//')) src = 'https:' + src;
                
                if (src.includes('trembed') || src.includes('animevostfr.org')) {
                    try {
                        const embedRes = await axios.get(src, { headers: { ...headers, 'Referer': url } });
                        const embedMatch = embedRes.data.match(/<iframe[^>]+src="([^"]+)"/i);
                        if (embedMatch && embedMatch[1]) {
                            src = embedMatch[1];
                            if (src.startsWith('//')) src = 'https:' + src;
                        } else if (embedRes.request && embedRes.request.res && embedRes.request.res.responseUrl) {
                            let redirectedUrl = embedRes.request.res.responseUrl;
                            if (redirectedUrl !== src && !redirectedUrl.includes('trembed')) {
                                src = redirectedUrl;
                            }
                        }
                    } catch (e) {
                         if (e.response && e.response.status === 302 && e.response.headers.location) {
                             src = e.response.headers.location;
                             if (src.startsWith('//')) src = 'https:' + src;
                         }
                    }
                }

                try {
                    let resolved = await Extractors.resolveStream(src);
                    if (resolved) streams.push(resolved);
                } catch(e) {
                    // console.error("Extractor error for " + src, e);
                }
            }

            const validStreams = streams.filter(s => s && s.url);
            cb({ success: true, data: validStreams });
        } catch (e) {
            cb({ success: false, errorCode: "STREAM_ERROR", message: String(e) });
        }
    }

    globalThis.getHome = getHome;
    globalThis.search = search;
    globalThis.load = load;
    globalThis.loadStreams = loadStreams;
