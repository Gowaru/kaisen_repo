fetch('https://french-anime.com/exclue/975--1onfepiefcffezzfafghb.html').then(res => res.text()).then(html => {
  const lineRegex = /(?:^|\n)\s*([0-9]+|Film|OAV)!\s*([^<\n]+)/gi;
  let match;
  let count = 0;
  while ((match = lineRegex.exec(html)) !== null) {
      count++;
      if(count <= 3 || count >= 1000) {
          console.log(`Episode: ${match[1]} | Length: ${match[2].length}`);
      }
  }
  console.log("Total matched episodes:", count);
});
