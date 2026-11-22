// Canvas rendering and export engine, extracted from the original editor.
// UI state is observable; React owns controls, the engine owns only canvas thumbnails.
export function createStudio() {
  const subscribers = new Set();
  let ready = false,
    current = null,
    animationId = 0,
    galleryObserver = null,
    messageTimer;
  const lifecycle = new AbortController();
  const motionPreference = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  );
  let galleryDirty = true;
  const listen = (target, type, handler) =>
    target.addEventListener(type, handler, { signal: lifecycle.signal });
  const ui = {
    modal: null,
    code: "",
    codeMeta: "",
    gifUrl: "",
    gifMeta: "",
    gifBusy: false,
    gifProgress: 0,
    message: "",
  };

  /* =====================================================================
   Utilities
   ===================================================================== */
  const TAU = Math.PI * 2;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const frac = (x) => x - Math.floor(x);
  function hash(n) {
    let x = (Math.imul(n | 0, 374761393) + 668265263) | 0;
    x = Math.imul(x ^ (x >>> 13), 1274126177);
    x ^= x >>> 16;
    return (x >>> 0) / 4294967296;
  }
  const HEX_RE = /^#[0-9a-f]{6}$/i;
  const hexToRgb = (h) => {
    const n = parseInt(h.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const rgbToHex = (c) =>
    "#" + c.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
  const mixRgb = (a, b, t) => [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
  const lum = (c) => (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255;
  let dpr = Math.min(window.devicePixelRatio || 1, 2);

  const ICONS = {
    dots: '<g fill="currentColor" stroke="none"><circle cx="5" cy="5" r="2"/><circle cx="12" cy="5" r="2"/><circle cx="19" cy="5" r="2" opacity=".4"/><circle cx="5" cy="12" r="2" opacity=".4"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/><circle cx="5" cy="19" r="2"/><circle cx="12" cy="19" r="2" opacity=".4"/><circle cx="19" cy="19" r="2"/></g>',
    film: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M7 3v18M17 3v18M3 7.5h4M3 12h18M3 16.5h4M17 7.5h4M17 16.5h4"/>',
    undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
    redo: '<path d="m15 14 5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>',
    code: '<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>',
    download:
      '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>',
    upload:
      '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/>',
    play: '<polygon points="7 4 19 12 7 20 7 4" fill="currentColor"/>',
    pause:
      '<rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor"/><rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor"/>',
    prev: '<polygon points="19 20 9 12 19 4 19 20"/><line x1="5" x2="5" y1="19" y2="5"/>',
    next: '<polygon points="5 4 15 12 5 20 5 4"/><line x1="19" x2="19" y1="5" y2="19"/>',
    plus: '<path d="M5 12h14M12 5v14"/>',
    copy: '<rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
    trash:
      '<path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
    left: '<path d="m15 18-6-6 6-6"/>',
    right: '<path d="m9 18 6-6-6-6"/>',
    up: '<path d="m18 15-6-6-6 6"/>',
    down: '<path d="m6 9 6 6 6-6"/>',
    pen: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
    eraser:
      '<path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"/><path d="M22 21H7M5 11l9 9"/>',
    bucket:
      '<path d="m19 11-8-8-8.6 8.6a2 2 0 0 0 0 2.8l5.2 5.2c.8.8 2 .8 2.8 0L19 11Z"/><path d="m5 2 5 5M2 13h15"/><path d="M22 20a2 2 0 1 1-4 0c0-1.6 1.7-2.4 2-4 .3 1.6 2 2.4 2 4Z"/>',
    layers:
      '<path d="m12 2 10 5-10 5L2 7l10-5Z"/><path d="m2 17 10 5 10-5M2 12l10 5 10-5"/>',
    invert:
      '<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor"/>',
    wand: '<path d="m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72"/><path d="m14 7 3 3M5 6v4M19 14v4M10 2v2M7 8H3M21 16h-4M11 3H9"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    shuffle:
      '<path d="M2 18h1.4c1.3 0 2.5-.6 3.3-1.7l6.1-8.6c.7-1.1 2-1.7 3.3-1.7H22"/><path d="m18 2 4 4-4 4M2 6h1.9c1.5 0 2.9.9 3.6 2.2M22 18h-5.9c-1.3 0-2.6-.7-3.3-1.8l-.5-.8M18 14l4 4-4 4"/>',
  };
  const svgIcon = (name) =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ""}</svg>`;
  function paintIcons(root = document) {
    $$("i[data-icon]", root).forEach((el) => {
      el.innerHTML = svgIcon(el.dataset.icon);
      el.setAttribute("aria-hidden", "true");
    });
  }

  /* =====================================================================
   Shapes
   ===================================================================== */
  const SHAPES = {
    circle: "圆形",
    rounded: "圆角",
    square: "方形",
    diamond: "菱形",
    ring: "圆环",
    plus: "十字",
    hex: "六边形",
  };
  const POLY = {
    diamond: [
      [0.5, 0],
      [1, 0.5],
      [0.5, 1],
      [0, 0.5],
    ],
    plus: [
      [0.34, 0],
      [0.66, 0],
      [0.66, 0.34],
      [1, 0.34],
      [1, 0.66],
      [0.66, 0.66],
      [0.66, 1],
      [0.34, 1],
      [0.34, 0.66],
      [0, 0.66],
      [0, 0.34],
      [0.34, 0.34],
    ],
    hex: [
      [0.25, 0.067],
      [0.75, 0.067],
      [1, 0.5],
      [0.75, 0.933],
      [0.25, 0.933],
      [0, 0.5],
    ],
  };
  function roundRectPath(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function shapePath(ctx, shape, x, y, s) {
    const h = s / 2;
    ctx.beginPath();
    if (shape === "circle") ctx.arc(x, y, h, 0, TAU);
    else if (shape === "ring")
      ctx.arc(x, y, Math.max(0.1, h - s * 0.12), 0, TAU);
    else if (shape === "square") ctx.rect(x - h, y - h, s, s);
    else if (shape === "rounded")
      roundRectPath(ctx, x - h, y - h, s, s, s * 0.28);
    else {
      const p = POLY[shape];
      ctx.moveTo(x - h + p[0][0] * s, y - h + p[0][1] * s);
      for (let k = 1; k < p.length; k++)
        ctx.lineTo(x - h + p[k][0] * s, y - h + p[k][1] * s);
      ctx.closePath();
    }
  }
  function shapeSvg(shape) {
    if (shape === "circle")
      return '<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="6.5" fill="currentColor"/></svg>';
    if (shape === "ring")
      return '<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="5.3" fill="none" stroke="currentColor" stroke-width="2.6"/></svg>';
    if (shape === "square")
      return '<svg viewBox="0 0 16 16"><rect x="2" y="2" width="12" height="12" fill="currentColor"/></svg>';
    if (shape === "rounded")
      return '<svg viewBox="0 0 16 16"><rect x="1.5" y="1.5" width="13" height="13" rx="3.6" fill="currentColor"/></svg>';
    const pts = POLY[shape]
      .map(
        ([x, y]) => `${(1.5 + x * 13).toFixed(2)},${(1.5 + y * 13).toFixed(2)}`,
      )
      .join(" ");
    return `<svg viewBox="0 0 16 16"><polygon points="${pts}" fill="currentColor"/></svg>`;
  }

  /* =====================================================================
   Preset animations — fn(cell, phase 0..1, grid) → brightness 0..1
   ===================================================================== */
  const pulse = (x, k = 2.4) => Math.pow(0.5 + 0.5 * Math.cos(TAU * x), k);
  const tail = (u, len) => {
    u = frac(u);
    return u < len ? Math.pow(1 - u / len, 1.6) : 0;
  };
  const PRESETS = [
    { id: "ripple", name: "涟漪", fn: (c, p) => pulse(p - c.d * 0.8, 2.2) },
    {
      id: "breathe",
      name: "呼吸",
      fn: (c, p) => 0.06 + 0.94 * (0.5 - 0.5 * Math.cos(TAU * p)),
    },
    { id: "wave", name: "波浪", fn: (c, p) => pulse(p - c.nx * 0.75, 2) },
    {
      id: "diagonal",
      name: "斜扫",
      fn: (c, p) => pulse(p - (c.nx + c.ny) * 0.4, 2.4),
    },
    { id: "radar", name: "雷达", fn: (c, p) => tail(p - c.a, 0.5) },
    { id: "spiral", name: "螺旋", fn: (c, p) => tail(p - c.rs, 0.3) },
    { id: "snake", name: "贪吃蛇", fn: (c, p) => tail(p - c.rk, 0.28) },
    {
      id: "fill",
      name: "进度条",
      fn: (c, p, g) => {
        const n = g.count + 1,
          k = c.rr * g.count;
        if (p < 0.5) return clamp(p * 2 * n - k, 0, 1);
        return 1 - clamp((p - 0.5) * 2 * n - k, 0, 1);
      },
    },
    {
      id: "twinkle",
      name: "星光",
      fn: (c, p) => Math.max(tail(p - c.h, 0.3), tail(p - c.h2, 0.3) * 0.6),
    },
    {
      id: "rain",
      name: "雨滴",
      fn: (c, p) => {
        const head = frac(p + c.hc) * 1.7 - 0.1,
          diff = head - c.ny;
        return diff >= 0 && diff < 0.6 ? Math.pow(1 - diff / 0.6, 1.5) : 0;
      },
    },
    {
      id: "equalizer",
      name: "均衡器",
      fn: (c, p, g) => {
        const k = 1 + Math.floor(c.hc * 2);
        const h = 0.15 + 0.85 * (0.5 + 0.5 * Math.sin(TAU * (p * k + c.hc)));
        return clamp(h * g.rows - (g.rows - 1 - c.y), 0, 1);
      },
    },
    {
      id: "bounce",
      name: "弹跳",
      fn: (c, p, g) => {
        const hgt = Math.abs(Math.sin(Math.PI * (2 * p - c.nx * 0.9)));
        const by = (g.rows - 1) * (1 - hgt);
        return Math.pow(clamp(1 - Math.abs(c.y - by), 0, 1), 1.2);
      },
    },
    {
      id: "scan",
      name: "扫描",
      fn: (c, p, g) => {
        const pos = (0.5 - 0.5 * Math.cos(TAU * p)) * (g.rows - 1);
        return Math.pow(clamp(1 - Math.abs(c.y - pos) / 1.3, 0, 1), 1.3);
      },
    },
    {
      id: "windmill",
      name: "风车",
      fn: (c, p) => {
        const th = Math.PI * p,
          dist = Math.abs(-Math.sin(th) * c.cx + Math.cos(th) * c.cy);
        return Math.pow(clamp(1 - dist / 0.9, 0, 1), 1.4);
      },
    },
    {
      id: "diamond",
      name: "菱形扩散",
      fn: (c, p) => pulse(p - c.m * 0.8, 2.4),
    },
    {
      id: "checker",
      name: "棋盘",
      fn: (c, p) => pulse(p + ((c.x + c.y) & 1) * 0.5, 1.5),
    },
    {
      id: "heartbeat",
      name: "心跳",
      fn: (c, p) => {
        const t = frac(p - c.d * 0.12);
        return Math.min(
          1,
          Math.exp(-(((t - 0.08) / 0.05) ** 2)) +
            0.75 * Math.exp(-(((t - 0.26) / 0.06) ** 2)),
        );
      },
    },
    {
      id: "stagger",
      name: "交错",
      fn: (c, p) => pulse(p - (c.y % 2 ? 1 - c.nx : c.nx) * 0.6, 2.4),
    },
    {
      id: "noise",
      name: "噪点",
      fn: (c, p) => {
        const steps = 10,
          t = p * steps,
          k = Math.floor(t),
          f = t - k,
          e = f * f * (3 - 2 * f);
        const a = hash(c.i * 131 + (k % steps)),
          b = hash(c.i * 131 + ((k + 1) % steps));
        const v = a + (b - a) * e;
        return v > 0.5 ? (v - 0.5) / 0.5 : 0;
      },
    },
  ];
  const PRESET_MAP = Object.fromEntries(PRESETS.map((p) => [p.id, p]));

  /* =====================================================================
   State
   ===================================================================== */
  const STORE = "dot-loader-studio:v1";
  const DEFAULTS = {
    mode: "pattern",
    cols: 5,
    rows: 5,
    shape: "circle",
    dotSize: 12,
    gap: 6,
    colorMode: "solid",
    colorA: "#e4e4e7",
    colorB: "#22d3ee",
    gradDir: "diagonal",
    bg: "#0b0b0f",
    base: 0.12,
    glow: false,
    scaleFx: false,
    hideOff: false,
    preset: "ripple",
    duration: 1600,
    reverse: false,
    mask: null,
    frames: null,
    frameMs: 100,
    cur: 0,
    onion: true,
    tool: "pen",
    brush: 1,
    genPreset: "radar",
    genCount: 12,
    previewTheme: "dark",
    codeTab: "react",
    gifScale: 2,
    gifTransparent: false,
    brailleThreshold: 0.5,
  };
  let S = structuredClone(DEFAULTS);
  const play = { pattern: true, sequence: false };

  function applyProject(o) {
    if (!o || typeof o !== "object") throw new Error("无效的项目文件");
    for (const k in DEFAULTS) {
      if (!(k in o) || o[k] == null) continue;
      if (DEFAULTS[k] === null || typeof o[k] === typeof DEFAULTS[k])
        S[k] = o[k];
    }
    S.cols = clamp(S.cols | 0 || 5, 1, 16);
    S.rows = clamp(S.rows | 0 || 5, 1, 16);
    for (const k of ["colorA", "colorB", "bg"])
      if (!HEX_RE.test(S[k])) S[k] = DEFAULTS[k];
    if (!SHAPES[S.shape]) S.shape = "circle";
    if (!PRESET_MAP[S.preset]) S.preset = "ripple";
    if (!PRESET_MAP[S.genPreset]) S.genPreset = "radar";
    if (!["pattern", "sequence"].includes(S.mode)) S.mode = "pattern";
    const n = S.cols * S.rows;
    S.mask =
      Array.isArray(S.mask) && S.mask.length === n
        ? S.mask.map((v) => (v ? 1 : 0))
        : new Array(n).fill(1);
    if (
      !Array.isArray(S.frames) ||
      !S.frames.length ||
      S.frames.some((f) => !Array.isArray(f) || f.length !== n)
    )
      S.frames = null;
    else S.frames = S.frames.map((f) => f.map((v) => clamp(+v || 0, 0, 1)));
    G = null;
  }
  let saveTimer;
  function save() {
    notify();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try {
        localStorage.setItem(STORE, JSON.stringify(S));
      } catch (e) {}
    }, 250);
  }

  /* history (content edits only) */
  const hist = { past: [], future: [] };
  const snapshot = () =>
    JSON.stringify({
      cols: S.cols,
      rows: S.rows,
      mask: S.mask,
      frames: S.frames,
      cur: S.cur,
    });
  function pushHistory() {
    hist.past.push(snapshot());
    if (hist.past.length > 150) hist.past.shift();
    hist.future = [];
    updateUndoUI();
  }
  function restore(json) {
    const o = JSON.parse(json);
    Object.assign(S, o);
    S.cur = clamp(S.cur, 0, S.frames.length - 1);
    G = null;
    renderStrip(true);
    syncUI();
    save();
  }
  function undo() {
    if (!hist.past.length) return;
    hist.future.push(snapshot());
    restore(hist.past.pop());
  }
  function redo() {
    if (!hist.future.length) return;
    hist.past.push(snapshot());
    restore(hist.future.pop());
  }
  function updateUndoUI() {
    notify();
  }

  /* =====================================================================
   Geometry cache
   ===================================================================== */
  let G = null;
  function spiralOrder(c, r) {
    const out = [];
    let t = 0,
      b = r - 1,
      l = 0,
      rt = c - 1;
    while (t <= b && l <= rt) {
      for (let x = l; x <= rt; x++) out.push(t * c + x);
      for (let y = t + 1; y <= b; y++) out.push(y * c + rt);
      if (t < b) for (let x = rt - 1; x >= l; x--) out.push(b * c + x);
      if (l < rt) for (let y = b - 1; y > t; y--) out.push(y * c + l);
      t++;
      b--;
      l++;
      rt--;
    }
    return out;
  }
  function geom() {
    if (G && G.cols === S.cols && G.rows === S.rows) return G;
    const { cols, rows, mask } = S,
      n = cols * rows,
      hx = (cols - 1) / 2,
      hy = (rows - 1) / 2;
    const maxD = Math.hypot(hx, hy) || 1,
      maxM = hx + hy || 1;
    const cells = [];
    for (let i = 0; i < n; i++) {
      const x = i % cols,
        y = (i / cols) | 0,
        cx = x - hx,
        cy = y - hy;
      cells.push({
        i,
        x,
        y,
        cx,
        cy,
        d: Math.hypot(cx, cy) / maxD,
        m: (Math.abs(cx) + Math.abs(cy)) / maxM,
        a: frac(Math.atan2(cx, -cy) / TAU),
        nx: cols > 1 ? x / (cols - 1) : 0.5,
        ny: rows > 1 ? y / (rows - 1) : 0.5,
        h: hash(i * 7 + 1),
        h2: hash(i * 13 + 5),
        hc: hash(x * 31 + 7),
        rr: 0,
        rk: 0,
        rs: 0,
      });
    }
    const count = mask.reduce((a, v) => a + (v ? 1 : 0), 0);
    const rank = (order, key) => {
      let k = 0;
      for (const i of order)
        if (mask[i]) {
          cells[i][key] = count ? k / count : 0;
          k++;
        }
    };
    const snake = [];
    for (let y = 0; y < rows; y++)
      for (let k = 0; k < cols; k++)
        snake.push(y * cols + (y % 2 ? cols - 1 - k : k));
    rank([...Array(n).keys()], "rr");
    rank(snake, "rk");
    rank(spiralOrder(cols, rows), "rs");
    G = { cells, count, cols, rows };
    return G;
  }

  /* =====================================================================
   Frame values: -1 = hidden, 0..1 = brightness
   ===================================================================== */
  function patternVals(p, id = S.preset, out) {
    const g = geom(),
      n = g.cells.length;
    if (!out || out.length !== n) out = new Float32Array(n);
    const fn = PRESET_MAP[id].fn,
      pp = frac(S.reverse ? 1 - p : p);
    for (let i = 0; i < n; i++) {
      if (!S.mask[i]) {
        out[i] = S.hideOff ? -1 : 0;
        continue;
      }
      const v = fn(g.cells[i], pp, g);
      out[i] = v > 0 ? (v < 1 ? v : 1) : 0;
    }
    return out;
  }
  function seqVals(k, out) {
    const f = S.frames[k] || [],
      n = S.cols * S.rows;
    if (!out || out.length !== n) out = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const v = f[i] || 0;
      out[i] = v > 0 ? v : S.hideOff ? -1 : 0;
    }
    return out;
  }
  const quant = (v) => (v < 0.17 ? 0 : v < 0.5 ? 0.33 : v < 0.83 ? 0.66 : 1);
  function framesFromPreset(id, n) {
    const out = [];
    for (let k = 0; k < n; k++)
      out.push(
        Array.from(patternVals(k / n, id), (x) => quant(Math.max(0, x))),
      );
    return out;
  }
  function exportFrames() {
    if (S.mode === "pattern") {
      const n = clamp(Math.round(S.duration / 40), 8, 125);
      const vals = [];
      for (let k = 0; k < n; k++)
        vals.push(Float32Array.from(patternVals(k / n)));
      return { vals, interval: S.duration / n, smooth: true };
    }
    return {
      vals: S.frames.map((_, k) => Float32Array.from(seqVals(k))),
      interval: S.frameMs,
      smooth: false,
    };
  }

  /* colors per cell */
  let colorCache = null;
  function colors() {
    const key = [
      S.colorMode,
      S.colorA,
      S.colorB,
      S.gradDir,
      S.cols,
      S.rows,
    ].join("|");
    if (colorCache && colorCache.key === key) return colorCache.css;
    const a = hexToRgb(S.colorA),
      b = hexToRgb(S.colorB);
    const css = geom().cells.map((c) => {
      if (S.colorMode !== "gradient") return S.colorA;
      const t =
        S.gradDir === "horizontal"
          ? c.nx
          : S.gradDir === "vertical"
            ? c.ny
            : S.gradDir === "radial"
              ? c.d
              : (c.nx + c.ny) / 2;
      return rgbToHex(mixRgb(a, b, t));
    });
    colorCache = { key, css };
    return css;
  }

  /* =====================================================================
   Renderer
   ===================================================================== */
  function gridSize() {
    return [
      S.cols * S.dotSize + (S.cols - 1) * S.gap,
      S.rows * S.dotSize + (S.rows - 1) * S.gap,
    ];
  }
  function fitLayout(W, H, pad, maxCell) {
    const [gw, gh] = gridSize();
    let k = Math.min((W - 2 * pad) / gw, (H - 2 * pad) / gh);
    if (maxCell) k = Math.min(k, maxCell / S.dotSize);
    k = Math.max(k, 0.01);
    return {
      cell: S.dotSize * k,
      gap: S.gap * k,
      ox: (W - gw * k) / 2,
      oy: (H - gh * k) / 2,
      k,
    };
  }
  function drawDots(ctx, L, vals, cols, o = {}) {
    const C = S.cols,
      base = S.base,
      step = L.cell + L.gap,
      glow = o.glow && S.glow,
      am = o.alpha ?? 1,
      shape = S.shape;
    ctx.save();
    for (let i = 0; i < vals.length; i++) {
      const v = vals[i];
      if (v < 0) continue;
      const a = (base + (1 - base) * v) * am;
      if (a < 0.004) continue;
      const x = L.ox + (i % C) * step + L.cell / 2,
        y = L.oy + ((i / C) | 0) * step + L.cell / 2;
      const s = L.cell * (S.scaleFx ? 0.4 + 0.6 * v : 1);
      const col = cols[i];
      ctx.globalAlpha = a;
      if (glow && v > 0.02) {
        ctx.shadowBlur = L.cell * 1.1 * v;
        ctx.shadowColor = col;
      } else ctx.shadowBlur = 0;
      shapePath(ctx, shape, x, y, s);
      if (shape === "ring") {
        ctx.lineWidth = s * 0.24;
        ctx.strokeStyle = col;
        ctx.stroke();
      } else {
        ctx.fillStyle = col;
        ctx.fill();
      }
    }
    ctx.restore();
  }

  /* =====================================================================
   Stage (editor canvas)
   ===================================================================== */
  const stageCv = $("#stage"),
    sctx = stageCv.getContext("2d");
  let SL = null,
    hover = -1,
    painting = false,
    paintVal = 1,
    lastCell = -1;
  const resizeObserver = new ResizeObserver(() => {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = stageCv.getBoundingClientRect();
    stageCv.width = Math.max(1, Math.round(r.width * dpr));
    stageCv.height = Math.max(1, Math.round(r.height * dpr));
  });
  resizeObserver.observe($("#stageWrap"));

  function drawStage(vals) {
    const ctx = sctx,
      W = stageCv.width,
      H = stageCv.height;
    ctx.fillStyle = S.bg;
    ctx.fillRect(0, 0, W, H);
    const L = (SL = fitLayout(W, H, 40 * dpr, 64 * dpr));
    const step = L.cell + L.gap,
      C = S.cols,
      n = vals.length;
    const ink = lum(hexToRgb(S.bg)) > 0.55 ? "0,0,0" : "255,255,255";
    const cols = colors();
    const m = Math.min(L.gap * 0.4, L.cell * 0.14);
    ctx.save();
    // slots: mask outlines + ghost markers for invisible cells
    for (let i = 0; i < n; i++) {
      const x = L.ox + (i % C) * step,
        y = L.oy + ((i / C) | 0) * step;
      if (S.mode === "pattern" && S.mask[i]) {
        ctx.strokeStyle = `rgba(${ink},.14)`;
        ctx.lineWidth = dpr;
        ctx.beginPath();
        roundRectPath(
          ctx,
          x - m,
          y - m,
          L.cell + 2 * m,
          L.cell + 2 * m,
          L.cell * 0.3,
        );
        ctx.stroke();
      }
      const v = vals[i],
        eff = v < 0 ? 0 : S.base + (1 - S.base) * v;
      if (eff < 0.08) {
        ctx.fillStyle = `rgba(${ink},.06)`;
        shapePath(
          ctx,
          S.shape === "ring" ? "circle" : S.shape,
          x + L.cell / 2,
          y + L.cell / 2,
          L.cell,
        );
        ctx.fill();
      }
    }
    // onion skin (previous frame)
    if (
      S.mode === "sequence" &&
      !play.sequence &&
      S.onion &&
      S.frames.length > 1
    ) {
      const prev = seqVals((S.cur - 1 + S.frames.length) % S.frames.length);
      for (let i = 0; i < prev.length; i++) if (prev[i] <= 0) prev[i] = -1;
      const saveBase = S.base;
      S.base = 0;
      drawDots(ctx, L, prev, cols, { alpha: 0.28 });
      S.base = saveBase;
    }
    ctx.restore();
    drawDots(ctx, L, vals, cols, { glow: true });
    if (hover >= 0 && hover < n) {
      const x = L.ox + (hover % C) * step,
        y = L.oy + ((hover / C) | 0) * step;
      ctx.strokeStyle = `rgba(${ink},.6)`;
      ctx.lineWidth = 1.5 * dpr;
      ctx.beginPath();
      roundRectPath(
        ctx,
        x - m,
        y - m,
        L.cell + 2 * m,
        L.cell + 2 * m,
        L.cell * 0.3,
      );
      ctx.stroke();
    }
  }

  function cellAt(e) {
    if (!SL) return -1;
    const r = stageCv.getBoundingClientRect();
    const px = (e.clientX - r.left) * dpr,
      py = (e.clientY - r.top) * dpr,
      step = SL.cell + SL.gap;
    const x = Math.floor((px - SL.ox + SL.gap / 2) / step),
      y = Math.floor((py - SL.oy + SL.gap / 2) / step);
    if (x < 0 || y < 0 || x >= S.cols || y >= S.rows) return -1;
    return y * S.cols + x;
  }
  function applyPaint(i) {
    if (S.mode === "pattern") {
      if (S.mask[i] !== paintVal) {
        S.mask[i] = paintVal;
        G = null;
      }
    } else {
      const f = S.frames[S.cur];
      if (f[i] !== paintVal) {
        f[i] = paintVal;
        thumbDirty.add(S.cur);
      }
    }
  }
  function paintLine(a, b) {
    const C = S.cols;
    let x0 = a % C,
      y0 = (a / C) | 0;
    const x1 = b % C,
      y1 = (b / C) | 0;
    const dx = Math.abs(x1 - x0),
      dy = -Math.abs(y1 - y0),
      sx = x0 < x1 ? 1 : -1,
      sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      applyPaint(y0 * C + x0);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
  }
  function floodFill(start, val) {
    const f = S.frames[S.cur],
      target = f[start],
      C = S.cols,
      R = S.rows;
    if (target === val) return;
    const stack = [start];
    while (stack.length) {
      const i = stack.pop();
      if (f[i] !== target) continue;
      f[i] = val;
      const x = i % C,
        y = (i / C) | 0;
      if (x > 0) stack.push(i - 1);
      if (x < C - 1) stack.push(i + 1);
      if (y > 0) stack.push(i - C);
      if (y < R - 1) stack.push(i + C);
    }
    thumbDirty.add(S.cur);
  }
  listen(stageCv, "contextmenu", (e) => e.preventDefault());
  listen(stageCv, "pointerdown", (e) => {
    const i = cellAt(e);
    if (i < 0) return;
    e.preventDefault();
    pushHistory();
    if (S.mode === "pattern") {
      paintVal = S.mask[i] ? 0 : 1;
    } else {
      if (play.sequence) setPlaying(false);
      const erase = e.button === 2 || S.tool === "eraser";
      if (S.tool === "fill") {
        floodFill(i, erase ? 0 : S.brush);
        afterEdit();
        return;
      }
      const f = S.frames[S.cur];
      paintVal = erase ? 0 : f[i] === S.brush ? 0 : S.brush;
    }
    painting = true;
    lastCell = i;
    applyPaint(i);
    stageCv.setPointerCapture(e.pointerId);
    afterEdit();
  });
  listen(stageCv, "pointermove", (e) => {
    const i = cellAt(e);
    hover = i;
    if (painting && i >= 0 && i !== lastCell) {
      paintLine(lastCell, i);
      lastCell = i;
      afterEdit();
    }
  });
  const endPaint = () => {
    painting = false;
  };
  listen(stageCv, "pointerup", endPaint);
  listen(stageCv, "pointercancel", endPaint);
  listen(stageCv, "pointerleave", () => {
    hover = -1;
  });

  function afterEdit() {
    save();
    updateHint();
  }

  /* mask quick shapes */
  const MASKS = [
    ["all", "全部"],
    ["none", "清空"],
    ["invert", "反选"],
    ["circle", "圆形"],
    ["ring", "圆环"],
    ["cross", "十字"],
    ["x", "X 形"],
    ["diamond", "菱形"],
    ["border", "边框"],
    ["random", "随机"],
  ];
  function maskShape(kind) {
    pushHistory();
    const { cols, rows } = S,
      hx = (cols - 1) / 2,
      hy = (rows - 1) / 2,
      R = Math.min(hx, hy),
      seed = (Math.random() * 1e6) | 0;
    S.mask = geom().cells.map((c) => {
      const dist = Math.hypot(c.cx, c.cy),
        ax = Math.abs(c.cx),
        ay = Math.abs(c.cy);
      switch (kind) {
        case "all":
          return 1;
        case "none":
          return 0;
        case "invert":
          return S.mask[c.i] ? 0 : 1;
        case "circle":
          return dist <= R + 0.5 ? 1 : 0;
        case "ring":
          return Math.abs(dist - R) <= 0.5 ? 1 : 0;
        case "cross":
          return ax < 0.6 || ay < 0.6 ? 1 : 0;
        case "x":
          return Math.abs(ax - ay) < 0.6 ? 1 : 0;
        case "diamond":
          return ax + ay <= R + 0.5 ? 1 : 0;
        case "border":
          return c.x === 0 || c.y === 0 || c.x === cols - 1 || c.y === rows - 1
            ? 1
            : 0;
        case "random":
          return hash(seed + c.i * 97) > 0.45 ? 1 : 0;
      }
      return 1;
    });
    G = null;
    afterEdit();
  }

  /* grid resize (keeps content centred) */
  function resizeGrid(nc, nr) {
    nc = clamp(nc, 1, 16);
    nr = clamp(nr, 1, 16);
    if (nc === S.cols && nr === S.rows) return;
    pushHistory();
    const oc = S.cols,
      or = S.rows,
      dx = Math.floor((nc - oc) / 2),
      dy = Math.floor((nr - or) / 2);
    const remap = (arr, fill) => {
      const out = new Array(nc * nr).fill(fill);
      for (let y = 0; y < or; y++)
        for (let x = 0; x < oc; x++) {
          const X = x + dx,
            Y = y + dy;
          if (X >= 0 && Y >= 0 && X < nc && Y < nr)
            out[Y * nc + X] = arr[y * oc + x];
        }
      return out;
    };
    S.mask = S.mask.every(Boolean)
      ? new Array(nc * nr).fill(1)
      : remap(S.mask, 0);
    S.frames = S.frames.map((f) => remap(f, 0));
    S.cols = nc;
    S.rows = nr;
    G = null;
    renderStrip(true);
    syncUI();
    save();
  }

  /* =====================================================================
   Sequence ops
   ===================================================================== */
  let thumbDirty = new Set(),
    stripCanvases = [],
    seqStart = 0;
  const blankFrame = () => new Array(S.cols * S.rows).fill(0);
  function gotoFrame(k) {
    if (play.sequence) setPlaying(false);
    const n = S.frames.length;
    S.cur = ((k % n) + n) % n;
    onCurChange();
    save();
  }
  function onCurChange() {
    const strip = $("#strip");
    [...strip.children].forEach((b, k) =>
      b.classList.toggle("on", k === S.cur),
    );
    const el = strip.children[S.cur];
    if (el && S.mode === "sequence") {
      const sr = strip.getBoundingClientRect(),
        er = el.getBoundingClientRect();
      if (er.left < sr.left || er.right > sr.right)
        strip.scrollLeft += er.left - sr.left - sr.width / 2 + er.width / 2;
    }
    updateHint();
  }
  function frameOp(fn) {
    pushHistory();
    fn();
    S.cur = clamp(S.cur, 0, S.frames.length - 1);
    renderStrip(true);
    afterEdit();
  }
  const addFrame = () =>
    frameOp(() => {
      S.frames.splice(S.cur + 1, 0, blankFrame());
      S.cur++;
    });
  const dupFrame = () =>
    frameOp(() => {
      S.frames.splice(S.cur + 1, 0, S.frames[S.cur].slice());
      S.cur++;
    });
  const delFrame = () => {
    if (S.frames.length <= 1) {
      toast("至少保留一帧");
      return;
    }
    frameOp(() => {
      S.frames.splice(S.cur, 1);
    });
  };
  const moveFrame = (d) => {
    const j = S.cur + d;
    if (j < 0 || j >= S.frames.length) return;
    frameOp(() => {
      const f = S.frames;
      [f[S.cur], f[j]] = [f[j], f[S.cur]];
      S.cur = j;
    });
  };
  function shiftFrame(dx, dy) {
    if (play.sequence) setPlaying(false);
    pushHistory();
    const f = S.frames[S.cur],
      { cols, rows } = S,
      out = new Array(f.length);
    for (let y = 0; y < rows; y++)
      for (let x = 0; x < cols; x++)
        out[((y + dy + rows) % rows) * cols + ((x + dx + cols) % cols)] =
          f[y * cols + x];
    S.frames[S.cur] = out;
    thumbDirty.add(S.cur);
    afterEdit();
  }
  function genFromPreset(id, n) {
    pushHistory();
    S.frames = framesFromPreset(id, n);
    S.cur = 0;
    renderStrip(true);
  }

  function renderStrip(force) {
    const strip = $("#strip"),
      n = S.frames.length;
    if (force || stripCanvases.length !== n) {
      strip.innerHTML = "";
      stripCanvases = [];
      for (let k = 0; k < n; k++) {
        const b = document.createElement("button");
        b.className = "thumb";
        b.dataset.i = k;
        b.title = `第 ${k + 1} 帧`;
        b.setAttribute("aria-label", b.title);
        b.innerHTML = `<canvas width="112" height="112"></canvas><span>${k + 1}</span>`;
        strip.appendChild(b);
        stripCanvases.push(b.firstChild);
      }
      const add = document.createElement("button");
      add.className = "thumb add";
      add.dataset.add = "1";
      add.title = "新建空白帧";
      add.setAttribute("aria-label", add.title);
      add.innerHTML = '<i data-icon="plus"></i>';
      strip.appendChild(add);
      paintIcons(add);
      thumbDirty = new Set(S.frames.keys());
    }
    [...strip.children].forEach((b, k) =>
      b.classList.toggle("on", k === S.cur),
    );
  }
  listen($("#strip"), "click", (e) => {
    const b = e.target.closest(".thumb");
    if (!b) return;
    if (b.dataset.add) addFrame();
    else gotoFrame(+b.dataset.i);
  });
  let thumbBuf;
  function drawThumbs() {
    for (const k of thumbDirty) {
      const cv = stripCanvases[k];
      if (!cv) continue;
      const ctx = cv.getContext("2d");
      ctx.fillStyle = S.bg;
      ctx.fillRect(0, 0, cv.width, cv.height);
      thumbBuf = seqVals(k, thumbBuf);
      drawDots(
        ctx,
        fitLayout(cv.width, cv.height, 12, null),
        thumbBuf,
        colors(),
        {},
      );
    }
    thumbDirty.clear();
  }

  /* =====================================================================
   Playback
   ===================================================================== */
  let tStart = performance.now(),
    pausedP = 0;
  const phaseNow = (now) => frac((now - tStart) / S.duration);
  function setPlaying(on) {
    const now = performance.now();
    if (S.mode === "pattern") {
      if (!on) pausedP = phaseNow(now);
      else tStart = now - pausedP * S.duration;
      play.pattern = on;
    } else {
      if (on) seqStart = now - S.cur * S.frameMs;
      play.sequence = on;
    }
    updatePlayUI();
  }
  const togglePlay = () => setPlaying(!play[S.mode]);
  function updatePlayUI() {
    notify();
  }

  /* =====================================================================
   Preview card, gallery, logo
   ===================================================================== */
  const pv = $("#pv"),
    pvBtn = $("#pvBtn");
  function sizePreviewCanvas(cv, maxW, maxH) {
    const [gw, gh] = gridSize();
    const pad = S.glow ? Math.min(10, S.dotSize * 0.6) : 2;
    const k = Math.min(1, (maxW - 2 * pad) / gw, (maxH - 2 * pad) / gh);
    const w = Math.round(gw * k + 2 * pad),
      h = Math.round(gh * k + 2 * pad);
    const key = `${w}x${h}@${dpr}`;
    if (cv._key !== key) {
      cv._key = key;
      cv.style.width = w + "px";
      cv.style.height = h + "px";
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
    }
    return fitLayout(cv.width, cv.height, pad * dpr, null);
  }
  function drawPreview(vals) {
    const cols = colors();
    let L = sizePreviewCanvas(pv, 160, 110),
      ctx = pv.getContext("2d");
    ctx.clearRect(0, 0, pv.width, pv.height);
    drawDots(ctx, L, vals, cols, { glow: true });
    L = sizePreviewCanvas(pvBtn, 40, 18);
    ctx = pvBtn.getContext("2d");
    ctx.clearRect(0, 0, pvBtn.width, pvBtn.height);
    drawDots(ctx, L, vals, cols, { glow: false });
  }
  const galleryThumbs = [];
  function buildGallery() {
    const g = $("#gallery");
    g.replaceChildren();
    for (const pr of PRESETS) {
      const b = document.createElement("button");
      b.className = "preset";
      b.dataset.id = pr.id;
      b.setAttribute("aria-label", pr.name);
      b.innerHTML = `<canvas width="120" height="96"></canvas><span>${pr.name}</span>`;
      b.addEventListener("click", () => {
        if (S.mode === "sequence") S.genPreset = pr.id;
        else {
          S.preset = pr.id;
          tStart = performance.now();
          pausedP = 0;
        }
        syncUI();
        save();
      });
      g.appendChild(b);
      galleryThumbs.push({
        id: pr.id,
        cv: b.firstChild,
        ctx: b.firstChild.getContext("2d"),
        buf: null,
      });
    }
    const observer = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          const t = galleryThumbs.find((t) => t.cv === entry.target);
          if (t) {
            t.visible = entry.isIntersecting;
            galleryDirty = true;
          }
        }),
      { root: g.closest(".library-panel") },
    );
    galleryThumbs.forEach((t) => observer.observe(t.cv));
    galleryObserver = observer;
    listen(g, "keydown", (e) => {
      if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key))
        return;
      const buttons = [...g.querySelectorAll("button:not([hidden])")];
      const i = buttons.indexOf(document.activeElement);
      if (i < 0) return;
      e.preventDefault();
      const step =
        e.key === "ArrowLeft"
          ? -1
          : e.key === "ArrowRight"
            ? 1
            : e.key === "ArrowUp"
              ? -2
              : 2;
      const next = buttons[(i + step + buttons.length) % buttons.length];
      next.focus();
      next.click();
    });
  }
  function drawGallery(p) {
    if (motionPreference.matches && !galleryDirty) return;
    const cols = colors();
    galleryDirty = false;
    for (const t of galleryThumbs) {
      if (t.visible === false || t.cv.parentElement.hidden) continue;
      const { cv, ctx } = t;
      ctx.fillStyle = S.bg;
      ctx.fillRect(0, 0, cv.width, cv.height);
      const galleryPhase = motionPreference.matches ? 0.25 : p;
      t.buf = patternVals(galleryPhase, t.id, t.buf);
      drawDots(ctx, fitLayout(cv.width, cv.height, 18, 22), t.buf, cols, {});
    }
  }
  /* =====================================================================
   Main loop
   ===================================================================== */
  let bufA,
    bufB,
    lastGalleryTime = 0;
  function tick(now) {
    const pNow = phaseNow(now);
    let vals;
    if (S.mode === "pattern") {
      vals = bufA = patternVals(play.pattern ? pNow : pausedP, S.preset, bufA);
      drawStage(vals);
      drawPreview(vals);
    } else {
      const n = S.frames.length;
      if (play.sequence) {
        const c = Math.floor((now - seqStart) / S.frameMs) % n;
        if (c !== S.cur) {
          S.cur = c;
          onCurChange();
        }
      }
      vals = bufA = seqVals(S.cur, bufA);
      drawStage(vals);
      drawPreview(vals);
      drawThumbs();
    }
    if (now - lastGalleryTime > 66) {
      drawGallery(pNow);
      lastGalleryTime = now;
    }
    drawBraillePreview(now);
    animationId = requestAnimationFrame(tick);
  }

  /* =====================================================================
   UI bindings
   ===================================================================== */
  const DOT_SWATCHES = [
    "#e4e4e7",
    "#ffffff",
    "#a78bfa",
    "#60a5fa",
    "#22d3ee",
    "#34d399",
    "#a3e635",
    "#facc15",
    "#fb923c",
    "#f87171",
    "#f472b6",
    "#818cf8",
  ];
  const BG_SWATCHES = ["#0b0b0f", "#18181b", "#ffffff", "#f4f4f5"];
  function onStyleChange() {
    galleryDirty = true;
    thumbDirty = new Set(S.frames.keys());
    syncUI();
    save();
  }
  function setMode(mode) {
    if (!["pattern", "sequence"].includes(mode)) return;
    S.mode = mode;
    if (mode === "sequence") {
      S.cur = clamp(S.cur, 0, S.frames.length - 1);
      renderStrip(true);
    }
    syncUI();
    save();
  }
  function toSequence() {
    const n = clamp(Math.round(S.duration / 100), 6, 24);
    genFromPreset(S.preset, n);
    S.frameMs = Math.round(S.duration / n / 10) * 10;
    S.genPreset = S.preset;
    play.sequence = false;
    seqStart = performance.now();
    setMode("sequence");
    toast(`已生成 ${n} 帧，选择画笔开始编辑`);
  }
  function updateHint() {
    notify();
  }
  function updateMeta() {
    notify();
  }
  function syncUI() {
    document.body.dataset.mode = S.mode;
    $$("#gallery .preset").forEach((b) => {
      b.classList.toggle(
        "on",
        b.dataset.id === (S.mode === "sequence" ? S.genPreset : S.preset),
      );
      b.setAttribute(
        "aria-pressed",
        String(
          b.dataset.id === (S.mode === "sequence" ? S.genPreset : S.preset),
        ),
      );
    });
    renderStrip();
    notify();
  }
  function setValue(key, value) {
    if (key === "mode") {
      setMode(value);
      return;
    }
    if (key === "cols" || key === "rows") {
      resizeGrid(
        key === "cols" ? value : S.cols,
        key === "rows" ? value : S.rows,
      );
      return;
    }
    if (["colorA", "colorB", "bg"].includes(key) && !HEX_RE.test(value)) return;
    if (key === "duration") {
      const p = play.pattern ? phaseNow(performance.now()) : pausedP;
      S.duration = value;
      tStart = performance.now() - p * value;
    } else S[key] = value;
    if (key === "frameMs") seqStart = performance.now() - S.cur * value;
    if (key === "codeTab" || key === "brailleThreshold") renderCode();
    if (key === "gifScale" || key === "gifTransparent") runGif();
    onStyleChange();
  }

  /* keyboard */
  document.addEventListener(
    "keydown",
    (e) => {
      if (
        e.target.matches(
          "input,textarea,select,[role=slider],[role=tab],[role=radio]",
        ) ||
        (e.code === "Space" && e.target.closest("button"))
      )
        return;
      if (ui.modal || document.querySelector("[role=dialog]")) return;
      const mod = e.metaKey || e.ctrlKey,
        k = e.key.toLowerCase();
      if (e.key === "Escape") {
        closeModals();
        return;
      }
      if (mod && k === "z") {
        e.preventDefault();
        e.shiftKey ? redo() : undo();
        return;
      }
      if (mod && k === "y") {
        e.preventDefault();
        redo();
        return;
      }
      if (mod || e.altKey || ui.modal) return;
      if (e.code === "Space") {
        e.preventDefault();
        togglePlay();
        return;
      }
      if (S.mode !== "sequence") return;
      const map = {
        arrowleft: () => gotoFrame(S.cur - 1),
        arrowright: () => gotoFrame(S.cur + 1),
        b: () => {
          S.tool = "pen";
          syncUI();
        },
        e: () => {
          S.tool = "eraser";
          syncUI();
        },
        g: () => {
          S.tool = "fill";
          syncUI();
        },
        1: () => {
          S.brush = 1;
          syncUI();
        },
        2: () => {
          S.brush = 0.66;
          syncUI();
        },
        3: () => {
          S.brush = 0.33;
          syncUI();
        },
        n: addFrame,
        d: dupFrame,
        delete: delFrame,
        backspace: delFrame,
        o: () => {
          S.onion = !S.onion;
          syncUI();
        },
      };
      if (map[k]) {
        e.preventDefault();
        map[k]();
        save();
      }
    },
    { signal: lifecycle.signal },
  );

  /* =====================================================================
   Code export
   ===================================================================== */
  function genData() {
    const { vals, interval, smooth } = exportFrames();
    const frames = vals.map((v) =>
      Array.from(v, (x) =>
        x < 0 ? "-" : Math.round(x * 15).toString(16),
      ).join(""),
    );
    const css = colors(),
      uniq = [...new Set(css)];
    return {
      frames,
      smooth,
      interval: Math.round(interval * 100) / 100,
      colors: uniq.length === 1 ? uniq : css,
      cols: S.cols,
      rows: S.rows,
      base: Math.round(S.base * 100) / 100,
      shape: S.shape,
      size: S.dotSize,
      gap: S.gap,
      glow: S.glow,
      scale: S.scaleFx,
    };
  }
  const clipOf = (shape) =>
    POLY[shape]
      ? `polygon(${POLY[shape].map(([x, y]) => `${+(x * 100).toFixed(1)}% ${+(y * 100).toFixed(1)}%`).join(", ")})`
      : "";
  const radiusOf = (shape) =>
    ({ circle: "50%", ring: "50%", rounded: "28%" })[shape] || "";
  function framesLiteral(frames, indent) {
    return frames.map((f) => `${indent}"${f}",`).join("\n");
  }

  /* "dot-loader/v1" definition — the format read by the dot-loader-studio npm package */
  function genDef(d) {
    return {
      format: "dot-loader/v1",
      cols: d.cols,
      rows: d.rows,
      interval: d.interval,
      frames: d.frames,
      colors: d.colors,
      base: d.base,
      shape: d.shape,
      size: d.size,
      gap: d.gap,
      glow: d.glow,
      scale: d.scale,
      smooth: d.smooth,
    };
  }
  const defJSON = (d) => JSON.stringify(genDef(d), null, 2);

  /* braille: each character covers 2×4 dots (same mapping as the npm package) */
  const BRAILLE_BITS = [
    [0x01, 0x08],
    [0x02, 0x10],
    [0x04, 0x20],
    [0x40, 0x80],
  ];
  function brailleFrames(d, threshold = S.brailleThreshold) {
    return d.frames.map((f) => {
      const lines = [];
      for (let by = 0; by < d.rows; by += 4) {
        let line = "";
        for (let bx = 0; bx < d.cols; bx += 2) {
          let bits = 0;
          for (let dy = 0; dy < 4; dy++)
            for (let dx = 0; dx < 2; dx++) {
              const x = bx + dx,
                y = by + dy;
              if (x < d.cols && y < d.rows) {
                const c = f[y * d.cols + x];
                if (c !== "-" && parseInt(c, 16) / 15 >= threshold)
                  bits |= BRAILLE_BITS[dy][dx];
              }
            }
          line += String.fromCharCode(0x2800 + bits);
        }
        lines.push(line);
      }
      return lines.join("\n");
    });
  }

  function genNpm(d) {
    const L = [];
    L.push("// npm install dot-loader-studio");
    L.push('import { DotLoader } from "dot-loader-studio/react";');
    L.push("");
    L.push(
      `// ${d.cols}×${d.rows} · ${d.frames.length} frames — also available as loader.json`,
    );
    L.push("const loader = " + defJSON(d) + ";");
    L.push("");
    L.push("export function Thinking() {");
    L.push(
      `  return <DotLoader loader={loader} size={${d.size}} label="Thinking" />;`,
    );
    L.push("}");
    L.push("");
    L.push("// Without React:");
    L.push('//   import { mount } from "dot-loader-studio";');
    L.push(
      '//   const handle = mount(document.querySelector("#loader"), loader);',
    );
    L.push("//   handle.destroy();");
    L.push("//");
    L.push("// In a terminal:");
    L.push('//   npx dot-loader-studio loader.json --text "Thinking…"');
    return L.join("\n");
  }

  function genBraille(d) {
    const frames = brailleFrames(d);
    const L = [];
    L.push(
      `// Terminal spinner · ${d.cols}×${d.rows} dots as braille · generated with Dot Loader Studio`,
    );
    L.push(
      "// Zero dependencies (Node.js). Or use the package: npx dot-loader-studio loader.json",
    );
    L.push("const FRAMES = [");
    L.push(frames.map((f) => `  ${JSON.stringify(f)},`).join("\n"));
    L.push("];");
    L.push(`const INTERVAL = ${d.interval}; // ms per frame`);
    L.push("");
    L.push(
      'export function startSpinner(text = "Thinking…", stream = process.stderr) {',
    );
    L.push('  const height = FRAMES[0].split("\\n").length;');
    L.push("  let i = 0, drawn = false;");
    L.push("  const draw = () => {");
    L.push(
      '    const lines = FRAMES[i++ % FRAMES.length].split("\\n").map((l) => "\\r\\x1b[2K" + l);',
    );
    L.push('    lines[0] += " " + text;');
    L.push(
      '    stream.write((drawn && height > 1 ? `\\x1b[${height - 1}A` : "") + lines.join("\\n"));',
    );
    L.push("    drawn = true;");
    L.push("  };");
    L.push('  stream.write("\\x1b[?25l");');
    L.push("  draw();");
    L.push("  const timer = setInterval(draw, INTERVAL);");
    L.push("  return () => {");
    L.push("    clearInterval(timer);");
    L.push(
      '    stream.write("\\r\\x1b[2K" + "\\x1b[1A\\r\\x1b[2K".repeat(height - 1) + "\\x1b[?25h");',
    );
    L.push("  };");
    L.push("}");
    L.push("");
    L.push('// const stop = startSpinner("Thinking…");');
    L.push("// await doWork();");
    L.push("// stop();");
    return { code: L.join("\n"), frames };
  }

  function genReact(d) {
    const clip = clipOf(d.shape),
      radius = radiusOf(d.shape),
      ring = d.shape === "ring";
    const L = [];
    L.push('import { useEffect, useState } from "react";');
    L.push("");
    L.push("/**");
    L.push(
      ` * DotLoader — ${d.cols}×${d.rows} dots · ${d.frames.length} frames · ${Math.round(d.interval * d.frames.length)}ms loop`,
    );
    L.push(" * Generated with Dot Loader Studio");
    L.push(" */");
    L.push(`const COLS = ${d.cols};`);
    L.push(`const INTERVAL = ${d.interval}; // ms per frame`);
    L.push(`const BASE = ${d.base}; // opacity of idle dots`);
    L.push(`const COLORS = ${JSON.stringify(d.colors)};`);
    L.push(
      '// one string per frame, one char per dot: 0–f = brightness, "-" = hidden',
    );
    L.push("const FRAMES = [");
    L.push(framesLiteral(d.frames, "  "));
    L.push("];");
    L.push("");
    L.push(
      "type Props = { size?: number; gap?: number; label?: string; className?: string };",
    );
    L.push("");
    L.push(
      `export function DotLoader({ size = ${d.size}, gap = ${d.gap}, label = "Loading", className }: Props) {`,
    );
    L.push("  const [frame, setFrame] = useState(0);");
    L.push("");
    L.push("  useEffect(() => {");
    L.push(
      '    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;',
    );
    L.push("    const start = performance.now();");
    L.push("    let raf = 0;");
    L.push("    const tick = (now: number) => {");
    L.push(
      "      setFrame(Math.floor((now - start) / INTERVAL) % FRAMES.length);",
    );
    L.push("      raf = requestAnimationFrame(tick);");
    L.push("    };");
    L.push("    raf = requestAnimationFrame(tick);");
    L.push("    return () => cancelAnimationFrame(raf);");
    L.push("  }, []);");
    L.push("");
    L.push("  return (");
    L.push("    <div");
    L.push('      role="status"');
    L.push("      aria-label={label}");
    L.push("      className={className}");
    L.push("      style={{");
    L.push('        display: "inline-grid",');
    L.push("        gridTemplateColumns: `repeat(${COLS}, ${size}px)`,");
    L.push("        gap,");
    if (d.glow)
      L.push(
        "        filter: `drop-shadow(0 0 ${size * 0.5}px ${COLORS[0]}99)`,",
      );
    L.push("      }}");
    L.push("    >");
    L.push("      {[...FRAMES[frame]].map((c, i) => {");
    L.push('        const v = c === "-" ? -1 : parseInt(c, 16) / 15;');
    L.push("        const color = COLORS[i % COLORS.length];");
    L.push("        return (");
    L.push("          <span");
    L.push("            key={i}");
    L.push("            style={{");
    L.push("              width: size,");
    L.push("              height: size,");
    if (radius) L.push(`              borderRadius: "${radius}",`);
    if (clip) L.push(`              clipPath: "${clip}",`);
    if (ring)
      L.push(
        "              boxShadow: `inset 0 0 0 ${size * 0.24}px ${color}`,",
      );
    else L.push("              background: color,");
    L.push("              opacity: v < 0 ? 0 : BASE + (1 - BASE) * v,");
    if (d.scale)
      L.push("              transform: `scale(${v < 0 ? 0 : 0.4 + 0.6 * v})`,");
    if (d.smooth)
      L.push(
        "              transition: `opacity ${INTERVAL}ms linear, transform ${INTERVAL}ms linear`,",
      );
    L.push("            }}");
    L.push("          />");
    L.push("        );");
    L.push("      })}");
    L.push("    </div>");
    L.push("  );");
    L.push("}");
    return L.join("\n");
  }

  function genHTML(d) {
    const clip = clipOf(d.shape),
      radius = radiusOf(d.shape),
      ring = d.shape === "ring";
    const L = [];
    L.push(
      `<!-- DotLoader · ${d.cols}×${d.rows} · ${d.frames.length} frames · generated with Dot Loader Studio -->`,
    );
    L.push('<div class="dot-loader" role="status" aria-label="Loading"></div>');
    L.push("");
    L.push("<style>");
    L.push("  .dot-loader {");
    L.push(`    --size: ${d.size}px;`);
    L.push(`    --gap: ${d.gap}px;`);
    L.push("    display: inline-grid;");
    L.push(`    grid-template-columns: repeat(${d.cols}, var(--size));`);
    L.push("    gap: var(--gap);");
    if (d.glow)
      L.push(
        `    filter: drop-shadow(0 0 calc(var(--size) * 0.5) ${d.colors[0]}99);`,
      );
    L.push("  }");
    L.push("  .dot-loader > i {");
    L.push("    width: var(--size);");
    L.push("    height: var(--size);");
    if (radius) L.push(`    border-radius: ${radius};`);
    if (clip) L.push(`    clip-path: ${clip};`);
    if (d.smooth)
      L.push(
        `    transition: opacity ${d.interval}ms linear, transform ${d.interval}ms linear;`,
      );
    L.push("  }");
    L.push("</style>");
    L.push("");
    L.push("<script>");
    L.push("  (() => {");
    L.push(`    const INTERVAL = ${d.interval};`);
    L.push(`    const BASE = ${d.base};`);
    L.push(`    const COLORS = ${JSON.stringify(d.colors)};`);
    L.push("    const FRAMES = [");
    L.push(framesLiteral(d.frames, "      "));
    L.push("    ];");
    L.push(
      '    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;',
    );
    L.push("");
    L.push(
      '    document.querySelectorAll(".dot-loader:not([data-ready])").forEach((root) => {',
    );
    L.push('      root.dataset.ready = "";');
    L.push("      const dots = [...FRAMES[0]].map((_, i) => {");
    L.push('        const el = document.createElement("i");');
    if (ring)
      L.push(
        "        el.style.boxShadow = `inset 0 0 0 calc(var(--size) * 0.24) ${COLORS[i % COLORS.length]}`;",
      );
    else L.push("        el.style.background = COLORS[i % COLORS.length];");
    L.push("        return root.appendChild(el);");
    L.push("      });");
    L.push("      const start = performance.now();");
    L.push("      let last = -1;");
    L.push("      const render = (now) => {");
    L.push(
      "        const f = reduce ? 0 : Math.floor((now - start) / INTERVAL) % FRAMES.length;",
    );
    L.push("        if (f !== last) {");
    L.push("          last = f;");
    L.push("          dots.forEach((el, i) => {");
    L.push("            const c = FRAMES[f][i];");
    L.push('            const v = c === "-" ? -1 : parseInt(c, 16) / 15;');
    L.push("            el.style.opacity = v < 0 ? 0 : BASE + (1 - BASE) * v;");
    if (d.scale)
      L.push(
        "            el.style.transform = `scale(${v < 0 ? 0 : 0.4 + 0.6 * v})`;",
      );
    L.push("          });");
    L.push("        }");
    L.push("        if (!reduce) requestAnimationFrame(render);");
    L.push("      };");
    L.push("      requestAnimationFrame(render);");
    L.push("    });");
    L.push("  })();");
    L.push("</" + "script>");
    return L.join("\n");
  }

  function projectJSON() {
    const o = {};
    for (const k of [
      "mode",
      "cols",
      "rows",
      "shape",
      "dotSize",
      "gap",
      "colorMode",
      "colorA",
      "colorB",
      "gradDir",
      "bg",
      "base",
      "glow",
      "scaleFx",
      "hideOff",
      "preset",
      "duration",
      "reverse",
      "mask",
      "frames",
      "frameMs",
    ])
      o[k] = S[k];
    o.$schema = "dot-loader-studio/v1";
    return JSON.stringify(o, null, 2).replace(
      /\[\s+([\d.,\s]+?)\s+\]/g,
      (m, a) => "[" + a.replace(/\s+/g, "") + "]",
    );
  }

  function highlight(code) {
    const esc = (s) =>
      s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const re =
      /(\/\/[^\n]*|\/\*[\s\S]*?\*\/|<!--[\s\S]*?-->)|("(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`)|\b(import|from|export|function|const|let|return|if|type|new|true|false|null)\b|(\b\d+(?:\.\d+)?)\b/g;
    let out = "",
      last = 0,
      m;
    while ((m = re.exec(code))) {
      out += esc(code.slice(last, m.index));
      const cls = m[1] ? "c" : m[2] ? "s" : m[3] ? "k" : "n";
      out += `<span class="t-${cls}">${esc(m[0])}</span>`;
      last = re.lastIndex;
    }
    return out + esc(code.slice(last));
  }
  let codeText = "",
    braillePlay = null,
    lastData = null;
  function renderCode() {
    const d = (lastData = genData()),
      tab = S.codeTab;
    const summary = `${d.cols}×${d.rows} 点阵 · ${d.frames.length} 帧 · 每帧 ${d.interval}ms`;
    braillePlay = null;
    if (tab === "react") codeText = genReact(d);
    else if (tab === "html") codeText = genHTML(d);
    else if (tab === "npm") codeText = genNpm(d);
    else if (tab === "braille") {
      const b = genBraille(d);
      codeText = b.code;
      braillePlay = { frames: b.frames, interval: d.interval };
    } else codeText = projectJSON();
    ui.code = codeText;
    ui.codeMeta = {
      react: summary + " · React 组件，支持减少动态效果。",
      html: summary + " · 独立 HTML / CSS / JavaScript。",
      npm: summary + " · 下载 loader.json，使用 dot-loader-studio 包引用。",
      braille: summary + " · 用于终端和 CLI 的 Unicode 盲文字符。",
      json: "保存完整项目，下次导入后继续编辑。",
    }[tab];
    notify();
  }
  function drawBraillePreview(now) {
    if (!braillePlay || ui.modal !== "export" || S.codeTab !== "braille")
      return;
    const el = $("#braillePreview");
    if (el)
      el.textContent =
        braillePlay.frames[
          Math.floor(now / braillePlay.interval) % braillePlay.frames.length
        ];
  }
  async function copyText(t) {
    try {
      await navigator.clipboard.writeText(t);
    } catch (e) {
      const ta = document.createElement("textarea");
      ta.value = t;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
  }
  function downloadBlob(blob, name) {
    const url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }
  /* =====================================================================
   GIF encoder (GIF89a + LZW, median-cut palette)
   ===================================================================== */
  class ByteWriter {
    constructor(n = 1 << 16) {
      this.a = new Uint8Array(n);
      this.n = 0;
    }
    b(v) {
      if (this.n >= this.a.length) {
        const t = new Uint8Array(this.a.length * 2);
        t.set(this.a);
        this.a = t;
      }
      this.a[this.n++] = v;
    }
    w16(v) {
      this.b(v & 255);
      this.b((v >> 8) & 255);
    }
    str(s) {
      for (let i = 0; i < s.length; i++) this.b(s.charCodeAt(i));
    }
    bytes() {
      return this.a.subarray(0, this.n);
    }
  }
  const LZW_CODE = new Int16Array(1 << 20),
    LZW_GEN = new Uint32Array(1 << 20);
  let lzwGen = 0;
  function lzwEncode(px) {
    const w = new ByteWriter(px.length >> 1 || 64);
    let size = 9,
      next = 258,
      gen = ++lzwGen,
      cur = 0,
      bits = 0;
    const emit = (c) => {
      cur |= c << bits;
      bits += size;
      while (bits >= 8) {
        w.b(cur & 255);
        cur >>>= 8;
        bits -= 8;
      }
    };
    emit(256);
    let prefix = px[0];
    for (let i = 1; i < px.length; i++) {
      const k = px[i],
        key = (prefix << 8) | k;
      if (LZW_GEN[key] === gen) {
        prefix = LZW_CODE[key];
        continue;
      }
      emit(prefix);
      if (next < 4096) {
        LZW_CODE[key] = next;
        LZW_GEN[key] = gen;
        next++;
        if (next > 1 << size && size < 12) size++;
      } else {
        emit(256);
        gen = ++lzwGen;
        next = 258;
        size = 9;
      }
      prefix = k;
    }
    emit(prefix);
    emit(257);
    if (bits > 0) w.b(cur & 255);
    return w.bytes();
  }
  function buildPalette(cnt, sr, sg, sb, max) {
    const bins = [];
    for (let k = 0; k < 32768; k++)
      if (cnt[k])
        bins.push({
          k,
          n: cnt[k],
          r: sr[k] / cnt[k],
          g: sg[k] / cnt[k],
          b: sb[k] / cnt[k],
        });
    let boxes;
    if (bins.length <= max) boxes = bins.map((b) => [b]);
    else {
      boxes = [bins];
      while (boxes.length < max) {
        let bi = -1,
          best = 0,
          bc = "r";
        for (let j = 0; j < boxes.length; j++) {
          const bx = boxes[j];
          if (bx.length < 2) continue;
          let r0 = 255,
            r1 = 0,
            g0 = 255,
            g1 = 0,
            b0 = 255,
            b1 = 0,
            tot = 0;
          for (const c of bx) {
            if (c.r < r0) r0 = c.r;
            if (c.r > r1) r1 = c.r;
            if (c.g < g0) g0 = c.g;
            if (c.g > g1) g1 = c.g;
            if (c.b < b0) b0 = c.b;
            if (c.b > b1) b1 = c.b;
            tot += c.n;
          }
          const rg = [r1 - r0, g1 - g0, b1 - b0],
            ch = rg.indexOf(Math.max(...rg)),
            sc = rg[ch] * Math.sqrt(tot);
          if (sc > best) {
            best = sc;
            bi = j;
            bc = "rgb"[ch];
          }
        }
        if (bi < 0) break;
        const bx = boxes[bi].sort((u, v) => u[bc] - v[bc]);
        let tot = 0;
        for (const c of bx) tot += c.n;
        let acc = 0,
          s = bx.length - 1;
        for (let q = 0; q < bx.length - 1; q++) {
          acc += bx[q].n;
          if (acc >= tot / 2) {
            s = q + 1;
            break;
          }
        }
        boxes.splice(bi, 1, bx.slice(0, s), bx.slice(s));
      }
    }
    const lut = new Uint8Array(32768);
    const pal = boxes.map((bx, j) => {
      let n = 0,
        r = 0,
        g = 0,
        b = 0;
      for (const c of bx) {
        n += c.n;
        r += c.r * c.n;
        g += c.g * c.n;
        b += c.b * c.n;
        lut[c.k] = j;
      }
      return [Math.round(r / n), Math.round(g / n), Math.round(b / n)];
    });
    return { pal, lut };
  }
  async function makeGif(scale, transparent, onProgress, cancelled) {
    const { vals, interval } = exportFrames();
    const cols = colors(),
      [gw, gh] = gridSize(),
      n = vals.length;
    const pad = Math.round((S.glow ? S.dotSize * 0.9 : S.dotSize * 0.4) + 6);
    const W = Math.round((gw + pad * 2) * scale),
      H = Math.round((gh + pad * 2) * scale);
    const cv = document.createElement("canvas");
    cv.width = W;
    cv.height = H;
    const ctx = cv.getContext("2d", { willReadFrequently: true });
    const L = {
      cell: S.dotSize * scale,
      gap: S.gap * scale,
      ox: pad * scale,
      oy: pad * scale,
    };
    const render = (k) => {
      ctx.clearRect(0, 0, W, H);
      if (!transparent) {
        ctx.fillStyle = S.bg;
        ctx.fillRect(0, 0, W, H);
      }
      drawDots(ctx, L, vals[k], cols, { glow: true });
      return ctx.getImageData(0, 0, W, H).data;
    };
    const yieldUI = () => new Promise((r) => setTimeout(r, 0));
    // pass 1: histogram
    const cnt = new Uint32Array(32768),
      sr = new Float64Array(32768),
      sg = new Float64Array(32768),
      sb = new Float64Array(32768);
    for (let k = 0; k < n; k++) {
      const d = render(k);
      for (let p = 0; p < d.length; p += 4) {
        if (transparent && d[p + 3] < 128) continue;
        const key =
          ((d[p] >> 3) << 10) | ((d[p + 1] >> 3) << 5) | (d[p + 2] >> 3);
        cnt[key]++;
        sr[key] += d[p];
        sg[key] += d[p + 1];
        sb[key] += d[p + 2];
      }
      onProgress(((k + 1) / n) * 0.35);
      await yieldUI();
      if (cancelled()) return null;
    }
    const { pal, lut } = buildPalette(cnt, sr, sg, sb, transparent ? 255 : 256);
    const trans = transparent ? pal.length : -1;
    if (transparent) pal.push([0, 0, 0]);
    if (!pal.length) pal.push([0, 0, 0]);
    // pass 2: index + compress
    const out = [];
    const px = new Uint8Array(W * H);
    for (let k = 0; k < n; k++) {
      const d = render(k);
      for (let p = 0, q = 0; q < px.length; p += 4, q++) {
        px[q] =
          transparent && d[p + 3] < 128
            ? trans
            : lut[
                ((d[p] >> 3) << 10) | ((d[p + 1] >> 3) << 5) | (d[p + 2] >> 3)
              ];
      }
      out.push(lzwEncode(px).slice());
      onProgress(0.35 + ((k + 1) / n) * 0.6);
      await yieldUI();
      if (cancelled()) return null;
    }
    // assemble
    const w = new ByteWriter(out.reduce((a, b) => a + b.length + 32, 1024));
    w.str("GIF89a");
    w.w16(W);
    w.w16(H);
    w.b(0xf7);
    w.b(0);
    w.b(0);
    for (let i = 0; i < 256; i++) {
      const c = pal[i] || [0, 0, 0];
      w.b(c[0]);
      w.b(c[1]);
      w.b(c[2]);
    }
    w.b(0x21);
    w.b(0xff);
    w.b(11);
    w.str("NETSCAPE2.0");
    w.b(3);
    w.b(1);
    w.w16(0);
    w.b(0);
    const delay = Math.max(2, Math.round(interval / 10));
    for (const data of out) {
      w.b(0x21);
      w.b(0xf9);
      w.b(4);
      w.b(transparent ? (2 << 2) | 1 : 1 << 2);
      w.w16(delay);
      w.b(transparent ? trans : 0);
      w.b(0);
      w.b(0x2c);
      w.w16(0);
      w.w16(0);
      w.w16(W);
      w.w16(H);
      w.b(0);
      w.b(8);
      for (let i = 0; i < data.length; i += 255) {
        const len = Math.min(255, data.length - i);
        w.b(len);
        for (let j = 0; j < len; j++) w.b(data[i + j]);
      }
      w.b(0);
    }
    w.b(0x3b);
    onProgress(1);
    return {
      blob: new Blob([w.bytes()], { type: "image/gif" }),
      W,
      H,
      frames: n,
      delay,
    };
  }
  let gifJob = 0,
    gifResult = null,
    gifUrl = null;
  async function runGif() {
    if (ui.modal !== "export" || S.codeTab !== "gif") return;
    const job = ++gifJob;
    ui.gifBusy = true;
    ui.gifProgress = 0;
    notify();
    await new Promise((r) => setTimeout(r, 30));
    try {
      const res = await makeGif(
        S.gifScale,
        S.gifTransparent,
        (p) => {
          if (job === gifJob) {
            ui.gifProgress = p;
            notify();
          }
        },
        () => job !== gifJob,
      );
      if (!res || job !== gifJob) return;
      gifResult = res;
      if (gifUrl) URL.revokeObjectURL(gifUrl);
      gifUrl = URL.createObjectURL(res.blob);
      ui.gifUrl = gifUrl;
      ui.gifMeta = `${res.W}×${res.H}px · ${res.frames} 帧 · ${(res.blob.size / 1024).toFixed(1)} KB`;
      ui.gifBusy = false;
      notify();
    } catch (error) {
      if (job === gifJob) {
        ui.gifBusy = false;
        toast("生成失败，请降低导出尺寸后重试");
      }
    }
  }

  function closeModals() {
    ui.modal = null;
    gifJob++;
    notify();
  }
  function toast(message) {
    ui.message = message;
    notify();
    clearTimeout(messageTimer);
    messageTimer = setTimeout(() => {
      ui.message = "";
      notify();
    }, 2800);
  }
  function exportTab(tab) {
    S.codeTab = tab;
    if (tab === "gif") runGif();
    else {
      gifJob++;
      renderCode();
    }
    notify();
  }
  async function importFile(file) {
    if (!file) return;
    try {
      const o = JSON.parse(await file.text());
      pushHistory();
      applyProject(o);
      if (!S.frames) S.frames = framesFromPreset(S.genPreset, S.genCount);
      S.cur = 0;
      renderStrip(true);
      syncUI();
      save();
      toast("项目已导入");
    } catch {
      toast("导入失败，请选择有效的 Dot Loader Studio 项目文件");
    }
  }
  function notify() {
    if (!ready) return;
    current = {
      ...S,
      ...ui,
      playing: play[S.mode],
      canUndo: hist.past.length > 0,
      canRedo: hist.future.length > 0,
      frameCount: S.frames.length,
      presetName: PRESET_MAP[S.preset].name,
      litCount: S.mask.reduce((a, v) => a + v, 0),
    };
    subscribers.forEach((f) => f());
  }
  try {
    const raw = localStorage.getItem(STORE);
    if (raw) applyProject(JSON.parse(raw));
  } catch {
    S = structuredClone(DEFAULTS);
  }
  if (!S.mask) S.mask = new Array(S.cols * S.rows).fill(1);
  if (!S.frames) S.frames = [new Array(S.cols * S.rows).fill(0)];
  S.cur = clamp(S.cur, 0, S.frames.length - 1);
  if (motionPreference.matches) play.pattern = false;
  listen(motionPreference, "change", () => {
    galleryDirty = true;
    if (motionPreference.matches) setPlaying(false);
  });
  buildGallery();
  renderStrip(true);
  ready = true;
  syncUI();
  animationId = requestAnimationFrame(tick);
  return {
    getSnapshot: () => current,
    subscribe: (fn) => {
      subscribers.add(fn);
      return () => subscribers.delete(fn);
    },
    set: setValue,
    grid: resizeGrid,
    mask: maskShape,
    shapes: SHAPES,
    presets: PRESETS.map(({ id, name }) => ({ id, name })),
    swatches: DOT_SWATCHES,
    backgrounds: BG_SWATCHES,
    action(name, arg) {
      const actions = {
        undo,
        redo,
        play: togglePlay,
        previous: () => gotoFrame(S.cur - 1),
        next: () => gotoFrame(S.cur + 1),
        add: addFrame,
        duplicate: dupFrame,
        delete: delFrame,
        earlier: () => moveFrame(-1),
        later: () => moveFrame(1),
        shift: () => shiftFrame(...arg),
        convert: toSequence,
        clear: () => {
          if (play.sequence) setPlaying(false);
          pushHistory();
          S.frames[S.cur] = blankFrame();
          thumbDirty.add(S.cur);
          afterEdit();
        },
        invert: () => {
          if (play.sequence) setPlaying(false);
          pushHistory();
          S.frames[S.cur] = S.frames[S.cur].map((v) => (v > 0 ? 0 : S.brush));
          thumbDirty.add(S.cur);
          afterEdit();
        },
        generate: () => {
          genFromPreset(S.genPreset, S.genCount);
          syncUI();
          save();
          toast("已生成序列，可使用撤销恢复");
        },
        export: () => {
          ui.modal = "export";
          exportTab(S.codeTab);
        },
        close: closeModals,
        copy: async () => {
          await copyText(codeText);
          toast("代码已复制");
        },
        save: () =>
          downloadBlob(
            new Blob([projectJSON()], { type: "application/json" }),
            "dot-loader-project.json",
          ),
        definition: () =>
          downloadBlob(
            new Blob([defJSON(genData())], { type: "application/json" }),
            "loader.json",
          ),
        gif: () => {
          if (gifResult && !ui.gifBusy)
            downloadBlob(gifResult.blob, "dot-loader.gif");
        },
      };
      actions[name]?.();
    },
    exportTab,
    importFile,
    filter(query) {
      $$("#gallery .preset").forEach((b) => {
        b.hidden = !b.textContent.toLowerCase().includes(query.toLowerCase());
      });
    },
    destroy() {
      ready = false;
      cancelAnimationFrame(animationId);
      resizeObserver.disconnect();
      galleryObserver?.disconnect();
      lifecycle.abort();
      gifJob++;
      clearTimeout(saveTimer);
      clearTimeout(messageTimer);
      if (gifUrl) URL.revokeObjectURL(gifUrl);
    },
  };
}
