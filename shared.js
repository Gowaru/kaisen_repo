// ── Base64 encoding (tries native btoa first, then manual polyfill) ──
export function encodeBase64(str) {
    try {
        if (typeof btoa === 'function') return btoa(str);
    } catch (e) { }
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
    let output = "";
    let i = 0;
    str = encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, function (match, p1) {
        return String.fromCharCode(parseInt(p1, 16));
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

// ── Create a fixUrl function bound to a specific baseUrl ──
export function createFixUrl(baseUrl) {
    return function fixUrl(p) {
        if (!p) return '';
        if (p.startsWith('http')) return p;
        return baseUrl + (p.startsWith('/') ? '' : '/') + p;
    };
}

// ── Detect dubbing status from URL/title text ──
export function detectDubStatus(url, title) {
    const text = (url || '') + ' ' + (title || '');
    if (/\/vf\b|\(VF\)|-vf$/i.test(text)) return 'dub';
    if (/\/vostfr\b|\(VOSTFR\)|-vostfr$/i.test(text)) return 'sub';
    return 'none';
}

// ── Parse season info from a season title (e.g. "Saison 1", "Film", "OAV 2") ──
export function parseSeasonInfo(title) {
    let season = undefined;
    let contentType = undefined;
    if (!title) return { season, contentType };
    let t = title.trim().replace(/\s*[\[(]?(?:VF|VOSTFR|VOST|VO|DUB|SUB)[\])]?\s*/gi, ' ').replace(/\s+/g, ' ').trim();
    if (!t) return { season, contentType };
    if (/\b(?:oav|ova|ona)\b/i.test(t)) contentType = 'OAV';
    else if (/\b(?:film|movie|film\s*anim[ée])\b/i.test(t)) contentType = 'Film';
    else if (/\b(?:sp[ée]cial|special)\b/i.test(t)) contentType = 'Spécial';
    const sMatch = t.match(/(?:\b(?:saison|season|part|cour|film|oav|ova|ona|sp[ée]cial|special|episode|ep|volume|vol|tome)\s+|\bS\s*)(\d+)\b/i);
    if (sMatch) season = parseInt(sMatch[1]);
    if (season === undefined) {
        const numMatch = t.match(/\d+/);
        if (numMatch) {
            const num = parseInt(numMatch[0]);
            if (!contentType) season = num;
        }
    }
    return { season, contentType };
}

// ── Centralized host URL construction from content_player_X values ──
// Converts a raw content value + button number to a full player URL.
// btnNum mapping:
//   1  = Myvi          (numeric 6+)
//   2  = Sibnet        (alphanumeric 6+)
//   3  = Embed4Me      (any value)
//   4  = Sendvid       (any value)
//   5  = Uqload        (alphanumeric 3+)
//   6  = Verystream    (alphanumeric 3+)
//   7  = Vidmoly       (any value)
//   8  = Minochinos    (any value)
//   9  = Filemoon      (any value)
//  10  = StreamWish    (alphanumeric 3+)
//  11  = Stape         (alphanumeric 3+)
//  12  = StreamSB      (alphanumeric 3+)
//  13  = Mp4Upload     (alphanumeric 3+)
export function getPlayerUrl(content, btnNum) {
    if (!content) return null;
    const c = content.trim();
    if (!c) return null;
    // Already a full URL
    if (c.includes('://')) return c;
    // Protocol-relative URL
    if (c.startsWith('//')) return 'https:' + c;

    // Use btnNum to determine host-specific URL construction
    if (btnNum) {
        if (btnNum === '1' && /^\d{6,}$/.test(c)) {
            return 'https://myvi.ru/player/embed/html/' + c;
        }
        if (btnNum === '2' && /^[a-zA-Z0-9]{6,}$/.test(c)) {
            return 'https://video.sibnet.ru/sh.php?video=' + c;
        }
        if (btnNum === '3') {
            return 'https://embed4me.com/e/' + c;
        }
        if (btnNum === '4') {
            return 'https://sendvid.com/embed/' + c;
        }
        if (btnNum === '5' && /^[a-zA-Z0-9]{3,}$/.test(c)) {
            return 'https://uqload.io/embed-' + c + '.html';
        }
        if (btnNum === '6' && /^[a-zA-Z0-9]{3,}$/.test(c)) {
            return 'https://verystream.com/e/' + c;
        }
        if (btnNum === '7') {
            return 'https://vidmoly.net/embed-' + c + '.html';
        }
        if (btnNum === '8') {
            return 'https://minochinos.com/v/' + c;
        }
        if (btnNum === '9') {
            return 'https://filemoon.sx/e/' + c;
        }
        if (btnNum === '10' && /^[a-zA-Z0-9]{3,}$/.test(c)) {
            return 'https://streamwish.com/e/' + c;
        }
        if (btnNum === '11' && /^[a-zA-Z0-9]{3,}$/.test(c)) {
            return 'https://stape.me/e/' + c;
        }
        if (btnNum === '12' && /^[a-zA-Z0-9]{3,}$/.test(c)) {
            return 'https://streamsb.net/e/' + c;
        }
        if (btnNum === '13' && /^[a-zA-Z0-9]{3,}$/.test(c)) {
            return 'https://www.mp4upload.com/embed-' + c + '.html';
        }
    }

    // Fallback: format-based guessing when btnNum not provided or doesn't match
    if (/^\d{6,}$/.test(c)) {
        // Numeric 6+ → Sibnet (most common numeric host)
        return 'https://video.sibnet.ru/sh.php?video=' + c;
    }
    if (/^[a-zA-Z0-9]{3,5}$/.test(c)) {
        // Short alphanumeric 3-5 → try Uqload
        return 'https://uqload.io/embed-' + c + '.html';
    }
    if (/^[a-zA-Z0-9]{6,}$/.test(c)) {
        // Long alphanumeric 6+ → try Sibnet
        return 'https://video.sibnet.ru/sh.php?video=' + c;
    }

    return null;
}
