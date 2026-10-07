'use strict';
/* Shadow mapping + HDR post-processing: bloom, god rays (light shafts that only pass where the sky is visible,
   so leaves, buildings and clouds cut them into beams), ACES filmic tone mapping, gentle grading and vignette. */
const PostFX = (() => {
  const gl2 = renderer.capabilities.isWebGL2;
  const hdr = gl2 && renderer.extensions.has('EXT_color_buffer_float');
  const TYPE = hdr ? THREE.HalfFloatType : THREE.UnsignedByteType;
  const rt = (w, h, depth) => {
    const t = new THREE.WebGLRenderTarget(Math.max(1, w), Math.max(1, h), { type: TYPE, depthBuffer: !!depth, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
    t.texture.generateMipmaps = false;
    return t;
  };
  let rtScene = rt(2, 2, true), rtHalfA = rt(1, 1), rtHalfB = rt(1, 1), rtQA = rt(1, 1), rtQB = rt(1, 1), rtRays = rt(1, 1);
  const depthRays = gl2; // god rays read the scene depth to find open sky
  if (depthRays) { rtScene.depthTexture = new THREE.DepthTexture(2, 2); rtScene.depthTexture.type = THREE.UnsignedIntType; }

  // ---- shadow map: depth from the sun (or moon), follows the player
  let SH = 2048; const SPAN = 52;
  let shadowRT = null;
  function makeShadowRT(n) {
    if (shadowRT) { shadowRT.depthTexture.dispose(); shadowRT.dispose(); }
    SH = n;
    shadowRT = new THREE.WebGLRenderTarget(SH, SH, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
    shadowRT.depthTexture = new THREE.DepthTexture(SH, SH);
    shadowRT.depthTexture.type = THREE.UnsignedIntType;
    U.uShadowMap.value = shadowRT.depthTexture; U.uShadowSize.value = SH;
  }
  makeShadowRT(2048);
  function setShadowRes(n) { if (n !== SH) makeShadowRT(n); }
  const shadowCam = new THREE.OrthographicCamera(-SPAN, SPAN, SPAN, -SPAN, 1, 320);
  shadowCam.layers.set(1);
  shadowCam.up.set(1, 0, 0);
  const depthMat = new THREE.MeshBasicMaterial({ colorWrite: false });
  const tmp = new THREE.Vector3(), right = new THREE.Vector3(), upv = new THREE.Vector3();
  function renderShadows(center, dir) {
    shadowCam.position.copy(center).addScaledVector(dir, 160);
    shadowCam.lookAt(center);
    shadowCam.updateMatrixWorld();
    // snap to the shadow-map texel grid so edges don't shimmer while walking
    const texel = (SPAN * 2) / SH;
    right.setFromMatrixColumn(shadowCam.matrixWorld, 0); upv.setFromMatrixColumn(shadowCam.matrixWorld, 1);
    const dx = center.dot(right), dy = center.dot(upv);
    tmp.copy(right).multiplyScalar(dx - Math.floor(dx / texel) * texel).addScaledVector(upv, dy - Math.floor(dy / texel) * texel);
    shadowCam.position.sub(tmp); shadowCam.updateMatrixWorld();
    shadowCam.matrixWorldInverse.copy(shadowCam.matrixWorld).invert();
    U.uShadowMatrix.value.multiplyMatrices(shadowCam.projectionMatrix, shadowCam.matrixWorldInverse);
    scene.overrideMaterial = depthMat;
    renderer.setRenderTarget(shadowRT);
    renderer.clear();
    renderer.render(scene, shadowCam);
    scene.overrideMaterial = null;
    renderer.setRenderTarget(null);
  }

  // ---- full-screen passes
  const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quadScene = new THREE.Scene();
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
  quad.frustumCulled = false; quadScene.add(quad);
  const QV = 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.0,1.0); }';
  const brightMat = new THREE.ShaderMaterial({
    uniforms: { tIn: { value: null }, uThresh: { value: hdr ? 0.95 : 0.88 } }, vertexShader: QV,
    fragmentShader: 'uniform sampler2D tIn; uniform float uThresh; varying vec2 vUv; void main(){ vec3 c=texture2D(tIn,vUv).rgb; float l=max(c.r,max(c.g,c.b)); gl_FragColor=vec4(c*smoothstep(uThresh,uThresh+0.45,l),1.0); }',
    depthTest: false, depthWrite: false,
  });
  const blurMat = new THREE.ShaderMaterial({
    uniforms: { tIn: { value: null }, uDir: { value: new THREE.Vector2(1, 0) } }, vertexShader: QV,
    fragmentShader: `uniform sampler2D tIn; uniform vec2 uDir; varying vec2 vUv;
      void main(){ vec3 c=texture2D(tIn,vUv).rgb*0.227;
        c+=(texture2D(tIn,vUv+uDir*1.385).rgb+texture2D(tIn,vUv-uDir*1.385).rgb)*0.316;
        c+=(texture2D(tIn,vUv+uDir*3.23).rgb+texture2D(tIn,vUv-uDir*3.23).rgb)*0.07;
        gl_FragColor=vec4(c,1.0); }`,
    depthTest: false, depthWrite: false,
  });
  const raysMat = new THREE.ShaderMaterial({
    uniforms: { tDepth: { value: null }, uSun: { value: new THREE.Vector2(0.5, 0.5) }, uAspect: { value: 1 } }, vertexShader: QV,
    fragmentShader: `uniform sampler2D tDepth; uniform vec2 uSun; uniform float uAspect; varying vec2 vUv;
      void main(){
        vec2 d=uSun-vUv; float L=length(d*vec2(uAspect,1.0));
        vec2 st=d/36.0; vec2 p=vUv+st*fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(0.06711056,0.00583715))));
        float acc=0.0, w=1.0, ws=0.0;
        for(int i=0;i<36;i++){ vec2 q=clamp(p,0.001,0.999); float sk=texture2D(tDepth,q).r>0.99999?1.0:0.0; acc+=sk*w; ws+=w; w*=0.965; p+=st; }
        float r=acc/ws*exp(-L*2.4);
        gl_FragColor=vec4(r,r,r,1.0);
      }`,
    depthTest: false, depthWrite: false,
  });
  const compMat = new THREE.ShaderMaterial({
    uniforms: {
      tScene: { value: null }, tB1: { value: null }, tB2: { value: null }, tRays: { value: null }, uTexel: { value: new THREE.Vector2(0.001, 0.001) }, uSun: { value: new THREE.Vector2(0.5, 0.5) }, uRays: { value: 0 }, uDepthRays: { value: depthRays ? 1 : 0 }, uRayCol: { value: new THREE.Color(1, 0.85, 0.6) },
      uBloom: { value: hdr ? 0.7 : 0.55 }, uSharp: { value: 0.3 }, uExposure: { value: 0.82 }, uNight: { value: 0 }, uUnder: { value: 0 }, uTime: U.uTime,
    },
    vertexShader: QV,
    fragmentShader: `uniform sampler2D tScene, tB1, tB2, tRays; uniform vec2 uSun, uTexel; uniform float uRays, uDepthRays, uBloom, uSharp, uExposure, uNight, uUnder, uTime; uniform vec3 uRayCol; varying vec2 vUv;
      vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14),0.0,1.0); }
      vec3 lin(vec3 c){ return pow(max(c,0.0),vec3(2.2)); }
      void main(){
        vec2 uv=vUv;
        if(uUnder>0.5) uv+=vec2(sin(uv.y*30.0+uTime*2.0),cos(uv.x*24.0+uTime*1.7))*0.0025;
        vec3 c0=texture2D(tScene,uv).rgb;
        // light sharpening keeps block pixels crisp (stronger when the game renders below screen resolution)
        vec3 nb=texture2D(tScene,uv+vec2(uTexel.x,0.0)).rgb+texture2D(tScene,uv-vec2(uTexel.x,0.0)).rgb+texture2D(tScene,uv+vec2(0.0,uTexel.y)).rgb+texture2D(tScene,uv-vec2(0.0,uTexel.y)).rgb;
        vec3 c=lin(max(c0+(c0-nb*0.25)*uSharp,0.0));
        vec3 b=lin(texture2D(tB1,uv).rgb)*0.6+lin(texture2D(tB2,uv).rgb)*0.9;
        c+=b*uBloom*vec3(1.0,0.92,0.8);
        if(uRays>0.001){
          float r;
          if(uDepthRays>0.5){ // light shafts: blurred, upsampled
            vec2 px=uTexel*2.0;
            r=(texture2D(tRays,uv).r*2.0+texture2D(tRays,uv+vec2(px.x,0.0)).r+texture2D(tRays,uv-vec2(px.x,0.0)).r+texture2D(tRays,uv+vec2(0.0,px.y)).r+texture2D(tRays,uv-vec2(0.0,px.y)).r)/6.0;
          } else { // fallback: radial blur of the bloom image
            vec2 d=(uSun-uv)/24.0; vec2 p=uv; float w=1.0; vec3 rr=vec3(0.0);
            for(int i=0;i<24;i++){ rr+=texture2D(tB2,p).rgb*w; w*=0.93; p+=d; }
            r=dot(rr,vec3(0.33))/24.0*2.0;
          }
          c+=uRayCol*r*uRays;
        }
        c=aces(c*uExposure);
        c=pow(c,vec3(1.0/2.2));
        float l=dot(c,vec3(0.299,0.587,0.114));
        c=mix(vec3(l),c,1.07+0.05*(1.0-uNight));                       // a little richer colour by day
        c=mix(c*vec3(0.97,0.99,1.03),c*vec3(1.02,1.0,0.97),smoothstep(0.2,0.8,l)); // cool shadows, warm highlights
        c=mix(c,c*vec3(0.92,0.96,1.08),uNight*0.5);                     // moonlit blue at night
        vec2 q=uv-0.5; c*=1.0-dot(q,q)*0.28;
        c+=(fract(sin(dot(uv*vec2(12.9898,78.233),vec2(1.0)))*43758.5453)-0.5)/255.0;
        gl_FragColor=vec4(c,1.0);
      }`,
    depthTest: false, depthWrite: false,
  });
  function pass(mat, target) { quad.material = mat; renderer.setRenderTarget(target); renderer.render(quadScene, quadCam); }

  let W0 = 0, H0 = 0;
  function setSize() {
    const pr = renderer.getPixelRatio(), w = Math.floor(window.innerWidth * pr), h = Math.floor(window.innerHeight * pr);
    if (w === W0 && h === H0) return;
    W0 = w; H0 = h;
    rtScene.setSize(w, h);
    for (const t of [rtHalfA, rtHalfB, rtRays]) t.setSize(w >> 1, h >> 1);
    compMat.uniforms.uTexel.value.set(1 / Math.max(1, w), 1 / Math.max(1, h));
    for (const t of [rtQA, rtQB]) t.setSize(w >> 2, h >> 2);
  }
  const sunV = new THREE.Vector3();
  function render(opts) {
    const drawHand = () => { if (!opts.hand) return; renderer.autoClear = false; renderer.clearDepth(); renderer.render(opts.hand.scene, opts.hand.cam); renderer.autoClear = true; };
    if (!opts.post) { renderer.setRenderTarget(null); renderer.render(scene, camera); drawHand(); return; }
    setSize();
    renderer.setRenderTarget(rtScene); renderer.clear(); renderer.render(scene, camera); drawHand();
    // bloom: bright pass at half res, blurred twice, then a wider quarter-res blur
    if (opts.bloom === false) { compMat.uniforms.uBloom.value = 0; } else {
    compMat.uniforms.uBloom.value = hdr ? 0.7 : 0.55;
    brightMat.uniforms.tIn.value = rtScene.texture; pass(brightMat, rtHalfA);
    blurMat.uniforms.tIn.value = rtHalfA.texture; blurMat.uniforms.uDir.value.set(1 / (W0 >> 1), 0); pass(blurMat, rtHalfB);
    blurMat.uniforms.tIn.value = rtHalfB.texture; blurMat.uniforms.uDir.value.set(0, 1 / (H0 >> 1)); pass(blurMat, rtHalfA);
    blurMat.uniforms.tIn.value = rtHalfA.texture; blurMat.uniforms.uDir.value.set(2 / (W0 >> 2), 0); pass(blurMat, rtQB);
    blurMat.uniforms.tIn.value = rtQB.texture; blurMat.uniforms.uDir.value.set(0, 2 / (H0 >> 2)); pass(blurMat, rtQA); }
    // sun rays toward the sun's position on screen
    sunV.copy(opts.sunDir).multiplyScalar(200).add(camera.position).project(camera);
    const facing = sunV.z < 1 && Math.abs(sunV.x) < 1.6 && Math.abs(sunV.y) < 1.6;
    const u = compMat.uniforms;
    u.uSun.value.set(sunV.x * 0.5 + 0.5, sunV.y * 0.5 + 0.5);
    u.uRays.value += (((facing && opts.sunUp > 0) ? opts.sunUp * (depthRays ? 0.9 : 0.55) : 0) - u.uRays.value) * 0.1;
    if (opts.rayCol) u.uRayCol.value.copy(opts.rayCol);
    if (depthRays && u.uRays.value > 0.001) { raysMat.uniforms.tDepth.value = rtScene.depthTexture; raysMat.uniforms.uSun.value.copy(u.uSun.value); raysMat.uniforms.uAspect.value = W0 / H0; pass(raysMat, rtRays); }
    u.tScene.value = rtScene.texture; u.tB1.value = rtHalfA.texture; u.tB2.value = rtQA.texture; u.tRays.value = rtRays.texture;
    u.uSharp.value = opts.sharp === undefined ? 0.3 : opts.sharp;
    u.uNight.value = opts.night; u.uUnder.value = opts.under;
    pass(compMat, null);
  }
  return { render, renderShadows, setShadowRes, hdr, get shadowRes() { return SH; } };
})();
