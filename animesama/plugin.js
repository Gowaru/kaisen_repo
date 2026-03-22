(function() {
    async function getHome(cb) {
        try {
            const baseUrl = typeof manifest !== 'undefined' ? manifest.baseUrl : 'https://anime-sama.to';
            const response = await axios.get(baseUrl);
            const html = response.data;

            const items = [];
            // Catch a href="/catalogue/X/" and its img + h2
            const regex = /<a[^>]+href="([^"]+\/catalogue\/[^"]+)"[^>]*>[\s\S]*?<img[^>]+src="([^"]+)"[\s\S]*?<h2[^>]*>([^<]+)<\/h2>/gi;
            
            let match;
            let count = 0;
            const seenURLs = new Set();

            while ((match = regex.exec(html)) !== null && count < 15) {
                let url = match[1];
                if (!url.startsWith('http')) {
                    if (url.startsWith('/')) url = baseUrl + url;
                    else url = baseUrl + '/' + url;
                }
                
                // Keep only main catalogue links (remove saison/vostfr suffixes from url for main item)
                let baseItemUrl = url;
                const catalogueMatch = url.match(/(https?:\/\/[^\/]+\/catalogue\/[^\/]+\/)/);
                if(catalogueMatch) {
                    baseItemUrl = catalogueMatch[1];
                }

                if(!seenURLs.has(baseItemUrl)) {
                    seenURLs.add(baseItemUrl);
                    items.push(new MultimediaItem({
                        title: match[3].trim(),
                        url: baseItemUrl,
                        posterUrl: match[2].startsWith('http') ? match[2] : baseUrl + match[2],
                        type: "anime"
                    }));
                    count++;
                }
            }

            cb({ 
                success: true, 
                data: { 
                    "Dernières Sorties": items 
                } 
            });
        } catch (e) {
            cb({ success: false, errorCode: "PARSE_ERROR", message: String(e) });
        }
    }

    async function search(query, cb) {
        cb({ success: true, data: [] });
    }

    async function load(url, cb) {
        try {
            // Basic detection
            let jsUrl;
            if (url.endsWith('episodes.js')) {
                 jsUrl = url;
            } else {
                 if(!url.endsWith('/')) url += '/';
                 jsUrl = url + 'episodes.js';
            }
            
            const response = await axios.get(jsUrl);
            const jsData = response.data; // Raw JS text

            // Parse all var epsX = ['...']
            const epsRegex = /var\s+eps\d+\s*=\s*\[([\s\S]*?)\]/gi;
            let match;
            const players = [];

            while ((match = epsRegex.exec(jsData)) !== null) {
                const rawLinks = match[1].split(',').map(s => s.replace(/['"\s\n\r]+/g, '').trim());
                // Remove empty strings
                const cleanLinks = rawLinks.filter(l => l.length > 5);
                if (cleanLinks.length > 0) {
                    players.push(cleanLinks);
                }
            }

            if (players.length === 0) {
                return cb({ success: false, errorCode: "EPISODES_NOT_FOUND", message: `No eps array found in ${jsUrl}` });
            }

            // Assume player[0] length is the number of episodes
            const epCount = players[0].length;
            const eps = [];
            
            for (let i = 0; i < epCount; i++) {
                // Collect all player links for episode `i`
                const episodeStreams = [];
                for (let p = 0; p < players.length; p++) {
                    if (players[p][i]) {
                        episodeStreams.push(players[p][i]);
                    }
                }

                eps.push(new Episode({
                    name: "Épisode " + (i + 1),
                    // We pack the streams into the URL field!
                    url: JSON.stringify(episodeStreams),
                    season: 1,
                    episode: i + 1,
                    dubStatus: url.includes('/vf/') ? 'dub' : 'sub'
                }));
            }

            // Also try to extract a title from the URL slug
            const parts = url.split('/');
            let title = "Anime-Sama";
            for(let p of parts) {
                if(p !== "catalogue" && p !== "saison1" && p !== "saison2" && p !== "vostfr" && p !== "vf" && p !== "https:" && p !== "anime-sama.to" && p !== "" && p !== "episodes.js") {
                    title = p.replace(/-/g, ' ').toUpperCase();
                    break;
                }
            }

            cb({ 
                success: true, 
                data: new MultimediaItem({
                    title: title,
                    url: url.replace('episodes.js', ''),
                    type: "anime",
                    episodes: eps
                })
            });
        } catch(e) {
            cb({ success: false, errorCode: "LOAD_ERROR", message: String(e.message) });
        }
    }

    async function loadStreams(url, cb) {
        try {
            // Parse the streams packed in the load() step
            let episodeStreams = [];
            try {
                episodeStreams = JSON.parse(url);
            } catch(ign) {
                episodeStreams = [url];
            }

            const results = [];
            for (let i = 0; i < episodeStreams.length; i++) {
                const streamUrl = episodeStreams[i];
                // basic naming heuristic
                let sourceName = "Lecteur Anime-Sama " + (i + 1);
                if (streamUrl.includes('sibnet')) sourceName = "Sibnet";
                else if (streamUrl.includes('sendvid')) sourceName = "Sendvid";
                else if (streamUrl.includes('vk.com')) sourceName = "VK";
                else if (streamUrl.includes('dood')) sourceName = "DoodStream";
                else if (streamUrl.includes('vidmoly')) sourceName = "Vidmoly";

                results.push(new StreamResult({
                    url: streamUrl,
                    source: sourceName
                }));
            }
            
            cb({ success: true, data: results });
        } catch (e) {
            cb({ success: false, errorCode: "STREAM_ERROR", message: String(e) });
        }
    }

    globalThis.getHome = getHome;
    globalThis.search = search;
    globalThis.load = load;
    globalThis.loadStreams = loadStreams;
})();
