fetch('https://on.jetanimes.com/episode/one-piece-2025-1x1155/').then(res => res.text()).then(html => {
  const nonceMatch = html.match(/nonce":"([^"]+)"/);
  console.log("Nonce match:", nonceMatch ? nonceMatch[1] : null);
  
  const options = [];
  const regex = /<li[^>]*id="player-option[^>]*data-type="([^"]+)"[^>]*data-post="([^"]+)"[^>]*data-nume="([^"]+)"[^>]*>[\s\S]*?<span class="title">([^<]+)<\/span>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
      options.push({ type: match[1], post: match[2], nume: match[3], name: match[4] });
  }
  console.log("Found players:", options);
  
  // Try fetching the first one
  if(options.length > 0) {
      const form = new URLSearchParams();
      form.append('action', 'doo_player_ajax');
      form.append('post', options[0].post);
      form.append('nume', options[0].nume);
      form.append('type', options[0].type);
      if(nonceMatch) form.append('nonce', nonceMatch[1]); // Wait, the nonce name might be something else
      
      // Let's also check if there is DOOPLAY ajax variables script
      const wpRegex = /var dtGonza = (\{[^;]+});/;
      const vpMatch = html.match(wpRegex);
      if (vpMatch) console.log("dtGonza:", vpMatch[1]);

      const ajaxurl = 'https://on.jetanimes.com/wp-admin/admin-ajax.php';
      fetch(ajaxurl, {
          method: 'POST',
          body: form
      }).then(r => r.text()).then(res => console.log("Ajax response:", res));
  }
});
