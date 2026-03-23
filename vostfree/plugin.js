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

    // 1. (Optional) Register your plugin settings
    //     registerSettings([
    //         { id: "quality", name: "Default Quality", type: "select", options: ["1080p", "720p"], default: "1080p" },
    //         { id: "prefer_dub", name: "Prefer Dubbed", type: "toggle", default: false }
    //     ]);

    async function getHome(cb) {
        try {
            const baseUrl = typeof manifest !== 'undefined' ? manifest.baseUrl : 'https://vostfree.ws';
            const { data: html } = await axios.get(baseUrl);
            
            const results = [];
            
            // Typical DLE regex: <div class="image"> or <div class="movie-poster"> ... <a href="URL"><img src="IMG" alt="TITLE"/>
            const regex = /<div[^>]*class="(?:movie-poster|image|poster)"[^>]*>[\s\S]*?<a[^>]+href="(https?:\/\/[^"]+\.html)"[^>]*>[\s\S]*?<img[^>]+src="([^"]+)"[^>]*alt="([^"]+)"/gi;
            // Also try a simpler fallback
            const regex2 = /<a[^>]+href="(https?:\/\/vostfree[^"]+\.html)"[^>]*>[\s\S]*?<img[^>]+src="([^"]+)"(?:[^>]*alt="([^"]+)")?/gi;
            
            let match;
            const seen = new Set();
            while((match = regex.exec(html)) !== null && results.length < 20) {
                let url = match[1];
                let poster = match[2];
                let title = match[3] ? match[3].replace(/[\r\n\t]+/g, ' ').trim() : "Anime";
                
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
                            title: match[3] || "Anime",
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
            const baseUrl = typeof manifest !== 'undefined' ? manifest.baseUrl : 'https://vostfree.ws';
            
            const params = `do=search&subaction=search&story=${encodeURIComponent(query)}`;
            
            const response = await axios.post(`${baseUrl}/index.php?do=search`, params, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Referer': baseUrl
                }
            });
            const html = response.data;
            
            const results = [];
            // Match <span class="image"><img src="..." alt="..."/></span>\n<div class="title"><a href="...">TITLE</a>
            const regex = /<span class="image"><img[^>]+src="([^"]+)"[^>]*alt="([^"]*)"[^>]*>[\s\S]*?<div class="title"><a href="(https?:\/\/vostfree[^"]+\.html)">([^<]+)<\/a><\/div>/gi;
            // General fallback
            const regex2 = /<a[^>]+href="(https?:\/\/vostfree[^"]+\.html)"[^>]*>[\s\S]*?<img[^>]+src="([^"]+)"/gi;
            
            let match;
            const seen = new Set();
            while((match = regex.exec(html)) !== null && results.length < 20) {
                let poster = match[1];
                let title = match[4].replace(/[\r\n\t]+/g, ' ').trim();
                let url = match[3];
                
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
                    let title = match[3] || "Vostfree Anime";
                    if(!seen.has(url)) {
                        seen.add(url);
                        results.push(new MultimediaItem({
                            title: (title)?.replace(/[\n\r\t]+/g, ' ').replace(/\s\s+/g, ' ').trim(),
                            url: url,
                            posterUrl: match[2].startsWith('http') ? match[2] : baseUrl + match[2],
                            type: "anime"
                        }));
                    }
                }
            }

            cb({ success: true, data: results });
        } catch (e) {
            cb({ success: false, errorCode: "SEARCH_ERROR", message: String(e) });
        }
    }

    /**
     * Loads details for a specific media item.
     * @param {string} url
     * @param {(res: Response) => void} cb 
     */
    async function load(url, cb) {
        try {
            const response = await axios.get(url, { headers: { 'Referer': baseUrl , 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'} });
            const html = response.data;
            
            // Extract Title from generic DLE movie layout
            // Usually <div class="slide-middle"><h1>TITLE</h1> or <title>TITLE</title>
            let title = "Vostfree";
            const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
            if(titleMatch) {
                // Remove generic suffix
                title = titleMatch[1].split(' en ')[0].replace(' VOSTFR', '').replace(' VF', '').trim();
            }

            // Extract Poster
            let posterUrl = "";
            const posterMatch = html.match(/<div[^>]*class="slide-poster"[^>]*>[\s\S]*?<img[^>]+src="([^"]+)"/i);
            if (posterMatch) {
                posterUrl = posterMatch[1].startsWith('http') ? posterMatch[1] : manifest.baseUrl + posterMatch[1];
            }
            
            // Extract Episodes
            // <select class="new_player_selector"><option value="buttons_1">Episode 1</option>...
            const selectRegex = /<select[^>]*class="new_player_selector"[^>]*>([\s\S]*?)<\/select>/i;
            const selectMatch = html.match(selectRegex);
            const eps = [];
            
            if (selectMatch) {
                const optionsRegex = /<option[^>]+value="(buttons_\d+)"[^>]*>([^<]+)<\/option>/gi;
                let optMatch;
                let epNum = 1;
                while ((optMatch = optionsRegex.exec(selectMatch[1])) !== null) {
                    eps.push(new Episode({
                        name: optMatch[2].trim(),
                        url: `${url}#${optMatch[1]}`,
                        season: 1,
                        dubStatus: url.includes('-vf-') ? 'dub' : 'sub'
                    }));
                }
            } else {
                // If it's a movie and there are no episodes, just add one generic episode
                eps.push(new Episode({
                    name: "Film / Unique",
                    url: `${url}#movie`,
                    season: 1,
                    dubStatus: url.includes('-vf-') ? 'dub' : 'sub'
                }));
            }

            cb({ 
                success: true, 
                data: new MultimediaItem({
                    title: (title)?.replace(/[\n\r\t]+/g, ' ').replace(/\s\s+/g, ' ').trim(),
                    url: url,
                    posterUrl: (function(p){ if(!p) return ''; if(p.startsWith('http')) return p; return manifest.baseUrl + (p.startsWith('/') ? '' : '/') + p; })(posterUrl),
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
            // URL comes formatted as https://vostfree.ws/...#buttons_1
            const parts = url.split('#');
            const pageUrl = parts[0];
            const buttonId = parts[1] || "";
            
            const response = await axios.get(pageUrl, { headers: { 'Referer': pageUrl , 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'} });
            const html = response.data;
            
            const streams = [];
            
            // Find the specific button_box for this episode
            // If it's a movie, there might not be a buttons_X, we might just look for all <div id="player_X"> in the player section
            let playerIds = [];
            
            if (buttonId && buttonId !== 'movie') {
                const boxRegex = new RegExp(`<div[^>]+id="${buttonId}"[^>]*>([\\s\\S]*?)(?:<div\\s+id="buttons_|$)`);
                const boxMatch = html.match(boxRegex);
                if (boxMatch) {
                    const pRegex = /id="(player_\d+)"\s+class="([^"]+)"[^>]*>([^<]+)/gi;
                    let pMatch;
                    while ((pMatch = pRegex.exec(boxMatch[1])) !== null) {
                        playerIds.push({ id: pMatch[1], cssClass: pMatch[2], name: pMatch[3].trim() });
                    }
                }
            } else {
                // It's a movie or single ep, just find all active players in the bottom container
                const boxRegex = /<div[^>]*class="new_player_bottom"[^>]*>([\s\S]*?)<\/div>/;
                const boxMatch = html.match(boxRegex);
                if (boxMatch) {
                    const pRegex = /id="(player_\d+)"\s+class="([^"]+)"[^>]*>([^<]+)/gi;
                    let pMatch;
                    while ((pMatch = pRegex.exec(boxMatch[1])) !== null) {
                        playerIds.push({ id: pMatch[1], cssClass: pMatch[2], name: pMatch[3].trim() });
                    }
                }
            }

            // Extract all hashes from <div id="content_player_X" class="player_box">HASH</div>
            const hashes = {};
            const hashRegex = /<div\s+id="content_(player_\d+)"\s+class="player_box"[^>]*>([^<]+)<\/div>/gi;
            let hMatch;
            while((hMatch = hashRegex.exec(html)) !== null) {
                hashes[hMatch[1]] = hMatch[2].trim();
            }
            
            // For each extracted player ID, find its javascript variable mapping
            // var player_13 = "https://..."; OR derive from class and hash
            
            for (const item of playerIds) {
                // First try var regex if available
                const varRegex = new RegExp(`var\\s+${item.id}\\s*=\\s*['"]([^'"]+)['"]`, 'i');
                const varMatch = html.match(varRegex);
                if (varMatch && varMatch[1].startsWith('http')) {
                    streams.push(new StreamResult({
                        url: varMatch[1],
                        source: item.name
                    }));
                    continue; // found direct url
                }
                
                // If not found as var, try to deduce from hash and class
                const hash = hashes[item.id];
                if(hash && item.cssClass) {
                    let streamUrl = "";
                    let isDirect = false;
                    
                    if(item.cssClass.includes('sibnet')) { streamUrl = `https://video.sibnet.ru/shell.php?videoid=${hash}`; isDirect = true; }
                    else if(item.cssClass.includes('ok')) { streamUrl = `https://ok.ru/videoembed/${hash}`; isDirect = true; }
                    else if(item.cssClass.includes('uqload')) { streamUrl = `https://uqload.co/embed-${hash}.html`; isDirect = true; }
                    else if(item.cssClass.includes('vidoza')) { streamUrl = `https://vidoza.net/embed-${hash}.html`; isDirect = true; }
                    else if(item.cssClass.includes('verystream') || item.cssClass.includes('vstream')) { streamUrl = `https://verystream.com/e/${hash}`; isDirect = true; }
                    else if(item.cssClass.includes('sendvid')) { streamUrl = `https://sendvid.com/embed/${hash}`; isDirect = true; }
                    else if(item.cssClass.includes('uptostream')) { streamUrl = `https://uptostream.com/${hash}`; isDirect = true; }
                    
                    if(isDirect) {
                        streams.push(new StreamResult({
                            url: streamUrl,
                            source: item.name || item.cssClass.replace('new_player_', '')
                        }));
                    } else if(hash.startsWith('http')) {
                        // Might be raw url
                        streams.push(new StreamResult({
                            url: hash,
                            source: item.name || "Lecteur Inconnu"
                        }));
                    }
                }
            }

            cb({ success: true, data: streams });
        } catch (e) {
            cb({ success: false, errorCode: "STREAM_ERROR", message: String(e) });
        }
    }

    // Export to global scope for namespaced IIFE capture
    globalThis.getHome = getHome;
    globalThis.search = search;
    globalThis.load = load;
    globalThis.loadStreams = loadStreams;
})();
