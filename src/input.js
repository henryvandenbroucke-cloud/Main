'use strict';
/* Keyboard and mouse. Key bindings follow the game's defaults. */
const Input = (() => {
  const keys = new Set(), pressed = new Set(), mouseBtn = [false, false, false], clicked = [false, false, false];
  let dx = 0, dy = 0, wheel = 0, locked = false;
  const BIND = {
    forward: 'KeyW', back: 'KeyS', left: 'KeyA', right: 'KeyD', jump: 'Space', sneak: 'ShiftLeft', sprint: 'ControlLeft',
    inventory: 'KeyE', drop: 'KeyQ', chat: 'KeyT', command: 'Slash', swap: 'KeyF', perspective: 'F5', debug: 'F3', hideHud: 'F1', playerList: 'Tab', advancements: 'KeyL', screenshot: 'F2', pickBlock: null,
  };
  try { Object.assign(BIND, JSON.parse(localStorage.getItem('mc_keys') || '{}')); } catch (e) { /* ignore */ }
  const isDown = act => keys.has(BIND[act]) || (act === 'sneak' && keys.has('ShiftRight')) || (act === 'sprint' && keys.has('ControlRight'));
  const wasPressed = act => pressed.has(BIND[act]);
  addEventListener('keydown', e => {
    if (UI.captureKey && UI.captureKey(e)) return;
    if (['Tab', 'F1', 'F2', 'F3', 'F5', 'Space', 'Slash'].includes(e.code) && UI.inGame()) e.preventDefault();
    if (e.ctrlKey && ['KeyW', 'KeyS', 'KeyD', 'KeyR'].includes(e.code) && UI.inGame()) e.preventDefault();
    if (!keys.has(e.code)) pressed.add(e.code);
    keys.add(e.code);
    UI.onKey(e);
  });
  addEventListener('keyup', e => { keys.delete(e.code); });
  addEventListener('blur', () => { keys.clear(); mouseBtn.fill(false); });
  const canvas = document.getElementById('view');
  canvas.addEventListener('mousedown', e => {
    if (!locked) { if (UI.inGame() && !UI.screenOpen()) requestLock(); return; }
    mouseBtn[e.button] = true; clicked[e.button] = true; e.preventDefault();
  });
  addEventListener('mouseup', e => { mouseBtn[e.button] = false; });
  addEventListener('mousemove', e => { if (locked) { dx += e.movementX; dy += e.movementY; } });
  addEventListener('wheel', e => { if (locked) { wheel += Math.sign(e.deltaY); } }, { passive: true });
  addEventListener('contextmenu', e => { if (UI.inGame()) e.preventDefault(); });
  document.addEventListener('pointerlockchange', () => {
    locked = document.pointerLockElement === canvas;
    if (!locked) { mouseBtn.fill(false); UI.onUnlock(); }
  });
  function requestLock() { try { const p = canvas.requestPointerLock({ unadjustedMovement: false }); if (p && p.catch) p.catch(() => canvas.requestPointerLock()); } catch (e) { canvas.requestPointerLock(); } }
  function releaseLock() { if (document.pointerLockElement) document.exitPointerLock(); }
  return {
    BIND, isDown, wasPressed, keys,
    get locked() { return locked; },
    mouse: mouseBtn, clicked,
    consumeLook() { const r = [dx, dy]; dx = 0; dy = 0; return r; },
    consumeWheel() { const w = wheel; wheel = 0; return w; },
    endFrame() { pressed.clear(); clicked.fill(false); },
    requestLock, releaseLock,
    saveBinds() { try { localStorage.setItem('mc_keys', JSON.stringify(BIND)); } catch (e) { /* ignore */ } },
  };
})();
