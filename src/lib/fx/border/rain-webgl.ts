/**
 * Rain / drizzle, high tier: procedural "drops on glass" in one fragment
 * shader pass — no textures, no per-frame uploads, no CPU simulation. Every
 * drop is a pure function of (pixel, time), so the whole frame is a single
 * fullscreen-triangle draw call, and pixels outside the border ring exit
 * after one distance test (the ring is ~half the screen; the other half
 * costs almost nothing).
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
 *   specular glint.
 *
 * The browser can't hand WebGL the DOM behind the canvas, so the refracted
 * "scene" is a procedural stand-in for Layout.svelte's Blue Hour sky (same
 * three stops, same warm-low-left / cold-high-right light pools). The body
 * of each drop stays partly transparent so real content still shows through
 * over a photo background.
 *
 * Falls back to the Canvas2D tier (rain-eco) if a context can't be created,
 * the shader fails to compile, the context is lost, or sustained frame time
 * shows the GPU can't keep up (plan premortem P3: tiers auto-degrade).
 */
import { createCappedLoop } from '../raf-loop'
import { BAND_FRACTION, FPS, createLayerCanvas } from './common'
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
uniform float uBand;
// 0 for rain, 1 for drizzle/freezing-drizzle (see EffectOptions.conditionKey)
// — finer, slower, quieter droplets rather than just fewer of them.
uniform float uDrizzle;

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
  vec3 top = vec3(0.039, 0.090, 0.149);
  vec3 mid = vec3(0.063, 0.141, 0.227);
  vec3 bot = vec3(0.102, 0.180, 0.275);
  vec3 c = p.y > 0.48 ? mix(mid, top, (p.y - 0.48) / 0.52) : mix(bot, mid, p.y / 0.48);
  c += vec3(1.0, 0.588, 0.463) * 0.2 * (1.0 - smoothstep(0.0, 0.8, length(p * vec2(1.0, 1.3))));
  c += vec3(0.361, 0.667, 0.824) * 0.16 * (1.0 - smoothstep(0.0, 0.8, length(p - 1.0)));
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

void main() {
  vec2 frag = gl_FragCoord.xy;
  float shortSide = min(uRes.x, uRes.y);
  vec2 uv = frag / shortSide;
  float edgeDist = min(min(frag.x, uRes.x - frag.x), min(frag.y, uRes.y - frag.y)) / shortSide;
  float band = uBand * (0.85 + 0.15 * sin(uv.x * 5.0 + uv.y * 3.0 + sin(uv.y * 4.0) * 2.0));
  float mask = 1.0 - smoothstep(band * 0.3, band, edgeDist);
  if (mask <= 0.0) {
    gl_FragColor = vec4(0.0);
    return;
  }

  float beadDensity = (0.32 + 0.5 * uDensity) * mix(1.0, 1.3, uDrizzle);
  vec3 b = beads(uv, uTime, min(beadDensity, 0.95), uDrizzle);
  vec4 r1 = runners(uv, uTime, 0.16 + 0.62 * uDensity, 0.0, uDrizzle);
  vec4 r2 = runners(uv * 1.7 + vec2(0.31, 0.0), uTime * 1.15, 0.12 + 0.52 * uDensity, 7.0, uDrizzle);
  float trail = max(r1.w, r2.w);
  b.z *= 1.0 - smoothstep(0.0, 0.5, trail);
  vec3 d = b;
  if (r1.z > d.z) d = r1.xyz;
  if (r2.z > d.z) d = r2.xyz;

  vec2 suv = frag / uRes;
  vec2 nrm = d.xy;
  float rr = min(dot(nrm, nrm), 1.0);
  float edge = sqrt(rr);
  vec3 N = normalize(vec3(nrm, sqrt(1.0 - rr)));

  vec2 refr = suv - nrm * 0.18 * shortSide / uRes;
  vec3 bg = env(refr);
  vec3 L = normalize(vec3(-0.35, 0.6, 0.72));
  vec3 H = normalize(L + vec3(0.0, 0.0, 1.0));
  float spec = pow(max(dot(N, H), 0.0), 70.0);
  float rim = smoothstep(0.6, 1.0, edge);
  float caustic = smoothstep(0.35, 0.8, edge) * (1.0 - smoothstep(0.85, 1.0, edge))
    * max(0.0, dot(nrm / max(edge, 1e-3), -normalize(L.xy)));

  vec3 dropCol = bg * (2.0 - 1.4 * rim)
    + vec3(1.0, 0.72, 0.59) * caustic * 0.4
    + vec3(1.0, 0.97, 0.93) * spec * 1.2;
  float dropA = d.z * (0.5 + 0.4 * rim);

  vec3 hazeCol = env(suv) * 1.7 + vec3(0.02, 0.03, 0.04);
  float hazeA = 0.1 * (1.0 - trail);

  vec3 col = dropCol * dropA + hazeCol * hazeA * (1.0 - dropA);
  float a = (dropA + hazeA * (1.0 - dropA)) * mask;
  col *= mask;
  gl_FragColor = vec4(min(col, vec3(a)), a);
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
    const layer = createLayerCanvas(host, {
      maxDpr: 1.5,
      maxPixels: 1_400_000,
      onResize: () => (resized = true)
    })
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
      layer.destroy()
      toEco(host, opts, 'no WebGL context')
      return
    }

    let program: WebGLProgram | null = null
    let buffer: WebGLBuffer | null = null
    const shaders: WebGLShader[] = []
    const onLost = (): void => toEco(host, opts, 'context lost')
    layer.canvas.addEventListener('webglcontextlost', onLost)

    let loop: ReturnType<typeof createCappedLoop> | null = null
    teardownGl = () => {
      loop?.stop()
      layer.canvas.removeEventListener('webglcontextlost', onLost)
      if (!gl.isContextLost()) {
        for (const s of shaders) gl.deleteShader(s)
        if (program) gl.deleteProgram(program)
        if (buffer) gl.deleteBuffer(buffer)
        // Release the context now: browsers cap live contexts per page
        // (~16), and GC alone is far too lazy for repeated remounts.
        gl.getExtension('WEBGL_lose_context')?.loseContext()
      }
      layer.destroy()
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
    const uRes = gl.getUniformLocation(program, 'uRes')
    const uTime = gl.getUniformLocation(program, 'uTime')
    gl.uniform1f(gl.getUniformLocation(program, 'uDensity'), opts.density)
    gl.uniform1f(gl.getUniformLocation(program, 'uBand'), BAND_FRACTION)
    const isDrizzle =
      opts.conditionKey === 'drizzle' || opts.conditionKey === 'freezingDrizzle'
    gl.uniform1f(gl.getUniformLocation(program, 'uDrizzle'), isDrizzle ? 1 : 0)

    let t = Math.random() * 600
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
      t = (t + deltaMs / 1000) % TIME_WRAP_S
      if (resized) {
        resized = false
        gl.viewport(0, 0, layer.width, layer.height)
        gl.uniform2f(uRes, layer.width, layer.height)
      }
      gl.uniform1f(uTime, t)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    })
    loop.start()
  }

  return {
    mount(host, opts) {
      if (teardownGl || fallback) return
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
