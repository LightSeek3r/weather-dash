/**
 * Rain / drizzle, high tier: procedural "drops on glass" in one fragment
 * shader pass — no per-frame uploads, no CPU simulation. Every drop is a
 * pure function of (pixel, time), so the whole frame is a single
 * fullscreen-triangle draw call. The only texture is the tiny presence
 * field (common.ts), re-uploaded when the layout moves; pixels where it's
 * zero exit after one lookup.
 *
 * Model, per pixel:
 * - beads: a sparse grid of small static drops, each with its own slow
 *   appear → evaporate cycle (the condensation field);
 * - runners: two scales of a tall grid, one heavier drop per cell sliding
 *   down with a stick-slip gait (position s − sin(2πks)/2πk, whose speed
 *   1 − cos(2πks) repeatedly drops to zero — drops on glass pin, then
 *   release), a wobbling path, a teardrop profile and a wet trail of tiny
 *   droplets. The trail wipes beads and haze, the way a real runner clears
 *   a streak through condensation;
 * - each drop is shaded as a hemispherical lens: the refracted lookup is
 *   mirrored through the drop centre (a drop on a window shows a small
 *   inverted view of what's behind it), with a darker total-internal-
 *   reflection rim, a warm caustic crescent opposite the key light, and a
 *   specular glint;
 * - streaks: rain falling past the pane, slanted by the wind — sparse, short
 *   and slow for light rain, dense, long and fast for heavy;
 * - pool: water collecting along the bottom edge, with a bright meniscus and
 *   ripples where drops land;
 * - veil: a grey cloud deck from the top, which is what hides the sky
 *   layer's sun/moon during rain.
 *
 * The browser can't hand WebGL the DOM behind the canvas, so the refracted
 * "scene" is a procedural stand-in for Layout.svelte's Blue Hour sky (same
 * three stops, same warm-low-left / cold-high-right light pools). The body
 * of each drop stays partly transparent so real content still shows through
 * over a photo background.
 *
 * Falls back to the Canvas2D tier (rain-eco) if a context can't be created,
 * the shader fails to compile, the context is lost, or sustained frame time
 * shows the GPU can't keep up (plan premortem P3: tiers auto-degrade). The
 * icy variants (freezing rain, hail) go straight to the Canvas2D scene at
 * the same tier: frost and hail pellets live there, not in the shader.
 */
import { createCappedLoop } from '../raf-loop'
import {
  FPS,
  FROZEN_DT,
  FROZEN_SEED,
  FROZEN_STEPS,
  FROZEN_T,
  appendCanvas,
  bandSize,
  createFieldTracker,
  createLayerCanvas,
  random,
  releaseCanvas,
  seedRandom,
  smoothstep,
  type PresenceField
} from './common'
import { isIcy } from './ice'
import { createNearRain, type NearRain } from './near-rain'
import { createEffect as createEcoEffect } from './rain-eco'
import type { BorderEffect, EffectOptions } from './types'

const VERT = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`

const FRAG = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

uniform vec2 uRes;
uniform float uTime;
uniform float uDensity;
// 0 at light rain -> 1 at heavy/storm: streak length/speed/slant, pool depth.
uniform float uHeavy;
// 0 for rain, 1 for drizzle/freezing-drizzle (see EffectOptions.conditionKey)
// — finer, slower, quieter droplets rather than just fewer of them.
uniform float uDrizzle;
// Presence field (alpha), and the affine map from screen uv to its texels:
// grid samples sit on cell corners, i.e. on texel centres.
uniform sampler2D uField;
uniform vec2 uFieldA;
uniform vec2 uFieldB;

// Hash without sine, Dave Hoskins (MIT) — stable across GPUs, unlike sin-hashes.
float hash11(float p) {
  p = fract(p * 0.1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}
vec3 hash31(float p) {
  vec3 p3 = fract(vec3(p) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xxy + p3.yzz) * p3.zyx);
}

// Stand-in for Layout.svelte's .bg-sky (y up: sky-0 top, sky-2 bottom).
vec3 env(vec2 p) {
  p = clamp(p, 0.0, 1.0);
  vec3 top = vec3(0.027, 0.051, 0.141);
  vec3 mid = vec3(0.047, 0.102, 0.239);
  vec3 bot = vec3(0.059, 0.149, 0.314);
  vec3 c = p.y > 0.5 ? mix(mid, top, (p.y - 0.5) / 0.5) : mix(bot, mid, p.y / 0.5);
  c += vec3(0.157, 0.863, 0.784) * 0.2 * (1.0 - smoothstep(0.0, 0.8, length(p * vec2(1.0, 1.3))));
  c += vec3(0.275, 0.549, 1.0) * 0.2 * (1.0 - smoothstep(0.0, 0.8, length(p - 1.0)));
  c += vec3(0.235, 0.51, 1.0) * 0.25 * (1.0 - smoothstep(0.0, 0.55, length(p - vec2(0.12, 0.85))));
  c += vec3(0.588, 0.431, 1.0) * 0.25 * (1.0 - smoothstep(0.0, 0.6, length(p - vec2(0.55, -0.05))));
  return c;
}

// -> (normal.xy in drop radii, coverage)
vec3 beads(vec2 uv, float t, float density, float drizzle) {
  // Drizzle packs a finer grid of smaller, slower-cycling beads — a mist of
  // condensation rather than rain's sparser, plumper drops.
  vec2 g = uv * mix(30.0, 42.0, drizzle);
  vec2 id = floor(g);
  vec2 gv = fract(g) - 0.5;
  vec3 n = hash31(id.x * 107.45 + id.y * 3543.654);
  if (n.z > density) return vec3(0.0);
  vec3 m = hash31(n.z * 917.3 + n.x * 31.1);
  float life = fract(t * mix(0.035, 0.022, drizzle) * (0.6 + m.x) + m.y);
  float fade = smoothstep(0.0, 0.03, life) * smoothstep(1.0, 0.55, life);
  float rMax = mix(0.1, 0.055, drizzle) + mix(0.24, 0.12, drizzle) * m.z;
  float r = rMax * (0.65 + 0.35 * smoothstep(0.0, 0.08, life));
  vec2 p = (n.xy - 0.5) * 2.0 * (0.5 - rMax);
  vec2 dv = gv - p;
  float c = smoothstep(r, r * 0.72, length(dv)) * fade;
  return vec3(dv / r, c);
}

float runnerPath(float y, vec3 n) {
  return 0.5 + (n.y - 0.5) * 0.45
    + sin(y * 7.0 + n.z * 41.0) * 0.12
    + sin(y * 17.0 + n.x * 13.0) * 0.035;
}

// -> (normal.xy, coverage, trail wetness)
vec4 runners(vec2 uv, float t, float density, float seed, float drizzle) {
  // Drizzle's runners are thinner, narrower and slide down slower — a light
  // trickle rather than rain's fuller, faster streaks.
  vec2 CELL = mix(vec2(0.075, 0.5), vec2(0.06, 0.5), drizzle);
  vec2 g = uv / CELL;
  g.y += hash11(floor(g.x) * 13.7 + seed) * 11.0;
  vec2 id = floor(g);
  vec2 gv = fract(g);
  vec3 n = hash31(id.x * 35.17 + id.y * 2376.13 + seed * 17.0);
  if (n.x > density) return vec4(0.0);

  float s = fract(t * mix(1.0, 0.45, drizzle) * (0.07 + 0.08 * n.y) + n.z);
  const float K = 3.0;
  float prog = s - sin(6.2831853 * K * s) / (6.2831853 * K);
  float dropY = 0.95 - prog * 0.9;
  float dropX = runnerPath(dropY, n);
  float vis = smoothstep(0.0, 0.06, s) * smoothstep(1.0, 0.9, s);
  float r = mix(1.0, 0.6, drizzle) * (0.011 + 0.008 * fract(n.z * 51.3)) * mix(1.0, 0.7, s);

  vec2 dv = (gv - vec2(dropX, dropY)) * CELL;
  dv.y *= dv.y > 0.0 ? 0.7 : 1.1;
  float c = smoothstep(r, r * 0.8, length(dv)) * vis;
  vec2 nrm = dv / r;

  float above = (gv.y - dropY) * CELL.y;
  float tx = (gv.x - runnerPath(gv.y, n)) * CELL.x;
  float tw = r * 0.6;
  float trail = smoothstep(tw, tw * 0.2, abs(tx)) * step(0.0, above)
    * smoothstep(0.22, 0.0, above) * vis;

  // Droplets shed along the path — fixed in cell space, so they stay put
  // while the runner moves on, and fade as it gets further away.
  const float SEG = 0.02;
  float ty = gv.y * CELL.y / SEG;
  vec3 tn = hash31(floor(ty) * 7.7 + id.x * 131.0 + id.y * 17.0 + seed);
  vec2 tp = vec2(tx + (tn.x - 0.5) * tw, (fract(ty) - 0.5) * SEG);
  float tr = r * (0.2 + 0.25 * tn.z);
  float tc = smoothstep(tr, tr * 0.7, length(tp)) * step(0.4, tn.y)
    * smoothstep(0.26, 0.03, above) * step(r, above) * vis;
  if (tc > c) {
    nrm = tp / tr;
    c = tc;
  }
  return vec4(nrm, c, trail);
}

// Slanted rain falling past the pane; y is up, so heads move toward 0.
float streaks(vec2 uv, float t, float density, float seed, float cols, float H) {
  uv.x += uv.y * mix(0.05, 0.2, uHeavy);
  float x = uv.x * cols;
  float id = floor(x);
  float fx = fract(x) - 0.5;
  vec3 n = hash31(id * 17.13 + seed);
  if (n.x > density) return 0.0;
  float len = mix(mix(0.07, 0.34, uHeavy), 0.03, uDrizzle) * (0.6 + 0.8 * n.y);
  float L = H + len + 0.4;
  float speed = mix(mix(0.9, 2.2, uHeavy), 0.45, uDrizzle) * H * (0.75 + 0.5 * n.z);
  float head = H + len - fract(t * speed / L + n.y * 7.0) * L;
  float d = uv.y - head;
  if (d < 0.0 || d > len) return 0.0;
  float along = 1.0 - d / len;
  float across = smoothstep(mix(0.08, 0.13, uHeavy), 0.0, abs(fx));
  return along * along * across * (0.55 + 0.45 * n.z);
}

float ripples(vec2 uv, float sy, float t) {
  const float CW = 0.16;
  float id = floor(uv.x / CW);
  vec3 n = hash31(id * 9.7 + 3.3);
  float period = 0.9 + 1.6 * n.x;
  float k = fract(t / period + n.y);
  float cx = (id + 0.2 + 0.6 * n.z) * CW;
  vec2 p = vec2(uv.x - cx, (uv.y - sy) * 4.0);
  return smoothstep(0.005, 0.0, abs(length(p) - k * CW * 0.45)) * (1.0 - k);
}

vec4 over(vec4 src, vec4 dst) {
  return src + dst * (1.0 - src.a);
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  float shortSide = min(uRes.x, uRes.y);
  vec2 uv = frag / shortSide;
  vec2 suv = frag / uRes;
  float mask = texture2D(uField, vec2(suv.x, 1.0 - suv.y) * uFieldA + uFieldB).a;
  if (mask <= 0.004) {
    gl_FragColor = vec4(0.0);
    return;
  }

  float beadDensity = (0.3 + 0.55 * uDensity) * mix(1.0, 1.3, uDrizzle);
  vec3 b = beads(uv, uTime, min(beadDensity, 0.95), uDrizzle);
  vec4 r1 = runners(uv, uTime, 0.16 + 0.62 * uDensity, 0.0, uDrizzle);
  vec4 r2 = runners(uv * 1.7 + vec2(0.31, 0.0), uTime * 1.15, 0.12 + 0.52 * uDensity, 7.0, uDrizzle);
  float trail = max(r1.w, r2.w);
  b.z *= 1.0 - smoothstep(0.0, 0.5, trail);
  vec3 d = b;
  if (r1.z > d.z) d = r1.xyz;
  if (r2.z > d.z) d = r2.xyz;

  vec2 nrm = d.xy;
  float rr = min(dot(nrm, nrm), 1.0);
  float edge = sqrt(rr);
  vec3 N = normalize(vec3(nrm, sqrt(1.0 - rr)));

  vec2 refr = suv - nrm * 0.18 * shortSide / uRes;
  vec3 bg = env(refr);
  vec3 L = normalize(vec3(-0.35, 0.6, 0.72));
  vec3 Hv = normalize(L + vec3(0.0, 0.0, 1.0));
  float spec = pow(max(dot(N, Hv), 0.0), 60.0);
  float rim = smoothstep(0.6, 1.0, edge);
  float caustic = smoothstep(0.35, 0.8, edge) * (1.0 - smoothstep(0.85, 1.0, edge))
    * max(0.0, dot(nrm / max(edge, 1e-3), -normalize(L.xy)));

  vec3 dropCol = bg * (2.6 - 1.6 * rim)
    + vec3(1.0, 0.72, 0.59) * caustic * 0.55
    + vec3(1.0, 0.97, 0.93) * spec * 1.6;
  float dropA = d.z * (0.62 + 0.35 * rim);

  // Pool along the bottom edge (uv units; 0.14 = one band).
  float pd = 0.14 * mix(0.14 + 0.26 * uHeavy, 0.1, uDrizzle);
  float wa = pd * 0.09;
  float sy = pd + sin(suv.x * 18.85 + uTime * 1.3) * wa
    + sin(suv.x * 45.87 - uTime * 0.9) * wa * 0.6;
  float below = sy - uv.y;

  float H = uRes.y / shortSide;
  float st = 0.0;
  if (below < 0.0) {
    float sd = (0.3 + 0.6 * uDensity) * mix(1.0, 0.45, uDrizzle);
    st = streaks(uv, uTime, sd, 1.0, 70.0, H)
      + 0.6 * streaks(uv, uTime * 1.13, sd, 5.0, 130.0, H);
  }

  float veilA = (0.3 + 0.2 * uHeavy) * smoothstep(0.4, 1.0, suv.y) + 0.03;
  vec4 acc = vec4(vec3(0.086, 0.133, 0.196) * veilA, veilA);
  float hazeA = 0.08 * (1.0 - trail);
  acc = over(vec4(env(suv) * 1.7 * hazeA, hazeA), acc);
  float sa = min(st, 1.0) * mix(0.5, 0.3, uDrizzle);
  acc = over(vec4(vec3(0.84, 0.92, 1.0) * sa, sa), acc);
  acc = over(vec4(dropCol * dropA, dropA), acc);
  if (below > 0.0) {
    float poolA = mix(0.14, 0.34, clamp(1.0 - uv.y / max(pd, 1e-3), 0.0, 1.0));
    acc = over(vec4(vec3(0.55, 0.75, 0.91) * poolA, poolA), acc);
  }
  float lineA = smoothstep(0.0035, 0.0, abs(below)) * 0.65;
  if (below > -0.01 && below < pd * 0.6) lineA += ripples(uv, sy, uTime) * 0.5;
  lineA = min(lineA, 1.0);
  acc = over(vec4(vec3(0.89, 0.95, 1.0) * lineA, lineA), acc);

  acc *= mask;
  gl_FragColor = vec4(min(acc.rgb, vec3(acc.a)), acc.a);
}
`

// Shader time wraps so fp32 phase math stays precise over weeks of uptime;
// costs one invisible-in-practice reshuffle of the drop field every 2h.
const TIME_WRAP_S = 7200
// Sustained frame interval this far over the 30fps target means the GPU
// (or the page around it) can't afford the shader — drop to Canvas2D.
const SLOW_FRAME_MS = (1000 / FPS.high) * 1.8
const SLOW_FRAMES_TO_DEGRADE = 60
const WARMUP_MS = 3000

function compile(
  gl: WebGLRenderingContext,
  type: number,
  src: string
): WebGLShader {
  const shader = gl.createShader(type)
  if (!shader) throw new Error('createShader failed')
  gl.shaderSource(shader, src)
  gl.compileShader(shader)
  if (
    !gl.getShaderParameter(shader, gl.COMPILE_STATUS) &&
    !gl.isContextLost()
  ) {
    const log = gl.getShaderInfoLog(shader)
    gl.deleteShader(shader)
    throw new Error(`shader compile failed: ${log ?? ''}`)
  }
  return shader
}

export function createEffect(): BorderEffect {
  let teardownGl: (() => void) | null = null
  let fallback: BorderEffect | null = null

  function toEco(host: HTMLElement, opts: EffectOptions, reason: string): void {
    console.warn(`[fx] rain-webgl → Canvas2D fallback: ${reason}`)
    teardownGl?.()
    teardownGl = null
    fallback = createEcoEffect()
    fallback.mount(host, { ...opts, tier: 'eco' })
  }

  function mountGl(host: HTMLElement, opts: EffectOptions): void {
    let resized = true
    let fieldDirty = true
    // Frozen renders draw on demand instead of from a loop.
    let redraw: (() => void) | null = null
    const tracker = createFieldTracker(0.7, () => {
      redraw?.()
    })
    // Near rain in front of the page text: Canvas2D, since one GL context
    // can't also draw this second canvas. Created before the layer so the
    // layer's first onResize sizes it too.
    const frontCanvas = opts.front ? appendCanvas(opts.front) : null
    const fctx = frontCanvas?.getContext('2d') ?? null
    if (frontCanvas) frontCanvas.dataset.renderer = '2d'
    let nearRain: NearRain | null = fctx ? createNearRain(opts) : null
    const layer = createLayerCanvas(host, {
      maxDpr: 1.25,
      maxPixels: 1_200_000,
      onResize: (w, h) => {
        tracker.resize(w, h)
        if (frontCanvas) {
          frontCanvas.width = w
          frontCanvas.height = h
        }
        if (!opts.frozen) nearRain?.resize(w, h, bandSize(w, h))
        resized = true
        fieldDirty = true
        redraw?.()
      }
    })

    function drawFront(dt: number): void {
      if (!fctx || !nearRain || !frontCanvas) return
      fctx.globalCompositeOperation = 'source-over'
      fctx.clearRect(0, 0, frontCanvas.width, frontCanvas.height)
      nearRain.draw(fctx, dt)
      tracker.clearFront(fctx)
    }

    // Same contract as createCanvas2dEffect's frozen path: one seeded scene,
    // warmed up so the streaks are spread out, never a loop.
    function renderFrontFrozen(): void {
      if (!fctx || !frontCanvas) return
      seedRandom(FROZEN_SEED)
      try {
        nearRain = createNearRain(opts)
        const { width: w, height: h } = frontCanvas
        nearRain.resize(w, h, bandSize(w, h))
        for (let i = 0; i < FROZEN_STEPS; i++) drawFront(FROZEN_DT)
      } finally {
        seedRandom(null)
      }
    }
    layer.canvas.dataset.renderer = 'webgl'
    const attrs: WebGLContextAttributes = {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      preserveDrawingBuffer: false,
      powerPreference: 'low-power'
    }
    const gl = (layer.canvas.getContext('webgl2', attrs) ??
      layer.canvas.getContext('webgl', attrs)) as WebGLRenderingContext | null
    if (!gl) {
      tracker.destroy()
      layer.destroy()
      if (frontCanvas) releaseCanvas(frontCanvas)
      toEco(host, opts, 'no WebGL context')
      return
    }

    let program: WebGLProgram | null = null
    let buffer: WebGLBuffer | null = null
    let texture: WebGLTexture | null = null
    const shaders: WebGLShader[] = []
    const onLost = (): void => toEco(host, opts, 'context lost')
    layer.canvas.addEventListener('webglcontextlost', onLost)

    let loop: ReturnType<typeof createCappedLoop> | null = null
    teardownGl = () => {
      loop?.stop()
      redraw = null
      tracker.destroy()
      layer.canvas.removeEventListener('webglcontextlost', onLost)
      if (!gl.isContextLost()) {
        for (const s of shaders) gl.deleteShader(s)
        if (program) gl.deleteProgram(program)
        if (buffer) gl.deleteBuffer(buffer)
        if (texture) gl.deleteTexture(texture)
        // Release the context now: browsers cap live contexts per page
        // (~16), and GC alone is far too lazy for repeated remounts.
        gl.getExtension('WEBGL_lose_context')?.loseContext()
      }
      layer.destroy()
      if (frontCanvas) releaseCanvas(frontCanvas)
      nearRain = null
    }

    try {
      shaders.push(compile(gl, gl.VERTEX_SHADER, VERT))
      shaders.push(compile(gl, gl.FRAGMENT_SHADER, FRAG))
      program = gl.createProgram()
      if (!program) throw new Error('createProgram failed')
      for (const s of shaders) gl.attachShader(program, s)
      gl.linkProgram(program)
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw new Error(`link failed: ${gl.getProgramInfoLog(program) ?? ''}`)
      }
    } catch (err) {
      toEco(host, opts, String(err))
      return
    }

    gl.useProgram(program)
    buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW
    )
    const aPos = gl.getAttribLocation(program, 'aPos')
    gl.enableVertexAttribArray(aPos)
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)

    texture = gl.createTexture()
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.uniform1i(gl.getUniformLocation(program, 'uField'), 0)
    const uFieldA = gl.getUniformLocation(program, 'uFieldA')
    const uFieldB = gl.getUniformLocation(program, 'uFieldB')
    const uRes = gl.getUniformLocation(program, 'uRes')
    const uTime = gl.getUniformLocation(program, 'uTime')

    const isDrizzle =
      opts.conditionKey === 'drizzle' || opts.conditionKey === 'freezingDrizzle'
    gl.uniform1f(gl.getUniformLocation(program, 'uDensity'), opts.density)
    gl.uniform1f(gl.getUniformLocation(program, 'uDrizzle'), isDrizzle ? 1 : 0)
    gl.uniform1f(
      gl.getUniformLocation(program, 'uHeavy'),
      isDrizzle ? 0 : smoothstep(0.5, 1, opts.density)
    )

    const uploadField = (field: PresenceField): void => {
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        field.mask
      )
      // Screen uv (y down) -> texel coords: sample k sits at k·cell px.
      gl.uniform2f(
        uFieldA,
        layer.width / (field.cell * field.cols),
        layer.height / (field.cell * field.rows)
      )
      gl.uniform2f(uFieldB, 0.5 / field.cols, 0.5 / field.rows)
    }

    const draw = (time: number): void => {
      if (gl.isContextLost()) return
      if (resized) {
        resized = false
        gl.viewport(0, 0, layer.width, layer.height)
        gl.uniform2f(uRes, layer.width, layer.height)
      }
      const field = tracker.field
      if (fieldDirty && field) {
        fieldDirty = false
        uploadField(field)
      }
      gl.uniform1f(uTime, time)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    }

    if (opts.frozen) {
      redraw = () => {
        draw(FROZEN_T)
        renderFrontFrozen()
      }
      redraw()
      return
    }

    let t = random() * 600
    let warm = 0
    let ema = 1000 / FPS.high
    let slowFrames = 0

    loop = createCappedLoop(FPS.high, (deltaMs) => {
      if (gl.isContextLost()) return
      if (deltaMs > 0) {
        warm += deltaMs
        if (warm > WARMUP_MS) {
          ema += (deltaMs - ema) * 0.05
          slowFrames = ema > SLOW_FRAME_MS ? slowFrames + 1 : 0
          if (slowFrames > SLOW_FRAMES_TO_DEGRADE) {
            toEco(host, opts, `sustained ${Math.round(ema)}ms frames`)
            return
          }
        }
      }
      tracker.tick(deltaMs / 1000)
      t = (t + deltaMs / 1000) % TIME_WRAP_S
      draw(t)
      drawFront(deltaMs / 1000)
    })
    loop.start()
  }

  return {
    mount(host, opts) {
      if (teardownGl || fallback) return
      if (isIcy(opts)) {
        fallback = createEcoEffect()
        fallback.mount(host, opts)
        return
      }
      mountGl(host, opts)
    },
    unmount() {
      teardownGl?.()
      teardownGl = null
      fallback?.unmount()
      fallback = null
    }
  }
}
