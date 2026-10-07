'use strict';
/* Interface (temporary minimal version for engine testing; replaced by the full menus). */
const UI = {
  screen: null, game: false,
  inGame() { return this.game; },
  screenOpen() { return !!this.screen; },
  onKey(e) {
    if (!this.game) return;
    const p = Game.player;
    if (e.code === 'Escape') { if (this.screen) this.screen = null; else { Game.paused = !Game.paused; Input.releaseLock(); } }
    if (/^Digit[1-9]$/.test(e.code)) { p.inv.selected = +e.code.slice(5) - 1; HUD.refresh(); }
    if (e.code === 'F5') p.view = (p.view + 1) % 3;
  },
  onUnlock() { if (this.game && !this.screen) Game.paused = true; },
  showDeath() {}, captureKey() { return false; }, open() {},
  enterGame() { this.game = true; document.getElementById('title').classList.add('hidden'); HUD.refresh(); },
  frame() {
    const p = Game.player; if (!p) return;
    const w = Input.consumeWheel(); if (w) { p.inv.selected = (p.inv.selected + w + 9) % 9; HUD.refresh(); }
  },
};
const HUD = {
  refresh() {
    const p = Game.player; if (!p) return;
    const el = document.getElementById('hotbar');
    el.innerHTML = p.inv.slots.slice(0, 9).map((s, i) => '<div class="slot' + (i === p.inv.selected ? ' sel' : '') + '">' + (s ? ITEMS[s.id].display.slice(0, 10) : '') + '</div>').join('');
  },
  tick() {}, totem() {},
  frame() {
    const p = Game.player; if (!p) return;
    const d = document.getElementById('debug');
    d.textContent = 'FPS ' + Loop.fps + '  XYZ ' + p.x.toFixed(1) + ' ' + p.y.toFixed(1) + ' ' + p.z.toFixed(1) + '  chunks ' + World.chunks.size + '  ' + BIOMES[World.biomeAt(Math.floor(p.x), Math.floor(p.z))].name;
  },
};
