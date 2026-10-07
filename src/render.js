'use strict';
/* Chunk meshing with smooth lighting + AO, voxel shader, sky, clouds, aurora, particles. */
const canvasEl = document.getElementById('view');
const renderer = new THREE.WebGLRenderer({ canvas: canvasEl, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.outputEncoding = THREE.LinearEncoding;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(72, 1, 0.05, 400);
camera.rotation.order = 'YXZ';
scene.add(camera);

// High-resolution world atlas: every 16x16 tile is redrawn at 64x64 with soft transitions between
// the original pixels and a layer of fine detail, so surfaces read as smooth materials instead of big
// squares. Each tile sits in a 128px cell with 32px of wrapped padding, so mipmaps don't bleed.
const HI = 64, HCELL = 128, PAD = 32, HIW = HCELL * 16;
// relief strength per texture: rough stone and brick stand out most, glass, glow and plants stay flat
const RELIEF = { stone: 1, cobble: 1.15, mossycobble: 1.1, stonebrick: 1, mossybrick: 1, crackedbrick: 1.1, darkbrick: 1, darkbrick_cracked: 1.1, redbrick: 1, sandbrick: 0.9, bedrock: 1.2, basalt: 1, gravel: 1.1, polished: 0.5,
  coal_ore: 1, iron_ore: 1, gold_ore: 1, lapis_ore: 1, dirt: 0.8, grass_side: 0.8, grass_top: 0.55, path: 0.8, farmland: 0.9, mud: 0.8, sand: 0.45, sandstone: 0.7, snow: 0.3, ash: 0.7,
  planks: 0.85, planks_dark: 0.85, log_side: 1.1, log_dark_side: 1.1, log_top: 0.7, log_dark_top: 0.7, thatch: 0.9, hay_side: 0.8, bookshelf: 0.8, chest_front: 0.7, chest_side: 0.7, barrel_side: 0.8, crate: 0.8, table_top: 0.7, table_side: 0.7,
  wool_red: 0.5, wool_white: 0.5, wool_blue: 0.5, wool_green: 0.5, wool_yellow: 0.5, wool_purple: 0.5, leaves: 0.45, leaves_dark: 0.45, leaves_blossom: 0.4, plaster: 0.4, timber: 0.7, terracotta: 0.4, roof_red: 0.8, roof_blue: 0.8,
  iron_block: 0.5, gold_block: 0.5, cactus_side: 0.6, swamp_grass: 0.55, swamp_grass_side: 0.8, snow_side: 0.7 };
let atlasNormalCanvas = null;
function buildHiAtlas() {
  const src = Atlas.canvas.getContext('2d').getImageData(0, 0, 256, 256).data;
  const cv = document.createElement('canvas'); cv.width = cv.height = HIW;
  const g = cv.getContext('2d'), img = g.createImageData(HIW, HIW), out = img.data;
  const ncv = document.createElement('canvas'); ncv.width = ncv.height = HIW;
  const ng = ncv.getContext('2d'), nimg = ng.createImageData(HIW, HIW), nout = nimg.data;
  const ss = f => f < 0.18 ? 0 : f > 0.82 ? 1 : (f - 0.18) / 0.64 * ((f - 0.18) / 0.64) * (3 - 2 * (f - 0.18) / 0.64);
  const hsh = (x, y) => { let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
  const vn = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy); return (hsh(xi, yi) * (1 - u) + hsh(xi + 1, yi) * u) * (1 - v) + (hsh(xi, yi + 1) * (1 - u) + hsh(xi + 1, yi + 1) * u) * v; };
  const names = []; for (const k in Atlas.tiles) names[Atlas.tiles[k]] = k;
  const N = HI * HI, col = new Float32Array(N * 4), hgt = new Float32Array(N), blur = new Float32Array(N), tmp = new Float32Array(N);
  const W8 = v => ((v % HI) + HI) % HI;
  for (let t = 0; t < Atlas.count; t++) {
    const tx = (t % 16) * 16, ty = Math.floor(t / 16) * 16, cx = (t % 16) * HCELL, cy = Math.floor(t / 16) * HCELL;
    const T = (x, y) => (((ty + (y & 15)) * 256) + tx + (x & 15)) * 4;
    const relief = RELIEF[names[t]] !== undefined ? RELIEF[names[t]] : 0.25;
    // 1. smooth 4x upscale with fine detail (premultiplied so transparent edges stay clean)
    for (let wy = 0; wy < HI; wy++) for (let wx = 0; wx < HI; wx++) {
      const sx = (wx + 0.5) / 4 - 0.5, sy = (wy + 0.5) / 4 - 0.5, ix = Math.floor(sx), iy = Math.floor(sy);
      const fx = ss(sx - ix), fy = ss(sy - iy);
      const a = T(ix, iy), b = T(ix + 1, iy), c = T(ix, iy + 1), d = T(ix + 1, iy + 1);
      const wa = (1 - fx) * (1 - fy), wb = fx * (1 - fy), wc = (1 - fx) * fy, wd = fx * fy;
      const A = src[a + 3] * wa + src[b + 3] * wb + src[c + 3] * wc + src[d + 3] * wd, o = (wx + wy * HI) * 4;
      col[o + 3] = A;
      if (A < 1) { hgt[wx + wy * HI] = 0; continue; }
      const det = 1 + ((hsh(wx + t * 977, wy) - 0.5) * 0.08 + (vn(wx / 5 + t * 13, wy / 5) - 0.5) * 0.07 + (vn(wx / 2.2 + t * 7, wy / 2.2 + 50) - 0.5) * 0.05) * (0.4 + relief * 0.6);
      for (let k = 0; k < 3; k++) col[o + k] = (src[a + k] * src[a + 3] * wa + src[b + k] * src[b + 3] * wb + src[c + k] * src[c + 3] * wc + src[d + k] * src[d + 3] * wd) / A * det;
      hgt[wx + wy * HI] = (col[o] * 0.3 + col[o + 1] * 0.59 + col[o + 2] * 0.11) / 255;
    }
    // 2. height from brightness; crevices (darker than their surroundings) get darker still
    for (let pass = 0; pass < 2; pass++) { const from = pass ? tmp : hgt, to = pass ? blur : tmp; for (let y = 0; y < HI; y++) for (let x = 0; x < HI; x++) { let sum = 0; for (let k = -4; k <= 4; k++) sum += pass ? from[x + W8(y + k) * HI] : from[W8(x + k) + y * HI]; to[x + y * HI] = sum / 9; } }
    for (let i = 0; i < N; i++) { if (col[i * 4 + 3] < 1) continue; const cav = Math.max(-0.35, Math.min(0.2, (hgt[i] - blur[i]) * 2.2)) * relief; const f = 1 + cav; col[i * 4] *= f; col[i * 4 + 1] *= f; col[i * 4 + 2] *= f; }
    // 3. pad by wrapping, writing colour and tangent-space normals (alpha = relief strength)
    for (let oy = -PAD; oy < HI + PAD; oy++) for (let ox = -PAD; ox < HI + PAD; ox++) {
      const wx = W8(ox), wy = W8(oy), i = wx + wy * HI, o = ((cy + PAD + oy) * HIW + cx + PAD + ox) * 4;
      out[o] = Math.min(255, col[i * 4]); out[o + 1] = Math.min(255, col[i * 4 + 1]); out[o + 2] = Math.min(255, col[i * 4 + 2]); out[o + 3] = col[i * 4 + 3];
      const hx = (hgt[W8(wx + 1) + wy * HI] - hgt[W8(wx - 1) + wy * HI]) * 3.2 * relief, hy = (hgt[wx + W8(wy + 1) * HI] - hgt[wx + W8(wy - 1) * HI]) * 3.2 * relief;
      const l = Math.hypot(hx, hy, 1);
      nout[o] = (-hx / l * 0.5 + 0.5) * 255; nout[o + 1] = (-hy / l * 0.5 + 0.5) * 255; nout[o + 2] = (1 / l * 0.5 + 0.5) * 255; nout[o + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0); ng.putImageData(nimg, 0, 0);
  atlasNormalCanvas = ncv;
  return cv;
}
const atlasTex = new THREE.CanvasTexture(buildHiAtlas());
atlasTex.magFilter = THREE.LinearFilter; atlasTex.minFilter = THREE.LinearMipmapLinearFilter; atlasTex.generateMipmaps = true; atlasTex.flipY = false;
atlasTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
// PBR material table, one texel per tile: R = glossiness, G = metalness
const GLOSS = { polished: [0.75, 0], iron_block: [0.85, 1], gold_block: [0.9, 1], ancient_gold: [0.8, 1], glass: [0.95, 0], crystal: [0.9, 0], crystal_rose: [0.9, 0], fallen_star: [0.7, 0],
  stonebrick: [0.35, 0], mossybrick: [0.3, 0], stone: [0.3, 0], cobble: [0.22, 0], mossycobble: [0.2, 0], darkbrick: [0.4, 0], basalt: [0.45, 0], sandstone: [0.15, 0], sandbrick: [0.2, 0],
  iron_ore: [0.45, 0.3], gold_ore: [0.5, 0.4], coal_ore: [0.4, 0], lapis_ore: [0.5, 0], planks: [0.25, 0], planks_dark: [0.3, 0], log_side: [0.12, 0], table_top: [0.35, 0], chest_top: [0.3, 0], chest_front: [0.3, 0], barrel_side: [0.35, 0.15],
  leaves: [0.45, 0], leaves_dark: [0.45, 0], leaves_blossom: [0.35, 0], grass_top: [0.2, 0], swamp_grass: [0.35, 0], mud: [0.55, 0], snow: [0.35, 0], terracotta: [0.25, 0], roof_red: [0.35, 0], roof_blue: [0.4, 0],
  redbrick: [0.25, 0], plaster: [0.2, 0], cauldron: [0.6, 0.6], rail: [0.7, 0.8], lamp: [0.6, 0.2], bookshelf: [0.25, 0], cactus_side: [0.4, 0], lilypad: [0.6, 0] };
const glossTex = (() => { const d = new Uint8Array(16 * 16 * 4); for (const k in Atlas.tiles) { const i = Atlas.tiles[k], g = GLOSS[k] || [0.08, 0]; d[i * 4] = g[0] * 255; d[i * 4 + 1] = g[1] * 255; d[i * 4 + 3] = 255; } const t = new THREE.DataTexture(d, 16, 16, THREE.RGBAFormat); t.needsUpdate = true; return t; })();
const normalTex = new THREE.CanvasTexture(atlasNormalCanvas);
normalTex.magFilter = THREE.LinearFilter; normalTex.minFilter = THREE.LinearMipmapLinearFilter; normalTex.flipY = false; normalTex.anisotropy = atlasTex.anisotropy;

const U = {
  uAtlas: { value: atlasTex }, uNormal: { value: normalTex }, uGloss: { value: glossTex }, uMist: { value: 0 }, uSeaY: { value: 22 }, uDay: { value: 1 }, uTime: { value: 0 },
  uFogColor: { value: new THREE.Color(0xbfd8ee) }, uFogNear: { value: 60 }, uFogFar: { value: 150 },
  uTorch: { value: new THREE.Color(1.0, 0.7, 0.4) }, uUnder: { value: 0 },
  uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSunCol: { value: new THREE.Color(1, 0.96, 0.88) }, uAmbCol: { value: new THREE.Color(0.45, 0.52, 0.66) },
  uViewSun: { value: new THREE.Vector3(0, 1, 0) }, uHazeCol: { value: new THREE.Color(1, 0.75, 0.45) },
  uPLight: { value: new THREE.Vector4(0, 0, 0, 0) },
  uReflTex: { value: null }, uReflMat: { value: new THREE.Matrix4() }, uReflOn: { value: 0 }, uReflH: { value: 22.88 }, uClipY: { value: -1000 },
  uSkyTop: { value: new THREE.Color(0x4a8ad8) }, uSkyHor: { value: new THREE.Color(0xbfd8ee) },
  uShadowMap: { value: null }, uShadowMatrix: { value: new THREE.Matrix4() }, uShadowOn: { value: 0 }, uShadowSize: { value: 2048 },
};
const VERT = `
attribute vec3 aTile; attribute vec2 aLocal; attribute vec4 aLight;
varying vec3 vTile; varying vec2 vLocal; varying vec4 vLight; varying float vFog; varying vec3 vWorld;
uniform float uTime;
void main(){
  vTile=aTile; vLocal=aLocal; vLight=aLight;
  vec3 p=position;
  float anim=mod(aTile.z,10.0);
  if(anim>1.5&&anim<2.5){ float sh=clamp(aLight.z*8.0,0.0,1.0); p.y+=(sin(p.x*0.9+uTime*1.7)*0.03+cos(p.z*0.8+uTime*1.3)*0.03+sin((p.x+p.z)*0.37+uTime*0.9)*0.025)*sh; }
  if(anim>2.5&&anim<3.5){ float w=sin(uTime*1.4+p.x*0.5+p.z*0.3); p.x+=w*0.04*aLocal.y; p.z+=cos(uTime*1.1+p.x*0.4)*0.03*aLocal.y; }
  vec4 wp=modelMatrix*vec4(p,1.0);
  vWorld=wp.xyz;
  vec4 mv=viewMatrix*wp;
  vFog=length(mv.xyz);
  gl_Position=projectionMatrix*mv;
}`;
const FRAG = `
uniform sampler2D uAtlas; uniform sampler2D uNormal; uniform sampler2D uGloss; uniform float uMist; uniform float uSeaY; uniform float uDay; uniform float uTime; uniform vec3 uFogColor; uniform float uFogNear; uniform float uFogFar;
uniform vec3 uTorch; uniform float uCut; uniform float uOpacity; uniform float uUnder; uniform float uPlant;
uniform vec3 uSunDir; uniform vec3 uSunCol; uniform vec3 uAmbCol; uniform vec3 uHazeCol;
uniform vec4 uPLight;
uniform sampler2D uReflTex; uniform mat4 uReflMat; uniform float uReflOn; uniform float uReflH; uniform float uClipY; uniform vec3 uSkyTop; uniform vec3 uSkyHor;
uniform sampler2D uShadowMap; uniform mat4 uShadowMatrix; uniform float uShadowOn; uniform float uShadowSize;
varying vec3 vTile; varying vec2 vLocal; varying vec4 vLight; varying float vFog; varying vec3 vWorld;
vec3 toLin(vec3 c){ return pow(c, vec3(2.2)); }
vec3 toSrgb(vec3 c){ return pow(max(c, 0.0), vec3(1.0/2.2)); }
float shadowAt(vec3 wp, vec3 n){
  if(uShadowOn<0.5) return 1.0;
  vec4 sc=uShadowMatrix*vec4(wp+n*0.07,1.0);
  vec3 c=sc.xyz/sc.w*0.5+0.5;
  if(c.x<0.0||c.x>1.0||c.y<0.0||c.y>1.0||c.z>1.0) return 1.0;
  float t=1.0/uShadowSize, s=0.0;
  for(int i=-1;i<=1;i++) for(int j=-1;j<=1;j++){ float d=texture2D(uShadowMap,c.xy+vec2(float(i),float(j))*t*1.25).r; s+= (c.z-0.0012>d)?0.0:1.0; }
  s/=9.0;
  vec2 e=min(c.xy,1.0-c.xy); float edge=smoothstep(0.0,0.08,min(e.x,e.y));
  return mix(1.0,s,edge);
}
vec3 V0(){ return normalize(cameraPosition-vWorld); }
// ---- water: summed directional waves (analytic slopes) + small ripples
vec2 waveSlope(vec2 p, float t){
  vec2 g=vec2(0.0);
  vec4 D[6]; D[0]=vec4(0.86,0.5,0.55,1.1); D[1]=vec4(-0.32,0.95,0.9,1.5); D[2]=vec4(0.6,-0.8,1.6,2.1); D[3]=vec4(-0.9,-0.43,2.7,2.6); D[4]=vec4(0.2,0.98,4.3,3.4); D[5]=vec4(-0.7,0.71,6.9,4.1);
  float A[6]; A[0]=0.11; A[1]=0.08; A[2]=0.05; A[3]=0.035; A[4]=0.022; A[5]=0.014;
  for(int i=0;i<6;i++){ float k=D[i].z; float ph=dot(D[i].xy,p)*k+t*D[i].w; g+=D[i].xy*k*A[i]*cos(ph); }
  return g;
}
float hash2(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float vnoise2(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(hash2(i),hash2(i+vec2(1,0)),f.x),mix(hash2(i+vec2(0,1)),hash2(i+vec2(1,1)),f.x),f.y); }
float caustic(vec2 p, float t){ // two drifting layers of bright, wobbly cells
  vec2 q=p*1.6; float c=0.0;
  for(int i=0;i<2;i++){ vec2 o=vec2(t*0.35,-t*0.27)*(i==0?1.0:-0.8); float n=vnoise2(q+o+vec2(sin(q.y*1.7+t),cos(q.x*1.3-t))*0.35); c+=pow(1.0-abs(n*2.0-1.0),7.0); q*=1.73; }
  return c;
}
void main(){
  float anim=mod(vTile.z,10.0);
  vec2 l=vLocal;
  if(anim>0.5&&anim<2.5) l.y=fract(l.y+uTime*(anim<1.5?0.03:0.06));
  l=clamp(l,0.001,0.999);
  vec2 cellO=vTile.xy*128.0+32.0;
  vec2 uv=(cellO+vec2(l.x,1.0-l.y)*64.0)/2048.0;
  vec2 guv=(cellO+vec2(vLocal.x,1.0-vLocal.y)*64.0)/2048.0; // continuous coords for mip selection
  vec4 t=texture2DGradEXT(uAtlas,uv,dFdx(guv),dFdy(guv));
  if(t.a<uCut) discard;
  vec3 alb=toLin(t.rgb);
  vec3 n0=normalize(cross(dFdx(vWorld),dFdy(vWorld)));
  // tiny per-block colour variation breaks up repetition on big flat areas
  if(vTile.z<10.0 && !(anim>1.5&&anim<2.5)){ vec3 bp=floor(vWorld-n0*0.01); float hv=fract(sin(dot(bp,vec3(12.9898,78.233,37.719)))*43758.5453); alb*=0.95+hv*0.1; }
  vec3 n=normalize(cross(dFdx(vWorld),dFdy(vWorld)));
  bool water=anim>1.5&&anim<2.5;
  if(uClipY>-999.0 && vWorld.y<uClipY) discard; // mirror pass: nothing below the water plane
  float wdepth=2.0; // side faces of water count as open water
  if(water&&n.y>0.5){ wdepth=vLight.z*8.0; vec2 sl=waveSlope(vWorld.xz,uTime)*(0.35+0.65*clamp(wdepth,0.0,1.0)); n=normalize(vec3(-sl.x,1.0,-sl.y)); }
  vec3 ng=n; // geometric normal, kept for shadow lookups
  if(!water && uPlant<0.5 && vTile.z<10.0){
    vec3 tn=texture2DGradEXT(uNormal,uv,dFdx(guv),dFdy(guv)).xyz*2.0-1.0;
    vec3 dp1=dFdx(vWorld), dp2=dFdy(vWorld); vec2 du1=dFdx(guv), du2=dFdy(guv);
    vec3 p2=cross(dp2,n), p1=cross(n,dp1);
    vec3 Tg=p2*du1.x+p1*du2.x, Bg=p2*du1.y+p1*du2.y;
    float im=inversesqrt(max(max(dot(Tg,Tg),dot(Bg,Bg)),1e-20));
    float fade=1.0-smoothstep(18.0,48.0,vFog); // distant surfaces stay flat (no shimmer)
    n=normalize(mix(n,normalize(Tg*im*tn.x+Bg*im*tn.y+n*tn.z),fade));
  }
  float sky=vLight.x, blk=vLight.y, ao=water?1.0:vLight.z;
  float ndl=uPlant>0.5 ? 0.65 : max(dot(n,uSunDir),0.0)*smoothstep(-0.02,0.12,dot(ng,uSunDir)); // relief can't light a face that points away from the sun
  float outdoor=smoothstep(0.45,0.93,sky);
  float sh=outdoor>0.0 ? shadowAt(vWorld,ng) : 0.0;
  vec3 direct=uSunCol*ndl*sh*outdoor*1.1;
  vec3 hemi=mix(vec3(0.72,0.66,0.58),vec3(1.06,1.06,1.12),n.y*0.5+0.5); // sky above, warm bounce below
  vec3 amb=uAmbCol*hemi*(0.08+0.92*pow(sky,1.6));
  float flick=0.93+0.07*sin(uTime*10.0+vWorld.x*2.7+vWorld.z*1.9)*sin(uTime*6.3+vWorld.y);
  float tl=pow(blk,2.2)*2.7*flick;
  if(uPLight.w>0.0){ float pd=distance(vWorld,uPLight.xyz); tl=max(tl,pow(max(0.0,1.0-pd/9.0),2.0)*1.6*uPLight.w*flick); }
  vec3 light=(amb+direct)*ao*mix(1.0,vLight.w,0.55)+uTorch*tl*mix(1.0,ao,0.6)+vec3(0.004,0.005,0.008);
  vec3 col=alb*light;
  if(!water && vTile.z<10.0){ // PBR specular: Blinn-Phong lobe from glossiness, metals tint it with their own colour
    vec2 gm=texture2D(uGloss,(vTile.xy+0.5)/16.0).rg;
    if(gm.r>0.1){
      vec3 Vv=normalize(cameraPosition-vWorld), Hh=normalize(Vv+uSunDir);
      float pw=exp2(2.0+gm.r*9.0), nh=max(dot(n,Hh),0.0);
      float spec=pow(nh,pw)*(pw+8.0)/25.0*gm.r;
      float fr=0.04+0.96*pow(1.0-max(dot(Vv,Hh),0.0),5.0);
      vec3 F=mix(vec3(fr),alb*1.6,gm.g);
      col+=uSunCol*F*spec*ndl*sh*outdoor*1.4;
      // a hint of sky reflected in shiny things
      vec3 Rr=reflect(-Vv,n); col+=mix(toLin(uFogColor),toLin(uFogColor)*0.6+vec3(0.02,0.04,0.09),clamp(Rr.y,0.0,1.0))*F*gm.r*gm.r*0.35*sky;
    }
  }
  if(!water && vTile.z<10.0 && vWorld.y<uReflH-0.12 && sky>0.3 && uUnder<0.5){ float cdep=uReflH-vWorld.y; col+=alb*uSunCol*caustic(vWorld.xz+n0.xz*0.0+vec2(vWorld.y*0.3),uTime)*0.55*smoothstep(0.0,0.6,cdep)*exp(-cdep*0.18)*(0.3+0.7*ndl); }
  if(uPlant>0.5){ float tr=pow(max(dot(-V0(),uSunDir),0.0),3.0); col+=alb*uSunCol*tr*0.55*outdoor*sh; } // sunlight through leaves
  if(vTile.z>=10.0){ float lm=dot(alb,vec3(0.33)); col=mix(alb,alb*vec3(1.0,0.78,0.5)*1.25,smoothstep(0.35,0.8,lm)*step(alb.b,alb.r))*(2.0+0.3*sin(uTime*2.0+vLocal.x*3.0)); }
  vec3 V=normalize(cameraPosition-vWorld);
  float alpha=water? uOpacity : t.a;
  if(water){
    float cosT=max(dot(V,n),0.0);
    float fres=0.02+0.98*pow(1.0-cosT,5.0);                    // Schlick Fresnel for water (F0 = 0.02)
    vec3 R=reflect(-V,n);
    // reflection: the mirrored world where available, otherwise the sky
    vec3 skyR=mix(toLin(uSkyHor),toLin(uSkyTop),pow(clamp(R.y,0.0,1.0),0.55));
    skyR+=toLin(uHazeCol)*pow(max(dot(R,uSunDir),0.0),8.0)*0.4;
    vec3 refl=skyR;
    if(uReflOn>0.5 && n.y>0.5 && abs(vWorld.y-uReflH)<0.45){
      vec4 rc=uReflMat*vec4(vWorld.x,uReflH,vWorld.z,1.0); vec2 ruv=rc.xy/rc.w+n.xz*0.035;
      vec3 rw=toLin(texture2D(uReflTex,clamp(ruv,0.002,0.998)).rgb);
      float edge=smoothstep(0.0,0.04,min(min(ruv.x,1.0-ruv.x),min(ruv.y,1.0-ruv.y)));
      refl=mix(skyR,rw,edge);
    }
    // body colour: light is absorbed with depth, red first, so shallows read turquoise and depths deep blue
    float dep=max(wdepth,0.05);
    vec3 absorb=exp(-vec3(0.45,0.11,0.07)*dep*1.6);
    vec3 deep=vec3(0.006,0.03,0.06), shallow=vec3(0.06,0.32,0.32);
    vec3 body=mix(deep,shallow,absorb.g)*(amb*0.9+direct*0.5+0.02);
    // light scattering through the wave crests toward the viewer
    float sss=pow(max(dot(-V,uSunDir)*0.5+0.5,0.0),4.0)*max(n.y-0.92,0.0)*12.0;
    body+=vec3(0.05,0.3,0.25)*uSunCol*sss*outdoor;
    // sun glints: a tight highlight plus a broad sheen
    vec3 Hh=normalize(V+uSunDir);
    float glint=pow(max(dot(n,Hh),0.0),900.0)*28.0+pow(max(dot(n,Hh),0.0),90.0)*0.6;
    col=mix(body,refl*(0.25+0.75*sky),fres)+uSunCol*glint*sh*outdoor;
    // foam where the water meets the shore, drifting with the waves
    float shore=1.0-smoothstep(0.08,0.75,wdepth);
    float fn=vnoise2(vWorld.xz*3.2+vec2(uTime*0.35,uTime*0.21))*0.6+vnoise2(vWorld.xz*7.0-uTime*0.5)*0.4;
    float foam=smoothstep(0.55,0.72,fn+shore*0.55)*shore;
    col=mix(col,vec3(0.85,0.9,0.92)*(amb+direct*0.8+0.05),foam*0.85);
    // shallow water is clear, deep water and grazing angles are opaque
    alpha=clamp(mix(0.22,0.93,1.0-absorb.g)+fres*0.5+foam,0.0,1.0);
    if(uUnder>0.5){ col=mix(body*2.0,refl,0.15); alpha=0.75; }
  }
  vec3 outc=toSrgb(col);
  float f=smoothstep(uFogNear,uFogFar,vFog);
  float aer=smoothstep(uFogNear*0.35,uFogFar,vFog)*0.35; outc=mix(outc,mix(vec3(dot(outc,vec3(0.3,0.59,0.11))),outc,0.7)*0.97+uFogColor*0.03,aer);
  vec3 fogc=uFogColor+uHazeCol*pow(max(dot(-V,uSunDir),0.0),6.0)*0.35;
  if(uMist>0.001){ float hgt=max(vWorld.y-uSeaY+1.0,0.0); float mist=(1.0-exp(-vFog*0.02*uMist))*exp(-hgt*0.16); f=max(f,clamp(mist,0.0,0.85)); }
  if(uUnder>0.5){ f=smoothstep(2.0,24.0,vFog); fogc=uFogColor; }
  gl_FragColor=vec4(mix(outc,fogc,f),alpha);
}`;
function voxelMat(cut, opacity, transparent) {
  const m = new THREE.ShaderMaterial({
    uniforms: Object.assign({}, U, { uCut: { value: cut }, uOpacity: { value: opacity }, uPlant: { value: 0 } }),
    vertexShader: VERT, fragmentShader: FRAG, transparent: !!transparent, depthWrite: !transparent,
    side: transparent ? THREE.DoubleSide : THREE.FrontSide,
  });
  m.extensions.derivatives = true; m.extensions.shaderTextureLOD = true;
  return m;
}
const matSolid = voxelMat(0.5, 1, false);
const matCross = voxelMat(0.5, 1, false); matCross.side = THREE.DoubleSide; matCross.uniforms.uPlant.value = 1;
const matWater = voxelMat(0.0, 0.62, true);
const matGlass = voxelMat(0.05, 1, true);
for (const m of [matSolid, matCross, matWater, matGlass]) for (const k of Object.keys(U)) m.uniforms[k] = U[k];

// ---------------------------------------------------------------- mesher
const TILEPOS = {};
for (const k in Atlas.tiles) { const i = Atlas.tiles[k]; TILEPOS[k] = [i % ATLAS_N, Math.floor(i / ATLAS_N)]; }
// faces: normal axis, dir, vertex corners (bl, br, tr, tl as seen from outside)
const FACES = [
  { n: [1, 0, 0], v: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], sh: 0.8, k: 'side', dir: 1 },
  { n: [-1, 0, 0], v: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], sh: 0.8, k: 'side', dir: 3 },
  { n: [0, 1, 0], v: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], sh: 1.0, k: 'top' },
  { n: [0, -1, 0], v: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], sh: 0.55, k: 'bottom' },
  { n: [0, 0, 1], v: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], sh: 0.68, k: 'side', dir: 2 },
  { n: [0, 0, -1], v: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], sh: 0.68, k: 'side', dir: 0 },
];
const LOCALUV = [[0, 0], [1, 0], [1, 1], [0, 1]];
// mesh buffers: typed arrays reused for every chunk (no garbage, so no collection pauses while streaming)
function TBuf() { this.cap = 0; this.n = 0; this.ni = 0; this.grow(4096); }
TBuf.prototype.grow = function (cap) {
  const p = new Float32Array(cap * 3), t = new Float32Array(cap * 3), l = new Float32Array(cap * 2), li = new Float32Array(cap * 4), ix = new Uint32Array(cap * 1.5);
  if (this.cap) { p.set(this.p); t.set(this.t); l.set(this.l); li.set(this.li); ix.set(this.i); }
  this.p = p; this.t = t; this.l = l; this.li = li; this.i = ix; this.cap = cap;
};
const MESH_BUFS = [new TBuf(), new TBuf(), new TBuf(), new TBuf()];
function takeBuf(k) { const b = MESH_BUFS[k]; b.n = 0; b.ni = 0; return b; }
function quad(g, verts, tile, anim, uvs, light) {
  if (g.n + 4 > g.cap) g.grow(g.cap * 2);
  const tp = TILEPOS[tile] || [0, 0], s = g.n;
  for (let k = 0; k < 4; k++) {
    const v = s + k, vk = verts[k], uk = uvs[k], lk = light[k];
    g.p[v * 3] = vk[0]; g.p[v * 3 + 1] = vk[1]; g.p[v * 3 + 2] = vk[2];
    g.t[v * 3] = tp[0]; g.t[v * 3 + 1] = tp[1]; g.t[v * 3 + 2] = anim;
    g.l[v * 2] = uk[0]; g.l[v * 2 + 1] = uk[1];
    g.li[v * 4] = lk[0]; g.li[v * 4 + 1] = lk[1]; g.li[v * 4 + 2] = lk[2]; g.li[v * 4 + 3] = lk[3];
  }
  const I = g.i; let o = g.ni;
  // flip the diagonal for nicer AO interpolation
  if (light[0][2] + light[2][2] < light[1][2] + light[3][2]) { I[o++] = s + 1; I[o++] = s + 2; I[o++] = s + 3; I[o++] = s + 1; I[o++] = s + 3; I[o++] = s; }
  else { I[o++] = s; I[o++] = s + 1; I[o++] = s + 2; I[o++] = s; I[o++] = s + 2; I[o++] = s + 3; }
  g.ni = o; g.n += 4;
}
function opaqueAt(x, y, z) { if (y >= H) return 0; if (y < 0 || !resident(x, z)) return 1; return OPAQUE[wb[(x & 255) + (z & 255) * W + y * W * D]]; }
function lightSample(x, y, z) {
  if (y >= H) return [15, 0];
  if (y < 0 || !resident(x, z)) return [0, 0];
  const i = (x & 255) + (z & 255) * W + y * W * D; return [wsky[i], wbl[i]];
}
const AOV = [0.45, 0.63, 0.82, 1.0];
function waterColDepth(x, y, z) { if (getB(x, y, z) !== B.WATER) return 0; let d = 0; while (d < 8 && getB(x, y - d, z) === B.WATER) d++; return d; }
function waterDepthAt(vx, y, vz) { // average depth of the four columns touching this corner; land counts as 0
  let s = 0; for (const [dx, dz] of [[-1, -1], [0, -1], [-1, 0], [0, 0]]) s += waterColDepth(vx + dx, y, vz + dz); return Math.min(8, s / 4);
}
// smooth lighting + ambient occlusion for one face; neighbour offsets are precomputed per face corner and
// the result buffer is reused (callers copy the values straight into the mesh)
for (const f of FACES) {
  const n = f.n, ax = n[0] !== 0 ? 0 : n[1] !== 0 ? 1 : 2, t1 = ax === 0 ? 1 : 0, t2 = ax === 2 ? 1 : 2;
  f.co = f.v.map(v => { const o1 = [0, 0, 0], o2 = [0, 0, 0]; o1[t1] = v[t1] ? 1 : -1; o2[t2] = v[t2] ? 1 : -1; return [o1[0], o1[1], o1[2], o2[0], o2[1], o2[2]]; });
}
const FL_OUT = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
const WD_ = W * D;
function LIX(x, y, z) { if (y >= H) return -2; if (y < 0 || !resident(x, z)) return -1; return (x & 255) + (z & 255) * W + y * WD_; }
function faceLight(x, y, z, f, smooth) {
  const n = f.n, cx = x + n[0], cy = y + n[1], cz = z + n[2];
  const ci = LIX(cx, cy, cz), csk = ci === -2 ? 15 : ci < 0 ? 0 : wsky[ci], cbl = ci < 0 ? 0 : wbl[ci];
  for (let k = 0; k < 4; k++) {
    const o = FL_OUT[k];
    if (!smooth) { o[0] = csk / 15; o[1] = cbl / 15; o[2] = 1; o[3] = f.sh; continue; }
    const q = f.co[k];
    const ia = LIX(cx + q[0], cy + q[1], cz + q[2]), ib = LIX(cx + q[3], cy + q[4], cz + q[5]), ic = LIX(cx + q[0] + q[3], cy + q[1] + q[4], cz + q[2] + q[5]);
    const a = ia === -2 ? 0 : ia < 0 ? 1 : OPAQUE[wb[ia]], b = ib === -2 ? 0 : ib < 0 ? 1 : OPAQUE[wb[ib]], cc = ic === -2 ? 0 : ic < 0 ? 1 : OPAQUE[wb[ic]];
    const ao = a && b ? 0 : 3 - (a + b + cc);
    let sk = csk, bl = cbl, cnt = 1;
    if (!a) { sk += ia === -2 ? 15 : ia < 0 ? 0 : wsky[ia]; bl += ia < 0 ? 0 : wbl[ia]; cnt++; }
    if (!b) { sk += ib === -2 ? 15 : ib < 0 ? 0 : wsky[ib]; bl += ib < 0 ? 0 : wbl[ib]; cnt++; }
    if (!cc && !(a && b)) { sk += ic === -2 ? 15 : ic < 0 ? 0 : wsky[ic]; bl += ic < 0 ? 0 : wbl[ic]; cnt++; }
    o[0] = sk / cnt / 15; o[1] = bl / cnt / 15; o[2] = AOV[ao]; o[3] = f.sh;
  }
  return FL_OUT;
}
const FACING_FACE = [5, 0, 4, 1]; // facing meta -> FACES index of the front
function texFor(d, f, fi, meta) {
  if (f.k === 'top') return d.tex.top;
  if (f.k === 'bottom') return d.tex.bottom;
  if (d.tex.front !== d.tex.side && FACING_FACE[meta] === fi) return d.tex.front;
  return d.tex.side;
}
function buildChunkGeo(cx, cz) {
  const S = takeBuf(0), X = takeBuf(1), Wt = takeBuf(2), G = takeBuf(3);
  const x0 = cx * CS, z0 = cz * CS;
  let top = H - 1; // highest layer with anything in it
  scan: for (; top >= 0; top--) { const base = top * WD_; for (let z = z0; z < z0 + CS; z++) { const row = base + (z & 255) * W; for (let x = x0; x < x0 + CS; x++) if (wb[row + (x & 255)]) break scan; } }
  for (let y = 0; y <= top; y++) for (let z = z0; z < z0 + CS; z++) for (let x = x0; x < x0 + CS; x++) {
    const i = (x & 255) + (z & 255) * W + y * W * D, id = wb[i];
    if (!id) continue;
    const d = BLK[id], meta = wm[i], emis = d.emissive ? 10 : 0;
    const r = d.render;
    if (r === 'cube' || r === 'cutout' || r === 'liquid') {
      const g = r === 'liquid' ? (id === B.WATER ? Wt : S) : (r === 'cutout' ? (d.cutLike ? S : G) : S);
      const isWater = id === B.WATER, isLava = id === B.LAVA;
      const topOpen = r === 'liquid' && getB(x, y + 1, z) !== id;
      for (let fi = 0; fi < 6; fi++) {
        const f = FACES[fi], nid = getB(x + f.n[0], y + f.n[1], z + f.n[2]);
        if (y + f.n[1] < 0) continue;
        if (!resident(x + f.n[0], z + f.n[2])) continue;
        if (r === 'liquid') { if (nid === id || (OPAQUE[nid] && fi !== 2)) continue; if (fi === 2 && OPAQUE[nid]) continue; }
        else if (r === 'cutout') { if (OPAQUE[nid] || (nid === id && !d.cutLike)) continue; if (nid === id && d.cutLike && hash3(x, y, z) < 0.5 && fi !== 2) continue; }
        else if (OPAQUE[nid]) continue;
        const verts = f.v.map(v => {
          let vy = v[1];
          if (topOpen && v[1] === 1) vy = isWater ? 0.88 : 0.9;
          return [x + v[0], y + vy, z + v[2]];
        });
        const uvs = f.k === 'side' ? LOCALUV.map((uv, k) => [uv[0], (topOpen && uv[1] === 1) ? 0.88 : uv[1]]) : f.v.map(v => [v[0], v[2]]);
        const light = faceLight(x, y, z, f, r === 'cube' || d.cutLike);
        if (isWater && topOpen && fi === 2) for (let k = 0; k < 4; k++) { const v = f.v[k]; light[k] = light[k].slice(); light[k][2] = waterDepthAt(x + v[0], y, z + v[2]) / 8; }
        quad(g, verts, texFor(d, f, fi, meta), (d.anim || 0) + emis, uvs, light);
      }
    } else if (r === 'cross') {
      const L = lightSample(x, y, z), lt = [L[0] / 15, L[1] / 15, 1, 0.92];
      const ang = hash3(x, y, z) * 0.6;
      const s = 0.45, cxm = x + 0.5, czm = z + 0.5;
      for (let k = 0; k < 2; k++) {
        const a = ang + k * Math.PI / 2 + Math.PI / 4, dx = Math.cos(a) * s * 1.414 / 1.414, dz = Math.sin(a) * s;
        const ddx = Math.cos(a) * s;
        const v = [[cxm - ddx, y, czm - dz], [cxm + ddx, y, czm + dz], [cxm + ddx, y + 1, czm + dz], [cxm - ddx, y + 1, czm - dz]];
        quad(X, v, d.tex.side, (d.anim || 0) + emis, LOCALUV, [lt, lt, lt, lt]);
      }
    } else if (r === 'flat') {
      const L = lightSample(x, y, z), lt = [L[0] / 15, L[1] / 15, 1, 1];
      const h = y + 0.02;
      quad(X, [[x, h, z + 1], [x + 1, h, z + 1], [x + 1, h, z], [x, h, z]], d.tex.top, 0, [[0, 0], [1, 0], [1, 1], [0, 1]], [lt, lt, lt, lt]);
    } else if (r === 'ladder') {
      const L = lightSample(x, y, z), lt = [L[0] / 15, L[1] / 15, 1, 0.85];
      const e = 0.06;
      let v;
      if (meta === 0) v = [[x + 1, y, z + 1 - e], [x, y, z + 1 - e], [x, y + 1, z + 1 - e], [x + 1, y + 1, z + 1 - e]];        // on wall at +z, facing -z
      else if (meta === 1) v = [[x + e, y, z + 1], [x + e, y, z], [x + e, y + 1, z], [x + e, y + 1, z + 1]];                // wall at -x
      else if (meta === 2) v = [[x, y, z + e], [x + 1, y, z + e], [x + 1, y + 1, z + e], [x, y + 1, z + e]];                // wall at -z
      else v = [[x + 1 - e, y, z], [x + 1 - e, y, z + 1], [x + 1 - e, y + 1, z + 1], [x + 1 - e, y + 1, z]];                // wall at +x
      quad(X, v, d.tex.side, 0, LOCALUV, [lt, lt, lt, lt]);
    } else if (r === 'box') {
      const bx = d.box, L = lightSample(x, y, z);
      for (let fi = 0; fi < 6; fi++) {
        const f = FACES[fi];
        const verts = f.v.map(v => [x + (v[0] ? bx[3] : bx[0]), y + (v[1] ? bx[4] : bx[1]), z + (v[2] ? bx[5] : bx[2])]);
        const uvs = f.k === 'side' ? f.v.map(v => [(f.n[0] !== 0 ? (v[2] ? bx[5] : bx[2]) : (v[0] ? bx[3] : bx[0])), v[1] ? bx[4] : bx[1]]) : f.v.map(v => [v[0] ? bx[3] : bx[0], v[2] ? bx[5] : bx[2]]);
        let NL = L;
        const nx = x + f.n[0], ny = y + f.n[1], nz = z + f.n[2];
        if (!OPAQUE[getB(nx, ny, nz)]) { const L2 = lightSample(nx, ny, nz); NL = [Math.max(L[0], L2[0]), Math.max(L[1], L2[1])]; }
        const lt = [NL[0] / 15, NL[1] / 15, 1, f.sh];
        quad(G === S ? S : S, verts, texFor(d, f, fi, meta), emis, uvs, [lt, lt, lt, lt]);
      }
    }
  }
  return [S, X, Wt, G];
}
const chunkMeshes = new Array(NCX * NCZ).fill(null);
const MATS = [matSolid, matCross, matWater, matGlass];
function toMesh(g, mat, order) {
  if (!g.n) return null;
  const geo = new THREE.BufferGeometry();
  const n = g.n;
  geo.setAttribute('position', new THREE.BufferAttribute(g.p.slice(0, n * 3), 3));
  geo.setAttribute('aTile', new THREE.BufferAttribute(g.t.slice(0, n * 3), 3));
  geo.setAttribute('aLocal', new THREE.BufferAttribute(g.l.slice(0, n * 2), 2));
  geo.setAttribute('aLight', new THREE.BufferAttribute(g.li.slice(0, n * 4), 4));
  geo.setIndex(new THREE.BufferAttribute(n < 65536 ? Uint16Array.from(g.i.subarray(0, g.ni)) : g.i.slice(0, g.ni), 1));
  geo.computeBoundingSphere();
  const m = new THREE.Mesh(geo, mat);
  m.renderOrder = order; m.matrixAutoUpdate = false;
  return m;
}
function disposeSlot(k) {
  if (chunkMeshes[k]) for (const m of chunkMeshes[k]) if (m) { scene.remove(m); m.geometry.dispose(); }
  chunkMeshes[k] = null;
}
function rebuildChunk(cx, cz) { // absolute chunk coordinates
  if (!chunkResident(cx, cz)) return;
  const k = slotOf(cx, cz);
  disposeSlot(k);
  const gs = buildChunkGeo(cx, cz);
  chunkMeshes[k] = gs.map((g, i) => { const m = toMesh(g, MATS[i], i === 2 ? 2 : i === 3 ? 3 : 0); if (m) { if (i === 0) m.layers.enable(1); scene.add(m); } return m; });
}
const dirtyChunks = new Map(); // "cx,cz" -> [cx, cz]
function markDirty(cx, cz) { if (chunkResident(cx, cz)) dirtyChunks.set(cx + ',' + cz, [cx, cz]); }
function markDirtyAround(x0, x1, z0, z1) {
  for (let cz = Math.floor(z0 / CS); cz <= Math.floor(z1 / CS); cz++) for (let cx = Math.floor(x0 / CS); cx <= Math.floor(x1 / CS); cx++) markDirty(cx, cz);
}
function flushDirty(budget) {
  let n = 0;
  for (const [k, c] of dirtyChunks) { dirtyChunks.delete(k); rebuildChunk(c[0], c[1]); if (++n >= budget) break; }
}

// ---------------------------------------------------------------- sky
const skyGeo = new THREE.SphereGeometry(300, 24, 12);
// tileable value-noise texture (4 independent channels) for cheap fbm in the sky shader
const skyNoiseTex = (() => {
  const N = 128, d = new Uint8Array(N * N * 4);
  const h = (x, y, c) => { let v = Math.imul(x & (N - 1), 374761393) ^ Math.imul(y & (N - 1), 668265263) ^ Math.imul(c + 1, 2246822519); v = Math.imul(v ^ (v >>> 13), 1274126177); return ((v ^ (v >>> 16)) >>> 0) / 4294967295; };
  for (let c = 0; c < 4; c++) { const cell = [4, 8, 16, 32][c];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const gx = x / N * cell, gy = y / N * cell, ix = Math.floor(gx), iy = Math.floor(gy), fx = gx - ix, fy = gy - iy, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
      const hh = (a, b) => h(((a % cell) + cell) % cell * 7919, ((b % cell) + cell) % cell * 104729, c);
      d[(x + y * N) * 4 + c] = 255 * ((hh(ix, iy) * (1 - u) + hh(ix + 1, iy) * u) * (1 - v) + (hh(ix, iy + 1) * (1 - u) + hh(ix + 1, iy + 1) * u) * v);
    } }
  const t = new THREE.DataTexture(d, N, N, THREE.RGBAFormat); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.needsUpdate = true; return t;
})();
// Physically based sky: Rayleigh + Mie single scattering with optical depth that grows toward the horizon,
// and a raymarched layer of volumetric clouds (self-shadowed, silver-lined) drifting with the wind.
const skyMat = new THREE.ShaderMaterial({
  uniforms: { uTop: { value: new THREE.Color(0x4a8ad8) }, uHorizon: { value: new THREE.Color(0xbfd8ee) }, uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uGlow: { value: new THREE.Color(0xffc080) },
    uNoise: { value: skyNoiseTex }, uTime: U.uTime, uCover: { value: 0.5 }, uSteps: { value: 10 }, uDay: U.uDay, uMoonDir: { value: new THREE.Vector3(0, -1, 0) }, uCam: { value: new THREE.Vector2() } },
  vertexShader: 'varying vec3 vP; void main(){ vP=normalize(position); vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.0); gl_Position=p.xyww; }',
  fragmentShader: `uniform vec3 uTop, uHorizon, uSunDir, uGlow, uMoonDir; uniform sampler2D uNoise; uniform float uTime, uCover, uDay, uSteps; uniform vec2 uCam; varying vec3 vP;
  const vec3 BR=vec3(5.8,13.5,33.1)*0.055; const vec3 BM=vec3(0.21)*0.11;
  float odepth(float h){ h=max(h,-0.05); return 1.0/(h+0.11*exp(-h*10.0)+0.022); }
  vec3 atmos(vec3 rd, vec3 sd, float strength){
    // Rayleigh look: deep blue zenith fading to a pale horizon; low sun reddens the band toward it (Mie halo around the sun)
    float zen=max(rd.y,0.0), sunH=sd.y, mu=dot(rd,sd);
    float hz=pow(1.0-zen,3.5);
    vec3 c=mix(vec3(0.20,0.42,0.86),vec3(0.66,0.80,0.96),hz);
    float low=1.0-smoothstep(-0.05,0.4,sunH);
    float toward=pow(max(dot(normalize(rd.xz+1e-4),normalize(sd.xz+1e-4)),0.0)*0.5+0.5,2.0);
    vec3 dusk=mix(vec3(1.0,0.42,0.16),vec3(1.0,0.72,0.42),zen*2.0);
    c=mix(c,dusk,clamp(low*hz*(0.25+0.75*toward)*1.25,0.0,1.0));
    c=mix(c,c*vec3(0.55,0.5,0.8),low*(1.0-hz)*0.5);  // the zenith turns violet at dusk
    c*=mix(0.18,1.0,smoothstep(-0.18,0.22,sunH));
    c+=vec3(1.0,0.86,0.62)*(pow(max(mu,0.0),32.0)*0.45+pow(max(mu,0.0),5.0)*0.12*(0.3+hz));
    return c*strength;
  }
  float fbm(vec2 p){ return texture2D(uNoise,p*0.25).r*0.5+texture2D(uNoise,p*0.25+0.37).g*0.27+texture2D(uNoise,p*0.25+0.71).b*0.15+texture2D(uNoise,p*0.25+0.13).a*0.08; }
  float cloudDens(vec3 p){ // p in cloud-layer space, y in 0..1 across the layer
    vec2 w=p.xz+vec2(uTime*0.012,uTime*0.004);
    float base=fbm(w*0.3);
    float shape=smoothstep(0.0,0.25,p.y)*smoothstep(1.0,0.45,p.y);
    float d=base-(1.0-uCover)*0.62-0.18;
    d+= (texture2D(uNoise,w*0.9+p.y*0.3).a-0.5)*0.1;   // erode the edges
    return max(d*shape*3.2,0.0);
  }
  void main(){
    vec3 rd=normalize(vP);
    float day=clamp(uDay*1.25-0.2,0.0,1.0);
    // daytime sky from scattering, night falls back to the authored gradient
    vec3 atm=atmos(rd,uSunDir,1.0);
    vec3 grad=mix(uHorizon,uTop,pow(max(rd.y,0.0),0.6));
    vec3 c=mix(grad, atm, day*0.9);
    // keep the horizon band matched to the fog so distant land blends in
    c=mix(c, uHorizon, (1.0-smoothstep(0.0,0.14,rd.y))*0.65);
    c+=uGlow*pow(max(dot(rd,uSunDir),0.0),8.0)*0.35*(1.0-rd.y);
    // volumetric clouds
    if(rd.y>0.015 && uSteps>0.5){
      float t0=1.0/rd.y, t1=1.55/rd.y; const int STEPS=14;
      float dt=(t1-t0)/uSteps, T=1.0; vec3 acc=vec3(0.0);
      vec3 sd=uSunDir.y>-0.1 ? uSunDir : uMoonDir;
      float mu=dot(rd,sd), hg=(1.0-0.36)/pow(1.0+0.36-1.2*mu,1.5)*0.6+0.45; // forward scattering: silver linings
      vec3 sunC=mix(vec3(0.18,0.22,0.35),mix(vec3(1.0,0.55,0.32),vec3(1.0,0.97,0.92),smoothstep(0.0,0.35,uSunDir.y)),day);
      vec3 ambC=mix(vec3(0.05,0.06,0.1),mix(grad,vec3(0.75,0.82,0.95),0.5),day);
      float jit=0.5;
      for(int i=0;i<STEPS;i++){ if(float(i)>=uSteps) break;
        float t=t0+dt*(float(i)+jit); vec3 wp=rd*t; vec3 p=vec3(wp.x+uCam.x,(wp.y-1.0)/0.55,wp.z+uCam.y);
        float d=cloudDens(p); if(d<=0.001) continue;
        float ld=0.0; for(int k=1;k<=3;k++){ if(k>1 && uSteps<7.0) break; ld+=cloudDens(p+vec3(sd.x,sd.y*1.6,sd.z)*0.09*float(k)); }
        if(uSteps<7.0) ld*=2.2;
        float beer=exp(-ld*0.9), powder=1.0-exp(-d*2.0);
        vec3 lit=sunC*beer*hg*powder*1.6+ambC*(0.5+0.5*p.y);
        float a=1.0-exp(-d*dt*2.4);
        acc+=T*a*lit; T*=1.0-a; if(T<0.03) break;
      }
      float fade=smoothstep(0.015,0.12,rd.y);
      c=mix(c, acc+c*T, fade);
    }
    gl_FragColor=vec4(c,1.0);
  }`,
  side: THREE.BackSide, depthWrite: false, fog: false,
});
const sky = new THREE.Mesh(skyGeo, skyMat); sky.renderOrder = -10; sky.frustumCulled = false; scene.add(sky);
const celestial = new THREE.Group(); scene.add(celestial);
function discTex(inner, outer, size) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'), gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gr.addColorStop(0, inner); gr.addColorStop(0.35, inner); gr.addColorStop(0.42, outer); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c); return t;
}
const sunMesh = new THREE.Mesh(new THREE.PlaneGeometry(70, 70), new THREE.MeshBasicMaterial({ map: discTex('#fffbe0', 'rgba(255,220,140,0.35)', 64), transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
const moonMesh = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshBasicMaterial({ map: discTex('#e8eeff', 'rgba(180,200,255,0.25)', 64), transparent: true, depthWrite: false, fog: false }));
sunMesh.position.set(0, 0, -260); moonMesh.position.set(0, 0, 260); sunMesh.lookAt(0, 0, 0); moonMesh.lookAt(0, 0, 0);
celestial.add(sunMesh, moonMesh);
// stars
const starGeo = new THREE.BufferGeometry(), sp = [];
for (let i = 0; i < 900; i++) { const u = Math.random() * 2 - 1, a = Math.random() * 6.283, r = Math.sqrt(1 - u * u); sp.push(Math.cos(a) * r * 250, Math.abs(u) * 250, Math.sin(a) * r * 250); }
starGeo.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false });
const stars = new THREE.Points(starGeo, starMat); stars.renderOrder = -9; celestial.add(stars);
// blocky clouds
const cloudGroup = new THREE.Group(); scene.add(cloudGroup);
(function buildClouds() {
  const pos = [], idx = [];
  let n = 0;
  const box = (x0, z0, x1, z1, y0, y1) => {
    const v = [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]];
    for (const p of v) pos.push(p[0], p[1], p[2]);
    const f = [[0, 1, 2, 0, 2, 3], [5, 4, 7, 5, 7, 6], [4, 0, 3, 4, 3, 7], [1, 5, 6, 1, 6, 2], [3, 2, 6, 3, 6, 7], [4, 5, 1, 4, 1, 0]];
    for (const q of f) for (const k of q) idx.push(n + k);
    n += 8;
  };
  for (let z = -40; z < 40; z++) for (let x = -40; x < 40; x++) if (vnoise(x / 4, z / 4, 991) > 0.62 && vnoise(x / 11, z / 11, 992) > 0.45) box(x * 12, z * 12, x * 12 + 12, z * 12 + 12, 0, 4);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false }));
  m.renderOrder = -5; cloudGroup.add(m); cloudGroup.userData.mat = m.material; cloudGroup.visible = false; // replaced by volumetric clouds in the sky shader
})();
// aurora ribbons (highlands at night)
const auroraMat = new THREE.ShaderMaterial({
  uniforms: { uTime: U.uTime, uAlpha: { value: 0 } },
  vertexShader: 'varying vec2 vUv; uniform float uTime; void main(){ vUv=uv; vec3 p=position; p.z+=sin(p.x*0.02+uTime*0.3)*30.0; p.y+=sin(p.x*0.05+uTime*0.5)*6.0; gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0); }',
  fragmentShader: 'varying vec2 vUv; uniform float uTime; uniform float uAlpha; void main(){ float band=pow(sin(vUv.y*3.1416),2.0)*(0.6+0.4*sin(vUv.x*40.0+uTime*1.5)); vec3 c=mix(vec3(0.2,1.0,0.6),vec3(0.5,0.3,1.0),vUv.y); gl_FragColor=vec4(c,band*uAlpha*(1.0-vUv.y)); }',
  transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: false,
});
const aurora = new THREE.Group();
for (let k = 0; k < 3; k++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(500, 60, 60, 1), auroraMat); m.position.set(0, 120 + k * 12, -120 - k * 40); aurora.add(m); }
aurora.renderOrder = -6; scene.add(aurora);

// ---------------------------------------------------------------- particles
const MAXP = 2500;
const pGeo = new THREE.BufferGeometry();
const pPos = new Float32Array(MAXP * 3), pCol = new Float32Array(MAXP * 4), pSize = new Float32Array(MAXP);
pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 4));
pGeo.setAttribute('size', new THREE.BufferAttribute(pSize, 1));
const pMat = new THREE.ShaderMaterial({
  uniforms: { uScale: { value: 400 } },
  vertexShader: 'attribute vec4 color; attribute float size; varying vec4 vC; uniform float uScale; void main(){ vC=color; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize=size*uScale/max(-mv.z,0.1); gl_Position=projectionMatrix*mv; }',
  fragmentShader: 'varying vec4 vC; void main(){ vec2 d=gl_PointCoord-0.5; if(max(abs(d.x),abs(d.y))>0.5) discard; gl_FragColor=vC; }',
  transparent: true, depthWrite: false,
});
const pPoints = new THREE.Points(pGeo, pMat); pPoints.frustumCulled = false; pPoints.renderOrder = 5; scene.add(pPoints);
const parts = [];
let PARTICLE_DENSITY = 1;
function emit(x, y, z, o) {
  if (PARTICLE_DENSITY < 1 && Math.random() > PARTICLE_DENSITY) return;
  if (parts.length >= MAXP) parts.shift();
  parts.push(Object.assign({ x, y, z, vx: 0, vy: 0, vz: 0, life: 1, max: 1, size: 0.12, r: 1, g: 1, b: 1, a: 1, grav: 0, drag: 0, glow: false, fade: true }, o, { max: o.life || 1 }));
}
function burst(x, y, z, n, o) {
  for (let i = 0; i < n; i++) emit(x, y, z, Object.assign({}, o, { vx: (Math.random() - 0.5) * (o.spread || 3), vy: Math.random() * (o.up || 3), vz: (Math.random() - 0.5) * (o.spread || 3), life: (o.life || 0.6) * (0.6 + Math.random() * 0.6) }));
}
function updateParticles(dt, daylight) {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.life -= dt; if (p.life <= 0) { parts.splice(i, 1); continue; }
    p.vy -= p.grav * dt; const k = 1 - p.drag * dt; p.vx *= k; p.vy *= k; p.vz *= k;
    p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    if (p.grav > 0 && solidAt(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z))) { p.vy = 0; p.vx *= 0.5; p.vz *= 0.5; p.y = Math.floor(p.y) + 1.01; }
  }
  const n = parts.length;
  for (let i = 0; i < n; i++) {
    const p = parts[i], t = p.life / p.max;
    pPos[i * 3] = p.x; pPos[i * 3 + 1] = p.y; pPos[i * 3 + 2] = p.z;
    const lit = p.glow ? 1.9 : (0.35 + 0.65 * daylight);
    pCol[i * 4] = p.r * lit; pCol[i * 4 + 1] = p.g * lit; pCol[i * 4 + 2] = p.b * lit; pCol[i * 4 + 3] = p.a * (p.fade ? Math.min(1, t * 2) : 1);
    pSize[i] = p.size * (p.grow ? (1 + (1 - t) * p.grow) : 1);
  }
  pGeo.setDrawRange(0, n);
  pGeo.attributes.position.needsUpdate = true; pGeo.attributes.color.needsUpdate = true; pGeo.attributes.size.needsUpdate = true;
}
function tileAvgColor(name) {
  if (!tileAvgColor.c) tileAvgColor.c = {};
  if (tileAvgColor.c[name]) return tileAvgColor.c[name];
  const [tx, ty] = TILEPOS[name] || [0, 0];
  const d = Atlas.canvas.getContext('2d').getImageData(tx * 16, ty * 16, 16, 16).data;
  let r = 0, g = 0, b = 0, n = 0;
  for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 100) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; }
  return (tileAvgColor.c[name] = n ? [r / n / 255, g / n / 255, b / n / 255] : [0.5, 0.5, 0.5]);
}
function blockBurst(x, y, z, id, n) {
  const c = tileAvgColor(BLK[id].tex.side);
  for (let i = 0; i < (n || 14); i++) emit(x + Math.random(), y + Math.random(), z + Math.random(), { vx: (Math.random() - 0.5) * 3, vy: Math.random() * 3, vz: (Math.random() - 0.5) * 3, grav: 14, life: 0.5 + Math.random() * 0.4, size: 0.07 + Math.random() * 0.05, r: c[0] * (0.8 + Math.random() * 0.3), g: c[1] * (0.8 + Math.random() * 0.3), b: c[2] * (0.8 + Math.random() * 0.3) });
}

// ---------------------------------------------------------------- floating damage numbers
const dmgSprites = [];
function damageNumber(x, y, z, val, crit) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 64;
  const g = c.getContext('2d'); g.font = 'bold 40px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 6; g.strokeStyle = '#1a1010'; const txt = (Math.round(val * 10) / 10).toString();
  g.strokeText(txt, 64, 32); g.fillStyle = crit ? '#ffd23a' : '#ffffff'; g.fillText(txt, 64, 32);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthTest: false, fog: false }));
  sp.scale.set(crit ? 1.1 : 0.8, crit ? 0.55 : 0.4, 1); sp.position.set(x + (Math.random() - 0.5) * 0.4, y, z + (Math.random() - 0.5) * 0.4); sp.renderOrder = 20;
  scene.add(sp); dmgSprites.push({ sp, life: 0.9 });
}
function updateDamageNumbers(dt) {
  for (let i = dmgSprites.length - 1; i >= 0; i--) {
    const d = dmgSprites[i]; d.life -= dt; d.sp.position.y += dt * 1.2; d.sp.material.opacity = Math.min(1, d.life * 2);
    if (d.life <= 0) { scene.remove(d.sp); d.sp.material.map.dispose(); d.sp.material.dispose(); dmgSprites.splice(i, 1); }
  }
}

// ---------------------------------------------------------------- voxel models from icons (held items, dropped items)
const ITEM_GEO = {};
function itemGeometry(id) {
  if (ITEM_GEO[id]) return ITEM_GEO[id];
  let geo;
  if (id < 256 && ['cube', 'cutout', 'box'].includes(BLK[id].render)) {
    const d = BLK[id], pos = [], col = [], idx = [];
    let n = 0;
    FACES.forEach((f, fi) => {
      const c = tileAvgColor(texFor(d, f, fi, 0)), sh = f.sh;
      for (const v of f.v) { pos.push(v[0] - 0.5, v[1] - 0.5, v[2] - 0.5); col.push(c[0] * sh, c[1] * sh, c[2] * sh); }
      idx.push(n, n + 1, n + 2, n, n + 2, n + 3); n += 4;
    });
    geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); geo.setIndex(idx);
    // textured version for blocks
    const uvs = [];
    FACES.forEach((f, fi) => { const tp = TILEPOS[texFor(d, f, fi, 0)]; for (const uv of LOCALUV) uvs.push((tp[0] * 128 + 32 + uv[0] * 64) / 2048, (tp[1] * 128 + 32 + (1 - uv[1]) * 64) / 2048); });
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.userData.block = true;
  } else {
    const cv = iconCanvas(id), sz = cv.width, data = cv.getContext('2d').getImageData(0, 0, sz, sz).data;
    const pos = [], col = [], idx = []; let n = 0;
    const s = 1 / sz, th = 1 / 16;
    const op = (x, y) => x >= 0 && y >= 0 && x < sz && y < sz && data[(x + y * sz) * 4 + 3] > 100;
    for (let y = 0; y < sz; y++) for (let x = 0; x < sz; x++) {
      if (!op(x, y)) continue;
      const o = (x + y * sz) * 4, r = data[o] / 255, g = data[o + 1] / 255, b = data[o + 2] / 255;
      if (data[o] === 24 && data[o + 1] === 18 && data[o + 2] === 28) continue; // skip the 2D outline in 3D
      const X0 = x * s - 0.5, X1 = X0 + s, Y1 = 0.5 - y * s, Y0 = Y1 - s, Z0 = -th / 2, Z1 = th / 2;
      const faces = [
        [[X0, Y0, Z1], [X1, Y0, Z1], [X1, Y1, Z1], [X0, Y1, Z1], 1],
        [[X1, Y0, Z0], [X0, Y0, Z0], [X0, Y1, Z0], [X1, Y1, Z0], 0.8],
      ];
      if (!op(x, y - 1)) faces.push([[X0, Y1, Z1], [X1, Y1, Z1], [X1, Y1, Z0], [X0, Y1, Z0], 0.9]);
      if (!op(x, y + 1)) faces.push([[X0, Y0, Z0], [X1, Y0, Z0], [X1, Y0, Z1], [X0, Y0, Z1], 0.6]);
      if (!op(x - 1, y)) faces.push([[X0, Y0, Z0], [X0, Y0, Z1], [X0, Y1, Z1], [X0, Y1, Z0], 0.7]);
      if (!op(x + 1, y)) faces.push([[X1, Y0, Z1], [X1, Y0, Z0], [X1, Y1, Z0], [X1, Y1, Z1], 0.7]);
      for (const f of faces) { for (let k = 0; k < 4; k++) { pos.push(f[k][0], f[k][1], f[k][2]); col.push(r * f[4], g * f[4], b * f[4]); } idx.push(n, n + 1, n + 2, n, n + 2, n + 3); n += 4; }
    }
    geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); geo.setIndex(idx);
  }
  ITEM_GEO[id] = geo;
  return geo;
}
const heldMatBlock = new THREE.MeshBasicMaterial({ map: atlasTex, transparent: true, alphaTest: 0.5 });
const heldMatItem = new THREE.MeshBasicMaterial({ vertexColors: true });
function itemMesh(id) {
  const g = itemGeometry(id);
  const m = new THREE.Mesh(g, g.userData.block ? heldMatBlock.clone() : heldMatItem.clone());
  return m;
}

function resize() {
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix();
  pMat.uniforms.uScale.value = window.innerHeight * 0.9;
}
window.addEventListener('resize', resize);
