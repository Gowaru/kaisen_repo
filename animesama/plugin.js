(function() {

        
    const baseUrl = typeof manifest !== 'undefined' ? manifest.baseUrl : 'https://anime-sama.to';
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

    
    function encodeBase64(str) {
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
        let output = "";
        let i = 0;
        str = encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, function(match, p1) {
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
        async resolveStream(url) {
            if (!url) return null;
            let finalStream = null;
            if (url.includes('vidoza.net')) finalStream = await this.extractVidoza(url);
            else if (url.includes('sibnet.ru')) finalStream = await this.extractSibnet(url);
            else if (url.includes('sendvid.com')) finalStream = await this.extractSendvid(url);
            
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
            return null; // Return null so we can fallback to proxying the direct iframe
        }
    };


    async function getHome(cb) {
        try {
            
            const response = await axios.get(baseUrl);
            const html = response.data;

            const items = [];
            // Catch a href="/catalogue/X/" and its img alt
            const regex = /<a[^>]+href="([^"]*\/catalogue\/[^"]+)"[^>]*>[\s\S]*?<img[^>]+src="([^"]+)"[\s\S]*?alt="([^"]+)"/gi;
            
            let match;
            let count = 0;
            const seenURLs = new Set();

            while ((match = regex.exec(html)) !== null && count < 15) {
                let url = match[1];
                if (!url.startsWith('http')) {
                    if (url.startsWith('/')) url = baseUrl + url;
                    else url = baseUrl + '/' + url;
                }
                
                // No baseURL stripping, we need the exact season/lang link for episodes.js to work
                let baseItemUrl = url;

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
            
            let posterUrl = "";
            let actualTitle = "Anime-Sama";
            if (!url.endsWith('episodes.js')) {
                try {
                    const htmlRes = await axios.get(url);
                    const html = htmlRes.data;
                    const imgMatch = html.match(/id="imgOeuvre"[^>]*src="([^"]+)"/i) || html.match(/property="og:image"[^>]*content="([^"]+)"/i);
                    if(imgMatch) posterUrl = imgMatch[1];
                    const titleMatch = html.match(/<title>([^<]+)<\/title>/i) || html.match(/<h2[^>]*>([^<]+)<\/h2>/i);
                    if(titleMatch) {
                        actualTitle = titleMatch[1].split('- Saison')[0].replace('Anime-Sama', '').replace('|', '').trim();
                    }
                } catch(e) {}
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
                    episode: i + 1,
                    // We pack the streams into the URL field!
                    url: JSON.stringify(episodeStreams),
                    season: 1,
                    dubStatus: url.includes('/vf/') ? 'dub' : 'sub'
                }));
            }

            // Also try to extract a title from the URL slug
            const parts = url.split('/');
            let title = actualTitle && actualTitle !== "Anime-Sama" ? actualTitle : "Anime-Sama"; // Fallback URL parsing below if still empty
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
                    posterUrl: posterUrl,
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
                let sourceName = "Lecteur Anime-Sama " + (i + 1);
                if (streamUrl.includes('sibnet')) sourceName = "Sibnet";
                else if (streamUrl.includes('sendvid')) sourceName = "Sendvid";
                else if (streamUrl.includes('vk.com')) sourceName = "VK";
                else if (streamUrl.includes('dood')) sourceName = "DoodStream";
                else if (streamUrl.includes('vidmoly')) sourceName = "Vidmoly";

                const extracted = await Extractors.resolveStream(streamUrl);
                if (extracted) {
                    extracted.source = sourceName;
                    results.push(extracted);
                    
                    const proxyStream = new StreamResult({
                        url: "MAGIC_PROXY_v1" + encodeBase64(extracted.url),
                        source: sourceName + " (Proxy)"
                    });
                    if (extracted.headers) proxyStream.headers = extracted.headers;
                    results.push(proxyStream);
                } else if(!streamUrl.includes('dood')) { // Dood doesn't work in iframes without extract
                    results.push(new StreamResult({
                        url: "MAGIC_PROXY_v1" + encodeBase64(streamUrl),
                        source: sourceName + " (Plateforme Proxy)"
                    }));
                }
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
