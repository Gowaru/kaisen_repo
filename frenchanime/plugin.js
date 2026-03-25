(function() {
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
                return new MultimediaItem({ title, url: url.startsWith('http') ? url : baseUrl+url, posterUrl, type: "anime" });
            }

            const mainMovs = Array.from(doc.querySelectorAll('.mov')).slice(0, 20);
            const mainItems = mainMovs.map(parseItem).filter(Boolean);
            if(mainItems.length > 0) results["Derniers Ajouts (Mixte)"] = mainItems;

            const sideMovs = Array.from(doc.querySelectorAll('.mov-side')).slice(0, 15);
            const sideItems = sideMovs.map(item => {
                const dt = parseItem(item);
                if(!dt) return null;
                const innerT = item.querySelector('.mov-side-title');
                if(innerT) dt.title = innerT.textContent.replace(/wiflix/gi, '').trim();
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
                        title, url: url.startsWith('http') ? url : baseUrl + url, posterUrl: poster, type: "anime"
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
            
            // Check global title or URL for obvious dub status.
            // Explicitly search itemprop="inLanguage" text and other metadata if needed.
            const langMatch = html.match(/<span itemprop="inLanguage">([^<]+)\/span>/i);
            const inLanguage = langMatch ? langMatch[1].toUpperCase() : "";
            
            let checkLanguage = inLanguage;
            if(!checkLanguage) checkLanguage = (html.match(/<li[^>]*><div class="mov-label">Version:?<\/div> \s*<div class="mov-desc">(.*?)<\/div>/i) || [])[1] || "";
            checkLanguage = checkLanguage.toUpperCase();

            const isGloballyVOSTFR = url.includes('-vostfr') || title.toUpperCase().includes('VOSTFR') || checkLanguage.includes('VOSTFR');
            const isGloballyVF = (!isGloballyVOSTFR && (url.includes('-vf') || url.includes('-french') || title.toUpperCase().includes('FRENCH') || title.toUpperCase().includes(' VF') || checkLanguage.includes('VF') || checkLanguage.includes('FRENCH')));
            
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

                
                // If the episode name has VF or VOSTFR explicitely, clean it and set correct dub
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
                    season: 1,
                    dubStatus: localDubStatus,
                    description: localDubStatus === 'dub' ? 'Version Française (VF)' : 'Version Originale Sous-Titrée (VOSTFR)'
                }));
            }
            
            if (eps.length === 0) {
                eps.push(new Episode({ name: "Film / Unique", episode: 1, posterUrl: posterUrl, url: "[]", season: 1, dubStatus: url.includes('-vf-') || url.includes('-vf.') ? 'dub' : 'sub' }));
            }

            cb({ 
                success: true, 
                data: new MultimediaItem({
                    title: title, url: url, posterUrl: posterUrl,
                    type: eps.length > 1 ? "series" : "movie",
                    description: description, year: parseInt(year) || null,
                    episodes: eps
                })
            });
        } catch (e) { cb({ success: false, errorCode: "LOAD_ERROR", message: String(e) }); }
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
        async extractUqload(url) {
            try {
                const finalUrl = url.replace('uqload.bz', 'uqload.com'); 
                const res = await axios.get(finalUrl, { headers: { 'Referer': 'https://uqload.com' } });
                const match = res.data.match(/sources:\s*\["([^"]+)"\]/i);
                if (match) return { url: match[1], quality: 'Auto', source: 'Uqload', headers: { 'Referer': 'https://uqload.com' } };
            } catch (e) {} return null;
        },
        async extractVudeo(url) {
            try {
                const res = await axios.get(url);
                const match = res.data.match(/sources:\s*\["([^"]+)"\]/i) || res.data.match(/src:\s*["']([^"']+\.mp4)["']/i);
                if (match) return { url: match[1], quality: 'Auto', source: 'Vudeo' };
            } catch (e) {} return null;
        },
        async extractVidmoly(url) {
            try {
                const res = await axios.get(url, { headers: { 'Referer': 'https://vidmoly.to/' } });
                const match = res.data.match(/file:\s*["']([^"']+\.mp4)["']/i) || res.data.match(/file:\s*["']([^"']+\.m3u8[^"']*)["']/i);
                if (match) return { url: match[1], quality: 'Auto', source: 'Vidmoly', headers: { 'Referer': 'https://vidmoly.to/' } };
            } catch (e) {} return null;
        },
        async extractLuluvid(url) {
            try {
                const res = await axios.get(url);
                const match = res.data.match(/file:\s*["']([^"']+\.mp4)["']/i) || res.data.match(/file:\s*["']([^"']+\.m3u8[^"']*)["']/i);
                if (match) return { url: match[1], quality: 'Auto', source: 'Luluvid' };
            } catch (e) {} return null;
        },
        async resolveStream(url) {
            let finalStream = null;
            if (url.includes('vidoza')) finalStream = await this.extractVidoza(url);
            else if (url.includes('sibnet')) finalStream = await this.extractSibnet(url);
            else if (url.includes('sendvid')) finalStream = await this.extractSendvid(url);
            else if (url.includes('uqload')) finalStream = await this.extractUqload(url);
            else if (url.includes('vudeo')) finalStream = await this.extractVudeo(url);
            else if (url.includes('vidmoly')) finalStream = await this.extractVidmoly(url);
            else if (url.includes('luluvid')) finalStream = await this.extractLuluvid(url);
            
            if (finalStream) {
                return new StreamResult({
                    url: finalStream.url, quality: finalStream.quality, source: finalStream.source,
                    headers: finalStream.headers || {}
                });
            }
            
            return null;
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
})();
