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

// Pastel dusk ramp, sampled from the horizon upward.
const vec3 SKY_AMBER = vec3(1.000, 0.808, 0.510);
const vec3 SKY_CORAL = vec3(0.988, 0.596, 0.522);
const vec3 SKY_PINK  = vec3(0.902, 0.541, 0.702);
const vec3 SKY_LILAC = vec3(0.647, 0.514, 0.812);
const vec3 SKY_BLUE  = vec3(0.416, 0.494, 0.729);
const vec3 SUN_CORE  = vec3(1.000, 0.914, 0.706);
const vec3 CLOUD_LIT = vec3(1.000, 0.741, 0.686);
const vec3 CLOUD_COOL= vec3(0.612, 0.494, 0.702);
const vec3 BIRD      = vec3(0.290, 0.220, 0.380);
// Palms recede toward the sky colour rather than toward black.
const vec3 PALM_FAR  = vec3(0.612, 0.482, 0.706);
const vec3 PALM_MID  = vec3(0.404, 0.278, 0.518);
const vec3 PALM_NEAR = vec3(0.216, 0.129, 0.302);

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

// Value noise, smoothstep-interpolated so the derivative is continuous.
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

/**
 * Fractal brownian motion. Five octaves is where the cloud edges stop reading
 * as noise and start reading as weather; a sixth costs frames and adds detail
 * nobody sees behind a headline.
 */
float fbm(vec2 p) {
  float sum = 0.0;
  float amp = 0.5;
  // Rotate between octaves so the layers do not line up into a visible grid.
  mat2 rot = mat2(0.80, 0.60, -0.60, 0.80);
  for (int i = 0; i < 5; i++) {
    sum += amp * noise(p);
    p = rot * p * 2.02;
    amp *= 0.5;
  }
  return sum;
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
  return mix(0.30, 2.8, h * h) * (0.6 + 0.5 * smoothstep(1.0, 7.0, abs(cell.x)));
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
        vec2 win = floor(face * vec2(11.0, 16.0));
        float lit = step(0.74, hash21(win + pos * 7.1));
        // A few windows flicker, on their own slow offset.
        lit *= step(0.15, fract(hash21(win) * 9.7 + uTime * 0.08));

        // Facade in the palm range, the sunlit side a shade warmer.
        col = mix(PALM_MID, PALM_FAR, xWall ? 0.55 : 0.30);

        // Warm interior lights, and a cooler neon sign on a few blocks.
        vec3 lamp = mix(vec3(1.00, 0.82, 0.52), ACCENT, step(0.82, hash21(pos * 3.7)));
        col += lamp * lit * 0.55;

        // Rooftop edge catching the last of the sun.
        if (abs(y - h) < 0.015) col += SUN_CORE * 0.30;

        // Aerial perspective. Distant blocks wash out toward the sky rather
        // than toward black, which is what makes the haze read as air.
        col = mix(col, SKY_PINK * 0.92, smoothstep(6.0, 44.0, t));
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

// The sky, sun and clouds. Also used as the reflection seen in the wet street.
vec3 sky(vec3 rd, float t) {
  vec2 p = vec2(rd.x, rd.y) / max(rd.z * -1.0, 0.35);

  /*
   * Pastel dusk ramp, bottom to top: warm amber at the waterline, coral, then
   * pink, lilac, and a cool blue at the top of the frame. This is the palette
   * every Florida-at-sunset illustration lands on, and it is the reason the
   * scene reads as evening rather than as a neon nightclub.
   */
  vec3 col = SKY_AMBER;
  col = mix(col, SKY_CORAL,  smoothstep(-0.10, 0.16, p.y));
  col = mix(col, SKY_PINK,   smoothstep( 0.08, 0.38, p.y));
  col = mix(col, SKY_LILAC,  smoothstep( 0.30, 0.70, p.y));
  col = mix(col, SKY_BLUE,   smoothstep( 0.60, 1.15, p.y));

  // Sun. Low, large and soft, sitting just above the horizon line.
  vec2 sunP = p - vec2(0.0, 0.015);
  float d = length(sunP * vec2(1.0, 1.15));
  col += SUN_CORE * smoothstep(0.30, 0.26, d) * 0.85;
  // Two-stage bloom: a tight halo and a wide wash across the whole sky.
  col += SUN_CORE * exp(-d * 5.0) * 0.45;
  col += SKY_CORAL * exp(-d * 1.5) * 0.30;

  /*
   * Clouds. Stretched horizontally so they band the way real dusk cloud does,
   * lit from below by the sun and cooling toward the top of the frame. The
   * drift is slow enough that it registers as weather, not as a scrolling
   * texture.
   */
  vec2 cp = vec2(p.x * 1.4 + uTime * 0.020, p.y * 3.6 - uTime * 0.004);
  float cloud = fbm(cp * 2.0);
  // Bias the coverage so the sky is not uniformly overcast.
  cloud = smoothstep(0.42, 0.86, cloud);
  // Thin the cloud out at the very bottom so it does not fog the horizon.
  cloud *= smoothstep(-0.06, 0.14, p.y) * smoothstep(1.30, 0.55, p.y);

  // Underlit near the sun, cool and violet away from it.
  vec3 cloudCol = mix(CLOUD_COOL, CLOUD_LIT, exp(-d * 1.9));
  col = mix(col, cloudCol, cloud * 0.72);

  // A brighter rim where the sun catches the underside of the cloud bank.
  float rim = smoothstep(0.55, 0.90, fbm(cp * 2.0 + vec2(0.0, 0.35)));
  col += SUN_CORE * rim * cloud * exp(-d * 2.2) * 0.35;

  // Birds. Three of them, far off, because an empty sky reads as unfinished.
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    vec2 bp = p - vec2(-0.42 + fi * 0.11 + sin(uTime * 0.05 + fi) * 0.02,
                        0.44 + fi * 0.045 + sin(uTime * 0.7 + fi * 2.0) * 0.006);
    // A shallow V, drawn as distance to two mirrored segments.
    float wing = abs(bp.y * 3.0) - abs(bp.x) * 0.9;
    float bird = smoothstep(0.010, 0.002, abs(wing)) * step(abs(bp.x), 0.016);
    col = mix(col, BIRD, bird * 0.55);
  }

  // Ferris wheel on the far right of the waterfront. Rim, hub and spokes,
  // turning slowly. One landmark is enough to stop a skyline reading as
  // anonymous massing.
  {
    vec2 w = (p - vec2(0.55, 0.085)) * vec2(1.0, 1.0);
    float d = length(w);
    float rim = smoothstep(0.004, 0.001, abs(d - 0.055));
    float spokes = 0.0;
    if (d < 0.058) {
      float a = atan(w.y, w.x) + uTime * 0.06;
      // Twelve spokes: fract of the angle over the spacing, folded to a ridge.
      float f = abs(fract(a * 12.0 / 6.2831) - 0.5) * 2.0;
      spokes = smoothstep(0.92, 1.0, f);
    }
    float wheel = clamp(rim + spokes * 0.55, 0.0, 1.0);
    col = mix(col, PALM_MID, wheel * 0.75);
    // Rim lights, because a wheel at dusk is lit.
    col += ACCENT * rim * 0.35;
  }

  // Palms. Three depths: hazed at the back, near-solid at the front. The
  // parallax between the rows is what gives the horizon its depth.
  float back = palmRow(p * 1.25 - vec2(0.10, -0.02), 2.6, 0.58, 0.26);
  col = mix(col, mix(col, PALM_FAR, 0.72), back);

  float mid = palmRow(p * 0.95 - vec2(0.44, -0.05), 1.7, 0.78, 0.40);
  col = mix(col, PALM_MID, mid * 0.88);

  float front = palmRow(p * 0.58 - vec2(0.34, -0.13), 1.0, 1.55, 0.78);
  col = mix(col, PALM_NEAR, front);

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

    // Wet asphalt, tinted by the sky it is reflecting.
    colour = mix(vec3(0.14, 0.10, 0.19), vec3(0.30, 0.20, 0.34), fade);
    vec3 gridCol = mix(SKY_AMBER, ACCENT, smoothstep(0.0, 9.0, td));
    colour += gridCol * line * fade * 0.55;

    // Reflection, wobbled so the street reads as wet rather than as a mirror.
    vec3 refl = reflect(rd, vec3(0.0, 1.0, 0.0));
    refl.x += sin(hit.z * 3.0 + t * 1.4) * 0.012;
    colour += sky(refl, td) * 0.55 * fade;

    // Ambient wash from the sky bouncing off the road.
    colour += SKY_CORAL * fade * 0.10;
    colour *= 0.92 + 0.08 * sin(hit.z * 8.0 + t * 3.0);
  } else {
    colour = sky(rd, 0.0);

    float cityDist;
    vec3 buildings = city(ro * 3.4, rd, cityDist);
    if (cityDist > 0.0) {
      // Buildings sit in front of the sky, keeping a little glow bleeding
      // through so the skyline stays lit from behind.
      colour = buildings;
    }
  }

  // Neon haze pulling everything together, then vignette.
  colour += SKY_CORAL * 0.015;
  colour *= 1.0 - 0.26 * length(uv * vec2(0.6, 0.9));

  // Exposure. The scene sits behind body copy, so it is lifted here rather
  // than by stacking another translucent panel over the top of it.
  colour *= 1.02;

  // Filmic-ish rolloff so the neon clips gracefully instead of turning white.
  // Gentle shoulder only. A hard tonemap turns pastels chalky.
  colour = colour / (colour + 1.35) * 1.85;
  colour = pow(colour, vec3(0.95));

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
