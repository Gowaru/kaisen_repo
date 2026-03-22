const fs = require('fs');
const html = fs.readFileSync('/tmp/jet_serie.html', 'utf8');
const links = new Set();
const regex = /href=(['"])(https:\/\/on\.jetanimes\.com\/[^\1]+)\1/gi;
let match;
while ((match = regex.exec(html)) !== null) {
  if (match[2].includes('episode') || match[2].includes('saison') || /[0-9]/.test(match[2])) {
      links.add(match[2]);
  }
}
console.log(Array.from(links).slice(0, 50).join('\n'));
