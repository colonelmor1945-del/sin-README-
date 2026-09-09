"use client";

import { useEffect, useRef } from "react";

/**
 * Animated 3D backdrop.
 *
 * Raw WebGL rather than Three.js. The whole scene is one fragment shader over
 * a fullscreen triangle, which is a few kilobytes against roughly 150 for a
 * Three.js bundle, and there is no scene graph to justify the cost. The
 * perspective is real: each pixel casts a ray, intersects a ground plane, and
 * the grid is drawn in world space, so lines converge at the horizon the way
 * geometry does and not the way a CSS gradient pretends to.
 *
 * Performance rules it keeps, because a background that eats the frame budget
 * is worse than no background:
 *  - Renders at most at 1.5x device pixel ratio.
 *  - Capped near 30fps. Nothing here needs 60.
 *  - Stops entirely when scrolled out of view or the tab is hidden.
 *  - Renders one static frame and stops under prefers-reduced-motion.
 *  - Falls back to nothing at all if WebGL is unavailable. The pages below it
 *    have their own background colour and never depend on this drawing.
 */

const VERTEX = `#version 300 es
void main() {
  // Fullscreen triangle. No vertex buffer, positions come from gl_VertexID.
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const FRAGMENT = `#version 300 es
precision highp float;

uniform vec2  uResolution;
uniform float uTime;
/** Pointer position, -1 to 1 on both axes, smoothed on the CPU side. */
uniform vec2  uMouse;
out vec4 outColour;

/**
 * Palette.
 *
 * A Miami sunset ramp: deep violet at the top, magenta through the middle,
 * amber at the waterline, over near-black. This is a colour scheme, drawn from
 * the same place every piece of Florida-at-dusk artwork draws from. No Rockstar
 * asset, mark, logotype or artwork is reproduced anywhere in this file.
 */
const vec3 GROUND  = vec3(0.020, 0.012, 0.035);
const vec3 ACCENT  = vec3(1.000, 0.176, 0.471);  // hot magenta
const vec3 CYAN    = vec3(0.310, 0.640, 1.000);  // sky blue
const vec3 VIOLET  = vec3(0.480, 0.130, 0.720);  // electric purple
const vec3 AMBER   = vec3(1.000, 0.620, 0.230);  // low sun

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

// Distance to the nearest line of a unit grid, screen-space antialiased.
float gridLine(vec2 p, float width) {
  vec2 g = abs(fract(p) - 0.5);
  vec2 d = g / fwidth(p);
  return 1.0 - smoothstep(0.0, width, min(d.x, d.y));
}

// Height of the building occupying this cell. Zero means an empty lot, which
// is what opens the avenues the camera flies down.
float blockHeight(vec2 cell) {
  float road = step(0.5, fract(cell.x * 0.25 + 0.5)) * step(0.5, fract(cell.y * 0.2));
  if (road < 0.5) return 0.0;
  float h = hash21(cell);
  // Skyline profile: taller towers away from the centre avenue.
  return mix(0.25, 1.9, h * h) * (0.6 + 0.5 * smoothstep(1.0, 7.0, abs(cell.x)));
}

/**
 * Voxel-style city.
 *
 * DDA across a grid of building columns. Genuine perspective: the ray walks
 * cell by cell and stops at the first column tall enough to occlude it, so the
 * skyline parallaxes and the towers occlude each other correctly.
 */
vec3 city(vec3 ro, vec3 rd, out float hitDist) {
  hitDist = -1.0;
  vec3 col = vec3(0.0);

  vec2 pos = floor(ro.xz);
  vec2 step2 = sign(rd.xz);
  vec2 invDir = 1.0 / max(abs(rd.xz), vec2(1e-4));
  vec2 sideDist = (pos - ro.xz + 0.5 + step2 * 0.5) * invDir * step2;

  // Distance at which the ray entered the cell it is currently in. Testing
  // against the exit distance instead is what makes columns appear to float:
  // the ray is already past the block by the time the height is compared.
  float tEnter = 0.0;
  bool xWall = false;

  for (int i = 0; i < 42; i++) {
    float h = blockHeight(pos);
    if (h > 0.0) {
      float y = ro.y + rd.y * tEnter;
      if (y < h) {
        float t = tEnter;
        hitDist = t;
        vec3 hitP = ro + rd * t;

        // Facade. Window rows and columns, some lit, some dark.
        vec2 face = xWall ? vec2(hitP.z, hitP.y) : vec2(hitP.x, hitP.y);
        vec2 win = floor(face * vec2(6.0, 9.0));
        float lit = step(0.62, hash21(win + pos * 7.1));
        // A few windows flicker, on their own slow offset.
        lit *= step(0.15, fract(hash21(win) * 9.7 + uTime * 0.08));

        vec3 neon = mix(CYAN, ACCENT, hash21(pos * 3.7));
        col = neon * lit * 1.30;

        // Thin rim so the edges catch the sunset, and almost nothing else.
        col += neon * (xWall ? 0.03 : 0.06);
        col += VIOLET * 0.015;

        // Roof beacon on the tallest towers.
        if (h > 2.2 && abs(y - h) < 0.02) col += ACCENT * 1.4;

        // Depth haze toward the horizon.
        col = mix(col, GROUND * 0.5, smoothstep(4.0, 20.0, t));
        return col;
      }
    }
    if (sideDist.x < sideDist.y) {
      tEnter = sideDist.x; xWall = true;
      sideDist.x += invDir.x; pos.x += step2.x;
    } else {
      tEnter = sideDist.y; xWall = false;
      sideDist.y += invDir.y; pos.y += step2.y;
    }
  }
  return col;
}

/**
 * Palm silhouette. Trunk plus fronds, built from distance functions.
 *
 * A palm tree is a plant, not anyone's intellectual property. This is drawn
 * from primitives here rather than traced from any existing artwork.
 */
float palm(vec2 p, float seed) {
  // Trunk: a slightly leaning curve, thinning toward the crown.
  float lean = (hash21(vec2(seed, 3.1)) - 0.5) * 0.55;
  float x = p.x - lean * p.y * p.y;
  float trunk = smoothstep(0.020, 0.008, abs(x)) * step(0.0, p.y) * step(p.y, 1.0);

  // Crown: fronds sweeping out and drooping down from the top of the trunk.
  vec2 c = p - vec2(lean, 1.0);
  float fronds = 0.0;
  for (int i = 0; i < 7; i++) {
    float a = (float(i) / 7.0) * 6.2831 + hash21(vec2(seed, float(i))) * 0.5;
    vec2 dir = vec2(cos(a), sin(a) * 0.62);
    float len = 0.20 + hash21(vec2(seed + 1.0, float(i))) * 0.14;
    // Project onto the frond, then droop it with a quadratic sag.
    float h = clamp(dot(c, dir) / len, 0.0, 1.0);
    vec2 onFrond = dir * len * h - vec2(0.0, 0.16 * h * h);
    float w = 0.028 * (1.0 - h * 0.85);
    fronds = max(fronds, smoothstep(w, w * 0.35, length(c - onFrond)));
  }
  return clamp(trunk + fronds, 0.0, 1.0);
}

// A row of palms along the horizon, at a given parallax depth.
float palmRow(vec2 p, float depth, float spacing, float scale) {
  p.x += uTime * 0.06 / depth;
  float id = floor(p.x / spacing);
  vec2 q = vec2(p.x - (id + 0.5) * spacing, p.y);
  // Vary the height per tree so the row is not a comb.
  float s = scale * (0.75 + hash21(vec2(id, depth)) * 0.5);
  return palm(q / s, id + depth * 17.0);
}

// The sky, sun and stars. Also used as the reflection seen in the wet ground.
vec3 sky(vec3 rd, float t) {
  vec2 p = vec2(rd.x, rd.y) / max(rd.z * -1.0, 0.35);

  // Sunset ramp: violet high, magenta mid, amber at the waterline.
  vec3 col = mix(GROUND, VIOLET * 0.55, smoothstep(1.10, 0.10, p.y));
  col = mix(col, ACCENT * 0.42, smoothstep(0.55, 0.02, p.y));
  col = mix(col, AMBER * 0.30, smoothstep(0.22, -0.06, p.y));

  // Stars, only well above the horizon.
  vec2 sc = floor(p * 90.0);
  float star = step(0.995, hash21(sc)) * smoothstep(0.05, 0.5, p.y);
  col += vec3(0.8, 0.85, 1.0) * star * (0.5 + 0.5 * sin(uTime * 2.0 + hash21(sc) * 30.0));

  // Sun, with the horizontal band cuts.
  vec2 sunP = p - vec2(0.0, 0.10);
  float d = length(sunP * vec2(1.0, 1.25));
  float disc = smoothstep(0.34, 0.325, d);
  float bands = step(0.42, fract(sunP.y * 30.0 + 0.5));
  bands = mix(1.0, bands, smoothstep(0.14, -0.10, sunP.y));
  vec3 sunCol = mix(AMBER, ACCENT, smoothstep(-0.25, 0.30, sunP.y));
  col += sunCol * disc * bands * 1.25;

  // Two-stage bloom, tight core and wide haze.
  col += ACCENT * exp(-d * 4.5) * 0.35;
  col += VIOLET * exp(-d * 1.6) * 0.16;

  // Drifting cloud bands, cut into strips so they read as neon slats.
  float cl = sin(p.x * 2.4 + uTime * 0.10) * 0.5 + 0.5;
  cl *= smoothstep(0.42, 0.10, abs(p.y - 0.30));
  col += mix(VIOLET, ACCENT, cl) * cl * 0.12;

  // Two rows of palms against the sunset. The far row is hazed toward the
  // sky colour, the near row reads almost black, which is what sells depth.
  float far = palmRow(p - vec2(0.0, -0.02), 2.2, 0.62, 0.30);
  col = mix(col, mix(col, VIOLET * 0.25, 0.85), far);

  float near = palmRow(p * 0.72 - vec2(0.31, -0.06), 1.0, 0.85, 0.46);
  col = mix(col, GROUND * 0.6, near);

  return col;
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  vec2 uv = (frag - 0.5 * uResolution) / uResolution.y;

  // Camera flying down the avenue, with a slow drift and a gentle bob.
  float t = uTime;
  vec3 ro = vec3(sin(t * 0.07) * 0.6, 0.55 + sin(t * 0.23) * 0.05, -t * 1.6);

  // The pointer steers the camera. Yaw and pitch are small on purpose: this
  // should feel like the scene is aware of you, not like a flight sim.
  float yaw   =  uMouse.x * 0.22;
  float pitch = -uMouse.y * 0.12;

  vec3 rd = normalize(vec3(uv.x, uv.y + 0.06 + pitch, -1.0));
  float cy = cos(yaw), sy = sin(yaw);
  rd = vec3(rd.x * cy - rd.z * sy, rd.y, rd.x * sy + rd.z * cy);
  // Lean the camera into the turn, the way a vehicle would.
  ro.x += uMouse.x * 0.45;

  vec3 colour;

  if (rd.y < -0.002) {
    // Wet street. Grid, plus a mirrored sky so the sun streaks toward us.
    float td = (ro.y) / -rd.y;
    vec3 hit = ro + rd * td;

    vec2 cell = hit.xz * 0.6;
    float line = gridLine(cell, 1.8);
    float fade = exp(-td * 0.10);

    vec3 gridCol = mix(CYAN, ACCENT, smoothstep(0.0, 10.0, td));
    colour = gridCol * line * fade * 1.15;

    // Reflection, wobbled so the street reads as wet rather than as a mirror.
    vec3 refl = reflect(rd, vec3(0.0, 1.0, 0.0));
    refl.x += sin(hit.z * 3.0 + t * 1.4) * 0.012;
    colour += sky(refl, td) * 0.30 * fade;

    // Ambient wash and a scanline crawl over the tarmac.
    colour += VIOLET * fade * 0.10;
    colour *= 0.92 + 0.08 * sin(hit.z * 8.0 + t * 3.0);
  } else {
    colour = sky(rd, 0.0);

    float cityDist;
    vec3 buildings = city(ro, rd, cityDist);
    if (cityDist > 0.0) {
      // Buildings sit in front of the sky, keeping a little glow bleeding
      // through so the skyline stays lit from behind.
      colour = mix(colour * 0.25, colour * 0.25 + buildings, 0.95);
    }
  }

  // Neon haze pulling everything together, then vignette.
  colour += ACCENT * 0.03;
  colour *= 1.0 - 0.34 * length(uv * vec2(0.6, 0.9));

  // Exposure. The scene sits behind body copy, so it is lifted here rather
  // than by stacking another translucent panel over the top of it.
  colour *= 1.05;

  // Filmic-ish rolloff so the neon clips gracefully instead of turning white.
  colour = colour / (colour + 0.90);
  colour = pow(colour, vec3(0.80));

  // Dither, to stop the gradients banding across a wide panel.
  float dither = fract(sin(dot(frag, vec2(12.9898, 78.233))) * 43758.5453);
  colour += (dither - 0.5) / 255.0;

  outColour = vec4(colour, 1.0);
}`;

export function VicePlayground({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl2", {
      antialias: false,
      alpha: false,
      powerPreference: "low-power",
    });
    // No WebGL2, no backdrop. The page has its own background colour.
    if (!gl) return;

    const compile = (type: number, source: string) => {
      const shader = gl.createShader(type)!;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.warn("[VicePlayground]", gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    };

    const vs = compile(gl.VERTEX_SHADER, VERTEX);
    const fs = compile(gl.FRAGMENT_SHADER, FRAGMENT);
    if (!vs || !fs) return;

    const program = gl.createProgram()!;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.warn("[VicePlayground]", gl.getProgramInfoLog(program));
      return;
    }
    gl.useProgram(program);

    const uResolution = gl.getUniformLocation(program, "uResolution");
    const uTime = gl.getUniformLocation(program, "uTime");
    const uMouse = gl.getUniformLocation(program, "uMouse");

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

    /*
     * Pointer steering.
     *
     * The target is written by the listener and the smoothed value is read by
     * the render loop. Deliberately not React state: this changes on every
     * pointer move and re-rendering the tree for it would be wasteful and
     * would not survive a mid-frame update anyway.
     */
    const target = { x: 0, y: 0 };
    const smooth = { x: 0, y: 0 };

    const onPointerMove = (event: PointerEvent) => {
      // The canvas has pointer-events: none, so the listener lives on the
      // window and converts to canvas-relative coordinates itself.
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      target.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      target.y = ((event.clientY - rect.top) / rect.height) * 2 - 1;
    };

    // Touch devices have no hover, so the scene drifts on its own there.
    const onPointerLeave = () => {
      target.x = 0;
      target.y = 0;
    };

    let width = 0;
    let height = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const w = Math.floor(canvas.clientWidth * dpr);
      const h = Math.floor(canvas.clientHeight * dpr);
      if (w === width && h === height) return false;
      width = w;
      height = h;
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
      gl.uniform2f(uResolution, w, h);
      return true;
    };

    const draw = (seconds: number) => {
      // Critically damped-ish easing toward the pointer. Without it the camera
      // snaps and the movement reads as jitter rather than as weight.
      smooth.x += (target.x - smooth.x) * 0.06;
      smooth.y += (target.y - smooth.y) * 0.06;
      gl.uniform2f(uMouse, smooth.x, smooth.y);
      gl.uniform1f(uTime, seconds);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    let raf = 0;
    let running = false;
    let last = 0;
    const start = performance.now();
    const FRAME_MS = 1000 / 30;

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (now - last < FRAME_MS) return;
      last = now;
      resize();
      draw((now - start) / 1000);
    };

    const stop = () => {
      if (!running) return;
      running = false;
      cancelAnimationFrame(raf);
    };

    const play = () => {
      if (running || reduced.matches || document.hidden) return;
      running = true;
      last = 0;
      raf = requestAnimationFrame(loop);
    };

    // One static frame, so the backdrop is present even when it never animates.
    resize();
    draw(0);

    // Only run while actually on screen.
    const observer = new IntersectionObserver(
      ([entry]) => (entry.isIntersecting ? play() : stop()),
      { threshold: 0 },
    );
    observer.observe(canvas);

    const onVisibility = () => (document.hidden ? stop() : play());
    const onMotionChange = () => {
      stop();
      resize();
      draw(0);
      play();
    };
    const onResize = () => {
      if (running) return;
      if (resize()) draw(0);
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    document.addEventListener("pointerleave", onPointerLeave);
    document.addEventListener("visibilitychange", onVisibility);
    reduced.addEventListener("change", onMotionChange);
    window.addEventListener("resize", onResize);

    return () => {
      stop();
      observer.disconnect();
      window.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerleave", onPointerLeave);
      document.removeEventListener("visibilitychange", onVisibility);
      reduced.removeEventListener("change", onMotionChange);
      window.removeEventListener("resize", onResize);
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden
      className={className}
      // The scene is decorative. It must never intercept a click or a scroll.
      style={{ pointerEvents: "none", display: "block", width: "100%", height: "100%" }}
    />
  );
}
