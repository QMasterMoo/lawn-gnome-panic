import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { PostFX, VisualMode } from './config';

/** Chunky low-res look for the CRT mode. */
const CRT_PIXEL_RATIO = 0.6;

/** How often materials added while in 'rtx' are converted to the glossy look. */
const RTX_CONVERT_INTERVAL = 2;

const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const RTX_FRAG = /* glsl */ `
uniform sampler2D tDiffuse;
uniform vec2 resolution;
uniform float time;
uniform vec2 sunUv;
varying vec2 vUv;

/** Soft ghost disc for lens flare. Radius is in screen-height units. */
float ghost(vec2 uv, vec2 centre, float radius, vec2 aspect) {
  float d = length((uv - centre) * aspect);
  return 1.0 - smoothstep(radius * 0.6, radius, d);
}

void main() {
  vec2 aspect = vec2(resolution.x / resolution.y, 1.0);
  vec4 orig = texture2D(tDiffuse, vUv);

  // 6. Chromatic shimmer: red and blue offset. Applied to the first sample
  // (single pass cannot re-sample its own output), so it runs before the rest.
  float sh = 0.0015 * sin(time * 1.3);
  vec3 c = vec3(
    texture2D(tDiffuse, vUv + vec2(sh, 0.0)).r,
    orig.g,
    texture2D(tDiffuse, vUv - vec2(sh, 0.0)).b
  );

  // 1. Fake puddle reflections on the lower screen (mostly lawn).
  vec2 muv = vec2(vUv.x + 0.004 * sin(vUv.y * 120.0 + time * 2.0), 0.9 - vUv.y);
  vec3 refl = texture2D(tDiffuse, muv).rgb;
  c = mix(c, refl, 0.22 * (1.0 - smoothstep(0.15, 0.45, vUv.y)));

  // 2. Saturation x2, then vibrance (less saturated colours get pushed more).
  float lum709 = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(lum709), c, 2.0);
  float lumSat = dot(c, vec3(0.2126, 0.7152, 0.0722));
  float chroma = clamp(max(c.r, max(c.g, c.b)) - min(c.r, min(c.g, c.b)), 0.0, 1.0);
  c = mix(vec3(lumSat), c, 1.0 + 0.6 * (1.0 - chroma));
  c = max(c, vec3(0.0));

  // 3. Silly shadows: purple crush, comic halftone dots in the darks, warm gold highlights.
  float luma = dot(c, vec3(0.299, 0.587, 0.114));
  float sz = 1.0 - smoothstep(0.05, 0.32, luma); // 1 in deep shadow, 0 above 0.32
  c = mix(c, vec3(0.42, 0.0, 1.0), sz * 0.55);
  vec2 cell = mod(gl_FragCoord.xy, 6.0) - 3.0;
  float dist = length(cell);
  float rad = 2.8 * sz;
  float inDot = 1.0 - smoothstep(rad - 0.6, rad + 0.6, dist);
  c *= 1.0 - 0.35 * inDot * smoothstep(0.0, 0.05, sz);
  float hi = smoothstep(0.75, 0.9, luma);
  c = mix(c, vec3(1.0, 0.85, 0.4), 0.2 * hi);

  // 4. Anamorphic streak: horizontal blur of only the bright parts, cyan tinted.
  vec3 streak = vec3(0.0);
  for (int i = 1; i <= 8; i++) {
    float off = float(i) * 3.0 / resolution.x;
    vec3 a = texture2D(tDiffuse, vec2(vUv.x + off, vUv.y)).rgb;
    vec3 b = texture2D(tDiffuse, vec2(vUv.x - off, vUv.y)).rgb;
    streak += max(a - 0.75, 0.0) + max(b - 0.75, 0.0);
  }
  streak /= 16.0;
  c += streak * 0.5 * vec3(0.4, 0.8, 1.0);

  // 5. Lens flare: ghosts along the line from the sun through the screen centre, plus a glow.
  vec2 toCentre = vec2(0.5) - sunUv;
  c += vec3(1.0, 0.35, 1.0) * 0.15 * ghost(vUv, sunUv + toCentre * 0.6, 0.03, aspect); // magenta
  c += vec3(0.4, 0.9, 1.0) * 0.20 * ghost(vUv, sunUv + toCentre * 1.1, 0.05, aspect);  // cyan
  c += vec3(1.0, 0.85, 0.4) * 0.25 * ghost(vUv, sunUv + toCentre * 1.5, 0.065, aspect); // gold
  c += vec3(0.5, 1.0, 0.5) * 0.18 * ghost(vUv, sunUv + toCentre * 1.9, 0.08, aspect);  // green
  float sd = length((vUv - sunUv) * aspect);
  c += vec3(1.0, 0.9, 0.7) * 0.4 / (1.0 + sd * sd * 120.0);

  gl_FragColor = vec4(c, orig.a);
}
`;

const CRT_FRAG = /* glsl */ `
uniform sampler2D tDiffuse;
uniform vec2 resolution;
uniform float time;
varying vec2 vUv;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  vec2 c = vUv - 0.5;
  // Barrel distortion.
  vec2 uv = vUv + c * dot(c, c) * 0.18;

  // Black outside the tube, with a soft 0.01 dark edge (rounded corners).
  vec2 edge = smoothstep(vec2(0.0), vec2(0.01), uv) * smoothstep(vec2(0.0), vec2(0.01), 1.0 - uv);
  float mask = edge.x * edge.y;

  // Chromatic aberration.
  vec2 off = c * 0.004;
  float r = texture2D(tDiffuse, uv + off).r;
  float g = texture2D(tDiffuse, uv).g;
  float b = texture2D(tDiffuse, uv - off).b;
  vec3 col = vec3(r, g, b);

  // Scanlines.
  col *= 0.78 + 0.22 * sin(uv.y * resolution.y * 3.14159);

  // Aperture grille.
  float m = mod(gl_FragCoord.x, 3.0);
  if (m < 1.0) {
    col *= vec3(1.1, 0.9, 0.9);
  } else if (m < 2.0) {
    col *= vec3(0.9, 1.1, 0.9);
  } else {
    col *= vec3(0.9, 0.9, 1.1);
  }

  // Vignette: darken the edges.
  float vig = 1.0 - 0.5 * smoothstep(0.3, 0.8, length(c) * 2.0);
  col *= vig;

  // Flicker, slight noise, a little glow.
  col *= 0.97 + 0.03 * sin(time * 60.0);
  col += (hash(vUv * resolution + vec2(time)) - 0.5) * 0.06;
  col += col * col * 0.25;

  gl_FragColor = vec4(col * mask, 1.0);
}
`;

interface Built {
  composer: EffectComposer;
  uniforms: Record<string, THREE.IUniform>;
}

interface MatState {
  roughness: number;
  metalness: number;
  envMapIntensity: number;
}

/** Post-processing for the visual modes. 'off' renders directly. */
export function createPostFX(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera): PostFX {
  let mode: VisualMode = 'off';
  let width = window.innerWidth;
  let height = window.innerHeight;
  let time = 0;
  let rtx: Built | null = null;
  let crt: Built | null = null;

  // RTX scene state: environment map, converted materials and values to restore on leaving 'rtx'.
  let rtxActive = false;
  let rtxEnv: THREE.Texture | null = null;
  let rtxConvertTimer = 0;
  const rtxMatState = new Map<THREE.MeshStandardMaterial, MatState>();
  let savedEnvironment: THREE.Texture | null = null;
  let savedToneMapping: THREE.ToneMapping = THREE.NoToneMapping;
  let savedExposure = 1;

  const watermark = document.createElement('div');
  watermark.textContent = 'RTX ON';
  const ws = watermark.style;
  ws.position = 'fixed';
  ws.bottom = '18px';
  ws.right = '24px';
  ws.fontFamily = "'Arial Black'";
  ws.fontSize = '44px';
  ws.fontStyle = 'italic';
  ws.color = '#fff';
  ws.textShadow = '0 0 12px #fff, 0 0 30px #9cff57';
  ws.pointerEvents = 'none';
  ws.zIndex = '50';
  ws.display = 'none';
  document.body.appendChild(watermark);

  /** Sizes a built composer to the current canvas size and refreshes its resolution uniform. */
  function fit(b: Built): void {
    b.composer.setSize(width, height);
    const rt = b.composer.renderTarget1;
    b.uniforms.resolution.value.set(rt.width, rt.height);
  }

  /** Lazily builds the PMREM environment map from a room scene. */
  function getRtxEnv(): THREE.Texture {
    if (!rtxEnv) {
      const pmrem = new THREE.PMREMGenerator(renderer);
      rtxEnv = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      pmrem.dispose();
    }
    return rtxEnv;
  }

  /** Makes every standard material glossier and more metallic, remembering the originals. */
  function convertMaterials(): void {
    scene.traverse((obj) => {
      const material = (obj as THREE.Mesh).material;
      if (!material) return;
      const list = Array.isArray(material) ? material : [material];
      for (const m of list) {
        if (!(m instanceof THREE.MeshStandardMaterial) || rtxMatState.has(m)) continue;
        rtxMatState.set(m, {
          roughness: m.roughness,
          metalness: m.metalness,
          envMapIntensity: m.envMapIntensity,
        });
        m.roughness = m.roughness * 0.25;
        m.metalness = Math.min(1, m.metalness + 0.35);
        m.envMapIntensity = 1.6;
      }
    });
  }

  function enterRtxScene(): void {
    savedEnvironment = scene.environment;
    savedToneMapping = renderer.toneMapping;
    savedExposure = renderer.toneMappingExposure;
    scene.environment = getRtxEnv();
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    convertMaterials();
    rtxConvertTimer = 0;
    rtxActive = true;
  }

  function leaveRtxScene(): void {
    for (const [m, s] of rtxMatState) {
      m.roughness = s.roughness;
      m.metalness = s.metalness;
      m.envMapIntensity = s.envMapIntensity;
    }
    rtxMatState.clear();
    scene.environment = savedEnvironment;
    renderer.toneMapping = savedToneMapping;
    renderer.toneMappingExposure = savedExposure;
    rtxActive = false;
  }

  function buildRTX(): Built {
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(width, height), 0.9, 0.5, 0.6));
    const pass = new ShaderPass({
      uniforms: {
        tDiffuse: { value: null },
        resolution: { value: new THREE.Vector2(width, height) },
        time: { value: 0 },
        sunUv: { value: new THREE.Vector2(0.78, 0.8) },
      },
      vertexShader: VERT,
      fragmentShader: RTX_FRAG,
    });
    composer.addPass(pass);
    composer.addPass(new OutputPass());
    const b: Built = { composer, uniforms: pass.uniforms };
    fit(b);
    return b;
  }

  function buildCRT(): Built {
    const composer = new EffectComposer(renderer);
    composer.setPixelRatio(CRT_PIXEL_RATIO);
    composer.addPass(new RenderPass(scene, camera));
    const pass = new ShaderPass({
      uniforms: {
        tDiffuse: { value: null },
        resolution: { value: new THREE.Vector2(width, height) },
        time: { value: 0 },
      },
      vertexShader: VERT,
      fragmentShader: CRT_FRAG,
    });
    composer.addPass(pass);
    composer.addPass(new OutputPass());
    const b: Built = { composer, uniforms: pass.uniforms };
    fit(b);
    return b;
  }

  return {
    setMode(next: VisualMode) {
      mode = next;
      if (next === 'rtx' && !rtx) rtx = buildRTX();
      if (next === 'crt' && !crt) crt = buildCRT();
      if (next === 'rtx' && !rtxActive) enterRtxScene();
      if (next !== 'rtx' && rtxActive) leaveRtxScene();
      watermark.style.display = next === 'rtx' ? 'block' : 'none';
    },
    setSize(w: number, h: number) {
      width = w;
      height = h;
      if (rtx) fit(rtx);
      if (crt) fit(crt);
    },
    render(dt: number) {
      time += dt;
      if (rtx) rtx.uniforms.time.value = time;
      if (crt) crt.uniforms.time.value = time;
      if (rtxActive) {
        rtxConvertTimer += dt;
        if (rtxConvertTimer >= RTX_CONVERT_INTERVAL) {
          rtxConvertTimer = 0;
          convertMaterials();
        }
      }
      const active = mode === 'rtx' ? rtx : mode === 'crt' ? crt : null;
      if (active) active.composer.render(dt);
      else renderer.render(scene, camera);
    },
  };
}
