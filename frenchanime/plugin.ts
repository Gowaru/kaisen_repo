// @ts-nocheck
import { MixDrop, StreamTape, Voe, Filemoon, DoodStream } from 'skystream-extractors';

const baseUrl = typeof manifest !== 'undefined' ? manifest.baseUrl : 'https://frenchanime.com';
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
                const r = await http_post(url, h, typeof data === 'string' ? data : JSON.stringify(data));
                let parsed = r.body;
                try { parsed = JSON.parse(r.body); } catch(e) {}
                return { data: parsed, status: r.status };
            }
            return { data: "" };
        }
    };

    
    function formatAnimeTitle(title, url = "", posterUrl = "") {
        let t = title.replace(/wiflix/gi, '').trim();
        let tags = [];
        
        let seasonMatch = t.match(/\b(?:saison|season)\s*(\d+)/i);
        if (seasonMatch) {
            tags.push(`S${seasonMatch[1]}`);
            t = t.replace(/\b(?:saison|season)\s*(\d+)/ig, '').trim();
        } else {
            seasonMatch = url.match(/(?:saison|season)[\-\s]*(\d+)/i);
            if (seasonMatch) {
                tags.push(`S${seasonMatch[1]}`);
            }
        }

        let isVOSTFR = false;
        let isVF = false;

        if (/\b(vostfr|sub)\b/i.test(t)) {
            isVOSTFR = true;
            t = t.replace(/\b(vostfr|sub)\b/ig, '').trim();
        }
        if (/\b(vf|french)\b/i.test(t)) {
            isVF = true;
            t = t.replace(/\b(vf|french)\b/ig, '').trim();
        }

        if (!isVF && !isVOSTFR && posterUrl) {
            if (posterUrl.toLowerCase().includes('vostfr')) isVOSTFR = true;
            else if (posterUrl.toLowerCase().includes('vf')) isVF = true;
        }

        if (!isVF && !isVOSTFR) {
            if (url.includes('/animes-vostfr/')) isVOSTFR = true;
            else if (url.includes('/animes-vf/')) isVF = true;
            else if (url.includes('vf-vostfr') || url.includes('vostfr-vf')) {
                isVOSTFR = true;
                isVF = true;
            } else {
                if (url.includes('-vostfr')) isVOSTFR = true;
                else if (url.includes('-vf') || url.includes('-french')) isVF = true;
            }
        }

        if (!isVF && !isVOSTFR) {
            if (url.includes('/exclue/')) isVOSTFR = true;
            else if (url.includes('/films-vf-vostfr/')) {
                isVF = true;
                isVOSTFR = true;
            }
        }

        if (isVOSTFR && isVF) tags.push('MULTI');
        else if (isVOSTFR) tags.push('VOSTFR');
        else if (isVF) tags.push('VF');

        t = t.replace(/^[-\s]+|[-\s]+$/g, '').replace(/[\s\-:\.]+$/, '').replace(/^\s+/, '').replace(/\s{2,}/g, ' ').trim();
        
        if (tags.length > 0) {
            return `${t} [${tags.join('] [')}]`;
        }
        return t;
    }

    
        async function getHome(cb) {
        try {
            const { data: html } = await axios.get(baseUrl);
            if (typeof parseHtml === 'undefined') throw new Error("parseHtml missing");
            const doc = await parseHtml(html);
            
            const results = {};
            
            function parseItem(item) {
                const a = item.querySelector('a') || item.querySelector('.ps-link');
                const img = item.querySelector('img');
                if (!img) return null;
                const url = (a && a.getAttribute('href')) ? a.getAttribute('href') : (a && a.getAttribute('data-link'));
                if (!url) return null;
                let title = img.getAttribute('alt') || item.querySelector('.mov-t, .mov-title')?.textContent || "Anime";
                title = title.replace(/wiflix/gi, '').trim();
                let posterUrl = img.getAttribute('data-src') || img.getAttribute('src') || '';
                posterUrl = posterUrl.trim();
                let protocolMatch = posterUrl.match(/^(\/\/[^\/]+)/);
                if (protocolMatch) posterUrl = "https:" + posterUrl;
                else if (posterUrl && !posterUrl.startsWith('http')) posterUrl = baseUrl.replace(/\/$/, '') + (posterUrl.startsWith('/') ? '' : '/') + posterUrl;
                return new MultimediaItem({ title: formatAnimeTitle(title, url, posterUrl), url: url.startsWith('http') ? url : baseUrl+url, posterUrl, type: "anime" });
            }

            const mainMovs = Array.from(doc.querySelectorAll('.mov')).slice(0, 20);
            const mainItems = mainMovs.map(parseItem).filter(Boolean);
            if(mainItems.length > 0) results["Derniers Ajouts (Mixte)"] = mainItems;

            const sideMovs = Array.from(doc.querySelectorAll('.mov-side')).slice(0, 15);
            const sideItems = sideMovs.map(item => {
                const dt = parseItem(item);
                if(!dt) return null;
                const innerT = item.querySelector('.mov-side-title');
                if(innerT) dt.title = formatAnimeTitle(innerT.textContent.replace(/wiflix/gi, '').trim(), dt.url, dt.posterUrl);
                return dt;
            }).filter(Boolean);
            if(sideItems.length > 0) results["Populaires / Tendances"] = sideItems;

            // Fetch VF Page
            try {
               const { data: vfHtml } = await axios.get(baseUrl + '/animes-vf/');
               const vfDoc = await parseHtml(vfHtml);
               const vfMovs = Array.from(vfDoc.querySelectorAll('.mov')).slice(0, 15);
               const vfItems = vfMovs.map(parseItem).filter(Boolean);
               if(vfItems.length > 0) results["Récemment Ajoutés (VF)"] = vfItems;
            } catch(e) {}

            // Fetch VOSTFR Page
            try {
               const { data: vostfrHtml } = await axios.get(baseUrl + '/animes-vostfr/');
               const vostfrDoc = await parseHtml(vostfrHtml);
               const vostfrMovs = Array.from(vostfrDoc.querySelectorAll('.mov')).slice(0, 15);
               const vostfrItems = vostfrMovs.map(parseItem).filter(Boolean);
               if(vostfrItems.length > 0) results["Récemment Ajoutés (VOSTFR)"] = vostfrItems;
            } catch(e) {}

            cb({ success: true, data: results });
        } catch(e) {
            cb({ success: false, message: String(e) });
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
                // Ensure query is correctly formatted for DLE search which uses + for spaces
                let searchStr = q.trim();
                const params = `do=search&subaction=search&story=${encodeURIComponent(searchStr)}`;
                const response = await axios.post(`${baseUrl}/index.php?do=search`, params, {
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Referer': baseUrl }
                });
                
                const doc = await parseHtml(response.data);
                const items = Array.from(doc.querySelectorAll('.mov-side, .mov'));
                
                for (const el of items) {
                    const a = el.querySelector('a') || (el.tagName === 'A' ? el : null);
                    if(!a) continue;
                    let url = a.getAttribute('href');
                    if (!url || seen.has(url)) continue;
                    seen.add(url);

                    const titleEl = el.querySelector('.mov-side-title, .mov-title') || el.querySelector('img');
                    let title = titleEl ? (titleEl.textContent || titleEl.getAttribute('alt')) : 'French-Anime';
                    title = title.replace(/wiflix/gi, '').replace(/[\n\r\t]+/g, ' ').replace(/\s\s+/g, ' ').trim();
                    
                    const imgEl = el.querySelector('img');
                    let poster = imgEl ? (imgEl.getAttribute('data-src') || imgEl.getAttribute('src')) : '';
                    poster = (poster || '').trim();
                    let protocolMatch = poster.match(/^(\/\/[^\/]+)/);
                    if (protocolMatch) poster = "https:" + poster;
                    else if (poster && !poster.startsWith('http')) poster = baseUrl.replace(/\/$/, '') + (poster.startsWith('/') ? '' : '/') + poster;

                    results.push(new MultimediaItem({
                        title: formatAnimeTitle(title, url, poster), url: url.startsWith('http') ? url : baseUrl + url, posterUrl: poster, type: "anime"
                    }));
                }
            }
            cb({ success: true, data: results });
        } catch (e) {
            cb({ success: false, errorCode: "SEARCH_ERROR", message: String(e) });
        }
    }

    async function load(url, cb) {
        try {
            const response = await axios.get(url, { headers: { 'Referer': baseUrl, 'User-Agent': 'Mozilla/5.0' } });
            const html = response.data;
            const doc = await parseHtml(html);
            
            let title = "French-Anime";
            const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
            if(titleMatch) title = titleMatch[1].split(' en ')[0].replace(/wiflix/gi, '').replace(' VOSTFR', '').replace(' VF', '').trim();

            let posterUrl = "";
            const imgMatch = doc.querySelector('.slide-poster img, .mov-i img, img#posterimg, img[itemprop="image"], img[itemprop="thumbnailUrl"]');
            if (imgMatch) posterUrl = imgMatch.getAttribute('data-src') || imgMatch.getAttribute('src');
            posterUrl = (posterUrl || "").trim();
            if (posterUrl.startsWith('//')) posterUrl = "https:" + posterUrl;
            else if (posterUrl && !posterUrl.startsWith('http')) posterUrl = baseUrl.replace(/\/$/, '') + (posterUrl.startsWith('/') ? '' : '/') + posterUrl;
            
            let description = "";
            let descNode = doc.querySelector('[itemprop="description"], .fdesc');
            if (descNode) {
                description = descNode.textContent.replace(/wiflix/gi, '').trim();
            } else {
                const descNodes = Array.from(doc.querySelectorAll('.mov-desc:not(.mov-label)'));
                if(descNodes.length > 0) {
                    const longest = descNodes.reduce((a, b) => a.textContent.length > b.textContent.length ? a : b);
                    description = longest.textContent.replace(/wiflix/gi, '').trim();
                }
            }

            let year = "";
            let originalTitle = "";
            const lists = Array.from(doc.querySelectorAll('.mov-list li, ul.mov-list li'));
            lists.forEach(li => {
                const txt = li.textContent.toLowerCase();
                if(txt.includes('année') || txt.includes('annee')) {
                    const a = li.querySelector('a');
                    if(a) year = a.textContent.trim();
                }
                if(txt.includes('original')) {
                    originalTitle = li.textContent.replace(/titre original/ig, '').replace(/:/g, '').trim();
                }
            });
            
            if(originalTitle && originalTitle.toLowerCase() !== title.toLowerCase()) {
                description = `Titre Original : ${originalTitle}\n\n` + description;
            }

            const eps = [];
            
            const lineRegex = /(?:^|>|\n)\s*([0-9A-Za-z -]+)!\s*([^<\n\r]+)/gi;
            let lineMatch;
            const added = new Set();
            
            const langMatch = html.match(/<span itemprop="inLanguage">([^<]+)\/span>/i);
            const inLanguage = langMatch ? langMatch[1].toUpperCase() : "";
            
            let checkLanguage = inLanguage;
            if(!checkLanguage) checkLanguage = (html.match(/<li[^>]*><div class="mov-label">Version:?<\/div> \s*<div class="mov-desc">(.*?)<\/div>/i) || [])[1] || "";
            checkLanguage = checkLanguage.toUpperCase();

            const isGloballyVOSTFR = url.includes('-vostfr') || title.toUpperCase().includes('VOSTFR') || checkLanguage.includes('VOSTFR');
            const isGloballyVF = (!isGloballyVOSTFR && (url.includes('-vf') || url.includes('-french') || title.toUpperCase().includes('FRENCH') || title.toUpperCase().includes(' VF') || checkLanguage.includes('VF') || checkLanguage.includes('FRENCH')));
            
            let seasonNumber = 1;
            const seasonMatch = title.match(/saison\s*(\d+)/i) || title.match(/season\s*(\d+)/i) || originalTitle.match(/season\s*(\d+)/i) || originalTitle.match(/saison\s*(\d+)/i);
            if (seasonMatch) {
                seasonNumber = parseInt(seasonMatch[1], 10);
            } else {
                const numMatch = title.replace(/(vostfr|vf|french)\b/ig, '').trim().match(/\s+([2-9]|\d{2,})$/);
                if (numMatch) {
                    seasonNumber = parseInt(numMatch[1], 10);
                }
            }

            while ((lineMatch = lineRegex.exec(html)) !== null) {
                const epNameRaw = lineMatch[1].trim();
                if(epNameRaw.length > 30 || added.has(epNameRaw)) continue; 
                added.add(epNameRaw);

                let epName = isNaN(parseInt(epNameRaw)) ? epNameRaw : `Episode ${epNameRaw}`;
                const urlsLine = lineMatch[2].trim();
                
                let localDubStatus = isGloballyVOSTFR ? 'sub' : (isGloballyVF ? 'dub' : 'sub');
                if (epNameRaw.toLowerCase().includes('vostfr')) {
                    localDubStatus = 'sub';
                    epName = epName.replace(/vostfr/ig, '').trim();
                } else if (epNameRaw.toLowerCase().includes('vf')) {
                    localDubStatus = 'dub';
                    epName = epName.replace(/vf/ig, '').trim();
                }

                
                if (epName.toLowerCase().includes('vostfr')) {
                    localDubStatus = 'sub';
                    epName = epName.replace(/vostfr/ig, '').trim();
                } else if (epName.toLowerCase().includes('vf')) {
                    localDubStatus = 'dub';
                    epName = epName.replace(/vf/ig, '').trim();
                }

                const urls = urlsLine.split(',').map(u => u.trim()).filter(u => u.length > 5);
                const formattedUrls = urls.map(u => u.startsWith('//') ? 'https:' + u : u);
                
                eps.push(new Episode({
                    name: epName,
                    episode: parseInt(epName.match(/\d+/) ? epName.match(/\d+/)[0] : 0, 10) || 1,
                    posterUrl: posterUrl,
                    url: JSON.stringify(formattedUrls),
                    season: seasonNumber,
                    dubStatus: localDubStatus,
                    description: localDubStatus === 'dub' ? 'Version Française (VF)' : 'Version Originale Sous-Titrée (VOSTFR)'
                }));
            }
            
            if (eps.length === 0) {
                eps.push(new Episode({ name: "Film / Unique", episode: 1, posterUrl: posterUrl, url: "[]", season: seasonNumber, dubStatus: url.includes('-vf-') || url.includes('-vf.') ? 'dub' : 'sub' }));
            }
            
            // Collect related series/recommendations (other seasons/films linked on the same page)
            const recommendations = [];
            const relatedMatch = html.match(/<a class="mov-t nowrap" href="([^"]+)">([^<]+)<\/a>/g);
            if (relatedMatch) {
                function cleanTitleForMatch(t) {
                    return t.toLowerCase().replace(/vostfr|vf|french|saison\s*\d+|season\s*\d+|\d+$/ig, '').replace(/[^a-z0-9]/g, '');
                }
                const base1 = cleanTitleForMatch(title);
                const base2 = originalTitle ? cleanTitleForMatch(originalTitle) : base1;

                relatedMatch.forEach(rm => {
                    const m = rm.match(/href="([^"]+)">([^<]+)</);
                    if (m && m[1] !== url && m[2] !== title) {
                        const recTitle = m[2].trim();
                        const recBase = cleanTitleForMatch(recTitle);
                        // Ensure we don't match empty strings if base is too short
                        const isRelated = (base1.length > 2 && (recBase.includes(base1) || base1.includes(recBase))) || 
                                          (base2.length > 2 && (recBase.includes(base2) || base2.includes(recBase)));
                        
                        if (isRelated) {
                            recommendations.push(new MultimediaItem({
                                title: formatAnimeTitle(recTitle, m[1], posterUrl),
                                url: m[1].startsWith('http') ? m[1] : baseUrl + m[1],
                                posterUrl: posterUrl,
                                type: "series"
                            }));
                        }
                    }
                });
            }

            let finalRecommendations = [];
            if (recommendations.length > 0) {
                // Fetch valid posters for a limited number of related seasons (max 5) to avoid excessive requests
                finalRecommendations = await Promise.all(recommendations.slice(0, 5).map(async (rec) => {
                    try {
                        const recRes = await axios.get(rec.url, { headers: { 'Referer': baseUrl, 'User-Agent': 'Mozilla/5.0' } });
                        // Extract exact poster for the recommended series
                        let recImgMatch = recRes.data.match(/<img[^>]+id="posterimg"[^>]+src="([^"]+)"/i) 
                             || recRes.data.match(/<img[^>]+itemprop="image"[^>]+src="([^"]+)"/i)
                             || recRes.data.match(/<div class="mov-i img-box">\s*<img src="([^"]+)"/i);
                             
                        if (recImgMatch) {
                            let extractedPoster = recImgMatch[1].trim();
                            if(!extractedPoster.includes('[xfvalue_img]')) {
                                if (extractedPoster.startsWith('//')) extractedPoster = "https:" + extractedPoster;
                                else if (!extractedPoster.startsWith('http')) extractedPoster = baseUrl.replace(/\/$/, '') + (extractedPoster.startsWith('/') ? '' : '/') + extractedPoster;
                                rec.posterUrl = extractedPoster;
                            }
                        }
                    } catch(err) {
                        // Keep the default fallback poster on error
                    }
                    return rec;
                }));
            }

            cb({ 
                success: true, 
                data: new MultimediaItem({
                    title: formatAnimeTitle(title, url, posterUrl), url: url, posterUrl: posterUrl,
                    type: eps.length > 1 ? "series" : "movie",
                    description: description, year: parseInt(year) || null,
                    episodes: eps,
                    recommendations: finalRecommendations.length > 0 ? finalRecommendations : undefined
                })
            });
        } catch (e) { cb({ success: false, errorCode: "LOAD_ERROR", message: String(e) }); }
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
            let streamUrls = []; try { streamUrls = JSON.parse(url); } catch(e) {}
            const streams = [];
            for (let streamUrl of streamUrls) {
                if (streamUrl.startsWith('//')) streamUrl = 'https:' + streamUrl;
                try {
                    const resolved = await Extractors.resolveStream(streamUrl);
                    if (resolved) {
                        streams.push(resolved);
                    }
                } catch(e) {
                }
            }
            cb({ success: true, data: streams });
        } catch (e) {
            cb({ success: false, errorCode: "STREAM_ERROR", message: String(e) });
        }
    }

    globalThis.getHome = getHome; globalThis.search = search; globalThis.load = load; globalThis.loadStreams = loadStreams;
