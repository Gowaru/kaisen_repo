(function() {
    const apiBase = "https://api.franime.fr/api/animes/";
    const headers = { 'User-Agent': 'Mozilla/5.0' };

    async function getHome(cb) {
        try {
            const res = await axios.get(apiBase, { headers });
            const data = res.data;
            const items = data.slice(0, 30).map(anime => ({
                title: anime.title,
                url: `https://franime.fr/anime/${anime.id}`,
                posterUrl: anime.affiche_small || anime.affiche,
                type: 'anime',
                status: anime.status === 'EN COURS' ? 'ongoing' : 'completed',
                playbackPolicy: 'none'
            }));
            cb({ success: true, data: items });
        } catch (e) {
            console.error(e);
            cb({ success: false, errorCode: "HOME_ERROR", message: e.stack });
        }
    }

    async function search(query, cb) {
        try {
            const res = await axios.get(apiBase, { headers });
            const data = res.data;
            const items = data.filter(anime => 
                anime.title.toLowerCase().includes(query.toLowerCase()) || 
                (anime.originalTitle && anime.originalTitle.toLowerCase().includes(query.toLowerCase()))
            ).map(anime => ({
                title: anime.title,
                url: `https://franime.fr/anime/${anime.id}`,
                posterUrl: anime.affiche_small || anime.affiche,
                type: 'anime',
                status: anime.status === 'EN COURS' ? 'ongoing' : 'completed',
                playbackPolicy: 'none'
            }));
            cb({ success: true, data: items });
        } catch (e) {
            console.error(e);
            cb({ success: false, errorCode: "SEARCH_ERROR", message: e.stack });
        }
    }

    async function load(url, cb) {
        try {
            const idMatch = url.match(/anime\/(\d+)/);
            if (!idMatch) return cb({ success: false, message: "Invalid URL" });
            const id = parseInt(idMatch[1]);

            const res = await axios.get(apiBase, { headers });
            const data = res.data;
            const anime = data.find(a => a.id === id);

            if (!anime) return cb({ success: false, message: "Anime not found" });

            const episodes = [];
            anime.saisons.forEach((saison, sIdx) => {
                saison.episodes.forEach((ep, eIdx) => {
                    episodes.push({
                        season: sIdx + 1,
                        name: ep.title || `Épisode ${eIdx + 1}`,
                        url: `${url}/${sIdx}/${eIdx}`, // Internal URL for loadStreams
                        playbackPolicy: 'none'
                    });
                });
            });

            cb({
                success: true,
                data: {
                    title: anime.title,
                    description: anime.description,
                    posterUrl: anime.affiche || anime.affiche_small,
                    episodes
                }
            });
        } catch (e) {
            console.error(e);
            cb({ success: false, errorCode: "LOAD_ERROR", message: e.stack });
        }
    }

    async function loadStreams(url, cb) {
        try {
            // url format: https://franime.fr/anime/{id}/{sIdx}/{eIdx}
            const match = url.match(/anime\/(\d+)\/(\d+)\/(\d+)/);
            if (!match) return cb({ success: false, message: "Invalid Stream URL" });
            const [_, id, sIdx, eIdx] = match;

            const res = await axios.get(apiBase, { headers });
            const data = res.data;
            const anime = data.find(a => a.id === parseInt(id));
            if (!anime) return cb({ success: false, message: "Anime not found" });

            const episode = anime.saisons[parseInt(sIdx)].episodes[parseInt(eIdx)];
            const streams = [];

            // FRAnime provides several players for each language
            // Typical flow: resolve via api.franime.fr/api/anime/{id}/{s}/{e}/{lang}/{player_idx}
            // But let's check if we can just return the player name for now or if we need the actual embed
            
            for (const lang in episode.lang) {
                episode.lang[lang].lecteurs.forEach((player, pIdx) => {
                    // This is a placeholder for the actual player resolution logic
                    // In a real SkyStream plugin, we might need to fetch the embed URL
                    streams.push(new StreamResult({
                        url: `https://api.franime.fr/api/anime/${id}/${sIdx}/${eIdx}/${lang}/${pIdx}`,
                        quality: lang.toUpperCase(),
                        source: `FRAnime - ${player}`
                    }));
                });
            }

            cb({ success: true, data: streams });
        } catch (e) {
            console.error(e);
            cb({ success: false, errorCode: "STREAM_ERROR", message: e.stack });
        }
    }

    globalThis.getHome = getHome;
    globalThis.search = search;
    globalThis.load = load;
    globalThis.loadStreams = loadStreams;
})();
