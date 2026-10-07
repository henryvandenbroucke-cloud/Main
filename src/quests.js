'use strict';
/* Survival quest chain: a gentle introduction to Blockhollow that rewards items and permanent power-ups. */
const PERKS = {
  mining: { name: "Miner's Grit", desc: '+30% mining speed' },
  glow: { name: 'Hearthglow', desc: 'A warm light follows you after dark' },
  hearth: { name: 'Heart of the Hearth', desc: '+2 max hearts' },
  melee: { name: 'Keen Edge', desc: '+15% melee damage' },
  speed: { name: 'Swift Feet', desc: '+10% movement speed' },
  nighteye: { name: 'Night Eyes', desc: 'See further in the dark' },
  stomach: { name: 'Iron Stomach', desc: 'Hunger drains 40% slower' },
  warden: { name: "Warden's Resolve", desc: '+2 max hearts' },
  legend: { name: 'Legend of Blockhollow', desc: '+20% damage, +2 max hearts' },
};
const isLog = id => id === B.LOG || id === B.DARKLOG;
const QUESTS = [
  { title: 'First Steps', desc: 'Walk around with W A S D and look around with the mouse.', type: 'walk', n: 20, unit: 'blocks', reward: { items: [[I.bread, 2]] } },
  { title: 'Timber!', desc: 'Hold left click on a tree trunk to chop it. Gather 3 logs.', type: 'break', match: isLog, n: 3, reward: { items: [[I.globerry, 3]] } },
  { title: 'Planks', desc: 'Press E and put a log in the crafting grid. Light Oak Logs give Oak Planks, dark Gnarled Logs give Gnarled Planks. Both kinds work the same in every recipe!', type: 'craft', match: id => id === B.PLANKS || id === B.PLANKS_DARK, n: 1, reward: { items: [[B.PLANKS, 4]] } },
  { title: 'Sticks', desc: 'Two planks stacked on top of each other make sticks.', type: 'craft', match: id => id === I.stick, n: 1, reward: {} },
  { title: 'A Place to Work', desc: 'Fill the 2×2 grid with planks to craft a Crafting Table.', type: 'craft', match: id => id === B.TABLE, n: 1, reward: {} },
  { title: 'Set Up Shop', desc: 'Select the crafting table in your hotbar and right-click the ground to place it.', type: 'place', match: id => id === B.TABLE, n: 1, reward: { items: [[I.stick, 4]] } },
  { title: 'Your First Pickaxe', desc: 'Stand next to the table, press E and use the 3×3 grid (the recipe book helps).', type: 'craft', match: id => id === I.wood_pick, n: 1, reward: { items: [[I.wood_axe, 1]] } },
  { title: 'Stone Age', desc: 'Mine stone with your pickaxe until you carry 8 cobblestone.', type: 'have', id: B.COBBLE, n: 8, reward: { perk: 'mining' } },
  { title: 'Better Tools', desc: 'Craft a Stone Pickaxe from cobblestone and sticks.', type: 'craft', match: id => id === I.stone_pick, n: 1, reward: { items: [[I.stone_sword, 1]] } },
  { title: 'Black Rock', desc: 'Coal ore is grey stone with black flecks. Look in hillsides, cave walls and anywhere you dig into stone, then mine it.', type: 'break', match: id => id === B.COAL_ORE, n: 1, reward: { items: [[I.coal, 2]] } },
  { title: 'Light the Way', desc: 'Craft torches from coal and a stick.', type: 'craft', match: id => id === B.TORCH, n: 1, reward: { perk: 'glow' } },
  { title: 'A Hearty Meal', desc: 'Hold food and right-click to eat when you are hungry.', type: 'eat', n: 1, reward: { items: [[I.bread, 3]] } },
  { title: 'Animal Friends', desc: 'Hold wheat and right-click two cows or sheep that stand close together.', type: 'breed', n: 1, reward: { items: [[I.shears, 1]] } },
  { title: 'Shepherd', desc: 'Right-click a sheep while holding shears to collect its wool.', type: 'shear', n: 1, reward: { items: [[I.bread, 2]] } },
  { title: 'Safe Haven', desc: 'Every village square has a glowing blue Waystone pillar. Right-click it to attune: you will come back there if you fall.', type: 'attune', n: 1, reward: { perk: 'hearth' } },
  { title: 'Where To?', desc: "Select the Wayfinder's Compass in your hotbar and right-click it (or press M). Then click Follow next to a place.", type: 'follow', n: 1, reward: { items: [[I.potion, 1]] } },
  { title: 'Off the Beaten Path', desc: 'Discover a landmark, camp or ancient place.', type: 'discover', match: s => s.cat !== 'village', n: 1, reward: { items: [[I.gold, 5]] } },
  { title: 'Trader', desc: 'Visit a village and right-click a villager while holding gold coins.', type: 'trade', n: 1, reward: { items: [[I.gold, 3]] } },
  { title: 'Treasure Hunter', desc: 'Chests hidden in houses, camps and ruins hold loot. Open one you have never opened before.', type: 'loot', n: 1, reward: { items: [[I.potion, 1]] } },
  { title: 'Liquid Courage', desc: 'Chests often hold potions. Hold one and right-click to drink it. Haste makes you mine almost instantly!', type: 'drink', n: 1, reward: { items: [[I.pot_swift, 1]] } },
  { title: 'Old Stories', desc: 'Lore tablets are carved stone slabs covered in old writing. They stand at landmarks and ruins. Follow the arrow below and right-click one to read it.', type: 'lore', n: 1, reward: { items: [[I.shard, 2]] } },
  { title: 'First Blood', desc: 'Defeat a hostile creature. Charged swings hit harder!', type: 'kill', match: m => !m.def.passive, n: 1, reward: { perk: 'melee' } },
  { title: 'Best Friend', desc: 'Skeletons drop bones. Right-click a wolf with a bone to tame it.', type: 'tame', n: 1, reward: { items: [[I.beef, 3]] } },
  { title: 'Hunter', desc: 'Collect 3 boar hides from boars (or deer).', type: 'have', id: I.leather, n: 3, reward: { items: [[I.hide_boots, 1]] } },
  { title: 'Dressed for Adventure', desc: 'Press E and wear a piece of armor.', type: 'equip', n: 1, reward: { items: [[I.gold, 5]] } },
  { title: 'Storage', desc: 'Craft and place a chest or barrel to keep your things.', type: 'place', match: id => id === B.CHEST || id === B.BARREL, n: 1, reward: { items: [[B.CRATE, 2]] } },
  { title: 'Iron Will', desc: 'Carry 4 iron ingots (iron ore drops them).', type: 'have', id: I.iron, n: 4, reward: { perk: 'speed' } },
  { title: 'Blue Gems', desc: 'Lapis lazuli ore is stone with deep blue flecks, found low underground and in the Deepvein Mine. Collect 6 lapis lazuli.', type: 'have', id: I.lapis, n: 6, reward: { items: [[I.journal, 1]] } },
  { title: 'Arcane Arts', desc: 'Craft an Enchanting Table (journal page, lapis, iron, polished stone), place it, and enchant a tool with lapis. Bookshelves around it make enchantments stronger.', type: 'enchant', n: 1, reward: { items: [[I.pot_haste2, 1], [I.lapis, 6]] } },
  { title: 'Night Watch', desc: 'Survive until the next sunrise.', type: 'night', n: 1, reward: { perk: 'nighteye' } },
  { title: 'Wanderer', desc: 'Discover 3 villages. Roads connect them.', type: 'villages', n: 3, reward: { perk: 'stomach' } },
  { title: 'Crystal Seeker', desc: 'Gather 6 crystal shards in the Crystal Highlands.', type: 'have', id: I.shard, n: 6, reward: { items: [[I.iron, 4]] } },
  { title: "Ranger's Path", desc: "Craft a Ranger's Bow (sticks and crawler silk).", type: 'craft', match: id => id === I.ranger_bow, n: 1, reward: { items: [[I.arrow, 24]] } },
  { title: 'Into the Deep', desc: 'Find the Drowned Halls in the Mystic Marsh.', type: 'discover', match: s => s.name === 'The Drowned Halls', n: 1, reward: { items: [[I.potion, 3]] } },
  { title: 'The Mirewarden', desc: 'Defeat the Mirewarden in the heart of the Drowned Halls.', type: 'boss', match: t => t === 'warden', n: 1, reward: { perk: 'warden' } },
  { title: 'Break the Seal', desc: 'Use the Deepseal Key on the Seal of the Deep.', type: 'seal', n: 1, reward: { items: [[I.potion, 2], [I.ration, 2]] } },
  { title: 'The Sleeping Colossus', desc: 'Shatter the pylons and defeat the Colossus.', type: 'boss', match: t => t === 'colossus', n: 1, reward: { perk: 'legend' } },
];


// ---- "where do I go?" hints: an arrow and a distance to the nearest place that completes the quest
const unK = k => k.split(',').map(Number);
function nearestPos(list) { const P = Player; let best = null, bd = 1e9; for (const p of list) { const d = Math.hypot(p.x - P.x, p.z - P.z); if (d < bd) { bd = d; best = p; } } return best; }
function questTarget(q) {
  const sites = f => Sites.filter(f).map(s => ({ x: s.x, z: s.z, label: s.name }));
  const mob = (types, label) => nearestPos(Mobs.filter(m => types.includes(m.type) && !m.dead).map(m => ({ x: m.x, z: m.z, label })));
  switch (q.type) {
    case 'lore': return nearestPos([...Lore.entries()].filter(([, l]) => !l.read).map(([k]) => { const [x, , z] = unK(k); return { x: x + 0.5, z: z + 0.5, label: 'Lore tablet' }; }));
    case 'loot': return nearestPos([...Chests.entries()].filter(([, c]) => !c.items && !c.made).map(([k]) => { const [x, , z] = unK(k); return { x: x + 0.5, z: z + 0.5, label: 'Unopened chest' }; }));
    case 'attune': return nearestPos(sites(s => s.cat === 'village').map(p => Object.assign(p, { label: 'Waystone in ' + p.label })));
    case 'trade': return nearestPos(sites(s => s.cat === 'village').map(p => Object.assign(p, { label: 'Villagers in ' + p.label })));
    case 'villages': return nearestPos(sites(s => s.cat === 'village' && !s.found));
    case 'discover': return nearestPos(sites(s => !s.found && q.match({ cat: s.cat, name: s.name })));
    case 'boss': case 'seal': return nearestPos(sites(s => s.name === 'The Drowned Halls'));
    case 'breed': return mob(['cow', 'sheep', 'pig', 'chicken'], 'Farm animals');
    case 'shear': return mob(['sheep'], 'Sheep');
    case 'tame': return mob(['wolf'], 'Wolf') || nearestPos(Sites.filter(s => bmap[COL(Math.floor(s.x), Math.floor(s.z))] === 1).map(s => ({ x: s.x, z: s.z, label: 'Wolves roam the Ancient Forest' })));
    case 'enchant': return null;
    case 'kill': return mob(Object.keys(MOBDEF).filter(t => !MOBDEF[t].passive && !MOBDEF[t].boss), 'Hostile creature');
  }
  return null;
}
const HINT_ARROWS = ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖'];
function questHintHTML() {
  const q = Quests.cur; if (!q) return '';
  const t = questTarget(q); if (!t) return '';
  const P = Player, dx = t.x - P.x, dz = t.z - P.z, d = Math.round(Math.hypot(dx, dz));
  const k = ((Math.round(-(Math.atan2(-dx, -dz) - P.yaw) / (Math.PI / 4)) % 8) + 8) % 8;
  return '<b>' + (d < 3 ? '•' : HINT_ARROWS[k]) + '</b>' + t.label + ' · ' + (d < 3 ? 'right here' : d + ' blocks');
}
const Quests = {
  index: 0, prog: 0, perks: {}, startDay: 0, hidden: false,
  get cur() { return QUESTS[this.index]; },
  has(p) { return !!this.perks[p]; },
  reset() { this.index = 0; this.prog = 0; this.perks = {}; this.onStart(); this.render(true); },
  load(s) { this.index = s.quest || 0; this.prog = s.questProg || 0; this.perks = s.perks || {}; this.startDay = s.questStart || 0; this.render(true); },
  active() { return Game.mode === 'survival' && !!this.cur; },
  onStart() { const q = this.cur; if (q && q.type === 'night') this.startDay = Game.day; },
  event(type, data, amt) {
    if (!this.active()) return;
    const q = this.cur;
    if (q.type !== type || (q.match && !q.match(data))) return;
    this.prog += amt === undefined ? 1 : amt;
    if (this.prog >= q.n) this.complete(); else this.render();
  },
  tick() { // conditions that are checked rather than triggered
    if (!this.active()) return;
    const hEl = document.querySelector('#quest .qhint'); if (hEl) { const h = questHintHTML(); hEl.innerHTML = h; hEl.style.display = h ? '' : 'none'; }
    const q = this.cur;
    let v = null;
    if (q.type === 'have') v = Math.min(q.n, countItem(q.id));
    else if (q.type === 'equip') v = Inv.armor.some(Boolean) ? 1 : 0;
    else if (q.type === 'villages') v = Math.min(q.n, Sites.filter(s => s.cat === 'village' && s.found).length);
    else if (q.type === 'night') { const target = Math.floor(this.startDay - 0.3) + 1.3; v = Game.day >= target ? 1 : 0; }
    if (v === null) return;
    if (v !== this.prog) { this.prog = v; if (v >= q.n) this.complete(); else this.render(); }
  },
  complete() {
    const q = this.cur, r = q.reward || {};
    const got = [];
    for (const [id, n] of r.items || []) { const left = giveItem(id, n); if (left) dropItem(id, left, Player.x, Player.y + 1, Player.z); got.push(n + '× ' + itemDef(id).name); }
    if (r.perk) { this.perks[r.perk] = true; got.push('Power-up: ' + PERKS[r.perk].name + ' (' + PERKS[r.perk].desc + ')'); if (['hearth', 'warden', 'legend'].includes(r.perk)) Player.hp = maxHealth(); clampHealth(); }
    notify('Quest complete!', q.title + (got.length ? '<br><span class="nr">' + got.join(' · ') + '</span>' : ''), iconURL(I.compass));
    Sound.quest();
    const fx = Player.x - Math.sin(Player.yaw) * 2.2, fz = Player.z - Math.cos(Player.yaw) * 2.2;
    burst(fx, Player.y + 0.6, fz, 40, { life: 1.1, size: 0.09, r: 1, g: 0.85, b: 0.4, glow: true, spread: 3, up: 4 });
    const el = $('quest'); el.classList.remove('done'); void el.offsetWidth; el.classList.add('done');
    this.index++; this.prog = 0; this.onStart();
    setTimeout(() => { this.render(true); this.tick(); }, 900);
    lastHudKey = '';
    if (typeof saveGame === 'function') setTimeout(saveGame, 50);
  },
  render(anim) {
    const el = $('quest'); if (!el) return;
    const show = Game.mode === 'survival' && Game.state === 'play' && !this.hidden;
    el.classList.toggle('hidden', !show);
    if (!show) return;
    const q = this.cur;
    if (!q) { el.innerHTML = '<div class="qh">QUESTS COMPLETE</div><div class="qt">Legend of Blockhollow</div><div class="qd">You have finished every quest. The realm is yours to explore.</div>'; return; }
    const pct = Math.min(1, this.prog / q.n);
    const r = q.reward || {};
    const rw = r.perk ? '★ ' + PERKS[r.perk].name : (r.items || []).map(([id, n]) => n + '× ' + itemDef(id).name).join(', ');
    const prog = q.type === 'night' ? (this.prog ? 'Dawn!' : 'Until dawn') : Math.floor(this.prog) + ' / ' + q.n + (q.unit ? ' ' + q.unit : '');
    el.innerHTML = '<div class="qh">QUEST ' + (this.index + 1) + ' / ' + QUESTS.length + '</div><div class="qt">' + q.title + '</div><div class="qd">' + q.desc + '</div>' +
      '<div class="qb"><i style="width:' + (pct * 100) + '%"></i></div><div class="qp">' + prog + '</div><div class="qhint"' + (questHintHTML() ? '' : ' style="display:none"') + '>' + questHintHTML() + '</div>' + (rw ? '<div class="qr">Reward: ' + rw + '</div>' : '');
    if (anim) { el.classList.remove('slide'); void el.offsetWidth; el.classList.add('slide'); this.showDetails(); }
  },
  // the description and reward show for a few seconds when a quest begins, then the card shrinks to one line
  showDetails() {
    const el = $('quest'); el.classList.remove('brief'); clearTimeout(this.briefT);
    this.briefT = setTimeout(() => el.classList.add('brief'), 7000);
  },
};
// power-up effects read by the rest of the game
const Perk = {
  miningMul: () => Quests.has('mining') ? 1.3 : 1,
  speedMul: () => Quests.has('speed') ? 1.1 : 1,
  meleeMul: () => (Quests.has('melee') ? 1.15 : 1) * (Quests.has('legend') ? 1.2 : 1),
  hungerMul: () => Quests.has('stomach') ? 0.6 : 1,
  bonusHp: () => (Quests.has('hearth') ? 4 : 0) + (Quests.has('warden') ? 4 : 0) + (Quests.has('legend') ? 4 : 0),
};
