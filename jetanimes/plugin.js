(function () {

        
    const baseUrl = typeof manifest !== 'undefined' ? manifest.baseUrl : 'https://jetanimes.com';
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
     * Loads the home screen categories.
     */
    async function getHome(cb) {
        try {
            const response = await axios.get(baseUrl);
            const html = response.data;

            const data = {};

            // Helper to clean entities
            const clean = (str) => {
                if (!str) return "";
                return str.replace(/&#([0-9]+);/g, (m, c) => String.fromCharCode(c))
                          .replace(/&rsquo;/g, "'")
                          .replace(/&amp;/g, "&")
                          .replace(/&quot;/g, '"')
                          .trim();
            };

            // 1. Featured / Vedette (post-featured)
            const featured = [];
            const articleRegex = /<article id="post-featured-(\d+)" class="item (?:movies|tvshows)">([\s\S]*?)<\/article>/gi;
            let match;
            while ((match = articleRegex.exec(html)) !== null) {
                const artHtml = match[2];
                const imgMatch = artHtml.match(/<img src="([^"]+)"/);
                const urlMatch = artHtml.match(/<a href="([^"]+)"/);
                const titleMatch = artHtml.match(/<h3><a [^>]*>([^<]+)<\/a><\/h3>/);
                
                if (urlMatch && imgMatch) {
                    featured.push(new MultimediaItem({
                        url: urlMatch[1],
                        posterUrl: (function(p){ if(!p) return ''; if(p.startsWith('http')) return p; return baseUrl + (p.startsWith('/') ? '' : '/') + p; })(imgMatch[1]),
                        title: (clean(titleMatch ? titleMatch[1] : ""))?.replace(/[\n\r\t]+/g, ' ').replace(/\s\s+/g, ' ').trim(),
                        type: "anime"
                    }));
                }
            }
            if (featured.length > 0) data["Séries en Vedette"] = featured;

            // 2. Main sections by headers
            // Split by h2 to group sections
            const segments = html.split(/<h2[^>]*>/);
            for (let i = 1; i < segments.length; i++) {
                const seg = segments[i];
                const headerEnd = seg.indexOf('</h2>');
                if (headerEnd === -1) continue;
                
                const title = clean(seg.substring(0, headerEnd));
                if (title.includes("Années") || title.includes("Propositions")) continue;
                
                const items = [];
                const itemRegex = /<article id="post-(\d+)" class="item (?:movies|tvshows|se episodes|se seasons)"[^>]*>([\s\S]*?)<\/article>/gi;
                let itMatch;
                while ((itMatch = itemRegex.exec(seg)) !== null) {
                    const itHtml = itMatch[2];
                    const imgMatch = itHtml.match(/<img src="([^"]+)"/);
                    const urlMatch = itHtml.match(/<a href="([^"]+)"/);
                    const serieMatch = itHtml.match(/<span class="serie">([^<]+)<\/span>/);
                    const epNameMatch = itHtml.match(/<h3><a [^>]*>([^<]+)<\/a><\/h3>/);

                    if (urlMatch && imgMatch) {
                        let finalTitle = "";
                        if (serieMatch && epNameMatch) {
                            finalTitle = serieMatch[1] + " " + epNameMatch[1];
                        } else {
                            finalTitle = (epNameMatch ? epNameMatch[1] : "");
                        }
                        
                        items.push(new MultimediaItem({
                            url: urlMatch[1],
                            posterUrl: (function(p){ if(!p) return ''; if(p.startsWith('http')) return p; return baseUrl + (p.startsWith('/') ? '' : '/') + p; })(imgMatch[1]),
                            title: clean(finalTitle),
                            type: "anime"
                        }));
                    }
                }
                
                if (items.length > 0) {
                    data[title] = items;
                }
            }

            cb({ success: true, data });
        } catch (error) {
            cb({ success: false, errorCode: "HOME_ERROR", message: error.message });
        }
    }

    /**
     * Searches for media items.
     */
    async function search(query, cb) {
        try {
            const homeRes = await axios.get(baseUrl);
            const homeHtml = homeRes.data;
            
            const nonceMatch = homeHtml.match(/"nonce":"([^"]+)"/);
            if (!nonceMatch) throw new Error("Search nonce not found");
            const nonce = nonceMatch[1];
            
            const searchUrl = `${baseUrl}/wp-json/dooplay/search/?keyword=${encodeURIComponent(query)}&nonce=${nonce}`;
            const res = await axios.get(searchUrl);
            const json = res.data;
            
            const results = [];
            for (const key in json) {
                const item = json[key];
                if (item && item.title) {
                    results.push(new MultimediaItem({
                        title: (item.title)?.replace(/[\n\r\t]+/g, ' ').replace(/\s\s+/g, ' ').trim(),
                        url: item.url,
                        posterUrl: (function(p){ if(!p) return ''; if(p.startsWith('http')) return p; return baseUrl + (p.startsWith('/') ? '' : '/') + p; })(item.img),
                        type: "anime"
                    }));
                }
            }
            cb({ success: true, data: results });
        } catch (error) {
            cb({ success: false, errorCode: "SEARCH_ERROR", message: error.message });
        }
    }

    /**
     * Loads details for a specific media item.
     */
    async function load(url, cb) {
        try {
            const response = await axios.get(url);
            const html = response.data;

            const title = (html.match(/<h1>([^<]+)<\/h1>/) || [])[1] || "Titre inconnu";
            const descriptionMatch = html.match(/<div class="wp-content">\s*<p>([\s\S]*?)<\/p>/);
            const description = descriptionMatch ? descriptionMatch[1].replace(/<[^>]+>/g, "").trim() : "";
            const posterUrl = (html.match(/<div class="poster">\s*<img itemprop="image" src="([^"]+)"/) || [])[1] || "";
            const yearStr = (html.match(/<span class="date" itemprop="dateCreated">([^<]+)<\/span>/) || [])[1] || "";
            const year = parseInt(yearStr.match(/\d{4}/)?.[0]) || 0;

            const episodes = [];
            const seasonRegex = /<div class='se-c'>\s*<div class='se-q'>\s*<span class='se-t[^']*'>([0-9]+)<\/span>([\s\S]*?)<ul class='episodios'>([\s\S]*?)<\/ul>/gi;
            let seasonMatch;
            while ((seasonMatch = seasonRegex.exec(html)) !== null) {
                const seasonNum = parseInt(seasonMatch[1]);
                const blockHtml = seasonMatch[3];
                const episodeRegex = /<li[^>]*>\s*<div class='imagen'><img src='([^']*)'><\/div>\s*<div class='numerando'>(\d+)\s*-\s*([0-9.]+)<\/div>\s*<div class='episodiotitle'>\s*<a href='([^']+)'>([^<]+)<\/a>/gi;
                let epMatch;
                while ((epMatch = episodeRegex.exec(blockHtml)) !== null) {
                    episodes.push(new Episode({
                        name: epMatch[5].trim(),
                        episode: parseInt(epMatch[5].trim().match(/\d+/) ? epMatch[5].trim().match(/\d+/)[0] : 0, 10),
                        url: epMatch[4],
                        posterUrl: epMatch[1],
                        season: seasonNum || 1
                    }));
                }
            }

            if (episodes.length === 0) {
                episodes.push(new Episode({ name: "Film / Episode", episode: 1, url, season: 1 }));
            }

            cb({
                success: true,
                data: new MultimediaItem({
                    title: (title.trim())?.replace(/[\n\r\t]+/g, ' ').replace(/\s\s+/g, ' ').trim(),
                    description: description,
                    posterUrl,
                    year,
                    episodes,
                    type: episodes.length > 2 ? "series" : "movie"
                })
            });
        } catch (error) {
            cb({ success: false, errorCode: "LOAD_ERROR", message: error.message });
        }
    }

    /**
     * Resolves streams for a specific media item or episode.
     */
    
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
            const response = await axios.get(url, { headers: { 'Referer': baseUrl , 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'} });
            const html = response.data;

            // Robust post ID extraction
            const postIdMatch = html.match(/postid-(\d+)/) || html.match(/id="([^"]*player[^"]*)"[^>]*data-post="(\d+)"/);
            if (!postIdMatch) throw new Error("ID du post non trouvé");
            const postId = postIdMatch[1] || postIdMatch[2];
            
            const streams = [];
            // Try both 'tv' and 'movie' types as DooPlay can be inconsistent
            const types = url.includes('/episodes/') ? ['tv', 'movie'] : ['movie', 'tv'];

            for (const type of types) {
                for (let nume = 1; nume <= 10; nume++) {
                    try {
                        // Manually construct form data string to avoid URLSearchParams issues
                        const params = "action=doo_player_ajax&post=" + postId + "&nume=" + nume + "&type=" + type;
                        
                        const ajaxRes = await axios.post(`${baseUrl}/wp-admin/admin-ajax.php`, params, {
                            headers: { 
                                'Content-Type': 'application/x-www-form-urlencoded',
                                'X-Requested-With': 'XMLHttpRequest',
                                'Referer': url
                            }
                        });
                        
                        if (ajaxRes.status === 200 && ajaxRes.data) {
                            const embedData = ajaxRes.data;
                            if (embedData && embedData.embed_url) {
                                let embedUrl = embedData.embed_url.trim();
                                // Extraction if embed_url is an iframe string
                                if (embedUrl.includes('<iframe')) {
                                    const srcMatch = embedUrl.match(/src=["'](.*?)["']/);
                                    if (srcMatch) embedUrl = srcMatch[1];
                                }
                                
                                if (embedUrl && embedUrl !== "false") {
                                    if (embedUrl.startsWith('//')) embedUrl = 'https:' + embedUrl;
                                    
                                    let hostName = "Lecteur " + nume;
                                    try { hostName = new URL(embedUrl).hostname.replace('www.', ''); } catch(e) {}
                                    
                                    streams.push(await Extractors.resolveStream(embedUrl));
                                } else {
                                    break; // No more players for this type
                                }
                            } else {
                                break;
                            }
                        } else {
                            break;
                        }
                    } catch (e) {
                        break;
                    }
                }
                if (streams.length > 0) break; // Found streams, don't try other type
            }

            // Final fallback: Look for iframes directly in HTML (rare for DooPlay but safe)
            if (streams.length === 0) {
                const ifrMatch = html.match(/<iframe[^>]+src=["'](https?:\/\/[^"']+)["']/i);
                if (ifrMatch) {
                    streams.push(await Extractors.resolveStream(ifrMatch[1]));
                }
            }

            cb({ success: true, data: streams });
        } catch (error) {
            cb({ success: false, errorCode: "STREAM_ERROR", message: error.message });
        }
    }

    globalThis.getHome = getHome;
    globalThis.search = search;
    globalThis.load = load;
    globalThis.loadStreams = loadStreams;
})();
