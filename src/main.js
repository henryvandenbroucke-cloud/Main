'use strict';
/* Start-up. */
(function boot() {
  U.uTex.value = Tex.build();
  Loop.start();
  const q = new URLSearchParams(location.search);
  document.getElementById('playBtn').onclick = () => Game.start({ seed: seedFromText(document.getElementById('seed').value || String(Date.now())), name: 'World', gamemode: 'creative' });
  if (q.has('auto')) {
    Game.start({ seed: seedFromText(q.get('seed') || 'test'), name: 'Test', gamemode: q.get('mode') || 'creative' });
    if (q.has('x')) { Game.player.x = +q.get('x'); Game.player.z = +q.get('z'); }
    if (q.has('time')) Game.dayTime = +q.get('time');
    const p = Game.player; p.flying = q.has('fly');
    const give = ['grass_block', 'stone', 'oak_planks', 'oak_log', 'glass', 'torch', 'oak_stairs', 'oak_slab', 'oak_fence'];
    give.forEach((n, i) => p.inv.set(i, stack(n, 64)));
    if (q.has('yaw')) p.yaw = +q.get('yaw'); if (q.has('pitch')) p.pitch = +q.get('pitch');
    HUD.refresh();
  }
})();
