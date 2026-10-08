'use strict';
/* Options, kept in the browser between sessions. */
const Settings = (() => {
  const DEF = {
    renderDist: 8, fov: 70, smooth: true, clouds: 'fancy', particles: 'all', maxFps: 0, gamma: 0.5, bobbing: true, sensitivity: 0.5, invertY: false,
    vMaster: 1, vMusic: 0.5, vSfx: 1, vAmbient: 1, guiScale: 0, showFps: false, autoJump: false, fastLeaves: false, hud: true, subtitles: false,
    toggleSprint: false, toggleCrouch: false, fullscreen: false, entityShadows: true, biomeBlend: 2, mipmaps: true,
  };
  let s = {};
  try { s = JSON.parse(localStorage.getItem('mc_settings') || '{}'); } catch (e) { s = {}; }
  const S = Object.assign({}, DEF, s);
  S.hud = true;
  S.save = () => { try { const o = {}; for (const k in DEF) o[k] = S[k]; localStorage.setItem('mc_settings', JSON.stringify(o)); } catch (e) { /* storage blocked */ } };
  S.DEF = DEF;
  return S;
})();
