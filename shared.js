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
