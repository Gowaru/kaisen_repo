(function() {

    const axios = {
        get: async (url, config = {}) => {
            const h = config.headers || {};
            if (typeof http_get !== 'undefined') {
                const r = await http_get(url, h);
                
                let parsed = r.body;
                try { parsed = JSON.parse(r.body); } catch(e) {}
                return { data: parsed };
        
            }
            return { data: "" }; // Fallback
        },
        post: async (url, data, config = {}) => {
            const h = config.headers || {};
            if (typeof http_post !== 'undefined') {
                const r = await http_post(url, h, data);
                
                let parsed = r.body;
                try { parsed = JSON.parse(r.body); } catch(e) {}
                return { data: parsed };
        
            }
            return { data: "" }; // Fallback
        }
    };

    /**
     * @typedef {Object} Response
     * @property {boolean} success
     * @property {any} [data]
     * @property {string} [errorCode]
     * @property {string} [message]
     */

    /**
     * @type {import('@skystream/sdk').Manifest}
     */
    // var manifest is injected at runtime

    async function getHome(cb) {
        try {
            const baseUrl = typeof manifest !== 'undefined' ? manifest.baseUrl : 'https://french-anime.com';
            const { data: html } = await axios.get(baseUrl);
            
            const results = [];
            
            // Typical DLE regex: <div class="image"> or <div class="movie-poster"> ... <a href="URL"><img src="IMG" alt="TITLE"/>
            const regex = /<div[^>]*class="(?:movie-poster|image|poster)"[^>]*>[\s\S]*?<a[^>]+href="(https?:\/\/[^"]+\.html)"[^>]*>[\s\S]*?<img[^>]+src="([^"]+)"[^>]*alt="([^"]+)"/gi;
            // Also try a simpler fallback
            const regex2 = /<a[^>]+href="(https?:\/\/french-anime[^"]+\.html)"[^>]*>[\s\S]*?<img[^>]+src="([^"]+)"(?:[^>]*alt="([^"]+)")?/gi;
            
            let match;
            const seen = new Set();
            while((match = regex.exec(html)) !== null && results.length < 20) {
                let url = match[1];
                let poster = match[2];
                let title = match[3] ? match[3].replace(/[\r\n\t]+/g, ' ').replace(/wiflix/gi, '').trim() : "Anime";
                
                if(!poster.startsWith('http')) {
                    poster = baseUrl + (poster.startsWith('/') ? '' : '/') + poster;
                }
                
                if(!seen.has(url)) {
                    seen.add(url);
                    results.push(new MultimediaItem({
                        title: title,
                        url: url,
                        posterUrl: poster,
                        type: "anime"
                    }));
                }
            }

            if(results.length === 0) {
                while((match = regex2.exec(html)) !== null && results.length < 15) {
                    let url = match[1];
                    if(!seen.has(url)) {
                        seen.add(url);
                        results.push(new MultimediaItem({
                            title: (match[3] || "Anime").replace(/wiflix/gi, '').trim(),
                            url: url,
                            posterUrl: match[2].startsWith('http') ? match[2] : baseUrl + match[2],
                            type: "anime"
                        }));
                    }
                }
            }
            
            cb({ 
                success: true, 
                data: { "Derniers Ajouts": results } 
            });
        } catch(e) {
            cb({ success: false, message: String(e) });
        }
    }

    async function search(query, cb) {
        try {
            const baseUrl = typeof manifest !== 'undefined' ? manifest.baseUrl : 'https://french-anime.com';
            const params = `do=search&subaction=search&story=${encodeURIComponent(query)}`;
            
            const response = await axios.post(`${baseUrl}/index.php?do=search`, params, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Referer': baseUrl
                }
            });
            const html = response.data;
            const doc = await parseHtml(html);
            
            const results = [];
            const seen = new Set();

            const items = Array.from(doc.querySelectorAll('.mov-side'));
            for (const el of items) {
                const url = el.getAttribute('href');
                if (!url || seen.has(url)) continue;
                seen.add(url);

                const titleEl = el.querySelector('.mov-side-title');
                const imgEl = el.querySelector('img');
                
                let poster = imgEl ? imgEl.getAttribute('src') : '';
                if (poster && !poster.startsWith('http')) {
                    poster = baseUrl + (poster.startsWith('/') ? '' : '/') + poster;
                }

                results.push(new MultimediaItem({
                    title: titleEl ? titleEl.textContent.trim().replace(/wiflix/gi, '') : 'French-Anime',
                    url: url.startsWith('http') ? url : baseUrl + url,
                    posterUrl: poster,
                    type: "anime"
                }));
            }
            
            cb({ success: true, data: results });
        } catch (e) {
            cb({ success: false, errorCode: "SEARCH_ERROR", message: String(e) });
        }
    }

    async function load(url, cb) {
        try {
            const response = await axios.get(url, { headers: { 'Referer': manifest.baseUrl } });
            const html = response.data;
            
            // Extract Title
            let title = "French-Anime";
            const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
            if(titleMatch) {
                title = titleMatch[1].split(' en ')[0].replace(/wiflix/gi, '').replace(' VOSTFR', '').replace(' VF', '').trim();
            }

            // Extract Poster
            let posterUrl = "";
            const posterMatch = html.match(/<div[^>]*class="slide-poster"[^>]*>[\s\S]*?<img[^>]+src="([^"]+)"/i);
            if (posterMatch) {
                posterUrl = posterMatch[1].startsWith('http') ? posterMatch[1] : manifest.baseUrl + posterMatch[1];
            }
            
            // Extract Episodes directly from the HTML lines bypassing structural divs
            const eps = [];
            const lineRegex = /(?:^|\n)\s*([0-9A-Za-z -]+)!\s*([^<\n]+)/gi;
            let lineMatch;
            const added = new Set();
            
            while ((lineMatch = lineRegex.exec(html)) !== null) {
                const epNameRaw = lineMatch[1].trim();
                
                // French-Anime puts sometimes lines like `1!` or `OAV!`
                if(epNameRaw.length > 10 || added.has(epNameRaw)) continue; // ignore false positives
                added.add(epNameRaw);

                const epName = isNaN(parseInt(epNameRaw)) ? epNameRaw : `Episode ${epNameRaw}`;
                const urlsLine = lineMatch[2].trim();
                const urls = urlsLine.split(',').map(u => u.trim()).filter(u => u.length > 5);
                
                // Add scheme to protocol-relative URLs
                const formattedUrls = urls.map(u => u.startsWith('//') ? 'https:' + u : u);
                
                eps.push(new Episode({
                    name: epName,
                    url: JSON.stringify(formattedUrls),
                    season: 1,
                    dubStatus: url.includes('-vf-') || url.includes('-vf.') ? 'dub' : 'sub'
                }));
            }
            
            if (eps.length === 0) {
                eps.push(new Episode({
                    name: "Film / Unique",
                    url: JSON.stringify([]),
                    season: 1,
                    dubStatus: url.includes('-vf-') || url.includes('-vf.') ? 'dub' : 'sub'
                }));
            }

            cb({ 
                success: true, 
                data: new MultimediaItem({
                    title: title,
                    url: url,
                    posterUrl: posterUrl,
                    type: eps.length > 1 ? "series" : "movie",
                    episodes: eps
                })
            });
        } catch (e) {
            cb({ success: false, errorCode: "LOAD_ERROR", message: String(e) });
        }
    }

    async function loadStreams(url, cb) {
        try {
            let streamUrls = [];
            try {
                streamUrls = JSON.parse(url);
            } catch(ign) {}

            const streams = [];
            
            for (const streamUrl of streamUrls) {
                let sourceName = "Lecteur French-Anime";
                if(streamUrl.includes('sibnet')) sourceName = "Sibnet";
                else if(streamUrl.includes('myvi')) sourceName = "MyVi";
                else if(streamUrl.includes('ok.ru')) sourceName = "OK";
                else if(streamUrl.includes('uqload')) sourceName = "Uqload";
                else if(streamUrl.includes('vidoza')) sourceName = "Vidoza";
                else if(streamUrl.includes('verystream') || streamUrl.includes('vstream')) sourceName = "Verystream";
                else if(streamUrl.includes('sendvid')) sourceName = "Sendvid";
                else if(streamUrl.includes('uptostream')) sourceName = "Uptostream";
                else if(streamUrl.includes('voe.sx')) sourceName = "Voe";
                else if(streamUrl.includes('dood')) sourceName = "Doodstream";
                else if(streamUrl.includes('streamsb')) sourceName = "StreamSB";

                streams.push(new StreamResult({
                    url: streamUrl,
                    source: sourceName
                }));
            }

            cb({ success: true, data: streams });
        } catch (e) {
            cb({ success: false, errorCode: "STREAM_ERROR", message: String(e) });
        }
    }

    globalThis.getHome = getHome;
    globalThis.search = search;
    globalThis.load = load;
    globalThis.loadStreams = loadStreams;
})();
