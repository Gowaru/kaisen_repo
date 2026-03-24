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
            return null;
        }
    };


    async function getHome(cb) {
    try {
        const response = await axios.get(baseUrl);
        const html = response.data;

        // Extract days blocks
        const dayBlocks = html.split(/<h2 class="titreJours[^>]*>/gi);
        // The first element is before any day, let's process it for "Dernières Sorties"
        
        const data = {};
        
        // We iterate through all day blocks, starting from 1
        for (let i = 1; i < dayBlocks.length; i++) {
            const block = dayBlocks[i];
            
            // Extract the day title
            const dayTitleMatch = block.match(/<\/svg>[\s\S]*?<\/a>\s*([^\s<][^<]+)\s*<a/i);
            if (!dayTitleMatch) continue;
            const dayTitle = dayTitleMatch[1].trim();

            const items = [];
            // Regex to catch cards with VOSTFR or VF indicators inside the block
            const regex = /<div class="[^"]*(Anime|Scan)[^"]*(VF|VOSTFR)?[^"]*"[\s\S]*?<a[^>]+href="([^"]*\/catalogue\/[^"]+)"[^>]*>[\s\S]*?<img[^>]+src="([^"]+)"[\s\S]*?alt="([^"]+)"/gi;
            
            let match;
            const seenURLs = new Set();
            while ((match = regex.exec(block)) !== null) {
                if(match[1] && match[1].toLowerCase() === 'scan') continue;
                
                let lang = match[2] ? match[2] : '';
                let url = match[3];
                let posterUrl = match[4];
                let title = match[5].trim();
                
                if (lang === 'VF') title += ' (VF)';
                else if (lang === 'VOSTFR') title += ' (VOSTFR)';
                else if (url.includes('/vf/')) title += ' (VF)';
                else if (url.includes('/vostfr/')) title += ' (VOSTFR)';
                
                if (!url.startsWith('http')) {
                    if (url.startsWith('/')) url = baseUrl + url;
                    else url = baseUrl + '/' + url;
                }
                
                let baseItemUrl = url;
                // Keep only root catalogue url to fetch description correctly in load()
                const rootMatch = url.match(/(https?:\/\/[^\/]+\/catalogue\/[^\/]+)/);
                if (rootMatch) baseItemUrl = rootMatch[1] + '/';

                const uniqueKey = baseItemUrl + "_" + lang;
                
                if(!seenURLs.has(uniqueKey)) {
                    seenURLs.add(uniqueKey);
                    
                    if(!posterUrl.startsWith('http')) {
                        posterUrl = baseUrl + posterUrl;
                    }
                    
                    items.push(new MultimediaItem({
                        title: title,
                        url: baseItemUrl,
                        posterUrl: posterUrl,
                        type: "anime"
                    }));
                }
            }
            
            if (items.length > 0) {
                // Determine day, if "Mardi", make sure it comes nicely. We put it in the map.
                data[dayTitle] = items;
            }
        }
        
        // If no days were processed (format change), fallback to the original latest logic for "Dernières Sorties"
        if(Object.keys(data).length === 0) {
            const items = [];
            const regex = /<a[^>]+href="([^"]*\/catalogue\/[^"]+)"[^>]*>[\s\S]*?<img[^>]+src="([^"]+)"[\s\S]*?alt="([^"]+)"/gi;
            let match;
            let count = 0;
            const seenURLs = new Set();

            while ((match = regex.exec(html)) !== null && count < 15) {
                let url = match[1];
                if (url.includes('/scan/')) continue; // Skip scans
                
                if (!url.startsWith('http')) {
                    if (url.startsWith('/')) url = baseUrl + url;
                    else url = baseUrl + '/' + url;
                }
                
                let baseItemUrl = url;
                const rootMatch = url.match(/(https?:\/\/[^\/]+\/catalogue\/[^\/]+)/);
                if (rootMatch) baseItemUrl = rootMatch[1] + '/';

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
            data["Dernières Sorties"] = items;
        }

        cb({ 
            success: true, 
            data: data
        });
    } catch (e) {
            cb({ success: false, errorCode: "PARSE_ERROR", message: String(e) });
        }
    }

    async function search(query, cb) {
        try {
             let results = [];
             
             // Try standard fetch.php 
             try {
                 const postBody = 'query=' + encodeURIComponent(query);
                 const response = await axios.post(baseUrl + '/template-php/defaut/fetch.php', postBody, { 
                     headers: { 
                         'Content-Type': 'application/x-www-form-urlencoded',
                         'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
                     } 
                 });
                 const html = response.data;
                 const regex = /<a href="([^"]+)" class="asn-search-result"><img[^>]+src="([^"]+)"[^>]*><div[^>]*><h3[^>]*>([^<]+)<\/h3>(?:[^<]*<p[^>]*>([^<]+)<\/p>)?/gi;
                 let match;
                 while((match = regex.exec(html)) !== null && results.length < 25) {
                     if (match[1].includes('/scan/')) continue;
                     
                     let itemUrl = match[1].endsWith('/') ? match[1] : match[1] + '/';
                     if (!itemUrl.startsWith('http')) itemUrl = baseUrl + itemUrl;
                     
                     let posterUrl = match[2];
                     if (!posterUrl.startsWith('http')) posterUrl = baseUrl + posterUrl;
                     
                     let title = match[3].trim();
                     if (match[4] && match[4].trim()) {
                         title += " (" + match[4].trim().replace(/&#039;/g, "'").replace(/&amp;/g, "&") + ")";
                     }

                     results.push(new MultimediaItem({
                          title: title,
                          url: itemUrl,
                          posterUrl: posterUrl,
                          type: "anime"
                     }));
                 }
             } catch(err1) {}
             
             // Fallback to sitemap if fetch.php fails or returns empty in mobile environment
             if (results.length === 0) {
                 const sitemapRes = await axios.get(baseUrl + '/sitemap.xml');
                 const xml = sitemapRes.data;
                 
                 const queryClean = query.toLowerCase().replace(/[^a-z0-9]/g, '-');
                 const sitemapRegex = /<loc>(https?:\/\/anime-sama\.to\/catalogue\/([^<]+)\/)<\/loc>/gi;
                 let sMatch;
                 
                 while((sMatch = sitemapRegex.exec(xml)) !== null && results.length < 25) {
                     let url = sMatch[1];
                     let slug = sMatch[2];
                     
                     if (slug.includes('scan')) continue; // Skip scans
                     
                     // If slug matches query
                     if (slug.includes(queryClean)) {
                         let title = slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                         results.push(new MultimediaItem({
                             title: title,
                             url: url,
                             posterUrl: baseUrl + '/img/contenu/' + slug + '.jpg', 
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

    async function load(url, cb) {
        try {
            let rootUrl = url;
            const rootMatch = url.match(/(https?:\/\/[^\/]+\/catalogue\/[^\/]+)/);
            if (rootMatch) rootUrl = rootMatch[1] + '/';

            const htmlRes = await axios.get(rootUrl);
            const html = htmlRes.data;

            let posterUrl = "";
            const imgMatch = html.match(/id="imgOeuvre"[^>]*src="([^"]+)"/i) || html.match(/property="og:image"[^>]*content="([^"]+)"/i);
            if(imgMatch) posterUrl = imgMatch[1];
            
            let actualTitle = "Anime-Sama";
            const titleMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/i) || html.match(/<title>([^<]+)<\/title>/i);
            if(titleMatch) {
                actualTitle = titleMatch[1].split('- Saison')[0].replace('Anime-Sama', '').replace(/\|/g, '').replace('Streaming et catalogage', '').trim();
            }

            let description = "";
            const descMatch = html.match(/<h2[^>]*>Synopsis<\/h2>\s*<p[^>]*>([\s\S]*?)<\/p>/i);
            if(descMatch) {
                description = descMatch[1].replace(/<[^>]+>/g, '').trim();
            }

            const cleanHtml = html.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*panneauAnime.*$/gm, '').replace(/<!--[\s\S]*?-->/g, '');
            const seasonRegex = /panneauAnime\s*\(\s*["']([^"']+)["']\s*,\s*["']([^"']+)["']\s*\)/gi;
            let sMatch;
            const seasonEntries = [];
            while ((sMatch = seasonRegex.exec(cleanHtml)) !== null) {
                const seasonTitle = sMatch[1].trim(); 
                const seasonPath = sMatch[2].trim(); 
                if(seasonPath.includes('vf') || seasonPath.includes('vostfr')) {
                     seasonEntries.push({ title: seasonTitle, path: seasonPath });
                }
            }

            if (seasonEntries.length === 0) {
                return cb({ success: false, message: "Auncun épisode animé trouvé. Il s'agit peut-être d'un scan..." });
            }

            const eps = [];
            let currentSeasonNumber = 1;

            // Fetch episodes for all seasons found
            for (let sIdx = 0; sIdx < seasonEntries.length; sIdx++) {
                const sEntry = seasonEntries[sIdx];
                let jsUrl = rootUrl + sEntry.path;
                if(!jsUrl.endsWith('/')) jsUrl += '/';
                jsUrl += 'episodes.js';

                try {
                    const jsRes = await axios.get(jsUrl);
                    const jsData = jsRes.data;

                    const epsRegex = /var\s+eps\d+\s*=\s*\[([\s\S]*?)\]/gi;
                    let ematch;
                    const players = [];

                    while ((ematch = epsRegex.exec(jsData)) !== null) {
                        const rawLinks = ematch[1].split(',').map(s => s.replace(/['"\s\n\r]+/g, '').trim());
                        const cleanLinks = rawLinks.filter(l => l.length > 5);
                        if (cleanLinks.length > 0) {
                            players.push(cleanLinks);
                        }
                    }

                    if (players.length > 0) {
                        const epCount = players[0].length;
                        for (let i = 0; i < epCount; i++) {
                            const episodeStreams = [];
                            for (let p = 0; p < players.length; p++) {
                                if (players[p][i]) {
                                    episodeStreams.push(players[p][i]);
                                }
                            }
                            
                            let epName = "";
                            const sTitle = sEntry.title.trim();
                            const isFilmOrOav = /film|films|oav|special|spécial/i.test(sTitle);
                            
                            if (/^saison \d+$/i.test(sTitle)) {
                                epName = "Épisode " + (i + 1);
                            } else if (isFilmOrOav && epCount === 1) {
                                let tName = "Film";
                                if(/oav/i.test(sTitle)) tName = "OAV";
                                else if(/special|spécial/i.test(sTitle)) tName = "Spécial";
                                epName = tName;
                            } else if (isFilmOrOav) {
                                let tName = "Film";
                                if(/oav/i.test(sTitle)) tName = "OAV";
                                else if(/special|spécial/i.test(sTitle)) tName = "Spécial";
                                epName = tName + " " + (i + 1);
                            } else if (epCount === 1) {
                                epName = sTitle;
                            } else {
                                epName = sTitle + " - Ép. " + (i + 1);
                            }

                            eps.push(new Episode({
                                name: epName,
                                episode: i + 1,
                                posterUrl: posterUrl,
                                url: JSON.stringify(episodeStreams),
                                season: currentSeasonNumber,
                                dubStatus: sEntry.path.includes('/vf') || sEntry.path.endsWith('vf') ? 'dub' : 'sub'
                            }));
                        }
                        currentSeasonNumber++;
                    }
                } catch(e) {} 
            }

            if (eps.length === 0) {
                return cb({ success: false, errorCode: "EPISODES_NOT_FOUND", message: "Impossible de parser les liens." });
            }

            cb({ 
                success: true, 
                data: new MultimediaItem({
                    title: actualTitle,
                    url: rootUrl,
                    type: "anime",
                    posterUrl: posterUrl,
                    description: description,
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
                }
                // We REMOVED the unextracted iframe fallback intentionally. 
                // The mobile app's ExoPlayer crashes on raw HTML pages unless strictly intercepted, 
                // causing it to automatically fallback to Sibnet when Vidmoly is chosen.
                // It is better to only show streams we can extract directly into mp4/m3u8.
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
