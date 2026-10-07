'use strict';
/* Shadow mapping + HDR post-processing (bloom, sun rays, filmic tone curve, grading, vignette). */
const PostFX = (() => {
  const gl2 = renderer.capabilities.isWebGL2;
  const hdr = gl2 && renderer.extensions.has('EXT_color_buffer_float');
  const TYPE = hdr ? THREE.HalfFloatType : THREE.UnsignedByteType;
  const rt = (w, h, depth) => {
    const t = new THREE.WebGLRenderTarget(Math.max(1, w), Math.max(1, h), { type: TYPE, depthBuffer: !!depth, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
    t.texture.generateMipmaps = false;
    return t;
  };
  let rtScene = rt(2, 2, true), rtHalfA = rt(1, 1), rtHalfB = rt(1, 1), rtQA = rt(1, 1), rtQB = rt(1, 1);

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
  const compMat = new THREE.ShaderMaterial({
    uniforms: {
      tScene: { value: null }, tB1: { value: null }, tB2: { value: null }, uSun: { value: new THREE.Vector2(0.5, 0.5) }, uRays: { value: 0 },
      uBloom: { value: hdr ? 0.7 : 0.55 }, uExposure: { value: 0.94 }, uNight: { value: 0 }, uUnder: { value: 0 }, uTime: U.uTime, uWarm: { value: new THREE.Vector3(1.04, 1.0, 0.94) },
    },
    vertexShader: QV,
    fragmentShader: `uniform sampler2D tScene, tB1, tB2; uniform vec2 uSun; uniform float uRays, uBloom, uExposure, uNight, uUnder, uTime; uniform vec3 uWarm; varying vec2 vUv;
      vec3 tone(vec3 x){ vec3 k=vec3(0.72); vec3 hi=k+(1.0-k)*(1.0-exp(-(x-k)/(1.0-k))); x=mix(x,hi,step(k,x)); x=clamp(x,0.0,1.0); return mix(x,x*x*(3.0-2.0*x),0.18); }
      void main(){
        vec2 uv=vUv;
        if(uUnder>0.5) uv+=vec2(sin(uv.y*30.0+uTime*2.0),cos(uv.x*24.0+uTime*1.7))*0.0025;
        vec3 c=texture2D(tScene,uv).rgb;
        vec3 b=texture2D(tB1,uv).rgb*0.55+texture2D(tB2,uv).rgb*0.85;
        c+=b*uBloom*vec3(1.0,0.9,0.75);
        if(uRays>0.001){
          vec2 d=(uSun-uv)/24.0; vec2 p=uv+d*fract(sin(dot(uv,vec2(12.9898,78.233)))*43758.5453); float w=1.0; vec3 r=vec3(0.0);
          for(int i=0;i<24;i++){ r+=texture2D(tB2,p).rgb*w; w*=0.93; p+=d; }
          c+=r/24.0*1.2*uRays*0.6*vec3(1.0,0.82,0.55);
        }
        c=tone(c*uExposure);
        float l=dot(c,vec3(0.299,0.587,0.114));
        c=mix(vec3(l),c,1.08);
        c*=mix(uWarm,vec3(0.96,0.97,1.04),uNight);
        float lg=dot(c,vec3(0.299,0.587,0.114));
        c=mix(c*vec3(0.965,0.985,1.04),c*vec3(1.03,1.0,0.955),smoothstep(0.15,0.75,lg)); // cool shadows, warm highlights
        c=c*0.985+0.01;
        
        vec2 q=uv-0.5; c*=1.0-dot(q,q)*0.45;
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
    for (const t of [rtHalfA, rtHalfB]) t.setSize(w >> 1, h >> 1);
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
    u.uRays.value += (((facing && opts.sunUp > 0) ? opts.sunUp * 0.55 : 0) - u.uRays.value) * 0.1;
    u.tScene.value = rtScene.texture; u.tB1.value = rtHalfA.texture; u.tB2.value = rtQA.texture;
    u.uNight.value = opts.night; u.uUnder.value = opts.under;
    pass(compMat, null);
  }
  return { render, renderShadows, setShadowRes, hdr, get shadowRes() { return SH; } };
})();
