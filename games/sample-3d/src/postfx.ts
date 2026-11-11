import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import type { PostFX, VisualMode } from './config';

/** Chunky low-res look for the CRT mode. */
const CRT_PIXEL_RATIO = 0.6;

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
uniform float blurPx;
uniform vec2 lightPos;
varying vec2 vUv;

void main() {
  vec4 orig = texture2D(tDiffuse, vUv);
  vec2 px = blurPx / resolution;

  // 13-tap blur: centre plus a cross at 1, 2 and 3 px, weighted by distance.
  vec3 sum = orig.rgb;
  float wsum = 1.0;
  for (int i = 1; i <= 3; i++) {
    float fi = float(i);
    float w = 1.0 / (1.0 + fi);
    sum += texture2D(tDiffuse, vUv + vec2( px.x * fi, 0.0)).rgb * w;
    sum += texture2D(tDiffuse, vUv + vec2(-px.x * fi, 0.0)).rgb * w;
    sum += texture2D(tDiffuse, vUv + vec2(0.0,  px.y * fi)).rgb * w;
    sum += texture2D(tDiffuse, vUv + vec2(0.0, -px.y * fi)).rgb * w;
    wsum += 4.0 * w;
  }
  vec3 blur = sum / wsum;
  // Mostly blurred, with 30% of the original so it stays readable.
  vec3 c = mix(blur, orig.rgb, 0.3);

  // Radial god rays toward the light, decaying with distance.
  vec2 step = (lightPos - vUv) / 12.0;
  vec2 suv = vUv;
  vec3 rays = vec3(0.0);
  float decay = 1.0;
  for (int i = 0; i < 12; i++) {
    suv += step;
    rays += texture2D(tDiffuse, suv).rgb * decay;
    decay *= 0.9;
  }
  rays /= 12.0;
  c += rays * 0.35;

  // Oversaturated, contrasty, warm.
  float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(lum), c, 1.55);
  c = (c - 0.5) * 1.12 + 0.5;
  c *= vec3(1.06, 1.0, 0.92);

  // Soft bright vignette: lift the centre slightly, leave the edges alone.
  float d = distance(vUv, vec2(0.5));
  c *= mix(1.08, 1.0, smoothstep(0.0, 0.7, d));

  // Very subtle shimmer.
  c *= 1.0 + 0.02 * sin(time * 3.0);

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

/** Post-processing for the visual modes. 'off' renders directly. */
export function createPostFX(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera): PostFX {
  let mode: VisualMode = 'off';
  let width = window.innerWidth;
  let height = window.innerHeight;
  let time = 0;
  let rtx: Built | null = null;
  let crt: Built | null = null;

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

  function buildRTX(): Built {
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(width, height), 2.2, 0.9, 0.12));
    const pass = new ShaderPass({
      uniforms: {
        tDiffuse: { value: null },
        resolution: { value: new THREE.Vector2(width, height) },
        time: { value: 0 },
        blurPx: { value: 2.5 },
        lightPos: { value: new THREE.Vector2(0.78, 0.82) },
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
      const active = mode === 'rtx' ? rtx : mode === 'crt' ? crt : null;
      if (active) active.composer.render(dt);
      else renderer.render(scene, camera);
    },
  };
}
