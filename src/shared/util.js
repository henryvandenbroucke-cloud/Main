'use strict';
/* Shared helpers: seeded random numbers and Perlin noise. Runs on the page and inside the world generator worker. */
SHARED.push(function utilModule(G) {
  // 32-bit seeded random (mulberry32), with the handful of helpers Java's Random gives the generator
  class Rand {
    constructor(seed) { this.s = seed >>> 0; }
    next() { let t = this.s = (this.s + 0x6D2B79F5) | 0; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
    int(n) { return Math.floor(this.next() * n); }
    range(a, b) { return a + Math.floor(this.next() * (b - a + 1)); }
    chance(p) { return this.next() < p; }
    pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
    gauss() { return (this.next() + this.next() + this.next() - 1.5) * 1.15; }
  }
  // integer hash of a few ints, 0..1 (stable for a world seed)
  function hash(seed, a, b, c) {
    let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ Math.imul(c | 0, 0x1b873593) ^ Math.imul(seed | 0, 0x9e3779b1);
    h = Math.imul(h ^ (h >>> 15), 0x85ebca6b); h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35); h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  function hashInt(seed, a, b, c) { return Math.floor(hash(seed, a, b, c) * 2147483647); }
  // seed from a string the way the game does for text seeds (Java String.hashCode); numbers are used as they are
  function seedFromText(t) {
    t = String(t).trim();
    if (/^-?\d+$/.test(t) && Math.abs(Number(t)) < 2147483648) return Number(t) | 0;
    let h = 0; for (let i = 0; i < t.length; i++) h = (Math.imul(31, h) + t.charCodeAt(i)) | 0;
    return h;
  }

  // Ken Perlin's improved noise with a seeded permutation
  class Perlin {
    constructor(seed) {
      const r = new Rand(seed), p = new Uint8Array(256);
      for (let i = 0; i < 256; i++) p[i] = i;
      for (let i = 255; i > 0; i--) { const j = r.int(i + 1), t = p[i]; p[i] = p[j]; p[j] = t; }
      this.p = new Uint8Array(512); for (let i = 0; i < 512; i++) this.p[i] = p[i & 255];
      this.ox = r.next() * 256; this.oy = r.next() * 256; this.oz = r.next() * 256;
    }
    noise3(x, y, z) {
      x += this.ox; y += this.oy; z += this.oz;
      const p = this.p;
      let X = Math.floor(x), Y = Math.floor(y), Z = Math.floor(z);
      x -= X; y -= Y; z -= Z; X &= 255; Y &= 255; Z &= 255;
      const u = x * x * x * (x * (x * 6 - 15) + 10), v = y * y * y * (y * (y * 6 - 15) + 10), w = z * z * z * (z * (z * 6 - 15) + 10);
      const A = p[X] + Y, AA = p[A] + Z, AB = p[A + 1] + Z, B2 = p[X + 1] + Y, BA = p[B2] + Z, BB = p[B2 + 1] + Z;
      return lerp(w, lerp(v, lerp(u, grad(p[AA], x, y, z), grad(p[BA], x - 1, y, z)), lerp(u, grad(p[AB], x, y - 1, z), grad(p[BB], x - 1, y - 1, z))),
        lerp(v, lerp(u, grad(p[AA + 1], x, y, z - 1), grad(p[BA + 1], x - 1, y, z - 1)), lerp(u, grad(p[AB + 1], x, y - 1, z - 1), grad(p[BB + 1], x - 1, y - 1, z - 1))));
    }
    noise2(x, z) {
      x += this.ox; z += this.oz;
      const p = this.p;
      let X = Math.floor(x), Z = Math.floor(z);
      x -= X; z -= Z; X &= 255; Z &= 255;
      const u = x * x * x * (x * (x * 6 - 15) + 10), w = z * z * z * (z * (z * 6 - 15) + 10);
      const A = p[X], B2 = p[X + 1];
      const AA = p[A + Z], AB = p[A + Z + 1], BA = p[B2 + Z], BB = p[B2 + Z + 1];
      return lerp(w, lerp(u, grad2(AA, x, z), grad2(BA, x - 1, z)), lerp(u, grad2(AB, x, z - 1), grad2(BB, x - 1, z - 1)));
    }
  }
  function lerp(t, a, b) { return a + t * (b - a); }
  function grad(h, x, y, z) {
    switch (h & 15) {
      case 0: return x + y; case 1: return -x + y; case 2: return x - y; case 3: return -x - y;
      case 4: return x + z; case 5: return -x + z; case 6: return x - z; case 7: return -x - z;
      case 8: return y + z; case 9: return -y + z; case 10: return y - z; case 11: return -y - z;
      case 12: return y + x; case 13: return -y + z; case 14: return y - x; default: return -y - z;
    }
  }
  function grad2(h, x, z) { switch (h & 7) { case 0: return x + z; case 1: return -x + z; case 2: return x - z; case 3: return -x - z; case 4: return x; case 5: return -x; case 6: return z; default: return -z; } }
  // fractal noise: octaves of Perlin, roughly -1..1
  class Octaves {
    constructor(seed, n, persistence) {
      this.o = []; this.n = n; this.pers = persistence || 0.5;
      for (let i = 0; i < n; i++) this.o.push(new Perlin(hashInt(seed, i, 7331, n)));
      let s = 0, a = 1; for (let i = 0; i < n; i++) { s += a; a *= this.pers; } this.norm = 1 / s;
    }
    n2(x, z) { let r = 0, a = 1, f = 1; for (let i = 0; i < this.n; i++) { r += this.o[i].noise2(x * f, z * f) * a; a *= this.pers; f *= 2; } return r * this.norm; }
    n3(x, y, z) { let r = 0, a = 1, f = 1; for (let i = 0; i < this.n; i++) { r += this.o[i].noise3(x * f, y * f, z * f) * a; a *= this.pers; f *= 2; } return r * this.norm; }
  }
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  Object.assign(G, { Rand, hash, hashInt, seedFromText, Perlin, Octaves, clamp, smooth, lerp1: (a, b, t) => a + (b - a) * t });
});
