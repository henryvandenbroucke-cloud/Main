'use strict';
/* The creative inventory with the game's tabs, a search tab and the survival inventory tab. */
const Creative = (() => {
  const N = n => ITEMS[IID[n]] ? IID[n] : -1;
  const has = n => IID[n] !== undefined;
  const TABS = [
    { id: 'building', name: 'Building Blocks', icon: 'bricks' }, { id: 'colored', name: 'Colored Blocks', icon: 'cyan_wool' }, { id: 'natural', name: 'Natural Blocks', icon: 'grass_block' },
    { id: 'functional', name: 'Functional Blocks', icon: 'oak_sign' }, { id: 'redstone', name: 'Redstone Blocks', icon: 'redstone' }, { id: 'tools', name: 'Tools & Utilities', icon: 'diamond_pickaxe' },
    { id: 'combat', name: 'Combat', icon: 'netherite_sword' }, { id: 'food', name: 'Food & Drinks', icon: 'golden_apple' }, { id: 'ingredients', name: 'Ingredients', icon: 'iron_ingot' },
    { id: 'eggs', name: 'Spawn Eggs', icon: 'pig_spawn_egg' }, { id: 'search', name: 'Search Items', icon: 'compass' }, { id: 'inventory', name: 'Survival Inventory', icon: 'chest' },
  ];
  // sort every item into a tab by what it is
  function tabOf(it) {
    const n = it.name, d = it.block >= 0 ? BLOCKS[it.block] : null;
    if (n.endsWith('_spawn_egg')) return 'eggs';
    if (it.food || n === 'milk_bucket' || n === 'cake' || n.endsWith('potion') || n === 'honey_bottle') return 'food';
    if (it.tool && it.tool.kind === 'sword' || it.armor && it.armor.pts || ['bow', 'crossbow', 'arrow', 'spectral_arrow', 'tipped_arrow', 'trident', 'shield', 'totem_of_undying', 'snowball', 'egg', 'end_crystal', 'mace', 'wind_charge', 'turtle_helmet', 'elytra'].includes(n) || n.endsWith('_horse_armor') || (it.tool && it.tool.kind === 'axe' && false)) return 'combat';
    if (it.tool || ['bucket', 'water_bucket', 'lava_bucket', 'powder_snow_bucket', 'flint_and_steel', 'fire_charge', 'compass', 'recovery_compass', 'clock', 'spyglass', 'map', 'filled_map', 'fishing_rod', 'lead', 'name_tag', 'saddle', 'carrot_on_a_stick', 'warped_fungus_on_a_stick', 'brush', 'book', 'writable_book', 'written_book', 'ender_pearl', 'ender_eye', 'firework_rocket', 'experience_bottle', 'bone_meal'].includes(n) || n.endsWith('_bucket') || n.endsWith('_boat') || n.endsWith('_raft') || n.endsWith('minecart') || n.startsWith('music_disc') || n === 'goat_horn') return 'tools';
    if (!d) return 'ingredients';
    if (['redstone', 'redstone_torch', 'repeater', 'comparator', 'lever', 'piston', 'sticky_piston', 'observer', 'hopper', 'dispenser', 'dropper', 'redstone_lamp', 'daylight_detector', 'target', 'tripwire_hook', 'tnt', 'rail', 'powered_rail', 'detector_rail', 'activator_rail', 'note_block', 'slime_block', 'honey_block', 'lightning_rod', 'redstone_block', 'iron_door', 'iron_trapdoor', 'string', 'trapped_chest'].includes(n) || d.model === 'plate' || d.model === 'button') return 'redstone';
    if (/(_wool|_carpet|_terracotta|_concrete|_concrete_powder|_stained_glass|_stained_glass_pane|_shulker_box|_bed|_banner)$/.test(n) || n === 'terracotta' || n === 'glass' || n === 'glass_pane' || n === 'tinted_glass' || n === 'shulker_box') return 'colored';
    if (['crafting_table', 'furnace', 'blast_furnace', 'smoker', 'chest', 'ender_chest', 'barrel', 'anvil', 'chipped_anvil', 'damaged_anvil', 'grindstone', 'enchanting_table', 'brewing_stand', 'cauldron', 'composter', 'stonecutter', 'loom', 'smithing_table', 'fletching_table', 'cartography_table', 'lectern', 'bell', 'jukebox', 'beacon', 'conduit', 'flower_pot', 'scaffolding', 'ladder', 'torch', 'soul_torch', 'lantern', 'soul_lantern', 'campfire', 'soul_campfire', 'chain', 'end_rod', 'end_portal_frame', 'respawn_anchor', 'lodestone', 'bookshelf', 'chiseled_bookshelf', 'painting', 'item_frame', 'glow_item_frame', 'armor_stand', 'dragon_egg', 'bee_nest', 'beehive', 'sea_lantern', 'glowstone', 'shroomlight', 'iron_bars'].includes(n) || d.model === 'sign' || d.model === 'skull') return 'functional';
    const natural = /grass|dirt|podzol|mycelium|mud$|^clay$|gravel|sand$|^sand|_ore$|^stone$|deepslate$|^tuff$|calcite|dripstone|^bedrock|obsidian|^ice$|packed_ice|blue_ice|^snow|powder_snow|moss|magma|amethyst|_log$|_leaves$|_sapling$|propagule|^azalea|flower|dandelion|poppy|orchid|allium|bluet|tulip|daisy|cornflower|lily|wither_rose|sunflower|lilac|rose_bush|peony|fern|dead_bush|mushroom|sugar_cane|cactus|bamboo$|vine|pumpkin|melon|seeds$|^wheat$|carrot|potato|beetroot|berries|cocoa|kelp|seagrass|sea_pickle|coral|spore|hanging_roots|dripleaf|chorus|netherrack|soul_sand|soul_soil|basalt$|^blackstone$|nylium|fungus|roots|sprouts|wart|weeping|twisting|end_stone$|cobweb|bone_block|^raw_.*_block|lichen|^honeycomb_block$|^hay_block$|crying|_stem$|^mangrove_roots|muddy_mangrove/;
    if (natural.test(n) && !/stripped/.test(n)) return 'natural';
    return 'building';
  }
  const lists = {};
  function build() {
    for (const t of TABS) lists[t.id] = [];
    for (const it of ITEMS) {
      if (['enchanted_book', 'filled_map', 'written_book', 'potion', 'splash_potion', 'lingering_potion', 'tipped_arrow', 'reinforced_deepslate', 'trial_spawner', 'netherite_upgrade_smithing_template'].includes(it.name) && !['potion'].includes(it.name)) { if (it.name !== 'netherite_upgrade_smithing_template') continue; }
      const t = tabOf(it); lists[t].push(it.id);
    }
    // potions and tipped arrows of every kind, enchanted books of every enchantment
    if (typeof Potions !== 'undefined') for (const p of Potions.list()) { lists.food.push({ id: IID.potion, tag: { potion: p } }); lists.food.push({ id: IID.splash_potion, tag: { potion: p } }); lists.food.push({ id: IID.lingering_potion, tag: { potion: p } }); lists.combat.push({ id: IID.tipped_arrow, tag: { potion: p } }); }
    for (const e in MCDATA.enchantments) for (let l = 1; l <= MCDATA.enchantments[e].max; l++) lists.tools.push({ id: IID.enchanted_book, tag: { stored: { [e]: l } } });
  }
  class CreativeScreen extends Screens.Screen {
    constructor() {
      super('Creative', 195, 136);
      this.tab = Creative.lastTab || 'building'; this.scroll = 0; this.query = '';
      this.noBg = true;
      const self = this;
      this.cells = [];
      for (let r = 0; r < 5; r++) for (let c = 0; c < 9; c++) {
        const k = r * 9 + c;
        this.cells.push(this.slot(null, 0, 9 + c * 18, 18 + r * 18, { creative: true, get: () => self.itemAt(k), set: () => {} }));
      }
      const inv = Game.player.inv;
      this.hotSlots = []; for (let c = 0; c < 9; c++) this.hotSlots.push(this.slot(inv, c, 9 + c * 18, 112));
      this.mainSlots = [];
      this.trash = this.slot(null, 0, 173, 112, { get: () => null, set: () => {}, trash: true });
    }
    itemAt(k) {
      if (this.tab === 'inventory') return null;
      const L = this.list(), e = L[this.scroll * 9 + k];
      if (e === undefined) return null;
      if (typeof e === 'number') return stack(e, 1);
      return Object.assign({ count: 1, dmg: 0 }, e);
    }
    list() {
      if (this.tab === 'search') {
        const q = this.query.toLowerCase();
        const out = [];
        for (const t of TABS) if (lists[t.id]) for (const e of lists[t.id]) { const s = typeof e === 'number' ? stack(e, 1) : Object.assign({ count: 1, dmg: 0 }, e); if (!q || itemName(s).toLowerCase().includes(q) || ITEMS[s.id].name.includes(q.replace(/ /g, '_'))) out.push(e); }
        return out;
      }
      return lists[this.tab] || [];
    }
    build() {
      super.build();
      const S = GUI.S, el = this.el;
      el.style.backgroundImage = `url(${GUI.windowBg(195, 136)})`;
      // tabs along the top and bottom
      TABS.forEach((t, i) => {
        const top = i < 6, k = top ? i : i - 6, x = k * 29 + (i === 10 ? 166 - 5 * 29 : 0) + (i === 11 ? 166 - 5 * 29 : 0);
        const tx = i === 10 ? 166 : i === 11 ? 166 : k * 29, ty = top ? -28 : 136, b = document.createElement('div');
        b.className = 'ctab' + (this.tab === t.id ? ' on' : '') + (top ? ' top' : ' bottom');
        b.style.left = tx * S + 'px'; b.style.top = (i === 10 ? -28 : ty) * S + 'px';
        if (i === 10) { b.style.left = 166 * S + 'px'; b.style.top = -28 * S + 'px'; }
        if (i === 11) { b.style.left = 166 * S + 'px'; b.style.top = 136 * S + 'px'; }
        b.innerHTML = iconHTML(stack(t.icon, 1));
        b.title = t.name;
        b.onmousedown = e => { e.stopPropagation(); this.setTab(t.id); };
        b.onmouseenter = () => { Slots.hideTip(); const tp = document.getElementById('tooltip'); tp.innerHTML = t.name; tp.classList.remove('hidden'); };
        b.onmouseleave = () => Slots.hideTip();
        el.appendChild(b);
        void x;
      });
      const title = document.createElement('div'); title.className = 'glabel'; title.style.left = 8 * S + 'px'; title.style.top = 6 * S + 'px'; title.textContent = TABS.find(t => t.id === this.tab).name; el.appendChild(title);
      if (this.tab === 'search') {
        const inp = document.createElement('input'); inp.className = 'csearch'; inp.style.left = 82 * S + 'px'; inp.style.top = 5 * S + 'px'; inp.value = this.query;
        inp.oninput = () => { this.query = inp.value; this.scroll = 0; Screens.render(); };
        inp.onkeydown = e => { e.stopPropagation(); if (e.code === 'Escape') Screens.close(); };
        el.appendChild(inp); setTimeout(() => inp.focus(), 0);
      }
      // scroll bar
      const bar = document.createElement('div'); bar.className = 'cscroll'; bar.style.cssText = `left:${175 * S}px;top:${18 * S}px;${GUI.css('scroll')}`; el.appendChild(bar); this.bar = bar;
      el.onwheel = e => { const rows = Math.ceil(this.list().length / 9); this.scroll = Math.max(0, Math.min(Math.max(0, rows - 5), this.scroll + Math.sign(e.deltaY))); Screens.render(); };
      if (this.tab === 'inventory') this.buildInventory(el, S);
      const trashIcon = document.createElement('div'); trashIcon.className = 'ctrash'; trashIcon.style.left = 173 * S + 'px'; trashIcon.style.top = 112 * S + 'px'; trashIcon.textContent = '✕'; el.appendChild(trashIcon);
    }
    buildInventory(el, S) {
      // the survival inventory inside the creative screen: armour, off hand and the main inventory
      for (const s of this.cells) s.hidden = true;
      const inv = Game.player.inv;
      const extra = [];
      for (let i = 0; i < 4; i++) extra.push(this.slot(inv, 36 + i, 54 + (i % 2) * 54, 6 + Math.floor(i / 2) * 27, { max: 1, filter: s => ITEMS[s.id].armor && ITEMS[s.id].armor.slot === i, emptyIcon: ['empty_helmet', 'empty_chest', 'empty_legs', 'empty_boots'][i], onChange: () => Game.player.updateArmor() }));
      extra.push(this.slot(inv, 40, 35, 20, { emptyIcon: 'empty_shield' }));
      for (let r = 0; r < 3; r++) for (let c = 0; c < 9; c++) extra.push(this.slot(inv, 9 + r * 9 + c, 9 + c * 18, 54 + r * 18));
      for (const s of extra) {
        const d = document.createElement('div'); d.className = 'gslot'; d.style.left = (s.x - 1) * S + 'px'; d.style.top = (s.y - 1) * S + 'px';
        d.addEventListener('mousedown', e => { e.preventDefault(); e.stopPropagation(); Slots.mouseDown(s, e.button, e); });
        d.addEventListener('mouseenter', () => Slots.setHover(s)); d.addEventListener('mouseleave', () => Slots.setHover(null));
        s.el = d; el.appendChild(d);
      }
    }
    setTab(t) { if (this.tab === 'inventory') this.slots = this.slots.filter(s => this.cells.includes(s) || this.hotSlots.includes(s) || s === this.trash); for (const s of this.cells) s.hidden = false; this.tab = t; Creative.lastTab = t; this.scroll = 0; Screens.rebuild(); }
    renderExtra() {
      const rows = Math.ceil(this.list().length / 9), max = Math.max(0, rows - 5);
      if (this.bar) this.bar.style.top = (18 + (max ? this.scroll / max : 0) * (112 - 18 - 15 - 4)) * GUI.S + 'px';
    }
    // clicks in the item grid give items; the trash slot deletes; shift-click on trash clears the inventory
    creativeClick(s, button, e) {
      if (s.trash) { if (Slots.cursor) Slots.cursor = null; else if (e.shiftKey) { const inv = Game.player.inv; for (let i = 0; i < 41; i++) inv.set(i, null); } return true; }
      if (!s.creative) return false;
      const st = Slots.get(s);
      if (Slots.cursor) { Slots.cursor = null; return true; } // dropping onto the item list deletes
      if (!st) return true;
      const full = Object.assign({}, st, { count: maxStack(st) });
      if (e.shiftKey) { Game.player.inv.add(full, 0, 9); return true; }
      Slots.cursor = Object.assign({}, st, { count: button === 2 ? 1 : button === 1 ? maxStack(st) : (e.ctrlKey ? maxStack(st) : maxStack(st)) });
      if (button === 0 && !e.ctrlKey) Slots.cursor = Object.assign({}, st, { count: maxStack(st) });
      return true;
    }
    quickMove(s) {
      const st = Slots.get(s); if (!st) return;
      if (this.hotSlots.includes(s)) { Slots.set(s, null); return; }
      super.quickMove(s);
    }
  }
  return { build, CreativeScreen, TABS, lists, lastTab: null };
})();
