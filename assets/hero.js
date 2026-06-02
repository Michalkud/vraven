/* ============================================================================
   VRAVEN hero — real volumetric god-rays in a hand-written WebGL shader.
   The beam streams from the upper-right corner and pools on the name; the
   wordmark itself is crisp HTML (Clash Display) lit on top. Light arrives
   first, then the CSS ignites VRA/VEN right-to-left (see tokens.css).

   Degrades gracefully: no WebGL / prefers-reduced-motion / low-power -> the
   CSS fallback beam (body.no-webgl) and a static (non-animated) final state.

   Exposes window.VRAVEN.hero = { replay(), skip() } for the Skip/Replay UI.
   ============================================================================ */
(function () {
  "use strict";

  var REDUCE = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var canvas = document.querySelector(".hero-gl");
  var hero = document.getElementById("hero");
  if (!hero) return;

  // ---- capability gate ----------------------------------------------------
  var gl = null;
  function getGL() {
    if (!canvas) return null;
    var opts = { alpha: false, antialias: false, premultipliedAlpha: false, powerPreference: "high-performance" };
    return canvas.getContext("webgl", opts) || canvas.getContext("experimental-webgl", opts);
  }
  var lowPower = navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2;
  if (!REDUCE && !lowPower) { try { gl = getGL(); } catch (e) { gl = null; } }

  if (!gl) {
    // Fallback path: CSS beam, and (unless reduced-motion) still play the
    // letter ignite so the name reveals.
    document.body.classList.add("no-webgl");
    setupFallbackIntro();
    return;
  }

  // ---- shaders ------------------------------------------------------------
  var VERT = [
    "attribute vec2 p;",
    "void main(){ gl_Position = vec4(p, 0.0, 1.0); }"
  ].join("\n");

  var FRAG = [
    "precision highp float;",
    "uniform vec2  uRes;",
    "uniform float uTime;",
    "uniform float uIntro;",   // 0..1 light-arrival envelope
    "",
    "float hash(vec2 q){ return fract(sin(dot(q, vec2(127.1, 311.7))) * 43758.5453); }",
    "float vnoise(vec2 q){",
    "  vec2 i = floor(q), f = fract(q);",
    "  float a = hash(i), b = hash(i + vec2(1.0,0.0));",
    "  float c = hash(i + vec2(0.0,1.0)), d = hash(i + vec2(1.0,1.0));",
    "  vec2 u = f*f*(3.0 - 2.0*f);",
    "  return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);",
    "}",
    "float fbm(vec2 q){",
    "  float s = 0.0, a = 0.5;",
    "  for(int i=0;i<5;i++){ s += a*vnoise(q); q = q*2.02 + 7.0; a *= 0.5; }",
    "  return s;",
    "}",
    "",
    // density of luminous medium at p (aspect space) for the ray march
    "float density(vec2 p, vec2 src, float t){",
    "  float dist = length(p - src);",
    "  float core = exp(-dist*1.6);",                       // glow toward source
    "  vec2 dir = normalize(p - src + 1e-4);",
    "  float ang = atan(dir.y, dir.x);",
    // shafts: streaks that vary by angle + slow drift, modulated by dust fbm
    "  float shafts = 0.5 + 0.5*sin(ang*30.0 + fbm(p*1.6 + t*0.04)*7.0);",
    "  shafts = pow(shafts, 2.2);",
    "  float dust = fbm(p*2.4 + vec2(t*0.05, -t*0.03));",
    "  return core * (0.35 + 0.65*shafts) * (0.4 + 0.7*dust);",
    "}",
    "",
    "void main(){",
    "  vec2 uv = gl_FragCoord.xy / uRes.xy;",
    "  vec2 asp = vec2(uRes.x/uRes.y, 1.0);",
    "  vec2 p = uv * asp;",
    "  vec2 src = vec2(1.06, 1.03) * asp;",                 // just OFF the upper-right corner
    "",
    // ---- volumetric march toward the source (screen-space scattering) ----
    "  const int N = 32;",
    "  vec2 delta = (src - p) / float(N);",
    "  float dither = hash(gl_FragCoord.xy + uTime);",
    "  vec2 sp = p + delta * dither;",
    "  float illum = 0.0; float w = 1.0;",
    "  for(int i=0;i<N;i++){",
    "    illum += density(sp, src, uTime) * w;",
    "    w *= 0.94;",
    "    sp += delta;",
    "  }",
    "  illum /= float(N);",
    "  vec2 beamDir = normalize(vec2(0.5,0.5)*asp - src);",
    "  float cone = smoothstep(0.40, 0.96, dot(normalize(p - src + 1e-4), beamDir));",
    "  float ds0 = length(p - src);",
    "  illum = illum * cone * exp(-ds0 * 1.2) * 1.6;",
    "",
    // ---- direct source bloom ----
    "  float ds = length(p - src);",
    "  float bloom = exp(-ds*ds*10.0) * 0.4 + exp(-ds*ds*70.0) * 0.5;",
    "",
    // ---- warm pool where the name sits (centre, slightly high) ----
    "  vec2 pc = (uv - vec2(0.5, 0.54)) * asp;",
    "  float pool = exp(-dot(pc,pc)*6.5) * 0.42;",
    "",
    "  float L = illum + bloom + pool;",
    "",
    // ---- warm colour grade: gold core -> orange edge over near-black ----
    "  vec3 base = vec3(0.039, 0.039, 0.059);",            // --bg-0
    "  vec3 gold = vec3(1.0, 0.77, 0.43);",
    "  vec3 hot  = vec3(1.0, 0.95, 0.87);",
    "  vec3 warm = mix(gold, hot, smoothstep(0.5, 1.4, L));",
    "  vec3 lcol = warm * L; lcol = lcol / (lcol + 0.6);",
    "  vec3 col = base + lcol;",
    "",
    // ---- intro envelope: light sweeps in from the source side ----
    "  float reach = mix(0.15, 1.6, uIntro);",
    "  float arrive = smoothstep(reach+0.05, reach-0.55, ds);", // brighter near source first
    "  col = base + (col - base) * mix(0.0, 1.0, clamp(arrive + uIntro*0.15, 0.0, 1.0));",
    "",
    // gentle filmic-ish tone + faint grain to kill banding",
    "  col += (hash(gl_FragCoord.xy*1.3 + uTime) - 0.5) * 0.012;",
    "  gl_FragColor = vec4(col, 1.0);",
    "}"
  ].join("\n");

  function compile(type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error("VRAVEN shader:", gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  }
  var vs = compile(gl.VERTEX_SHADER, VERT);
  var fs = compile(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) { document.body.classList.add("no-webgl"); setupFallbackIntro(); return; }

  var prog = gl.createProgram();
  gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.error("VRAVEN link:", gl.getProgramInfoLog(prog));
    document.body.classList.add("no-webgl"); setupFallbackIntro(); return;
  }
  gl.useProgram(prog);

  var buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
  var aP = gl.getAttribLocation(prog, "p");
  gl.enableVertexAttribArray(aP);
  gl.vertexAttribPointer(aP, 2, gl.FLOAT, false, 0, 0);

  var uRes = gl.getUniformLocation(prog, "uRes");
  var uTime = gl.getUniformLocation(prog, "uTime");
  var uIntro = gl.getUniformLocation(prog, "uIntro");

  // ---- sizing -------------------------------------------------------------
  var DPR = Math.min(window.devicePixelRatio || 1, 2);
  function resize() {
    var w = Math.floor(hero.clientWidth * DPR);
    var h = Math.floor(hero.clientHeight * DPR);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w; canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
    gl.uniform2f(uRes, canvas.width, canvas.height);
  }
  window.addEventListener("resize", resize);
  resize();

  // ---- intro state + loop -------------------------------------------------
  var INTRO_MS = 1700;
  var startT = null;     // wall clock origin (driven by rAF timestamps)
  var introT = 0;        // ms into the intro
  var running = true;
  var introDone = false;
  var visible = true;

  function easeOutCubic(x) { return 1 - Math.pow(1 - x, 3); }

  function frame(ts) {
    if (!running) return;
    if (startT === null) startT = ts;
    var elapsed = ts - startT;
    introT = elapsed;
    var intro = REDUCE ? 1 : Math.min(introT / INTRO_MS, 1);
    gl.uniform1f(uIntro, easeOutCubic(intro));
    gl.uniform1f(uTime, elapsed / 1000);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    if (!introDone && intro >= 1) introDone = true;
    // keep animating for the living shaft drift; throttle handled by visibility
    if (visible) requestAnimationFrame(frame);
    else running = false;
  }

  function start() {
    if (!running) { running = true; }
    if (startT !== null) { /* relative restart */ }
    requestAnimationFrame(frame);
  }

  // pause when hero is scrolled away (battery / GPU)
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      if (visible && !running) { running = true; requestAnimationFrame(frame); }
    }, { threshold: 0.01 }).observe(hero);
  }

  // ---- letter ignite + controls ------------------------------------------
  function playLetters() {
    if (REDUCE) return;            // letters rest in final state
    var r = document.documentElement;
    r.classList.remove("intro");
    void r.offsetWidth;            // reflow to restart CSS animations
    r.classList.add("intro");
  }

  function replay() {
    startT = null; introT = 0; introDone = false;
    if (!running) { running = true; requestAnimationFrame(frame); }
    playLetters();
  }
  function skip() {
    // jump light + letters to final
    startT = -1e9; // forces intro>=1 next frame (elapsed huge)
    gl.uniform1f(uIntro, 1);
    document.documentElement.classList.remove("intro");
    if (!running) { running = true; requestAnimationFrame(frame); }
  }

  // boot — html.intro is already set pre-paint by the head script (when motion
  // is allowed); ensure it for the WebGL path too.
  if (!REDUCE) document.documentElement.classList.add("intro");
  start();
  // when the contact/last letter has lit, CSS just rests; nothing to do.

  window.VRAVEN = window.VRAVEN || {};
  window.VRAVEN.hero = { replay: replay, skip: skip };

  // ---- fallback intro (no WebGL) -----------------------------------------
  function setupFallbackIntro() {
    var r = document.documentElement;
    if (REDUCE) return;
    r.classList.add("intro");
    window.VRAVEN = window.VRAVEN || {};
    window.VRAVEN.hero = {
      replay: function () { r.classList.remove("intro"); void r.offsetWidth; r.classList.add("intro"); },
      skip: function () { r.classList.remove("intro"); }
    };
  }
})();
