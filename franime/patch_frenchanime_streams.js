const fs = require('fs');
const file = '/home/alexander/Documents/Projects/Divers/extensions_skystream/kaisen/frenchanime/plugin.js';
let content = fs.readFileSync(file, 'utf8');

// replace Uqload to return headers
content = content.replace(
    /if \(match\) return \{ url: match\[1\], quality: 'Auto', source: 'Uqload' \};/,
    "if (match) return { url: match[1], quality: 'Auto', source: 'Uqload', headers: { 'Referer': 'https://uqload.com' } };"
);

// DO NOT fallback and push unresolved iframes.
const loadStreamsBlock = `
    async function loadStreams(url, cb) {
        try {
            let streamUrls = []; try { streamUrls = JSON.parse(url); } catch(e) {}
            const streams = [];
            for (let streamUrl of streamUrls) {
                if (streamUrl.startsWith('//')) streamUrl = 'https:' + streamUrl;
                try {
                    const resolved = await Extractors.resolveStream(streamUrl);
                    if (resolved) {
                        streams.push(resolved);
                    }
                    // DONT FALLBACK TO RAW HTML IF NOT RESOLVED, otherwise ExoPlayer crashes
                } catch(e) {
                }
            }
            cb({ success: true, data: streams });
        } catch (e) {
            cb({ success: false, errorCode: "STREAM_ERROR", message: String(e) });
        }
    }
`;

content = content.replace(/async function loadStreams[\s\S]*?cb\(\{ success: true, data: streams \}\);\s*\} catch \(e\) \{\s*cb\(\{ success: false, errorCode: "STREAM_ERROR", message: String\(e\) \}\);\s*\}\s*\}/, loadStreamsBlock.trim());

fs.writeFileSync(file, content);
