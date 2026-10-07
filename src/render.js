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

// World atlas on the GPU: every 16x16 tile is enlarged 4x with hard pixel edges (so blocks stay crisp up close,
// like the classic game) and sits in a 128px cell with 32px of wrapped padding so mipmaps don't bleed. A matching
// normal map gives every pixel a tiny bevel (brighter pixels stand proud, mortar and cracks sink in), and its
// alpha carries the biome tint mask for grass and foliage.
const HI = 64, HCELL = 128, PAD = 32, HIW = HCELL * 16;
// relief strength per texture: rough stone and brick stand out most, glass, glow and plants stay flat
const RELIEF = { stone: 0.9, cobble: 1.25, mossycobble: 1.2, stonebrick: 1.1, mossybrick: 1.1, crackedbrick: 1.15, darkbrick: 1.1, darkbrick_cracked: 1.1, redbrick: 1.2, sandbrick: 0.9, bedrock: 1.3, basalt: 1, gravel: 1.25, polished: 0.6,
  coal_ore: 1, iron_ore: 1, gold_ore: 1, lapis_ore: 1, dirt: 0.8, grass_side: 0.8, grass_top: 0.6, path: 0.8, farmland: 1, mud: 0.7, sand: 0.5, sandstone: 0.8, sandstone_top: 0.4, snow: 0.35, snow_side: 0.7, ash: 0.7, terracotta: 0.4,
  planks: 0.9, planks_dark: 0.9, log_side: 1.2, log_dark_side: 1.2, log_top: 0.8, log_dark_top: 0.8, thatch: 1, hay_side: 0.9, hay_top: 0.8, bookshelf: 1, chest_front: 0.8, chest_side: 0.8, chest_top: 0.8, barrel_side: 0.9, barrel_top: 0.8, crate: 0.9, table_top: 0.8, table_side: 0.8,
  wool_red: 0.55, wool_white: 0.55, wool_blue: 0.55, wool_green: 0.55, wool_yellow: 0.55, wool_purple: 0.55, leaves: 0.6, leaves_dark: 0.6, leaves_blossom: 0.5, plaster: 0.45, timber: 0.8, roof_red: 1, roof_blue: 1,
  iron_block: 0.7, steel_block: 0.8, gold_block: 0.7, ancient_gold: 0.8, cactus_side: 0.7, cactus_top: 0.6, swamp_grass: 0.6, swamp_grass_side: 0.8, furnace_side: 1, furnace_front: 1, tablet: 0.9, waystone: 0.8, runepillar: 0.9, crystal: 0.6, crystal_rose: 0.6 };
let atlasNormalData = null;
function buildHiAtlas() {
  const src = Atlas.data, tm = Atlas.tint;
  const out = new Uint8Array(HIW * HIW * 4), nout = new Uint8Array(HIW * HIW * 4);
  const names = []; for (const k in Atlas.tiles) names[Atlas.tiles[k]] = k;
  const N = HI * HI, hgt = new Float32Array(N), sm = new Float32Array(N), tmp = new Float32Array(N);
  const W8 = v => ((v % HI) + HI) % HI;
  for (let t = 0; t < Atlas.count; t++) {
    const tx = (t % 16) * 16, ty = Math.floor(t / 16) * 16, cx = (t % 16) * HCELL, cy = Math.floor(t / 16) * HCELL;
    const T = (x, y) => (((ty + (y & 15)) * 256) + tx + (x & 15)) * 4;
    const relief = RELIEF[names[t]] !== undefined ? RELIEF[names[t]] : 0.3;
    // average colour of the opaque pixels: see-through pixels take it so mipmaps don't grow dark fringes
    let ar = 0, ag = 0, ab = 0, an = 0, lmin = 1, lmax = 0;
    const lum = new Float32Array(256);
    for (let i = 0; i < 256; i++) { const o = T(i & 15, i >> 4); if (src[o + 3] > 127) { ar += src[o]; ag += src[o + 1]; ab += src[o + 2]; an++; } lum[i] = (src[o] * 0.3 + src[o + 1] * 0.59 + src[o + 2] * 0.11) / 255 * (src[o + 3] / 255); if (src[o + 3] > 127) { lmin = Math.min(lmin, lum[i]); lmax = Math.max(lmax, lum[i]); } }
    if (an) { ar /= an; ag /= an; ab /= an; }
    const span = Math.max(0.08, lmax - lmin);
    // height: each pixel is a flat plateau at its brightness, softened by one hi-res texel so every pixel has a bevel
    for (let wy = 0; wy < HI; wy++) for (let wx = 0; wx < HI; wx++) { const i = (wx >> 2) + (wy >> 2) * 16; hgt[wx + wy * HI] = (lum[i] - lmin) / span; }
    for (let y = 0; y < HI; y++) for (let x = 0; x < HI; x++) tmp[x + y * HI] = (hgt[W8(x - 1) + y * HI] + hgt[x + y * HI] * 2 + hgt[W8(x + 1) + y * HI]) * 0.25;
    for (let y = 0; y < HI; y++) for (let x = 0; x < HI; x++) sm[x + y * HI] = (tmp[x + W8(y - 1) * HI] + tmp[x + y * HI] * 2 + tmp[x + W8(y + 1) * HI]) * 0.25;
    for (let oy = -PAD; oy < HI + PAD; oy++) for (let ox = -PAD; ox < HI + PAD; ox++) {
      const wx = W8(ox), wy = W8(oy), o = ((cy + PAD + oy) * HIW + cx + PAD + ox) * 4, s = T(wx >> 2, wy >> 2);
      const opaque = src[s + 3] > 127;
      out[o] = opaque ? src[s] : ar; out[o + 1] = opaque ? src[s + 1] : ag; out[o + 2] = opaque ? src[s + 2] : ab; out[o + 3] = src[s + 3];
      const hx = (sm[W8(wx + 1) + wy * HI] - sm[W8(wx - 1) + wy * HI]) * 2.4 * relief, hy = (sm[wx + W8(wy + 1) * HI] - sm[wx + W8(wy - 1) * HI]) * 2.4 * relief;
      const l = Math.hypot(hx, hy, 1);
      nout[o] = (-hx / l * 0.5 + 0.5) * 255; nout[o + 1] = (-hy / l * 0.5 + 0.5) * 255; nout[o + 2] = (1 / l * 0.5 + 0.5) * 255;
      nout[o + 3] = tm[(ty + (wy >> 2)) * 256 + tx + (wx >> 2)];
    }
  }
  atlasNormalData = nout;
  return out;
}
const atlasTex = new THREE.DataTexture(buildHiAtlas(), HIW, HIW, THREE.RGBAFormat);
atlasTex.magFilter = THREE.NearestFilter; atlasTex.minFilter = THREE.LinearMipmapLinearFilter; atlasTex.generateMipmaps = true; atlasTex.flipY = false;
atlasTex.anisotropy = renderer.capabilities.getMaxAnisotropy(); atlasTex.needsUpdate = true;
// PBR material table, one texel per tile: R = glossiness, G = metalness
const GLOSS = { polished: [0.6, 0], iron_block: [0.85, 1], steel_block: [0.8, 1], gold_block: [0.9, 1], ancient_gold: [0.8, 1], glass: [0.95, 0], crystal: [0.9, 0], crystal_rose: [0.9, 0], fallen_star: [0.7, 0],
  stonebrick: [0.3, 0], mossybrick: [0.25, 0], stone: [0.28, 0], cobble: [0.2, 0], mossycobble: [0.18, 0], darkbrick: [0.4, 0], basalt: [0.45, 0], sandstone: [0.12, 0], sandbrick: [0.15, 0],
  iron_ore: [0.45, 0.3], gold_ore: [0.55, 0.5], coal_ore: [0.4, 0], lapis_ore: [0.55, 0], planks: [0.22, 0], planks_dark: [0.28, 0], log_side: [0.1, 0], table_top: [0.3, 0], chest_top: [0.3, 0], chest_front: [0.3, 0], barrel_side: [0.32, 0.15],
  leaves: [0.42, 0], leaves_dark: [0.42, 0], leaves_blossom: [0.35, 0], grass_top: [0.18, 0], swamp_grass: [0.35, 0], mud: [0.55, 0], snow: [0.35, 0], terracotta: [0.22, 0], roof_red: [0.35, 0], roof_blue: [0.4, 0],
  redbrick: [0.22, 0], plaster: [0.15, 0], cauldron: [0.6, 0.6], rail: [0.7, 0.8], lamp: [0.6, 0.2], bookshelf: [0.22, 0], cactus_side: [0.4, 0], lilypad: [0.6, 0], furnace_front: [0.25, 0], waystone: [0.5, 0] };
const glossTex = (() => { const d = new Uint8Array(16 * 16 * 4); for (const k in Atlas.tiles) { const i = Atlas.tiles[k], g = GLOSS[k] || [0.08, 0]; d[i * 4] = g[0] * 255; d[i * 4 + 1] = g[1] * 255; d[i * 4 + 3] = 255; } const t = new THREE.DataTexture(d, 16, 16, THREE.RGBAFormat); t.needsUpdate = true; return t; })();
const normalTex = new THREE.DataTexture(atlasNormalData, HIW, HIW, THREE.RGBAFormat);
normalTex.magFilter = THREE.NearestFilter; normalTex.minFilter = THREE.LinearMipmapLinearFilter; normalTex.generateMipmaps = true; normalTex.flipY = false; normalTex.anisotropy = atlasTex.anisotropy; normalTex.needsUpdate = true;
atlasNormalData = null;

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
  uCloudMap: { value: null }, uCloud: { value: new THREE.Vector4(0, 0, 384, 96) }, uCloudOn: { value: 1 },
};
const VERT = `
attribute vec3 aTile; attribute vec2 aLocal; attribute vec4 aLight; attribute vec3 aTint;
varying vec3 vTile; varying vec2 vLocal; varying vec4 vLight; varying float vFog; varying vec3 vWorld; varying vec3 vTint;
uniform float uTime; uniform float uPlant;
void main(){
  vTile=aTile; vLocal=aLocal; vLight=aLight; vTint=aTint;
  vec3 p=position;
  float anim=mod(aTile.z,10.0);
  vec4 w0=modelMatrix*vec4(p,1.0);
  // gusty wind: a slow swell that rolls across the land plus a quicker flutter
  float gust=0.55+0.45*sin(uTime*0.35+w0.x*0.05+w0.z*0.03);
  if(anim>1.5&&anim<2.5){ float sh=clamp(aLight.z*8.0,0.0,1.0); p.y+=(sin(p.x*0.9+uTime*1.7)*0.03+cos(p.z*0.8+uTime*1.3)*0.03+sin((p.x+p.z)*0.37+uTime*0.9)*0.025)*sh; }
  if(anim>2.5&&anim<3.5){
    if(uPlant>0.5){ // plants bend from the root: only the top edge moves
      float k=aLocal.y*gust;
      p.x+=(sin(uTime*1.9+w0.x*0.7+w0.z*0.3)*0.09+sin(uTime*4.3+w0.z)*0.025)*k;
      p.z+=(cos(uTime*1.6+w0.z*0.6+w0.x*0.2)*0.07+cos(uTime*3.7+w0.x)*0.02)*k;
    } else { // leaves: every corner sways by its world position, so neighbouring blocks stay joined
      p.x+=(sin(uTime*1.7+w0.x*0.6+w0.y*0.4)*0.035+sin(uTime*3.9+w0.z*1.3)*0.012)*gust;
      p.y+=sin(uTime*2.3+w0.x*0.5+w0.z*0.7)*0.02*gust;
      p.z+=(cos(uTime*1.4+w0.z*0.6+w0.y*0.3)*0.035+cos(uTime*4.1+w0.x*1.1)*0.012)*gust;
    }
  }
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
uniform sampler2D uCloudMap; uniform vec4 uCloud; uniform float uCloudOn;
varying vec3 vTile; varying vec2 vLocal; varying vec4 vLight; varying float vFog; varying vec3 vWorld; varying vec3 vTint;
vec3 toLin(vec3 c){ return pow(c, vec3(2.2)); }
vec3 toSrgb(vec3 c){ return pow(max(c, 0.0), vec3(1.0/2.2)); }
float ign(vec2 p){ return fract(52.9829189*fract(dot(p,vec2(0.06711056,0.00583715)))); } // interleaved gradient noise
// soft shadows: 12 Poisson taps, rotated per pixel so the penumbra is smooth instead of banded
float shadowAt(vec3 wp, vec3 n){
  if(uShadowOn<0.5) return 1.0;
  vec4 sc=uShadowMatrix*vec4(wp+n*0.06,1.0);
  vec3 c=sc.xyz/sc.w*0.5+0.5;
  if(c.x<0.0||c.x>1.0||c.y<0.0||c.y>1.0||c.z>1.0) return 1.0;
  float t=1.0/uShadowSize, a=ign(gl_FragCoord.xy)*6.2832, ca=cos(a), sa=sin(a), s=0.0;
  vec2 P[12]; P[0]=vec2(-0.326,-0.406); P[1]=vec2(-0.840,-0.074); P[2]=vec2(-0.696,0.457); P[3]=vec2(-0.203,0.621); P[4]=vec2(0.962,-0.195); P[5]=vec2(0.473,-0.480);
  P[6]=vec2(0.519,0.767); P[7]=vec2(0.185,-0.893); P[8]=vec2(0.507,0.064); P[9]=vec2(0.896,0.412); P[10]=vec2(-0.322,-0.933); P[11]=vec2(-0.792,-0.598);
  float r=1.9*t;
  for(int i=0;i<12;i++){ vec2 o=vec2(P[i].x*ca-P[i].y*sa,P[i].x*sa+P[i].y*ca)*r; float d=texture2D(uShadowMap,c.xy+o).r; s+=(c.z-0.0011>d)?0.0:1.0; }
  s/=12.0;
  vec2 e=min(c.xy,1.0-c.xy); float edge=smoothstep(0.0,0.08,min(e.x,e.y));
  return mix(1.0,s,edge);
}
// shadows of the drifting cloud layer: project along the sun ray up to the cloud height and look up the cloud map
float cloudShadow(vec3 wp){
  if(uCloudOn<0.5||uSunDir.y<0.05) return 1.0;
  vec3 p=wp+uSunDir*((uCloud.w-wp.y)/uSunDir.y);
  vec2 uv=(p.xz-vec2(uCloud.x,0.0))/uCloud.z;
  float cov=texture2D(uCloudMap,uv+vec2(0.5/32.0)).r;
  return 1.0-cov*0.5;
}
vec3 V0(){ return normalize(cameraPosition-vWorld); }
// ---- water: summed directional waves (analytic slopes) + small ripples
vec2 waveSlope(vec2 p, float t){
  vec2 g=vec2(0.0);
  vec4 D[6]; D[0]=vec4(0.86,0.5,0.55,1.1); D[1]=vec4(-0.32,0.95,0.9,1.5); D[2]=vec4(0.6,-0.8,1.6,2.1); D[3]=vec4(-0.9,-0.43,2.7,2.6); D[4]=vec4(0.2,0.98,4.3,3.4); D[5]=vec4(-0.7,0.71,6.9,4.1);
  float A[6]; A[0]=0.1; A[1]=0.07; A[2]=0.045; A[3]=0.03; A[4]=0.02; A[5]=0.012;
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
  vec4 nm=texture2DGradEXT(uNormal,uv,dFdx(guv),dFdy(guv));
  alb*=mix(vec3(1.0),vTint,nm.a); // biome grass & foliage colour
  vec3 n0=normalize(cross(dFdx(vWorld),dFdy(vWorld)));
  // tiny per-block colour variation breaks up repetition on big flat areas
  if(vTile.z<10.0 && !(anim>1.5&&anim<2.5)){ vec3 bp=floor(vWorld-n0*0.01); float hv=fract(sin(dot(bp,vec3(12.9898,78.233,37.719)))*43758.5453); alb*=0.96+hv*0.08; }
  vec3 n=n0;
  bool water=anim>1.5&&anim<2.5;
  if(uClipY>-999.0 && vWorld.y<uClipY) discard; // mirror pass: nothing below the water plane
  float wdepth=2.0; // side faces of water count as open water
  if(water&&n.y>0.5){ wdepth=vLight.z*8.0; vec2 sl=waveSlope(vWorld.xz,uTime)*(0.35+0.65*clamp(wdepth,0.0,1.0)); n=normalize(vec3(-sl.x,1.0,-sl.y)); }
  vec3 ng=n; // geometric normal, kept for shadow lookups
  if(!water && uPlant<0.5 && vTile.z<10.0){
    vec3 tn=nm.xyz*2.0-1.0;
    vec3 dp1=dFdx(vWorld), dp2=dFdy(vWorld); vec2 du1=dFdx(guv), du2=dFdy(guv);
    vec3 p2=cross(dp2,n), p1=cross(n,dp1);
    vec3 Tg=p2*du1.x+p1*du2.x, Bg=p2*du1.y+p1*du2.y;
    float im=inversesqrt(max(max(dot(Tg,Tg),dot(Bg,Bg)),1e-20));
    float fade=1.0-smoothstep(20.0,56.0,vFog); // distant surfaces stay flat (no shimmer)
    n=normalize(mix(n,normalize(Tg*im*tn.x+Bg*im*tn.y+n*tn.z),fade));
  }
  float sky=vLight.x, blk=vLight.y, ao=water?1.0:vLight.z;
  float ndl=uPlant>0.5 ? 0.7 : max(dot(n,uSunDir),0.0)*smoothstep(-0.02,0.12,dot(ng,uSunDir)); // relief can't light a face that points away from the sun
  float outdoor=smoothstep(0.45,0.93,sky);
  float sh=outdoor>0.0 ? shadowAt(vWorld,ng)*cloudShadow(vWorld) : 0.0;
  vec3 direct=uSunCol*ndl*sh*outdoor*1.15;
  vec3 hemi=mix(vec3(0.7,0.64,0.56),vec3(1.05,1.07,1.14),n.y*0.5+0.5); // sky above, warm bounce below
  vec3 amb=uAmbCol*hemi*(0.07+0.93*pow(sky,1.6));
  float flick=0.94+0.06*sin(uTime*10.0+vWorld.x*2.7+vWorld.z*1.9)*sin(uTime*6.3+vWorld.y);
  float tl=pow(blk,2.4)*3.0*flick;
  if(uPLight.w>0.0){ float pd=distance(vWorld,uPLight.xyz); tl=max(tl,pow(max(0.0,1.0-pd/9.0),2.0)*1.6*uPLight.w*flick); }
  vec3 light=(amb+direct)*ao*mix(1.0,vLight.w,0.5)+uTorch*tl*mix(1.0,ao,0.6)+vec3(0.004,0.005,0.008);
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
      vec3 Rr=reflect(-Vv,n); col+=mix(toLin(uSkyHor),toLin(uSkyTop),clamp(Rr.y,0.0,1.0))*F*gm.r*gm.r*0.35*sky;
    }
  }
  if(!water && vTile.z<10.0 && vWorld.y<uReflH-0.12 && sky>0.3 && uUnder<0.5){ float cdep=uReflH-vWorld.y; col+=alb*uSunCol*caustic(vWorld.xz+vec2(vWorld.y*0.3),uTime)*0.5*smoothstep(0.0,0.6,cdep)*exp(-cdep*0.18)*(0.3+0.7*ndl); }
  if(uPlant>0.5 || (anim>2.5&&anim<3.5)){ float tr=pow(max(dot(-V0(),uSunDir),0.0),3.0); col+=alb*uSunCol*tr*(uPlant>0.5?0.55:0.3)*outdoor*sh; } // sunlight glowing through leaves and grass
  if(vTile.z>=10.0){ float lm=dot(alb,vec3(0.33)); col=mix(alb,alb*vec3(1.0,0.8,0.55)*1.2,smoothstep(0.35,0.8,lm)*step(alb.b,alb.r))*(2.2+0.25*sin(uTime*2.0+vLocal.x*3.0)); }
  vec3 V=normalize(cameraPosition-vWorld);
  float alpha=water? uOpacity : t.a;
  if(water){
    float cosT=max(dot(V,n),0.0);
    float fres=0.02+0.98*pow(1.0-cosT,5.0);                    // Schlick Fresnel for water (F0 = 0.02)
    vec3 R=reflect(-V,n);
    vec3 skyR=mix(toLin(uSkyHor),toLin(uSkyTop),pow(clamp(R.y,0.0,1.0),0.55));
    skyR+=toLin(uHazeCol)*pow(max(dot(R,uSunDir),0.0),8.0)*0.4;
    vec3 refl=skyR;
    if(uReflOn>0.5 && n.y>0.5 && abs(vWorld.y-uReflH)<0.45){
      vec4 rc=uReflMat*vec4(vWorld.x,uReflH,vWorld.z,1.0); vec2 ruv=rc.xy/rc.w+n.xz*0.035;
      vec3 rw=toLin(texture2D(uReflTex,clamp(ruv,0.002,0.998)).rgb);
      float edge=smoothstep(0.0,0.04,min(min(ruv.x,1.0-ruv.x),min(ruv.y,1.0-ruv.y)));
      refl=mix(skyR,rw,edge);
    }
    // body colour: light is absorbed with depth, red first, so shallows read clear aqua and depths deep blue
    float dep=max(wdepth,0.05);
    vec3 absorb=exp(-vec3(0.5,0.13,0.08)*dep*1.5);
    vec3 deep=vec3(0.004,0.022,0.07), shallow=vec3(0.05,0.24,0.38);
    vec3 body=mix(deep,shallow,absorb.g)*(amb*0.9+direct*0.5+0.02);
    float sss=pow(max(dot(-V,uSunDir)*0.5+0.5,0.0),4.0)*max(n.y-0.92,0.0)*12.0;
    body+=vec3(0.04,0.24,0.26)*uSunCol*sss*outdoor;
    vec3 Hh=normalize(V+uSunDir);
    float glint=pow(max(dot(n,Hh),0.0),900.0)*30.0+pow(max(dot(n,Hh),0.0),90.0)*0.5;
    col=mix(body,refl*(0.25+0.75*sky),fres)+uSunCol*glint*sh*outdoor;
    // a thin line of foam where the water meets the shore
    float shore=1.0-smoothstep(0.06,0.5,wdepth);
    float fn=vnoise2(vWorld.xz*3.2+vec2(uTime*0.35,uTime*0.21))*0.6+vnoise2(vWorld.xz*7.0-uTime*0.5)*0.4;
    float foam=smoothstep(0.6,0.75,fn+shore*0.5)*shore;
    col=mix(col,vec3(0.85,0.9,0.92)*(amb+direct*0.8+0.05),foam*0.7);
    alpha=clamp(mix(0.2,0.92,1.0-absorb.g)+fres*0.5+foam*0.6,0.0,1.0);
    if(uUnder>0.5){ col=mix(body*2.0,refl,0.15); alpha=0.75; }
  }
  vec3 outc=toSrgb(col);
  // distance fog matches the sky's horizon, glowing toward the sun; a touch of aerial blue in between
  float f=smoothstep(uFogNear,uFogFar,vFog); f*=f;
  float aer=smoothstep(uFogNear*0.4,uFogFar,vFog)*0.1; outc=mix(outc,mix(outc,uFogColor,0.35),aer);
  vec3 fogc=uFogColor+uHazeCol*pow(max(dot(-V,uSunDir),0.0),6.0)*0.4;
  if(uMist>0.001){ float hgt=max(vWorld.y-uSeaY+1.0,0.0); float mist=(1.0-exp(-vFog*0.02*uMist))*exp(-hgt*0.16); f=max(f,clamp(mist,0.0,0.8)); }
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

// ---------------------------------------------------------------- creature material
// Creatures and the third-person player use the same light as the world: sun with soft shadows, sky ambient
// from where they stand (uEnv.x), torch light (uEnv.y), distance fog and a faint rim so silhouettes read at night.
// `color` stays a plain multiplier so hit flashes and fuse blinks keep working.
const ENT_VERT = `varying vec2 vUv; varying vec3 vN; varying vec3 vW; varying float vFog;
void main(){ vUv=uv; vN=normalize(mat3(modelMatrix)*normal); vec4 w=modelMatrix*vec4(position,1.0); vW=w.xyz; vec4 mv=viewMatrix*w; vFog=length(mv.xyz); gl_Position=projectionMatrix*mv; }`;
const ENT_FRAG = `uniform sampler2D map; uniform vec3 color; uniform float uOpacity; uniform vec2 uEnv;
uniform vec3 uSunDir, uSunCol, uAmbCol, uTorch, uFogColor, uHazeCol; uniform float uFogNear, uFogFar, uUnder;
uniform sampler2D uShadowMap; uniform mat4 uShadowMatrix; uniform float uShadowOn, uShadowSize;
varying vec2 vUv; varying vec3 vN; varying vec3 vW; varying float vFog;
vec3 toLin(vec3 c){ return pow(c, vec3(2.2)); }
vec3 toSrgb(vec3 c){ return pow(max(c, 0.0), vec3(1.0/2.2)); }
float ign(vec2 p){ return fract(52.9829189*fract(dot(p,vec2(0.06711056,0.00583715)))); }
float shadowAt(vec3 wp, vec3 n){
  if(uShadowOn<0.5) return 1.0;
  vec4 sc=uShadowMatrix*vec4(wp+n*0.05,1.0); vec3 c=sc.xyz/sc.w*0.5+0.5;
  if(c.x<0.0||c.x>1.0||c.y<0.0||c.y>1.0||c.z>1.0) return 1.0;
  float t=1.6/uShadowSize, a=ign(gl_FragCoord.xy)*6.2832, s=0.0;
  for(int i=0;i<6;i++){ float an=a+float(i)*1.0472; vec2 o=vec2(cos(an),sin(an))*t*(0.6+0.4*float(i-i/2*2)); s+=(c.z-0.0015>texture2D(uShadowMap,c.xy+o).r)?0.0:1.0; }
  return s/6.0;
}
void main(){
  vec4 t=texture2D(map,vUv);
  if(t.a<0.5) discard;
  vec3 alb=toLin(t.rgb);
  vec3 n=normalize(vN); if(!gl_FrontFacing) n=-n;
  float sky=uEnv.x, blk=uEnv.y, outdoor=smoothstep(0.35,0.9,sky);
  float ndl=max(dot(n,uSunDir),0.0);
  float sh=outdoor>0.0?shadowAt(vW,n):0.0;
  vec3 direct=uSunCol*ndl*sh*outdoor*1.1;
  vec3 hemi=mix(vec3(0.68,0.62,0.55),vec3(1.05,1.07,1.14),n.y*0.5+0.5);
  vec3 amb=uAmbCol*hemi*(0.12+0.88*pow(sky,1.6));
  vec3 light=amb+direct+uTorch*pow(blk,2.4)*3.0+vec3(0.012,0.013,0.018);
  vec3 V=normalize(cameraPosition-vW);
  float rim=pow(1.0-max(dot(n,V),0.0),3.0);
  vec3 col=alb*light*toLin(color)+alb*rim*(uAmbCol*0.6+uSunCol*0.15*outdoor+vec3(0.02))*0.6;
  vec3 outc=toSrgb(col);
  float f=smoothstep(uFogNear,uFogFar,vFog); f*=f;
  vec3 fogc=uFogColor+uHazeCol*pow(max(dot(-V,uSunDir),0.0),6.0)*0.4;
  if(uUnder>0.5){ f=smoothstep(2.0,24.0,vFog); fogc=uFogColor; }
  gl_FragColor=vec4(mix(outc,fogc,f),uOpacity);
}`;
function entityMat(tex, o) {
  o = o || {};
  const u = { map: { value: tex }, color: { value: new THREE.Color(1, 1, 1) }, uOpacity: { value: o.opacity === undefined ? 1 : o.opacity }, uEnv: { value: new THREE.Vector2(1, 0) } };
  for (const k of ['uSunDir', 'uSunCol', 'uAmbCol', 'uTorch', 'uFogColor', 'uHazeCol', 'uFogNear', 'uFogFar', 'uUnder', 'uShadowMap', 'uShadowMatrix', 'uShadowOn', 'uShadowSize']) u[k] = U[k];
  const m = new THREE.ShaderMaterial({ uniforms: u, vertexShader: ENT_VERT, fragmentShader: ENT_FRAG, transparent: !!o.transparent, depthWrite: !o.transparent, side: o.side || THREE.FrontSide });
  m.color = u.color.value; m.userData.entity = true;
  return m;
}

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
  const p = new Float32Array(cap * 3), t = new Float32Array(cap * 3), l = new Float32Array(cap * 2), li = new Float32Array(cap * 4), tn = new Float32Array(cap * 3), ix = new Uint32Array(cap * 1.5);
  if (this.cap) { p.set(this.p); t.set(this.t); l.set(this.l); li.set(this.li); tn.set(this.tn); ix.set(this.i); }
  this.p = p; this.t = t; this.l = l; this.li = li; this.tn = tn; this.i = ix; this.cap = cap;
};
const MESH_BUFS = [new TBuf(), new TBuf(), new TBuf(), new TBuf()];
function takeBuf(k) { const b = MESH_BUFS[k]; b.n = 0; b.ni = 0; return b; }
const NO_TINT = [1, 1, 1];
function quad(g, verts, tile, anim, uvs, light, tint) {
  tint = tint || NO_TINT;
  if (g.n + 4 > g.cap) g.grow(g.cap * 2);
  const tp = TILEPOS[tile] || [0, 0], s = g.n;
  for (let k = 0; k < 4; k++) {
    const v = s + k, vk = verts[k], uk = uvs[k], lk = light[k];
    g.p[v * 3] = vk[0]; g.p[v * 3 + 1] = vk[1]; g.p[v * 3 + 2] = vk[2];
    g.t[v * 3] = tp[0]; g.t[v * 3 + 1] = tp[1]; g.t[v * 3 + 2] = anim;
    g.l[v * 2] = uk[0]; g.l[v * 2 + 1] = uk[1];
    g.li[v * 4] = lk[0]; g.li[v * 4 + 1] = lk[1]; g.li[v * 4 + 2] = lk[2]; g.li[v * 4 + 3] = lk[3];
    g.tn[v * 3] = tint[0]; g.tn[v * 3 + 1] = tint[1]; g.tn[v * 3 + 2] = tint[2];
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
// biome colour for grass (cls 0) and foliage (cls 1), blended over nearby columns like the classic game, as a
// multiplier on the Meadowbrook colours painted into the atlas
const TINT_RATIO = [BIOME_GRASS, BIOME_FOLIAGE].map(list => list.map(h => { const b = list[0]; return [((h >> 16) & 255) / ((b >> 16) & 255), ((h >> 8) & 255) / ((b >> 8) & 255), (h & 255) / (b & 255)]; }));
const _tintCache = new Float32Array(CS * CS * 6), _tintOut = [[1, 1, 1], [1, 1, 1]];
function prepChunkTint(x0, z0) {
  for (let z = 0; z < CS; z++) for (let x = 0; x < CS; x++) {
    const acc = [0, 0, 0, 0, 0, 0]; let n = 0;
    for (let dz = -3; dz <= 3; dz += 2) for (let dx = -3; dx <= 3; dx += 2) {
      const wx = x0 + x + dx, wz = z0 + z + dz; if (!resident(wx, wz)) continue;
      const b = bmap[COL(wx, wz)] || 0; for (let k = 0; k < 2; k++) { const r = TINT_RATIO[k][b] || TINT_RATIO[k][0]; acc[k * 3] += r[0]; acc[k * 3 + 1] += r[1]; acc[k * 3 + 2] += r[2]; } n++;
    }
    const o = (x + z * CS) * 6; for (let k = 0; k < 6; k++) _tintCache[o + k] = n ? acc[k] / n : 1;
  }
}
const TINT_CLASS = new Int8Array(256).fill(-1);
TINT_CLASS[B.GRASS] = 0; TINT_CLASS[B.TALLGRASS] = 0; TINT_CLASS[B.LEAVES] = 1; TINT_CLASS[B.LEAVES_DARK] = 1; TINT_CLASS[B.VINES] = 1;
function chunkTint(x, z, x0, z0, cls) { const o = ((x - x0) + (z - z0) * CS) * 6 + cls * 3, t = _tintOut[cls]; t[0] = _tintCache[o]; t[1] = _tintCache[o + 1]; t[2] = _tintCache[o + 2]; return t; }
function buildChunkGeo(cx, cz) {
  const S = takeBuf(0), X = takeBuf(1), Wt = takeBuf(2), G = takeBuf(3);
  const x0 = cx * CS, z0 = cz * CS;
  prepChunkTint(x0, z0);
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
        quad(g, verts, texFor(d, f, fi, meta), (d.anim || 0) + emis, uvs, light, TINT_CLASS[id] >= 0 ? chunkTint(x, z, x0, z0, TINT_CLASS[id]) : null);
      }
    } else if (r === 'cross') {
      const L = lightSample(x, y, z), lt = [L[0] / 15, L[1] / 15, 1, 0.92];
      const ang = hash3(x, y, z) * 0.6;
      const s = 0.45, cxm = x + 0.5, czm = z + 0.5;
      for (let k = 0; k < 2; k++) {
        const a = ang + k * Math.PI / 2 + Math.PI / 4, dx = Math.cos(a) * s * 1.414 / 1.414, dz = Math.sin(a) * s;
        const ddx = Math.cos(a) * s;
        const v = [[cxm - ddx, y, czm - dz], [cxm + ddx, y, czm + dz], [cxm + ddx, y + 1, czm + dz], [cxm - ddx, y + 1, czm - dz]];
        quad(X, v, d.tex.side, (d.anim || 0) + emis, LOCALUV, [lt, lt, lt, lt], TINT_CLASS[id] >= 0 ? chunkTint(x, z, x0, z0, TINT_CLASS[id]) : null);
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
      quad(X, v, d.tex.side, 0, LOCALUV, [lt, lt, lt, lt], TINT_CLASS[id] >= 0 ? chunkTint(x, z, x0, z0, TINT_CLASS[id]) : null);
    } else if (r === 'slab' || r === 'stairs') {
      const L = lightSample(x, y, z);
      for (const bx of SHAPE_BOXES[SHAPE[id]][meta & 7]) for (let fi = 0; fi < 6; fi++) {
        const f = FACES[fi], n = f.n;
        // faces flush with the block's boundary hide behind an opaque neighbour
        const onEdge = (n[0] > 0 && bx[3] === 1) || (n[0] < 0 && bx[0] === 0) || (n[1] > 0 && bx[4] === 1) || (n[1] < 0 && bx[1] === 0) || (n[2] > 0 && bx[5] === 1) || (n[2] < 0 && bx[2] === 0);
        const nx = x + n[0], ny = y + n[1], nz = z + n[2], nid = getB(nx, ny, nz);
        if (onEdge && (OPAQUE[nid] || (SHAPE[nid] === 1 && n[1] === 0 && (getMeta(nx, ny, nz) & 4) === (meta & 4) && bx[4] - bx[1] === 0.5 && SHAPE[id] === 1))) continue;
        const verts = f.v.map(v => [x + (v[0] ? bx[3] : bx[0]), y + (v[1] ? bx[4] : bx[1]), z + (v[2] ? bx[5] : bx[2])]);
        const uvs = f.k === 'side' ? f.v.map(v => [(n[0] !== 0 ? (v[2] ? bx[5] : bx[2]) : (v[0] ? bx[3] : bx[0])), v[1] ? bx[4] : bx[1]]) : f.v.map(v => [v[0] ? bx[3] : bx[0], v[2] ? bx[5] : bx[2]]);
        const L2 = lightSample(nx, ny, nz), inner = onEdge ? 1 : 0.86; // faces inside the block's own cell sit in a little shade
        const lt = [Math.max(L[0], L2[0]) / 15, Math.max(L[1], L2[1]) / 15, inner, f.sh];
        quad(S, verts, texFor(d, f, fi, 0), emis, uvs, [lt, lt, lt, lt]);
      }
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
  geo.setAttribute('aTint', new THREE.BufferAttribute(g.tn.slice(0, n * 3), 3));
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
// Sky dome: a zenith-to-horizon gradient with a sunset band that warms toward the sun, a soft glow around the
// sun and moon, and darkening below the horizon. Colours come from updateSky() so fog always matches the horizon.
const skyGeo = new THREE.SphereGeometry(300, 32, 16);
const skyMat = new THREE.ShaderMaterial({
  uniforms: { uZenith: { value: new THREE.Color(0x3d72d0) }, uHorizon: { value: new THREE.Color(0xa9c8ee) }, uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uMoonDir: { value: new THREE.Vector3(0, -1, 0) },
    uDusk: { value: 0 }, uDay: U.uDay, uTime: U.uTime, uGlow: { value: new THREE.Color(0xffc080) }, uMoonGlow: { value: 0 } },
  vertexShader: 'varying vec3 vP; void main(){ vP=normalize(position); vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.0); gl_Position=p.xyww; }',
  fragmentShader: `uniform vec3 uZenith, uHorizon, uSunDir, uMoonDir, uGlow; uniform float uDusk, uDay, uTime, uMoonGlow; varying vec3 vP;
  void main(){
    vec3 rd=normalize(vP);
    float up=max(rd.y,0.0), hz=pow(1.0-up,2.6);
    vec3 c=mix(uZenith,uHorizon,hz);
    // sunset: an orange band along the horizon, strongest toward the sun, pink-violet on the far side
    float toward=dot(normalize(rd.xz+1e-4),normalize(uSunDir.xz+1e-4))*0.5+0.5;
    vec3 band=mix(vec3(0.78,0.45,0.62),vec3(1.0,0.52,0.2),pow(toward,1.6));
    c=mix(c,band,uDusk*pow(1.0-up,5.0)*(0.45+0.55*toward));
    c=mix(c,c*vec3(0.85,0.72,1.0),uDusk*up*0.6);
    // glow around the sun and the moon
    float mu=max(dot(rd,uSunDir),0.0), mm=max(dot(rd,uMoonDir),0.0);
    c+=uGlow*(pow(mu,6.0)*0.32+pow(mu,48.0)*0.5+pow(mu,600.0)*1.4);
    c+=vec3(0.45,0.55,0.8)*uMoonGlow*(pow(mm,18.0)*0.12+pow(mm,300.0)*0.5);
    // the void below the horizon fades a little darker
    c*=1.0-smoothstep(0.0,-0.35,rd.y)*0.35;
    gl_FragColor=vec4(c,1.0);
  }`,
  side: THREE.BackSide, depthWrite: false, fog: false,
});
const sky = new THREE.Mesh(skyGeo, skyMat); sky.renderOrder = -10; sky.frustumCulled = false; scene.add(sky);
const celestial = new THREE.Group(); scene.add(celestial);
// the square pixel sun and the moon (with phases), plus a soft additive halo behind each
function pixelTex(size, paint) {
  const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d'), img = g.createImageData(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) { const col = paint(x, y); const o = (x + y * size) * 4; img.data[o] = col[0]; img.data[o + 1] = col[1]; img.data[o + 2] = col[2]; img.data[o + 3] = col[3]; }
  g.putImageData(img, 0, 0); const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; return t;
}
const sunTex = pixelTex(16, (x, y) => { const e = Math.min(x, y, 15 - x, 15 - y); return e === 0 ? [255, 214, 90, 255] : e === 1 ? [255, 236, 140, 255] : e === 2 ? [255, 248, 200, 255] : [255, 255, 236, 255]; });
const moonPhaseTex = [0, 1, 2, 3, 4, 5, 6, 7].map(ph => pixelTex(16, (x, y) => {
  const e = Math.min(x, y, 15 - x, 15 - y); if (e < 2) return [0, 0, 0, 0];
  // the lit part sweeps across with the phase; craters are a few darker pixels
  const k = (x - 2) / 11, lit = ph === 0 ? 1 : ph < 4 ? (k > ph / 4 ? 1 : 0.12) : ph === 4 ? 0.1 : (k < (ph - 4) / 4 ? 1 : 0.12);
  const crater = (x === 5 && y === 5) || (x === 6 && y === 5) || (x === 10 && y === 8) || (x === 9 && y === 11) || (x === 6 && y === 10) || (x === 11 && y === 4);
  const base = crater ? 196 : (x + y) % 5 === 0 ? 226 : 238;
  return [base * lit, base * lit, (base + 10) * lit, 255 * (0.25 + 0.75 * lit)];
}));
function haloTex(r, g, b) { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, `rgba(${r},${g},${b},0.55)`); gr.addColorStop(0.25, `rgba(${r},${g},${b},0.18)`); gr.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); }
const sunMesh = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshBasicMaterial({ map: sunTex, transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending, color: new THREE.Color(1.4, 1.35, 1.2) }));
const sunHalo = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), new THREE.MeshBasicMaterial({ map: haloTex(255, 220, 160), transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
const moonMesh = new THREE.Mesh(new THREE.PlaneGeometry(22, 22), new THREE.MeshBasicMaterial({ map: moonPhaseTex[0], transparent: true, depthWrite: false, fog: false }));
const moonHalo = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshBasicMaterial({ map: haloTex(170, 190, 255), transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending, opacity: 0.6 }));
sunMesh.position.set(0, 0, -260); sunHalo.position.set(0, 0, -262); moonMesh.position.set(0, 0, 260); moonHalo.position.set(0, 0, 262);
for (const m of [sunMesh, sunHalo, moonMesh, moonHalo]) { m.lookAt(0, 0, 0); m.renderOrder = -9; }
celestial.add(sunHalo, sunMesh, moonHalo, moonMesh);
function setMoonPhase(day) { const ph = Math.floor(day) % 8; if (moonMesh.material.map !== moonPhaseTex[ph]) { moonMesh.material.map = moonPhaseTex[ph]; moonMesh.material.needsUpdate = true; } }
// stars: points that twinkle gently, brighter ones a little bigger
const starGeo = new THREE.BufferGeometry(), sp = [], sseed = [];
for (let i = 0; i < 1400; i++) { const u = Math.random() * 2 - 1, a = Math.random() * 6.283, r = Math.sqrt(1 - u * u); sp.push(Math.cos(a) * r * 250, Math.abs(u) * 250 - 20, Math.sin(a) * r * 250); sseed.push(Math.random()); }
starGeo.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3)); starGeo.setAttribute('aSeed', new THREE.Float32BufferAttribute(sseed, 1));
const starMat = new THREE.ShaderMaterial({
  uniforms: { uTime: U.uTime, uAlpha: { value: 0 }, opacity: { value: 0 } },
  vertexShader: 'attribute float aSeed; varying float vB; uniform float uTime; void main(){ vB=(0.35+0.65*aSeed*aSeed)*(0.75+0.25*sin(uTime*(1.5+aSeed*3.0)+aSeed*40.0)); vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize=1.0+aSeed*aSeed*2.2; gl_Position=projectionMatrix*mv; }',
  fragmentShader: 'uniform float opacity; varying float vB; void main(){ gl_FragColor=vec4(vec3(0.9,0.93,1.0)*vB*1.4,opacity*vB); }',
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
});
Object.defineProperty(starMat, 'opacity', { get() { return this.uniforms.opacity.value; }, set(v) { if (this.uniforms) this.uniforms.opacity.value = v; } });
const stars = new THREE.Points(starGeo, starMat); stars.renderOrder = -9; stars.frustumCulled = false; celestial.add(stars);

// ---------------------------------------------------------------- clouds
// Blocky clouds like the classic game, but with volume: 12x12x4 cells from a tileable noise map, each face shaded
// by how it faces the sun, fading into the distance. The same map is handed to the world shader so clouds cast
// soft shadows that drift across the land.
const CLOUD_CELL = 12, CLOUD_N = 32, CLOUD_TILE = CLOUD_CELL * CLOUD_N, CLOUD_Y = 122, CLOUD_H = 4;
const cloudData = new Uint8Array(CLOUD_N * CLOUD_N * 4);
(function cloudMap() {
  const hh = (x, y, s) => { let v = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(s, 2246822519); v = Math.imul(v ^ (v >>> 13), 1274126177); return ((v ^ (v >>> 16)) >>> 0) / 4294967296; };
  const tv = (x, y, cell, s) => { const L = CLOUD_N / cell, gx = x / cell, gy = y / cell, ix = Math.floor(gx), iy = Math.floor(gy), fx = gx - ix, fy = gy - iy, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    const g = (a, b) => hh(((a % L) + L) % L, ((b % L) + L) % L, s); return (g(ix, iy) * (1 - u) + g(ix + 1, iy) * u) * (1 - v) + (g(ix, iy + 1) * (1 - u) + g(ix + 1, iy + 1) * u) * v; };
  for (let y = 0; y < CLOUD_N; y++) for (let x = 0; x < CLOUD_N; x++) {
    const n = tv(x, y, 8, 11) * 0.55 + tv(x, y, 4, 12) * 0.3 + tv(x, y, 2, 13) * 0.15;
    const on = n > 0.6 ? 255 : 0, o = (x + y * CLOUD_N) * 4;
    cloudData[o] = on; cloudData[o + 1] = on; cloudData[o + 2] = on; cloudData[o + 3] = 255;
  }
})();
const cloudTex = new THREE.DataTexture(cloudData, CLOUD_N, CLOUD_N, THREE.RGBAFormat);
cloudTex.wrapS = cloudTex.wrapT = THREE.RepeatWrapping; cloudTex.magFilter = THREE.LinearFilter; cloudTex.minFilter = THREE.LinearFilter; cloudTex.needsUpdate = true;
U.uCloudMap.value = cloudTex;
const cloudMat = new THREE.ShaderMaterial({
  uniforms: { uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uLit: { value: new THREE.Color(1, 1, 1) }, uShade: { value: new THREE.Color(0.75, 0.8, 0.9) }, uFogCol: { value: new THREE.Color(0xa9c8ee) }, uFar: { value: 380 } },
  vertexShader: 'attribute vec3 aN; varying vec3 vN; varying vec3 vW; void main(){ vN=aN; vec4 w=modelMatrix*vec4(position,1.0); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }',
  fragmentShader: `uniform vec3 uSunDir, uLit, uShade, uFogCol; uniform float uFar; varying vec3 vN; varying vec3 vW;
    void main(){
      float face=vN.y>0.5?1.0:vN.y<-0.5?-0.35:(abs(vN.x)>0.5?0.55:0.42);
      float sun=clamp(dot(vN,uSunDir)*0.5+0.5,0.0,1.0);
      vec3 col=mix(uShade*(vN.y<-0.5?0.82:1.0),uLit,clamp(face*0.75+sun*0.4-0.12,0.0,1.0));
      // thin edges glow when the sun is behind the cloud (silver lining)
      col+=uLit*pow(max(dot(normalize(vW-cameraPosition),uSunDir),0.0),12.0)*0.35;
      float d=length(vW.xz-cameraPosition.xz);
      float fade=1.0-smoothstep(uFar*0.45,uFar,d);
      col=mix(uFogCol,col,0.25+0.75*fade);
      gl_FragColor=vec4(col,0.86*fade);
    }`,
  transparent: true, depthWrite: true, fog: false,
});
const cloudGroup = new THREE.Group(); scene.add(cloudGroup);
(function buildClouds() {
  const pos = [], nrm = [], idx = []; let n = 0;
  const on = (x, z) => cloudData[((((x % CLOUD_N) + CLOUD_N) % CLOUD_N) + (((z % CLOUD_N) + CLOUD_N) % CLOUD_N) * CLOUD_N) * 4] > 0;
  const face = (v, nn) => { for (const p of v) { pos.push(p[0], p[1], p[2]); nrm.push(nn[0], nn[1], nn[2]); } idx.push(n, n + 1, n + 2, n, n + 2, n + 3); n += 4; };
  const C = CLOUD_CELL, Hh = CLOUD_H;
  for (let z = 0; z < CLOUD_N; z++) for (let x = 0; x < CLOUD_N; x++) {
    if (!on(x, z)) continue;
    const x0 = x * C, x1 = x0 + C, z0 = z * C, z1 = z0 + C;
    face([[x0, Hh, z1], [x1, Hh, z1], [x1, Hh, z0], [x0, Hh, z0]], [0, 1, 0]);
    face([[x0, 0, z0], [x1, 0, z0], [x1, 0, z1], [x0, 0, z1]], [0, -1, 0]);
    if (!on(x + 1, z)) face([[x1, 0, z1], [x1, 0, z0], [x1, Hh, z0], [x1, Hh, z1]], [1, 0, 0]);
    if (!on(x - 1, z)) face([[x0, 0, z0], [x0, 0, z1], [x0, Hh, z1], [x0, Hh, z0]], [-1, 0, 0]);
    if (!on(x, z + 1)) face([[x0, 0, z1], [x1, 0, z1], [x1, Hh, z1], [x0, Hh, z1]], [0, 0, 1]);
    if (!on(x, z - 1)) face([[x1, 0, z0], [x0, 0, z0], [x0, Hh, z0], [x1, Hh, z0]], [0, 0, -1]);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aN', new THREE.Float32BufferAttribute(nrm, 3)); g.setIndex(idx);
  for (let k = 0; k < 9; k++) { const m = new THREE.Mesh(g, cloudMat); m.renderOrder = 1; m.frustumCulled = false; m.userData.k = k; cloudGroup.add(m); }
})();
// cloud tiles follow the camera; the whole layer drifts slowly west
function updateClouds(cam, t) {
  const drift = t * 0.9, ox = Math.floor((cam.x - drift) / CLOUD_TILE) * CLOUD_TILE + drift, oz = Math.floor(cam.z / CLOUD_TILE) * CLOUD_TILE;
  for (const m of cloudGroup.children) { const k = m.userData.k; m.position.set(ox + ((k % 3) - 1) * CLOUD_TILE, CLOUD_Y, oz + (Math.floor(k / 3) - 1) * CLOUD_TILE); }
  U.uCloud.value.set(drift, 0, CLOUD_TILE, CLOUD_Y);
}

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
// the actual pixels of a tile, so breaking a block scatters chips of its own texture
function tilePixels(name) {
  if (!tilePixels.c) tilePixels.c = {};
  if (tilePixels.c[name]) return tilePixels.c[name];
  const [tx, ty] = TILEPOS[name] || [0, 0], out = [];
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const o = ((ty * 16 + y) * 256 + tx * 16 + x) * 4; if (Atlas.data[o + 3] > 127) out.push([Atlas.data[o] / 255, Atlas.data[o + 1] / 255, Atlas.data[o + 2] / 255]); }
  return (tilePixels.c[name] = out.length ? out : [[0.5, 0.5, 0.5]]);
}
function blockBurst(x, y, z, id, n) {
  const px = tilePixels(BLK[id].tex.side), tint = id === B.GRASS || id === B.LEAVES || id === B.LEAVES_DARK || id === B.TALLGRASS ? 0.85 : 1;
  for (let i = 0; i < (n || 18); i++) { const c = px[Math.floor(Math.random() * px.length)]; emit(x + 0.15 + Math.random() * 0.7, y + 0.15 + Math.random() * 0.7, z + 0.15 + Math.random() * 0.7, { vx: (Math.random() - 0.5) * 3.2, vy: 1 + Math.random() * 2.6, vz: (Math.random() - 0.5) * 3.2, grav: 16, life: 0.45 + Math.random() * 0.5, size: 0.06 + Math.random() * 0.05, r: c[0] * tint, g: c[1] * tint, b: c[2] * tint, fade: false }); }
}

// ---------------------------------------------------------------- floating damage numbers
const dmgSprites = [];
function damageNumber(x, y, z, val, crit) {
  if (!Settings.dmgNumbers) return;
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
  if (id < 256 && ['cube', 'cutout', 'box', 'slab', 'stairs'].includes(BLK[id].render)) {
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
