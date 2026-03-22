const fs = require('fs');
const html = fs.readFileSync('/tmp/jet_ep.html', 'utf8');

const regex = /href=(['"])(.*?)\1/gi;
const links = new Set();
let match;
while ((match = regex.exec(html)) !== null) {
  links.add(match[2]);
}

console.log(Array.from(links).join('\n'));
