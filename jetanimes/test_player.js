const fs = require('fs');
const html = fs.readFileSync('/tmp/jet_ep.html', 'utf8');

// Find all elements with class 'options' or ids with 'player'
const playerMatches = html.match(/id="([^"]*player[^"]*)"/gi);
const classMatches = html.match(/class="([^"]*player[^"]*)"/gi);
const dataPost = html.match(/data-post="([^"]+)"/gi);
const dataNume = html.match(/data-nume="([^"]+)"/gi);

console.log("Player IDs:", playerMatches);
console.log("Player Classes:", classMatches);
console.log("Data Posts:", dataPost);
console.log("Data Numes:", dataNume);

// Let's also locate the post id from body class
const bodyClass = html.match(/<body class="([^"]+)"/);
console.log("Body Class:", bodyClass ? bodyClass[1] : null);

// Search for any iframe
const iframes = html.match(/<iframe[^>]*>/gi);
console.log("Iframes:", iframes);
