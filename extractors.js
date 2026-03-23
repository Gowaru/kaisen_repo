// Universal Extractors for SkyStream Plugins
// Import or inject this logic into your plugins' `loadStreams` function

const Extractors = {
    async extractVidoza(url) {
        try {
            const res = await axios.get(url);
            const match = res.data.match(/source\s+src=["'](https?:\/\/[^"']+\.mp4)["']/i);
            if (match) {
                return { url: match[1], quality: 'Auto', source: 'Vidoza' };
            }
        } catch (e) { console.error('Vidoza Error:', e); }
        return null;
    },

    async extractSibnet(url) {
        try {
            const res = await axios.get(url);
            let videoUrl = null;
            const match = res.data.match(/player\.src\(\[\{src:\s*["']([^"']+)["']/i) || res.data.match(/src:\s*["'](\/v\/.*?\.mp4)["']/i);
            if (match) {
                videoUrl = match[1];
                if (videoUrl.startsWith('//')) videoUrl = 'https:' + videoUrl;
                else if (videoUrl.startsWith('/')) videoUrl = 'https://video.sibnet.ru' + videoUrl;
                
                return { 
                    url: videoUrl, 
                    quality: 'Auto', 
                    source: 'Sibnet',
                    headers: { 'Referer': url } // Sibnet requires Referer
                };
            }
        } catch (e) { console.error('Sibnet Error:', e); }
        return null;
    },

    async extractSendvid(url) {
        try {
            const res = await axios.get(url);
            const match = res.data.match(/<source\s+src=["']([^"']+\.mp4)["']/i) || res.data.match(/video_source\s*=\s*["']([^"']+)["']/i);
            if (match) {
                return { url: match[1], quality: 'Auto', source: 'Sendvid' };
            }
        } catch (e) { console.error('Sendvid Error:', e); }
        return null;
    },
    
    async extractStreamtape(url) {
        try {
            const res = await axios.get(url);
            const match = res.data.match(/document\.getElementById\('robotlink'\)\.innerHTML\s*=\s*'\/\/([^']+)'\s*\+\s*'([^']+)'/i);
            if (match) {
                const videoUrl = 'https://' + match[1] + match[2].substring(3); // typically skips some chars
                return { url: videoUrl, quality: 'Auto', source: 'Streamtape' };
            }
        } catch (e) { console.error('Streamtape Error:', e); }
        return null;
    },

    async extractUqload(url) {
        try {
            const res = await axios.get(url);
            const match = res.data.match(/sources:\s*\["([^"]+)"\]/i);
            if (match) {
                return { url: match[1], quality: 'Auto', source: 'Uqload' };
            }
        } catch (e) { console.error('Uqload Error:', e); }
        return null;
    },

    // Main delegator function
    async resolveStream(url) {
        let finalStream = null;
        if (url.includes('vidoza.net')) {
            finalStream = await this.extractVidoza(url);
        } else if (url.includes('sibnet.ru')) {
            finalStream = await this.extractSibnet(url);
        } else if (url.includes('sendvid.com')) {
            finalStream = await this.extractSendvid(url);
        } else if (url.includes('streamtape.com')) {
            finalStream = await this.extractStreamtape(url);
        } else if (url.includes('uqload')) {
            finalStream = await this.extractUqload(url);
        } 
        
        // Return resolved stream or fallback to iframe
        if (finalStream) {
            return new StreamResult({
                url: finalStream.url,
                quality: finalStream.quality,
                source: finalStream.source,
                headers: finalStream.headers || {}
            });
        }
        
        // Fallback for unknown hosts (SkyStream app will try to open it if possible, but might fail)
        let hostname = 'Unknown';
        try { hostname = new URL(url).hostname; } catch(e) {}
        return new StreamResult({
            url: url,
            quality: 'Auto',
            source: `IFrame (${hostname})`
        });
    }
};

module.exports = Extractors;
