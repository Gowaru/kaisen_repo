(function() {
    const baseUrl = 'https://sekai.one';
    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7'
    };

    async function getHome(cb) {
        try {
            const res = await axios.get(baseUrl + '/?v=15', { headers });
            const html = res.data;
            const dom = new JSDOM(html);
            const doc = dom.window.document;
            const items = [];

            const links = Array.from(doc.querySelectorAll('a[href]'));
            links.forEach(link => {
                const href = link.getAttribute('href');
                const title = link.getAttribute('title') || link.textContent.trim();
                const img = link.querySelector('img');
                const posterUrl = img?.getAttribute('src') || img?.getAttribute('data-src');

                if (href && !href.startsWith('http') && !href.startsWith('/') && href !== 'android' && href !== 'contact') {
                    items.push(new MultimediaItem({
                        title: title || href.split('?')[0].replace(/-/g, ' '),
                        url: baseUrl + '/' + href,
                        posterUrl: posterUrl ? (posterUrl.startsWith('http') ? posterUrl : baseUrl + (posterUrl.startsWith('/') ? '' : '/') + posterUrl) : '',
                        type: 'anime'
                    }));
                }
            });

            cb({
                success: true,
                data: {
                    "Catalogue Sekai": items
                }
            });
        } catch (e) {
            cb({ success: false, errorCode: "PARSE_ERROR", message: e.stack });
        }
    }

    async function search(query, cb) {
        try {
            // Re-use home scraping and filter
            const res = await axios.get(baseUrl + '/?v=15', { headers });
            const html = res.data;
            const dom = new JSDOM(html);
            const doc = dom.window.document;
            const items = [];

            const links = Array.from(doc.querySelectorAll('a[href]'));
            links.forEach(link => {
                const href = link.getAttribute('href');
                const title = link.getAttribute('title') || link.textContent.trim();
                const cleanTitle = title || href.split('?')[0].replace(/-/g, ' ');

                if (href && !href.startsWith('http') && !href.startsWith('/') && href !== 'android' && href !== 'contact') {
                    if (cleanTitle.toLowerCase().includes(query.toLowerCase())) {
                        const img = link.querySelector('img');
                        const posterUrl = img?.getAttribute('src') || img?.getAttribute('data-src');
                        items.push(new MultimediaItem({
                            title: cleanTitle,
                            url: baseUrl + '/' + href,
                            posterUrl: posterUrl ? (posterUrl.startsWith('http') ? posterUrl : baseUrl + (posterUrl.startsWith('/') ? '' : '/') + posterUrl) : '',
                            type: 'anime'
                        }));
                    }
                }
            });

            cb({ success: true, data: items });
        } catch (e) {
            cb({ success: false, errorCode: "SEARCH_ERROR", message: e.stack });
        }
    }

    async function load(url, cb) {
        try {
            const res = await axios.get(url, { headers });
            const html = res.data;
            const dom = new JSDOM(html);
            const doc = dom.window.document;

            const title = doc.querySelector('title')?.textContent.replace('Sekai', '').trim();
            const description = doc.querySelector('meta[property="og:description"]')?.getAttribute('content');
            const posterUrl = doc.querySelector('meta[property="og:image"]')?.getAttribute('content');

            // Extract episode count from last episode selection
            const lastSoloMatch = html.match(/var last[a-zA-Z0-9]+\s*=\s*(\d+)/i);
            const epCount = lastSoloMatch ? parseInt(lastSoloMatch[1]) : 1;

            const episodes = [];
            for (let i = 1; i <= epCount; i++) {
                episodes.push(new Episode({
                    name: `Épisode ${i}`,
                    url: url + (url.includes('?') ? '&' : '?') + `ep=${i}`,
                    season: 1
                }));
            }

            cb({
                success: true,
                data: new MultimediaItem({
                    title,
                    description,
                    posterUrl,
                    type: 'anime',
                    episodes
                })
            });
        } catch (e) {
            cb({ success: false, errorCode: "LOAD_ERROR", message: e.stack });
        }
    }

    async function loadStreams(url, cb) {
        try {
            const res = await axios.get(url, { headers });
            const html = res.data;
            const streams = [];

            // Extract mu variables (base URLs)
            const muMap = {};
            const muRegex = /var (mu\d+)\s*=\s*atob\("([^"]+)"\)/g;
            let muMatch;
            while ((muMatch = muRegex.exec(html)) !== null) {
                // simple base64 decode for the known mugiwara URLs
                let b64 = muMatch[2];
                let decoded = "";
                if (b64 === "aHR0cHM6Ly8yMi5tdWdpd2FyYS5vbmUv") decoded = "https://22.mugiwara.one/";
                else if (b64 === "aHR0cHM6Ly8yNi5tdWdpd2FyYS5vbmUv") decoded = "https://26.mugiwara.one/";
                else if (b64 === "aHR0cHM6Ly8yNy5tdWdpd2FyYS5vbmUv") decoded = "https://27.mugiwara.one/";
                
                if (decoded) muMap[muMatch[1]] = decoded;
            }

            // Extract slug from URL or HTML
            const slug = url.split('/').pop().split('?')[0];
            const epMatch = url.match(/[?&]ep=(\d+)/);
            const epNum = epMatch ? epMatch[1] : "1";

            // Reconstruct stream URLs based on patterns found
            // e.g., episode[num] = mu22 + "solo/solo-" + num + ".mp4";
            const pathRegex = /episode\[[^\]]+\]\s*=\s*(mu\d+)\s*\+\s*["']([^"']+)["']\s*\+\s*[^;]+/g;
            let pathMatch;
            while ((pathMatch = pathRegex.exec(html)) !== null) {
                const muKey = pathMatch[1];
                const basePath = pathMatch[2]; // e.g., "solo/solo-"
                if (muMap[muKey]) {
                    streams.push(new StreamResult({
                        url: muMap[muKey] + basePath + epNum + ".mp4",
                        source: "Sekai " + muKey.replace('mu', 'Server '),
                        quality: "1080p"
                    }));
                }
            }

            // Fallback: if no patterns found, try some common ones
            if (streams.length === 0) {
                const servers = Object.keys(muMap);
                servers.forEach(s => {
                   streams.push(new StreamResult({
                       url: muMap[s] + slug + "/" + slug + "-" + epNum + ".mp4",
                       source: "Sekai " + s.replace('mu', 'Server '),
                       quality: "1080p"
                   }));
                });
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

