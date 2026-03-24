const { plugin } = require('./kaisen/frenchanime/plugin.js');
const url = 'https://french-anime.com/exclue/975--1onfepiefcffezzfafghb.html';
plugin.load(url, (res) => {
    console.log("LOAD:", JSON.stringify(res, null, 2));
    if (res && res.data && res.data.episodes && res.data.episodes.length > 0) {
        plugin.loadStreams(res.data.episodes[0].url, (streamRes) => {
            console.log("STREAMS:", JSON.stringify(streamRes, null, 2));
        });
    }
});
