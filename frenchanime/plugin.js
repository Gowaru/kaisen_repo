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
                const a = item.querySelector('a');
                const img = item.querySelector('img');
                if (!a || !img) return null;
                const url = a.getAttribute('href');
                let title = img.getAttribute('alt') || item.querySelector('.mov-t, .mov-title')?.textContent || "Anime";
                title = title.replace(/wiflix/gi, '').trim();
                let posterUrl = img.getAttribute('data-src') || img.getAttribute('src') || '';
                if (posterUrl && !posterUrl.startsWith('http')) posterUrl = baseUrl + (posterUrl.startsWith('/') ? '' : '/') + posterUrl;
                return new MultimediaItem({ title, url: url.startsWith('http') ? url : baseUrl+url, posterUrl, type: "anime" });
            }

            const mainMovs = Array.from(doc.querySelectorAll('.mov')).slice(0, 20);
            const mainItems = mainMovs.map(parseItem).filter(Boolean);
            if(mainItems.length > 0) results["Derniers Ajouts"] = mainItems;

            const sideMovs = Array.from(doc.querySelectorAll('.mov-side')).slice(0, 15);
            const sideItems = sideMovs.map(item => {
                const dt = parseItem(item);
                if(!dt) return null;
                const innerT = item.querySelector('.mov-side-title');
                if(innerT) dt.title = innerT.textContent.replace(/wiflix/gi, '').trim();
                return dt;
            }).filter(Boolean);
            if(sideItems.length > 0) results["Populaires / Tendances"] = sideItems;

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
                const params = `do=search&subaction=search&story=${encodeURIComponent(q)}`;
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
                    if (poster && !poster.startsWith('http')) poster = baseUrl + (poster.startsWith('/') ? '' : '/') + poster;

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
            const imgMatch = doc.querySelector('.slide-poster img');
            if (imgMatch) posterUrl = imgMatch.getAttribute('data-src') || imgMatch.getAttribute('src');
            if (posterUrl && !posterUrl.startsWith('http')) posterUrl = baseUrl + posterUrl;
            
            let description = "";
            const descNode = doc.querySelector('.mov-desc:not(.mov-label), .fdesc, [itemprop="description"]');
            if (descNode) description = descNode.textContent.replace(/wiflix/gi, '').trim();

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
            const lineRegex = /(?:^|\n)\s*([0-9A-Za-z -]+)!\s*([^<\n]+)/gi;
            let lineMatch;
            const added = new Set();
            
            while ((lineMatch = lineRegex.exec(html)) !== null) {
                const epNameRaw = lineMatch[1].trim();
                if(epNameRaw.length > 10 || added.has(epNameRaw)) continue; 
                added.add(epNameRaw);

                const epName = isNaN(parseInt(epNameRaw)) ? epNameRaw : `Episode ${epNameRaw}`;
                const urlsLine = lineMatch[2].trim();
                const urls = urlsLine.split(',').map(u => u.trim()).filter(u => u.length > 5);
                const formattedUrls = urls.map(u => u.startsWith('//') ? 'https:' + u : u);
                
                eps.push(new Episode({
                    name: epName,
                    episode: parseInt(epName.match(/\d+/) ? epName.match(/\d+/)[0] : 0, 10) || 1,
                    url: JSON.stringify(formattedUrls),
                    season: 1,
                    dubStatus: url.includes('-vf-') || url.includes('-vf.') ? 'dub' : 'sub'
                }));
            }
            
            if (eps.length === 0) {
                eps.push(new Episode({ name: "Film / Unique", episode: 1, url: "[]", season: 1, dubStatus: url.includes('-vf-') || url.includes('-vf.') ? 'dub' : 'sub' }));
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
        async resolveStream(url) {
            return new StreamResult({ url: url, quality: 'Auto', source: new URL(url).hostname });
        }
    };

    async function loadStreams(url, cb) {
        try {
            let streamUrls = []; try { streamUrls = JSON.parse(url); } catch(e) {}
            const streams = [];
            for (const streamUrl of streamUrls) {
                let sourceName = "Lecteur French-Anime";
                if(streamUrl.includes('sibnet')) sourceName = "Sibnet";
                else if(streamUrl.includes('myvi')) sourceName = "MyVi";
                else if(streamUrl.includes('uqload')) sourceName = "Uqload";
                else if(streamUrl.includes('vidoza')) sourceName = "Vidoza";
                else if(streamUrl.includes('sendvid')) sourceName = "Sendvid";
                
                streams.push(new StreamResult({ url: streamUrl, source: sourceName, quality: 'Auto' }));
            }
            cb({ success: true, data: streams });
        } catch (e) {
            cb({ success: false, errorCode: "STREAM_ERROR", message: String(e) });
        }
    }

    globalThis.getHome = getHome; globalThis.search = search; globalThis.load = load; globalThis.loadStreams = loadStreams;
})();
