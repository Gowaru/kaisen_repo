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
                const r = await http_post(url, h, data);
                let parsed = r.body;
                try { parsed = JSON.parse(r.body); } catch(e) {}
                return { data: parsed, status: r.status };
            }
            return { data: "" };
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
                        title: (title)?.replace(/[\n\r\t]+/g, ' ').replace(/\s\s+/g, ' ').trim(),
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
                    title: titleEl ? titleEl.textContent.trim().replace(/wiflix/gi, '').replace(/[\n\r\t]+/g, ' ').replace(/\s\s+/g, ' ').trim() : 'French-Anime',
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
            const response = await axios.get(url, { headers: { 'Referer': baseUrl , 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'} });
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
                posterUrl = posterMatch[1].startsWith('http') ? posterMatch[1] : baseUrl + posterMatch[1];
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
                    episode: parseInt(epName.match(/\d+/) ? epName.match(/\d+/)[0] : 0, 10),
                    url: JSON.stringify(formattedUrls),
                    season: 1,
                    dubStatus: url.includes('-vf-') || url.includes('-vf.') ? 'dub' : 'sub'
                }));
            }
            
            if (eps.length === 0) {
                eps.push(new Episode({
                    name: "Film / Unique",
                    episode: 1,
                    url: JSON.stringify([]),
                    season: 1,
                    dubStatus: url.includes('-vf-') || url.includes('-vf.') ? 'dub' : 'sub'
                }));
            }

            cb({ 
                success: true, 
                data: new MultimediaItem({
                    title: (title)?.replace(/[\n\r\t]+/g, ' ').replace(/\s\s+/g, ' ').trim(),
                    url: url,
                    posterUrl: (function(p){ if(!p) return ''; if(p.startsWith('http')) return p; return baseUrl + (p.startsWith('/') ? '' : '/') + p; })(posterUrl),
                    type: eps.length > 1 ? "series" : "movie",
                    episodes: eps
                })
            });
        } catch (e) {
            cb({ success: false, errorCode: "LOAD_ERROR", message: String(e) });
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

                const resolved = await Extractors.resolveStream(streamUrl);
                if(resolved) { resolved.source = sourceName; streams.push(resolved); }
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
