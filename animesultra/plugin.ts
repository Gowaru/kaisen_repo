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

            // General blocks
            queryAll(doc, '.block_area_home, .block_area').forEach(block => {
                const titleEl = block.querySelector('.cat-heading') || block.querySelector('h2');
                const sectionTitle = titleEl ? titleEl.textContent.trim() : null;
                if (!sectionTitle) return;

                let items = [];
                // Grid blocks (Dernier épisode, Dernier Anime, etc)
                queryAll(block, '.film_list-wrap .flw-item').forEach(el => {
                    const linkEl = el.querySelector('.film-name a') || el.querySelector('a');
                    const imgEl = el.querySelector('img');
                    const epEl = el.querySelector('.tick-eps');
                    const title = linkEl?.textContent.trim() || el.querySelector('.film-name')?.textContent.trim();
                    const url = linkEl?.getAttribute('href');
                    const posterUrl = imgEl?.getAttribute('data-src') || imgEl?.getAttribute('src');
                    const ep = epEl?.textContent.trim();
                    if (title && url) {
                        items.push({
                            title: (title + (ep ? ' - ' + ep : ''))?.replace(/[\n\r\t]+/g, ' ').replace(/\s\s+/g, ' ').trim(),
                            url: url.startsWith('http') ? url : baseUrl + url,
                            posterUrl: (function(p){ if(!p) return ''; if(p.startsWith('http')) return p; return baseUrl + (p.startsWith('/') ? '' : '/') + p; })(posterUrl?.startsWith('http') ? posterUrl : (posterUrl?.startsWith('/') ? baseUrl + posterUrl : posterUrl)),
                            type: 'anime', playbackPolicy: 'none'
                        });
                    }
                });

                // Top viewed block (Les plus regardés) - we take the #top-viewed-month one 
                if (items.length === 0) {
                    queryAll(block, '#top-viewed-month li').forEach(el => {
                        const linkEl = el.querySelector('.film-name a') || el.querySelector('a');
                        const imgEl = el.querySelector('img');
                        const title = linkEl?.textContent.trim() || el.querySelector('.film-name')?.textContent.trim();
                        const url = linkEl?.getAttribute('href');
                        const posterUrl = imgEl?.getAttribute('data-src') || imgEl?.getAttribute('src');
                        if (title && url) {
                            items.push({
                                title,
                                url: url.startsWith('http') ? url : baseUrl + url,
                                posterUrl: (function(p){ if(!p) return ''; if(p.startsWith('http')) return p; return baseUrl + (p.startsWith('/') ? '' : '/') + p; })(posterUrl?.startsWith('http') ? posterUrl : (posterUrl?.startsWith('/') ? baseUrl + posterUrl : posterUrl)),
                                type: 'anime', playbackPolicy: 'none'
                            });
                        }
                    });
                }

                if (items.length > 0 && !results[sectionTitle]) {
                    results[sectionTitle] = items;
                }
            });

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
            let description = doc.querySelector('.film-description .text')?.textContent.trim() || 'No desc';
            const posterUrl = doc.querySelector('.film-poster img')?.getAttribute('src');
            
            let movieId = url.match(/\/(\d+)-/)?.[1];
            if (!movieId) {
                let matchRegex = html.match(/var movie\s*=\s*{[^}]*id:\s*"(\d+)"/);
                movieId = matchRegex ? matchRegex[1] : null;
            }
            if (!movieId) {
                movieId = doc.querySelector('.film-poster-ahref')?.getAttribute('data-id') || doc.querySelector('[data-id]')?.getAttribute('data-id');
            }

            const statusMatch = html.match(/<span class="item-head">[\s\S]*?Status:<\/span>\s*<span class="name">\s*([^<]*?)\s*<\/span>/i) || html.match(/Statut:<\/span>\s*<span class="name">\s*([^<]*?)\s*<\/span>/i);
            const status = statusMatch ? statusMatch[1].trim() : null;

            const yearMatch = html.match(/<span class="item-head">Année:<\/span>\s*<span class="name">[\s\S]*?>(\d{4})<\/a>/i);
            let year = yearMatch ? parseInt(yearMatch[1], 10) : null;
            if (isNaN(year)) year = null;

            const durationMatch = html.match(/<span class="item-head">Durée:<\/span>\s*<span class="name">([^<]*)<\/span>/i);
            const durationStr = durationMatch ? durationMatch[1].trim() : null;

            let duration = null;
            if (durationStr) {
                const minMatch = durationStr.match(/(\d+)\s*min/);
                if (minMatch) {
                    duration = parseInt(minMatch[1], 10);
                }
            }
            if (isNaN(duration)) duration = null;

            const episodes = [];
            if (movieId) {
                
                let parsedBase = baseUrl;
                try {
                    const match = url.split('/').slice(0, 3).join('/');
                    if (match) parsedBase = match;
                } catch(e) {}
                const epRes = await axios.get(`${parsedBase}/engine/ajax/full-story.php?newsId=${movieId}&d=${Date.now()}`, { headers });
                
                let htmlFrag = '';
                let rawBody = typeof epRes.data === 'string' ? epRes.data : '';
                try {
                    if (typeof epRes.data === 'object' && epRes.data) {
                        htmlFrag = epRes.data.html || JSON.stringify(epRes.data);
                    } else if (rawBody) {
                        let parsed = JSON.parse(rawBody);
                        htmlFrag = parsed.html || rawBody;
                    }
                } catch(e) {
                    htmlFrag = rawBody;
                }
                if(typeof htmlFrag !== 'string') {
                    try { htmlFrag = JSON.stringify(htmlFrag); } catch(e) { htmlFrag = String(htmlFrag); }
                }
                htmlFrag = htmlFrag.replace(/\\"/g, '"').replace(/\\'/g, "'").replace(/\\\//g, '/');
                
                if (htmlFrag) {
                    const epRegex = /<a [^>]*class=["'][^"']*ep-item[^"']*["'][^>]*>/gi;
                    let match;
                    while ((match = epRegex.exec(htmlFrag)) !== null) {
                        const aTag = match[0];
                        const epUrlMatch = aTag.match(/href=["']([^"']+)["']/);
                        const numMatch = aTag.match(/data-number=["'](\d+)["']/);
                        const titleMatch = aTag.match(/title=["']([^"']+)["']/);
                        
                        const epUrl = epUrlMatch ? epUrlMatch[1] : null;
                        let epNum = numMatch ? parseInt(numMatch[1], 10) : 0;
                        const epTitle = titleMatch ? titleMatch[1] : null;

                        if (epUrl) {
                            let epPoster = undefined;
                            if (posterUrl) {
                                epPoster = posterUrl.startsWith('http') ? posterUrl : (posterUrl.startsWith('/') ? baseUrl + posterUrl : baseUrl + '/' + posterUrl);
                            }
                            episodes.push(new Episode({
                                name: epTitle || ('Episode ' + epNum), 
                                episode: epNum,
                                url: epUrl.startsWith('http') ? epUrl : baseUrl + epUrl,
                                season: 1,
                                posterUrl: epPoster
                            }));
                        }
                    }
                }
            }

            const recommendations = [];
            const recBlocks = doc.querySelectorAll('.block_area');
            recBlocks.forEach((b) => {
                const titleEl = b.querySelector('h2') || b.querySelector('.cat-heading');
                const titleBlock = titleEl ? titleEl.textContent.trim() : null;
                if (titleBlock && titleBlock.includes('Recommandé')) {
                    const items = b.querySelectorAll('.flw-item');
                    items.forEach(el => {
                        const linkEl = el.querySelector('.film-name a') || el.querySelector('a');
                        const imgEl = el.querySelector('img');
                        const recTitle = linkEl?.textContent.trim() || el.querySelector('.film-name')?.textContent.trim();
                        const recUrl = linkEl?.getAttribute('href');
                        const recPoster = imgEl?.getAttribute('data-src') || imgEl?.getAttribute('src');
                        if (recTitle && recUrl) {
                            recommendations.push({
                                title: recTitle,
                                url: recUrl.startsWith('http') ? recUrl : baseUrl + recUrl,
                                posterUrl: (function(p){ if(!p) return ''; if(p.startsWith('http')) return p; return baseUrl + (p.startsWith('/') ? '' : '/') + p; })(recPoster?.startsWith('http') ? recPoster : (recPoster?.startsWith('/') ? baseUrl + recPoster : recPoster)),
                                type: 'anime', playbackPolicy: 'none'
                            });
                        }
                    });
                }
            });

            cb({
                success: true,
                data: new MultimediaItem({
                    type: "anime",
                    title,
                    description: description, // Removing debug text as it's no longer needed
                    posterUrl: (function(p){ if(!p) return ''; if(p.startsWith('http')) return p; return baseUrl + (p.startsWith('/') ? '' : '/') + p; })(posterUrl?.startsWith('http') ? posterUrl : (posterUrl?.startsWith('/') ? baseUrl + posterUrl : posterUrl)),
                    year,
                    duration,
                    status,
                    episodes,
                    recommendations
                })
            });
        } catch (e) {
            console.error(e);
            cb({ success: false });
        }
    }

    const PluginExtractors = {
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
                
                if (extracted && extracted.length > 0) {
                    return extracted[0]; // return first stream or modify to return all
                }
            } catch (e) {}
            
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
            
            let host = 'Unknown'; try { host = new URL(url).hostname; } catch(e) {}
            return new StreamResult({
                url: "MAGIC_PROXY_v1" + encodeBase64(url),
                quality: 'Auto',
                source: host + " (Proxy)"
            });
        }
    };

    async function loadStreams(url, cb) {
        try {
            const res = await axios.get(url, { headers });
            let html = res.data;
            const streams = [];

            let movieId = url.match(/\/(\d+)-/)?.[1];
            if (!movieId) {
                let matchRegex = html.match(/data-id=["'](\d+)["']/);
                movieId = matchRegex ? matchRegex[1] : null;
            }

            let fullStoryHtml = html;
            if (!html.includes('content_player_') && movieId) {
                let parsedBase = baseUrl;
                try {
                    const matchUrl = url.split('/').slice(0, 3).join('/');
                    if (matchUrl) parsedBase = matchUrl;
                } catch(e) {}
                const fsRes = await axios.get(`${parsedBase}/engine/ajax/full-story.php?newsId=${movieId}&d=${Date.now()}`, { headers });
                let rawBody = typeof fsRes.data === 'string' ? fsRes.data : '';
                try {
                    if (typeof fsRes.data === 'object' && fsRes.data) {
                        fullStoryHtml = fsRes.data.html || JSON.stringify(fsRes.data);
                    } else if (rawBody) {
                        let parsed = JSON.parse(rawBody);
                        fullStoryHtml = parsed.html || rawBody;
                    }
                } catch(e) {
                    fullStoryHtml = rawBody;
                }
                if(typeof fullStoryHtml !== 'string') {
                    try { fullStoryHtml = JSON.stringify(fullStoryHtml); } catch(e) { fullStoryHtml = String(fullStoryHtml); }
                }
                fullStoryHtml = fullStoryHtml.replace(/\\"/g, '"').replace(/\\'/g, "'").replace(/\\\//g, '/');
            }

            const serverRegex = /<div class="item server-item" data-class="([^"]*)" data-type="([^"]*)" data-id="([^"]*)" data-server-id="([^"]*)" data-embed="([^"]*)">/g;
            let match;
            while ((match = serverRegex.exec(html)) !== null) {
                const serverClass = match[1] || '';
                const serverId = match[4];
                const embedUrl = match[5];
                
                const contentPlayerRegex = new RegExp(`id="content_player_${serverId}"[^>]*>([^<]*)<`, 'i');
                const cpMatch = fullStoryHtml.match(contentPlayerRegex);
                let playerUrl = cpMatch ? cpMatch[1].trim() : embedUrl;

                if (!playerUrl.startsWith('http')) {
                    if (serverClass.includes('sibnet')) playerUrl = 'https://video.sibnet.ru/shell.php?videoid=' + playerUrl;
                    else if (serverClass.includes('mystream')) playerUrl = 'https://embed.mystream.to/' + playerUrl;
                    else if (serverClass.includes('streamtape')) playerUrl = 'https://streamtape.com/e/' + playerUrl;
                    else if (serverClass.includes('uqload')) playerUrl = 'https://uqload.com/embed-' + playerUrl + '.html';
                    else if (serverClass.includes('cdnt2')) playerUrl = 'https://mb.toonanime.xyz/dist/mpia.html?id=' + playerUrl;
                }
                
                if (playerUrl && playerUrl.includes('GQP45MG1WJ93')) continue; // Skip fake fallback url

                if (playerUrl) {
                    let serverName = 'Server ' + serverId;
                    const nameRegex = new RegExp(`data-server-id="${serverId}"[^>]*>[^<]*<a[^>]*class="btn">([^<]*)<`, 'i');
                    const nameMatch = html.match(nameRegex);
                    if (nameMatch) serverName = nameMatch[1].trim();

                    const streamRes = await PluginExtractors.resolveStream(playerUrl);
                    if (streamRes) {
                        streamRes.quality = serverName;
                        streams.push(streamRes);
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
