(function () {
  "use strict";
  /* ---------------- utilities ---------------- */
  function rng(a) {
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const hsl = (h, s, l, a = 1) =>
    `hsla(${h},${Math.max(0, Math.min(100, s))}%,${Math.max(0, Math.min(100, l))}%,${a})`;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const mk = (w, h) => {
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(w));
    c.height = Math.max(1, Math.round(h));
    return c;
  };
  const $ = (id) => document.getElementById(id);
  const TAU = Math.PI * 2;
  function angDiff(a, b) {
    let d = (a - b) % TAU;
    if (d > Math.PI) d -= TAU;
    if (d < -Math.PI) d += TAU;
    return d;
  }
  function turnToward(a, b, step) {
    const d = angDiff(b, a);
    return a + clamp(d, -step, step);
  }
  const isTouch = matchMedia("(pointer:coarse)").matches;
  const store = {
    get(k, d) {
      try {
        const v = localStorage.getItem(k);
        return v ? JSON.parse(v) : d;
      } catch (e) {
        return d;
      }
    },
    set(k, v) {
      try {
        localStorage.setItem(k, JSON.stringify(v));
      } catch (e) {}
    },
  };

  /* ---------------- painting studies (drawn in code) ---------------- */
  function soft(w, h, f, fn) {
    const s = mk(Math.ceil(w / f), Math.ceil(h / f));
    const g = s.getContext("2d");
    g.scale(s.width / w, s.height / h);
    fn(g);
    return s;
  }
  function upscale(dst, src, w, h) {
    const mid = mk(w / 2, h / 2);
    const m = mid.getContext("2d");
    m.imageSmoothingEnabled = true;
    m.imageSmoothingQuality = "high";
    m.drawImage(src, 0, 0, mid.width, mid.height);
    dst.imageSmoothingEnabled = true;
    dst.imageSmoothingQuality = "high";
    dst.drawImage(mid, 0, 0, w, h);
  }
  function stroke3(x, px, py, a, len, lw, col, r) {
    const dx = (Math.cos(a) * len) / 2,
      dy = (Math.sin(a) * len) / 2,
      b = (r() - 0.5) * len * 0.5;
    const cx = px - Math.sin(a) * b,
      cy = py + Math.cos(a) * b;
    const path = (ox, oy) => {
      x.beginPath();
      x.moveTo(px - dx + ox, py - dy + oy);
      x.quadraticCurveTo(cx + ox, cy + oy, px + dx + ox, py + dy + oy);
    };
    x.lineCap = "round";
    path(1.6, 1.8);
    x.strokeStyle = "rgba(0,0,0,.38)";
    x.lineWidth = lw;
    x.stroke();
    path(0, 0);
    x.strokeStyle = col;
    x.lineWidth = lw;
    x.stroke();
    path(-0.9, -1);
    x.strokeStyle = "rgba(255,255,240,.4)";
    x.lineWidth = lw * 0.28;
    x.stroke();
  }
  function paintOver(x, w, h, r, o) {
    const data = x.getImageData(0, 0, w, h).data;
    for (let i = 0; i < o.n; i++) {
      const px = r() * w,
        py = r() * h,
        k = ((py | 0) * w + (px | 0)) * 4;
      let R = data[k],
        G = data[k + 1],
        B = data[k + 2];
      const j = (r() - 0.5) * o.jit;
      R += j + (r() - 0.5) * 12;
      G += j + (r() - 0.5) * 12;
      B += j + (r() - 0.5) * 12;
      if (o.accent && r() < o.accent[0]) {
        [R, G, B] = o.accent[1][Math.floor(r() * o.accent[1].length)];
      }
      const a = (o.ang || 0) + (r() - 0.5) * o.angJit,
        len = o.len[0] + r() * (o.len[1] - o.len[0]);
      x.strokeStyle = `rgba(${R | 0},${G | 0},${B | 0},${o.alpha})`;
      x.lineWidth = o.lw[0] + r() * (o.lw[1] - o.lw[0]);
      x.lineCap = "round";
      x.beginPath();
      x.moveTo(px - (Math.cos(a) * len) / 2, py - (Math.sin(a) * len) / 2);
      x.lineTo(px + (Math.cos(a) * len) / 2, py + (Math.sin(a) * len) / 2);
      x.stroke();
    }
  }
  const P = {};
  P.impasto = function (w, h, seed) {
    const c = mk(w, h),
      x = c.getContext("2d"),
      r = rng(seed);
    const hor = h * (0.52 + r() * 0.1),
      sun = { x: w * (0.25 + r() * 0.5), y: h * (0.14 + r() * 0.1) },
      sr = Math.min(w, h) * 0.08,
      ph = r() * 6;
    x.fillStyle = "#1c3470";
    x.fillRect(0, 0, w, hor);
    x.fillStyle = "#a8791f";
    x.fillRect(0, hor, w, h - hor);
    const hill = (u) => hor - Math.sin(u * 5 + ph) * h * 0.035 - h * 0.03;
    const N = Math.floor((w * h) / 42);
    for (let i = 0; i < N; i++) {
      const px = r() * w,
        py = r() * h,
        len = 8 + r() * 12,
        lw = 3.5 + r() * 3.5;
      let ang, col;
      if (py < hill(px / w)) {
        const dx = px - sun.x,
          dy = py - sun.y,
          d = Math.hypot(dx, dy);
        ang =
          Math.atan2(dy, dx) +
          Math.PI / 2 +
          Math.sin(px * 0.015 + py * 0.02) * 0.5;
        if (d < sr) col = hsl(50, 95, 62 + r() * 18);
        else if (d < sr * 2) col = hsl(44 + r() * 10, 85, 50 + r() * 18);
        else
          col =
            r() < 0.1
              ? hsl(52, 70, 72)
              : hsl(212 + r() * 18, 55 + r() * 20, 22 + r() * 30);
      } else {
        const t = (py - hor) / (h - hor);
        ang = Math.sin(px * 0.04 + py * 0.06) * 0.6;
        if (py < hor + h * 0.06) col = hsl(100 + r() * 30, 35, 24 + r() * 14);
        else
          col =
            r() < 0.12
              ? hsl(20, 55, 30 + r() * 10)
              : hsl(40 + r() * 10, 78, 42 + r() * 22 - t * 12);
      }
      stroke3(x, px, py, ang, len, lw, col, r);
    }
    return c;
  };
  P.sfumato = function (w, h, seed) {
    const c = mk(w, h),
      x = c.getContext("2d"),
      r = rng(seed),
      off = (r() - 0.5) * 0.04;
    const base = (g) => {
      const gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, "#7e8c6b");
      gr.addColorStop(0.4, "#4f553a");
      gr.addColorStop(0.56, "#2a2216");
      gr.addColorStop(1, "#140e08");
      g.fillStyle = gr;
      g.fillRect(0, 0, w, h);
      g.fillStyle = "#65755e";
      g.beginPath();
      g.ellipse(
        w * (0.12 + r() * 0.08),
        h * 0.36,
        w * 0.3,
        h * 0.06,
        0,
        0,
        TAU,
      );
      g.fill();
      g.fillStyle = "#8e9a7a";
      g.beginPath();
      g.ellipse(
        w * (0.86 - r() * 0.08),
        h * 0.3,
        w * 0.26,
        h * 0.05,
        0,
        0,
        TAU,
      );
      g.fill();
      g.fillStyle = "#2b1d10";
      g.beginPath();
      g.ellipse(w * 0.5, h * 1.03, w * 0.47, h * 0.46, 0, 0, TAU);
      g.fill();
      g.fillStyle = "#a3774a";
      g.beginPath();
      g.ellipse(w * 0.5, h * 0.67, w * 0.15, h * 0.08, 0, 0, TAU);
      g.fill();
      g.fillStyle = "#1d130b";
      g.beginPath();
      g.ellipse(w * (0.5 + off), h * 0.45, w * 0.21, h * 0.26, 0, 0, TAU);
      g.fill();
      g.fillStyle = "#c09260";
      g.beginPath();
      g.ellipse(w * (0.5 + off), h * 0.4, w * 0.13, h * 0.16, 0, 0, TAU);
      g.fill();
      g.fillStyle = "#b3865a";
      g.beginPath();
      g.ellipse(w * 0.48, h * 0.91, w * 0.17, h * 0.05, 0.1, 0, TAU);
      g.fill();
    };
    const feat = (g) => {
      const cx = w * (0.5 + off);
      g.fillStyle = "rgba(40,25,12,.75)";
      g.beginPath();
      g.ellipse(cx - w * 0.05, h * 0.37, w * 0.022, h * 0.011, 0, 0, TAU);
      g.fill();
      g.beginPath();
      g.ellipse(cx + w * 0.05, h * 0.37, w * 0.022, h * 0.011, 0, 0, TAU);
      g.fill();
      g.fillStyle = "rgba(90,60,30,.45)";
      g.beginPath();
      g.ellipse(cx + w * 0.014, h * 0.42, w * 0.012, h * 0.03, 0, 0, TAU);
      g.fill();
      g.fillStyle = "rgba(110,55,35,.55)";
      g.beginPath();
      g.ellipse(cx, h * 0.475, w * 0.032, h * 0.007, 0, 0, TAU);
      g.fill();
      g.fillStyle = "rgba(240,200,150,.32)";
      g.beginPath();
      g.ellipse(cx - w * 0.03, h * 0.385, w * 0.05, h * 0.06, 0, 0, TAU);
      g.fill();
    };
    upscale(x, soft(w, h, 10, base), w, h);
    x.drawImage(
      (() => {
        const t = mk(w, h);
        upscale(t.getContext("2d"), soft(w, h, 4, feat), w, h);
        return t;
      })(),
      0,
      0,
    );
    x.fillStyle = "rgba(150,130,50,.12)";
    x.fillRect(0, 0, w, h);
    const v = x.createRadialGradient(
      w / 2,
      h * 0.45,
      Math.min(w, h) * 0.2,
      w / 2,
      h / 2,
      Math.max(w, h) * 0.75,
    );
    v.addColorStop(0, "rgba(0,0,0,0)");
    v.addColorStop(1, "rgba(0,0,0,.55)");
    x.fillStyle = v;
    x.fillRect(0, 0, w, h);
    return c;
  };
  P.pointillism = function (w, h, seed) {
    const c = mk(w, h),
      x = c.getContext("2d"),
      r = rng(seed),
      m = Math.min(w, h);
    const trees = [
      { u: 0.08 + r() * 0.18, v: 0.24, rad: 0.17 },
      { u: 0.72 + r() * 0.18, v: 0.2, rad: 0.2 },
    ];
    const figs = [
      {
        u: 0.34 + r() * 0.12,
        v: 0.48,
        fw: 0.05,
        fh: 0.27,
        c: [255, 30, 20],
        para: true,
      },
      {
        u: 0.6 + r() * 0.05,
        v: 0.55,
        fw: 0.06,
        fh: 0.24,
        c: [12, 60, 42],
      },
      {
        u: 0.16 + r() * 0.06,
        v: 0.66,
        fw: 0.08,
        fh: 0.12,
        c: [220, 40, 30],
      },
    ];
    const col = (u, v) => {
      for (const f of figs) {
        if (
          f.para &&
          v < f.v &&
          Math.hypot((u - f.u - f.fw / 2) * w, (v - f.v + 0.01) * h * 1.6) <
            m * 0.09
        )
          return [350, 60, 58];
        if (u > f.u && u < f.u + f.fw && v > f.v && v < f.v + f.fh)
          return v < f.v + f.fh * 0.17 ? [25, 45, 72] : f.c;
      }
      for (const t of trees) {
        if (Math.abs(u - t.u) * w < m * 0.015 && v > t.v && v < 0.56)
          return [25, 35, 22];
        if (Math.hypot((u - t.u) * w, (v - t.v) * h) < t.rad * m)
          return [118, 45, 20 + (v - t.v) * -30 + (u - t.u) * 20];
      }
      if (v < 0.3) return [205, 55, 82 - v * 30];
      if (v < 0.4) return [195, 55, 56];
      if (v > 0.72 && u < 0.55) return [110, 45, 26];
      if (v > 0.7 && u > 0.6) return [70, 62, 62];
      return [92, 52, 48 - (v - 0.4) * 25];
    };
    x.fillStyle = "#efe9d8";
    x.fillRect(0, 0, w, h);
    const N = Math.floor((w * h) / 6.5);
    for (let i = 0; i < N; i++) {
      const px = r() * w,
        py = r() * h;
      let [hh, s, l] = col(px / w, py / h);
      if (r() < 0.14) {
        hh += 180;
        s *= 0.6;
        l = clamp(l + 10, 30, 85);
      }
      x.fillStyle = hsl(hh + (r() - 0.5) * 24, s, l + (r() - 0.5) * 18);
      x.beginPath();
      x.arc(px, py, 1.3 + r() * 1.1, 0, TAU);
      x.fill();
    }
    return c;
  };
  P.cubist = function (w, h, seed) {
    const c = mk(w, h),
      x = c.getContext("2d"),
      r = rng(seed),
      m = Math.min(w, h);
    const pal = [
      [36, 25, 46],
      [30, 15, 38],
      [40, 35, 64],
      [30, 6, 34],
      [190, 8, 60],
      [40, 40, 70],
      [28, 22, 24],
      [195, 10, 46],
    ];
    x.fillStyle = "#9c8561";
    x.fillRect(0, 0, w, h);
    for (let i = 0; i < 75; i++) {
      const cx = r() * w,
        cy = r() * h,
        rad = m * (0.06 + r() * 0.22),
        n = 3 + Math.floor(r() * 3),
        a0 = r() * TAU,
        pts = [];
      for (let k = 0; k < n; k++) {
        const a = a0 + (k / n) * TAU + (r() - 0.5) * 0.8,
          rr = rad * (0.5 + r() * 0.6);
        pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
      }
      x.beginPath();
      pts.forEach((p, k) => (k ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1])));
      x.closePath();
      const [H, S, L] = pal[Math.floor(r() * pal.length)];
      const g = x.createLinearGradient(
        pts[0][0],
        pts[0][1],
        pts[1][0],
        pts[1][1],
      );
      g.addColorStop(0, hsl(H, S, L + 14, 0.82));
      g.addColorStop(1, hsl(H, S, L - 12, 0.82));
      x.fillStyle = g;
      x.fill();
      if (r() < 0.6) {
        x.strokeStyle = "rgba(40,32,24,.7)";
        x.lineWidth = 1 + r() * 2;
        x.stroke();
      }
    }
    x.strokeStyle = "rgba(35,28,20,.75)";
    for (let i = 0; i < 14; i++) {
      x.lineWidth = 1 + r() * 2;
      x.beginPath();
      x.moveTo(r() * w, r() * h);
      x.lineTo(r() * w, r() * h);
      x.stroke();
    }
    return c;
  };
  P.flat = function (w, h, seed) {
    const c = mk(w, h),
      x = c.getContext("2d"),
      r = rng(seed);
    const lw = Math.max(3, w / 90);
    x.lineWidth = lw;
    x.strokeStyle = "#1d1a16";
    x.lineJoin = "round";
    const shape = (fill, fn) => {
      x.beginPath();
      fn();
      x.fillStyle = fill;
      x.fill();
      x.stroke();
    };
    x.fillStyle = "#3e8a4a";
    x.fillRect(0, 0, w, h);
    shape("#e6d38a", () => {
      x.rect(-lw, -lw, w + 2 * lw, h * 0.17 + lw);
    });
    shape("#3f78ad", () => {
      x.moveTo(-lw, h * 0.17);
      x.bezierCurveTo(w * 0.3, h * 0.2, w * 0.6, h * 0.14, w + lw, h * 0.19);
      x.lineTo(w + lw, h * 0.28);
      x.bezierCurveTo(w * 0.6, h * 0.25, w * 0.3, h * 0.31, -lw, h * 0.27);
      x.closePath();
    });
    shape("#6fae4e", () => {
      x.ellipse(w * (0.3 + r() * 0.3), h * 0.5, w * 0.28, h * 0.1, 0, 0, TAU);
    });
    for (let i = 0; i < 2; i++) {
      const bx = w * (0.58 + i * 0.2 + (r() - 0.5) * 0.05),
        top = h * (0.3 + r() * 0.08);
      shape(i ? "#e8a33a" : "#e08a2c", () => {
        x.moveTo(bx, top);
        x.lineTo(bx + w * 0.08, h * 0.78);
        x.lineTo(bx - w * 0.08, h * 0.78);
        x.closePath();
      });
    }
    for (let i = 0; i < 2; i++) {
      const fx = w * (0.14 + i * 0.2),
        fy = h * (0.44 + i * 0.06);
      shape("#26407a", () => {
        x.moveTo(fx - w * 0.1, fy + h * 0.34);
        x.quadraticCurveTo(fx - w * 0.12, fy, fx, fy - h * 0.02);
        x.quadraticCurveTo(fx + w * 0.12, fy, fx + w * 0.1, fy + h * 0.34);
        x.closePath();
      });
      shape("#f3efe6", () => {
        x.ellipse(fx, fy - h * 0.03, w * 0.06, h * 0.05, 0, 0, TAU);
      });
      shape("#e3b98f", () => {
        x.ellipse(fx, fy - h * 0.02, w * 0.04, h * 0.035, 0, 0, TAU);
      });
    }
    shape("#c8352b", () => {
      x.rect(-lw, h * 0.84, w + 2 * lw, h * 0.12);
    });
    for (let sx = w * 0.03; sx < w; sx += w * 0.07) {
      shape("#f3efe6", () => {
        x.rect(sx, h * 0.82, w * 0.025, h * 0.16);
      });
    }
    return c;
  };
  P.impressionist = function (w, h, seed) {
    const c = mk(w, h),
      x = c.getContext("2d"),
      r = rng(seed);
    const g = x.createLinearGradient(0, 0, 0, h * 0.45);
    g.addColorStop(0, "#cdbfe0");
    g.addColorStop(1, "#f2d4b4");
    x.fillStyle = g;
    x.fillRect(0, 0, w, h);
    x.fillStyle = "#8f8fb8";
    x.fillRect(0, h * 0.4, w, h * 0.1);
    const fg = x.createLinearGradient(0, h * 0.5, 0, h);
    fg.addColorStop(0, "#d9b36b");
    fg.addColorStop(1, "#b49a8a");
    x.fillStyle = fg;
    x.fillRect(0, h * 0.5, w, h * 0.5);
    const stack = (cx, cy, rx, ry) => {
      x.fillStyle = "#b8704c";
      x.beginPath();
      x.ellipse(cx, cy, rx, ry, 0, Math.PI, TAU);
      x.lineTo(cx + rx, cy + ry * 0.25);
      x.lineTo(cx - rx, cy + ry * 0.25);
      x.fill();
      x.fillStyle = "#7a5a8a";
      x.beginPath();
      x.ellipse(cx + rx * 0.35, cy, rx * 0.65, ry * 0.9, 0, Math.PI * 1.3, TAU);
      x.lineTo(cx + rx, cy + ry * 0.25);
      x.fill();
    };
    stack(w * (0.28 + r() * 0.06), h * 0.66, w * 0.17, h * 0.15);
    stack(w * (0.72 + r() * 0.05), h * 0.62, w * 0.12, h * 0.11);
    paintOver(x, w, h, r, {
      n: Math.floor((w * h) / 22),
      jit: 26,
      alpha: 0.6,
      lw: [3, 5],
      len: [5, 11],
      angJit: 0.9,
      accent: [
        0.08,
        [
          [200, 160, 220],
          [240, 170, 160],
          [250, 220, 150],
        ],
      ],
    });
    return c;
  };
  const paintCache = {};
  function painting(type, seed, w, h) {
    const k = type + seed + "x" + w + "x" + h;
    if (!paintCache[k]) paintCache[k] = P[type](w, h, seed);
    return paintCache[k];
  }
  function paintingURL(type, seed, w, h) {
    const cv = painting(type, seed, w, h);
    if (!cv._url) cv._url = cv.toDataURL("image/jpeg", 0.9);
    return cv._url;
  }

  /* ---------------- level data ---------------- */
  const LEVELS = [
    {
      key: "Level1",
      name: "The Florentine Hall",
      technique: "Impasto",
      def: "Paint is laid on so thickly that the brush or palette-knife strokes stay visible and read as ridges and lines. Colors can even be mixed right on the canvas. In person, the paint seems to rise out of the surface.",
      seen: "Famous example: Vincent van Gogh, The Starry Night (1889).",
      hero: ["impasto", 7, 480, 360],
      options: [
        {
          p: "impasto",
          seed: 31,
          title: "Harvest Wind",
          correct: true,
          why: "Right. Those short, ridged strokes stand up from the canvas, each with its own highlight and shadow. That is impasto.",
        },
        {
          p: "sfumato",
          seed: 5,
          title: "The Quiet Sitter",
          why: "Not this one. The tones melt smoothly with no visible brushwork, which is the opposite of impasto.",
        },
        {
          p: "cubist",
          seed: 9,
          title: "Harbor in Pieces",
          why: "Not this one. The subject is broken into flat facets, but the paint itself is laid on smoothly, not built up.",
        },
      ],
      bg: 0x0a0608,
      spawn: [6.4, 6.4],
      obstacles: [
        { x: -2.5, z: 1.5, sx: 1.2, sz: 1.2, kind: "vase" },
        { x: 2.5, z: -2, sx: 1.2, sz: 1.2, kind: "bust" },
      ],
      guard: {
        speed: 2.0,
        chase: 3.3,
        range: 5,
        fov: 70,
        wp: [
          [-5, -3],
          [0, -5],
          [5, -4],
          [5, 2],
          [0, 4],
          [-5, 4],
        ],
      },
    },
    {
      key: "Level2",
      name: "The Stone Gallery",
      technique: "Sfumato",
      def: "A hazy quality that blurs contours, so figures emerge from a dark background through gradual changes in tone rather than harsh outlines. The transitions are so subtle that the figures almost fuse with their surroundings.",
      seen: "Famous example: Leonardo da Vinci, Mona Lisa (c. 1503 to 1519).",
      hero: ["sfumato", 21, 300, 400],
      options: [
        {
          p: "cubist",
          seed: 44,
          title: "Still Life, Fractured",
          why: "Not this one. Hard edges and sharp facets are everywhere here. Sfumato has no hard edges at all.",
        },
        {
          p: "flat",
          seed: 12,
          title: "Market Day",
          why: "Not this one. Bold dark outlines wrap flat patches of color. Sfumato avoids outlines entirely.",
        },
        {
          p: "sfumato",
          seed: 63,
          title: "Lady in Umber",
          correct: true,
          why: "Right. The face dissolves softly into the dark background with no outline anywhere. That is sfumato.",
        },
      ],
      bg: 0x07070a,
      spawn: [6.4, 6.4],
      obstacles: [
        { x: 0.5, z: 0, sx: 3.2, sz: 1.1, kind: "slab" },
        { x: -3.5, z: 0.5, sx: 1, sz: 1, kind: "bust" },
      ],
      guard: {
        speed: 2.3,
        chase: 3.5,
        range: 5.5,
        fov: 76,
        wp: [
          [-6, -5],
          [5, -5],
          [5, 4],
          [-1, 5],
          [-6, 2],
        ],
      },
    },
    {
      key: "Level3",
      name: "The Night Wing",
      technique: "Pointillism",
      def: "Small dots of color are applied separately to the surface. Up close you see the dots; from a distance, your eye blends them into shapes and new colors.",
      seen: "Famous example: Georges Seurat, A Sunday on La Grande Jatte (1884 to 1886).",
      hero: ["pointillism", 3, 480, 360],
      options: [
        {
          p: "impressionist",
          seed: 17,
          title: "Haystacks at Dusk",
          why: "Not this one. Loose, broken dabs capture the light, but they are strokes, not separate dots.",
        },
        {
          p: "flat",
          seed: 28,
          title: "Orchard Fence",
          why: "Not this one. Large flat areas of color with dark outlines, no dots in sight.",
        },
        {
          p: "pointillism",
          seed: 52,
          title: "Sunday by the River",
          correct: true,
          why: "Right. The whole scene is built from thousands of separate dots that blend in your eye. That is pointillism.",
        },
      ],
      bg: 0x0b0710,
      spawn: [6.4, 6.4],
      obstacles: [
        { x: 2, z: 1.5, sx: 1.4, sz: 1.4, kind: "crate" },
        { x: -3, z: -1.5, sx: 1.4, sz: 1.4, kind: "crate" },
      ],
      guard: {
        speed: 2.6,
        chase: 3.7,
        range: 6,
        fov: 80,
        wp: [
          [-6, -5.5],
          [5.5, -5.5],
          [4.5, 3.8],
          [-0.5, 3.8],
          [-0.5, -3],
          [-6, -3],
        ],
      },
    },
  ];

  /* ---------------- three.js setup ---------------- */
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  $("stage").appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
  const camTarget = new THREE.Vector3(-1, 2, -1)
    .normalize()
    .multiplyScalar(1.3);
  camera.position.copy(camTarget).add(new THREE.Vector3(30, 30, 30));
  camera.lookAt(camTarget);
  function resize() {
    const w = innerWidth,
      h = innerHeight,
      a = w / h;
    renderer.setSize(w, h);
    const hh = Math.max(9.3, 12.6 / a);
    camera.left = -hh * a;
    camera.right = hh * a;
    camera.top = hh;
    camera.bottom = -hh;
    camera.updateProjectionMatrix();
  }
  addEventListener("resize", resize);
  resize();

  function tex(c, rx = 1, ry = 1) {
    const t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(rx, ry);
    t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    return t;
  }
  function woodTex(H, S, L, seed) {
    const c = mk(512, 512),
      x = c.getContext("2d"),
      r = rng(seed);
    for (let row = 0; row < 8; row++) {
      let px = -r() * 200;
      while (px < 512) {
        const len = 150 + r() * 200;
        x.fillStyle = hsl(H + r() * 6 - 3, S, L + r() * 6 - 3);
        x.fillRect(px, row * 64, len, 64);
        for (let k = 0; k < 10; k++) {
          x.strokeStyle = `rgba(0,0,0,${0.05 + r() * 0.08})`;
          x.lineWidth = 1 + r() * 1.5;
          x.beginPath();
          const y = row * 64 + 4 + r() * 56;
          x.moveTo(px, y);
          x.bezierCurveTo(
            px + len * 0.3,
            y + r() * 6 - 3,
            px + len * 0.6,
            y + r() * 6 - 3,
            px + len,
            y,
          );
          x.stroke();
        }
        x.fillStyle = "rgba(0,0,0,.55)";
        x.fillRect(px, row * 64, 2, 64);
        px += len;
      }
      x.fillStyle = "rgba(0,0,0,.6)";
      x.fillRect(0, row * 64, 512, 2);
    }
    return c;
  }
  function slateTex(seed) {
    const c = mk(512, 512),
      x = c.getContext("2d"),
      r = rng(seed);
    x.fillStyle = "#1c1c22";
    x.fillRect(0, 0, 512, 512);
    const cols = ["#2c2c35", "#3a3a45", "#111116", "#24242c", "#4a4a55"];
    for (let i = 0; i < 420; i++) {
      x.fillStyle = cols[Math.floor(r() * cols.length)];
      x.globalAlpha = 0.15 + r() * 0.3;
      x.beginPath();
      x.ellipse(
        r() * 512,
        r() * 512,
        4 + r() * 40,
        3 + r() * 22,
        r() * 3,
        0,
        TAU,
      );
      x.fill();
    }
    x.globalAlpha = 0.18;
    x.strokeStyle = "#8a8a99";
    for (let i = 0; i < 40; i++) {
      x.lineWidth = 0.6 + r();
      x.beginPath();
      let px = r() * 512,
        py = r() * 512;
      x.moveTo(px, py);
      for (let k = 0; k < 5; k++) {
        px += (r() - 0.5) * 50;
        py += (r() - 0.5) * 50;
        x.lineTo(px, py);
      }
      x.stroke();
    }
    x.globalAlpha = 0.7;
    x.fillStyle = "#08080b";
    for (let i = 0; i <= 4; i++) {
      x.fillRect(i * 128 - 2, 0, 4, 512);
      x.fillRect(0, i * 128 - 2, 512, 4);
    }
    x.globalAlpha = 1;
    return c;
  }
  function panelWallTex() {
    const c = mk(512, 512),
      x = c.getContext("2d"),
      r = rng(4);
    x.fillStyle = "#8ea2ad";
    x.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 260; i++) {
      x.fillStyle = `rgba(${r() < 0.5 ? 255 : 30},${r() < 0.5 ? 255 : 40},${r() < 0.5 ? 255 : 50},.04)`;
      x.fillRect(r() * 512, r() * 512, 20 + r() * 60, 10 + r() * 30);
    }
    x.fillStyle = "#3b2217";
    x.fillRect(0, 340, 512, 172);
    x.strokeStyle = "rgba(0,0,0,.45)";
    x.lineWidth = 3;
    for (let i = 0; i < 4; i++) {
      x.strokeRect(i * 128 + 14, 362, 100, 128);
    }
    x.fillStyle = "#2a170f";
    x.fillRect(0, 0, 512, 22);
    x.fillRect(0, 326, 512, 20);
    x.fillRect(0, 0, 18, 512);
    x.fillRect(494, 0, 18, 512);
    return c;
  }
  function stoneWallTex() {
    const c = mk(512, 512),
      x = c.getContext("2d"),
      r = rng(12);
    x.fillStyle = "#231f1b";
    x.fillRect(0, 0, 512, 512);
    const bh = 42;
    for (let row = 0; row * bh < 512; row++) {
      const off = (row % 2) * 48;
      for (let bx = -96 + off; bx < 512; bx += 96) {
        x.fillStyle = hsl(30 + r() * 14, 12 + r() * 8, 24 + r() * 10);
        x.fillRect(bx + 3, row * bh + 3, 90, bh - 6);
        x.fillStyle = "rgba(255,255,255,.04)";
        x.fillRect(bx + 3, row * bh + 3, 90, 5);
      }
    }
    return c;
  }
  function plasterWallTex() {
    const c = mk(512, 512),
      x = c.getContext("2d"),
      r = rng(33);
    x.fillStyle = "#6a4b5a";
    x.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 300; i++) {
      x.fillStyle = r() < 0.5 ? "rgba(255,230,240,.05)" : "rgba(20,0,20,.07)";
      x.beginPath();
      x.ellipse(
        r() * 512,
        r() * 512,
        10 + r() * 50,
        6 + r() * 30,
        r() * 3,
        0,
        TAU,
      );
      x.fill();
    }
    x.fillStyle = "#3a2620";
    x.fillRect(0, 470, 512, 42);
    return c;
  }
  function stainedGlass(w, h, seed) {
    const c = mk(w, h),
      x = c.getContext("2d"),
      r = rng(seed);
    const cols = [
      "#ff9a2e",
      "#ffcf4a",
      "#e8542a",
      "#ffb347",
      "#c9331f",
      "#ffe08a",
    ];
    const nx = 4,
      ny = Math.round((4 * h) / w),
      pts = [];
    for (let j = 0; j <= ny; j++) {
      pts.push([]);
      for (let i = 0; i <= nx; i++) {
        const edge = i === 0 || j === 0 || i === nx || j === ny;
        pts[j].push([
          (i * w) / nx + (edge ? 0 : (((r() - 0.5) * w) / nx) * 0.6),
          (j * h) / ny + (edge ? 0 : (((r() - 0.5) * h) / ny) * 0.6),
        ]);
      }
    }
    x.lineWidth = 2.5;
    x.strokeStyle = "#1a0e08";
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++) {
        const a = pts[j][i],
          b = pts[j][i + 1],
          cc = pts[j + 1][i + 1],
          d = pts[j + 1][i];
        [
          [a, b, cc],
          [a, cc, d],
        ].forEach((t) => {
          x.beginPath();
          x.moveTo(...t[0]);
          x.lineTo(...t[1]);
          x.lineTo(...t[2]);
          x.closePath();
          x.fillStyle = cols[Math.floor(r() * cols.length)];
          x.fill();
          x.stroke();
        });
      }
    x.lineWidth = w * 0.07;
    x.strokeStyle = "#2a170f";
    x.strokeRect(0, 0, w, h);
    x.lineWidth = w * 0.04;
    x.beginPath();
    x.moveTo(w / 2, 0);
    x.lineTo(w / 2, h);
    for (let k = 1; k < 4; k++) {
      x.moveTo(0, (h * k) / 4);
      x.lineTo(w, (h * k) / 4);
    }
    x.stroke();
    return c;
  }
  function archWindow() {
    const w = 128,
      h = 256,
      c = mk(w, h),
      x = c.getContext("2d");
    const path = () => {
      x.beginPath();
      x.moveTo(8, h - 6);
      x.lineTo(8, w / 2);
      x.arc(w / 2, w / 2, w / 2 - 8, Math.PI, 0);
      x.lineTo(w - 8, h - 6);
      x.closePath();
    };
    path();
    x.fillStyle = "#1a120c";
    x.fill();
    x.save();
    path();
    x.clip();
    const g = x.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#fff2b0");
    g.addColorStop(1, "#f0a93a");
    x.fillStyle = g;
    x.fillRect(16, 16, w - 32, h - 24);
    x.fillStyle = "#1a120c";
    x.fillRect(w / 2 - 3, 0, 6, h);
    x.fillRect(0, h * 0.55, w, 6);
    x.restore();
    return c;
  }
  function gridWindow() {
    const c = mk(128, 128),
      x = c.getContext("2d");
    const g = x.createRadialGradient(64, 64, 10, 64, 64, 80);
    g.addColorStop(0, "#fff0b8");
    g.addColorStop(1, "#f2b53a");
    x.fillStyle = g;
    x.fillRect(0, 0, 128, 128);
    x.fillStyle = "#2a1a14";
    x.fillRect(0, 0, 128, 10);
    x.fillRect(0, 118, 128, 10);
    x.fillRect(0, 0, 10, 128);
    x.fillRect(118, 0, 10, 128);
    for (let i = 1; i < 4; i++) {
      x.fillRect(i * 32 - 3, 0, 6, 128);
      x.fillRect(0, i * 32 - 3, 128, 6);
    }
    return c;
  }
  function woodDoor() {
    const w = 160,
      h = 300,
      c = mk(w, h),
      x = c.getContext("2d"),
      r = rng(8);
    x.beginPath();
    x.moveTo(0, h);
    x.lineTo(0, 40);
    x.lineTo(30, 6);
    x.lineTo(w - 30, 6);
    x.lineTo(w, 40);
    x.lineTo(w, h);
    x.closePath();
    x.fillStyle = "#5b3a26";
    x.fill();
    x.save();
    x.clip();
    for (let i = 0; i < 5; i++) {
      x.fillStyle = hsl(22, 38, 22 + r() * 6);
      x.fillRect(i * 32 + 2, 0, 28, h);
    }
    x.strokeStyle = "rgba(0,0,0,.25)";
    for (let i = 0; i < 40; i++) {
      x.lineWidth = 1;
      x.beginPath();
      const px = r() * w;
      x.moveTo(px, 0);
      x.lineTo(px + (r() - 0.5) * 6, h);
      x.stroke();
    }
    x.restore();
    x.lineWidth = 6;
    x.strokeStyle = "#d8c9b0";
    x.stroke();
    return c;
  }

  /* ---------------- characters ---------------- */
  function makeCharacter(o) {
    const g = new THREE.Group(),
      M = (c, r = 0.7) =>
        new THREE.MeshStandardMaterial({ color: c, roughness: r });
    const skin = M(0xe8c8a4),
      top = M(o.top),
      legs = M(0x3b3244, 0.8),
      boot = M(0xc0443a, 0.45),
      hair = M(o.hair, 0.55),
      eye = M(0x2f8a99, 0.25),
      dark = M(0x141018, 0.5);
    const add = (geo, mat, x, y, z, p = g) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.castShadow = true;
      p.add(m);
      return m;
    };
    const body = new THREE.Group();
    g.add(body);
    const leg = (s) => {
      const p = new THREE.Group();
      p.position.set(s * 0.12, 0.78, 0);
      add(
        new THREE.CylinderGeometry(0.1, 0.085, 0.66, 10),
        legs,
        0,
        -0.33,
        0,
        p,
      );
      add(new THREE.BoxGeometry(0.24, 0.22, 0.38), boot, 0, -0.7, 0.05, p);
      add(
        new THREE.CylinderGeometry(0.13, 0.13, 0.08, 10),
        boot,
        0,
        -0.55,
        0,
        p,
      );
      body.add(p);
      return p;
    };
    const legL = leg(-1),
      legR = leg(1);
    add(
      new THREE.CylinderGeometry(0.24, 0.22, 0.24, 12),
      legs,
      0,
      0.86,
      0,
      body,
    );
    add(new THREE.CylinderGeometry(0.2, 0.22, 0.1, 12), skin, 0, 1.02, 0, body);
    add(new THREE.CylinderGeometry(0.22, 0.24, 0.4, 12), top, 0, 1.27, 0, body);
    add(new THREE.CylinderGeometry(0.12, 0.2, 0.14, 12), top, 0, 1.5, 0, body);
    const arm = (s) => {
      const p = new THREE.Group();
      p.position.set(s * 0.3, 1.42, 0);
      p.rotation.z = s * 0.12;
      add(new THREE.CylinderGeometry(0.07, 0.16, 0.5, 10), top, 0, -0.25, 0, p);
      add(new THREE.SphereGeometry(0.075, 10, 8), skin, 0, -0.53, 0, p);
      body.add(p);
      return p;
    };
    const armL = arm(-1),
      armR = arm(1);
    const head = add(
      new THREE.SphereGeometry(0.3, 22, 18),
      skin,
      0,
      1.83,
      0,
      body,
    );
    head.scale.set(1, 1.05, 1);
    add(
      new THREE.SphereGeometry(0.335, 22, 16, 0, TAU, 0, Math.PI * 0.55),
      hair,
      0,
      1.85,
      -0.01,
      body,
    );
    const back = add(
      new THREE.SphereGeometry(0.33, 18, 14),
      hair,
      0,
      1.7,
      -0.1,
      body,
    );
    back.scale.set(1.05, 1.25, 0.75);
    add(new THREE.BoxGeometry(0.12, 0.42, 0.18), hair, -0.28, 1.66, 0.04, body);
    add(new THREE.BoxGeometry(0.12, 0.42, 0.18), hair, 0.28, 1.66, 0.04, body);
    add(new THREE.SphereGeometry(0.058, 10, 8), eye, -0.1, 1.83, 0.265, body);
    add(new THREE.SphereGeometry(0.058, 10, 8), eye, 0.1, 1.83, 0.265, body);
    if (o.hat) {
      add(
        new THREE.CylinderGeometry(0.4, 0.4, 0.04, 24),
        dark,
        0,
        2.1,
        0,
        body,
      );
      add(
        new THREE.CylinderGeometry(0.25, 0.27, 0.4, 24),
        dark,
        0,
        2.32,
        0,
        body,
      );
      add(
        new THREE.CylinderGeometry(0.275, 0.275, 0.08, 24),
        M(0x6a4fd0, 0.5),
        0,
        2.16,
        0,
        body,
      );
    }
    if (o.mustache) {
      const mm = M(0x3a2414, 0.6);
      [-1, 1].forEach((s) => {
        const m = add(
          new THREE.SphereGeometry(0.07, 10, 8),
          mm,
          s * 0.07,
          1.72,
          0.28,
          body,
        );
        m.scale.set(1.7, 0.6, 0.6);
        m.rotation.z = s * 0.35;
      });
    }
    g.userData = { legL, legR, armL, armR, body, phase: 0 };
    return g;
  }
  function animateChar(ch, moving, dt, speed) {
    const u = ch.userData;
    if (moving) u.phase += dt * speed * 3.1;
    else u.phase *= Math.pow(0.001, dt);
    const s = Math.sin(u.phase);
    u.legL.rotation.x = s * 0.6;
    u.legR.rotation.x = -s * 0.6;
    u.armL.rotation.x = -s * 0.45;
    u.armR.rotation.x = s * 0.45;
    u.body.position.y = moving ? Math.abs(Math.cos(u.phase)) * 0.05 : 0;
  }
  const player = makeCharacter({ top: 0x6e5140, hair: 0x1f1a2e });
  const guardObj = makeCharacter({
    top: 0x5a45b8,
    hair: 0x5a3a24,
    hat: true,
    mustache: true,
  });
  scene.add(player, guardObj);

  /* speech bubble */
  function bubbleTex(ch, color) {
    const c = mk(128, 128),
      x = c.getContext("2d");
    x.fillStyle = "#fff";
    x.beginPath();
    x.arc(64, 58, 44, 0, TAU);
    x.fill();
    x.beginPath();
    x.moveTo(52, 96);
    x.lineTo(64, 122);
    x.lineTo(74, 96);
    x.fill();
    x.fillStyle = color;
    x.font = "bold 64px Georgia,serif";
    x.textAlign = "center";
    x.textBaseline = "middle";
    x.fillText(ch, 64, 62);
    const t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding;
    return t;
  }
  const bubbleTexs = {
    "!": bubbleTex("!", "#c0322b"),
    "?": bubbleTex("?", "#b07a12"),
  };
  const bubble = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: bubbleTexs["!"], depthTest: false }),
  );
  bubble.scale.set(0.8, 0.8, 1);
  bubble.position.y = 3;
  bubble.visible = false;
  guardObj.add(bubble);
  function setBubble(ch) {
    if (!ch) {
      bubble.visible = false;
      return;
    }
    bubble.material.map = bubbleTexs[ch];
    bubble.visible = true;
  }

  /* vision fan */
  const FAN = 28;
  const fanGeo = new THREE.BufferGeometry();
  fanGeo.setAttribute(
    "position",
    new THREE.BufferAttribute(new Float32Array((FAN + 2) * 3), 3),
  );
  const idx = [];
  for (let i = 1; i <= FAN; i++) idx.push(0, i, i + 1);
  fanGeo.setIndex(idx);
  const fanMat = new THREE.MeshBasicMaterial({
    color: 0xffe28a,
    transparent: true,
    opacity: 0.2,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const fan = new THREE.Mesh(fanGeo, fanMat);
  fan.frustumCulled = false;
  fan.renderOrder = 2;
  scene.add(fan);

  /* objective marker */
  const marker = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.28),
    new THREE.MeshStandardMaterial({
      color: 0xf1d98e,
      emissive: 0xc9a14a,
      emissiveIntensity: 0.8,
      metalness: 0.6,
      roughness: 0.3,
    }),
  );
  marker.scale.y = 1.5;
  scene.add(marker);

  /* ---------------- level building ---------------- */
  let level = new THREE.Group();
  scene.add(level);
  let obstacles = [],
    canvasInfo = null,
    doorInfo = null,
    spawn = { x: 6.4, z: 6.4 },
    curLevel = 0;
  function disposeLevel() {
    level.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material)
        [].concat(o.material).forEach((m) => {
          if (m.map) m.map.dispose();
          if (m.emissiveMap && m.emissiveMap !== m.map) m.emissiveMap.dispose();
          m.dispose();
        });
    });
    scene.remove(level);
    level = new THREE.Group();
    scene.add(level);
  }
  function mesh(geo, mat, x, y, z, opt = {}) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = opt.cast !== false;
    m.receiveShadow = true;
    if (opt.ry) m.rotation.y = opt.ry;
    level.add(m);
    return m;
  }
  const std = (c, r = 0.8, extra = {}) =>
    new THREE.MeshStandardMaterial(
      Object.assign({ color: c, roughness: r }, extra),
    );

  function buildLevel(i) {
    disposeLevel();
    curLevel = i;
    const L = LEVELS[i];
    scene.background = new THREE.Color(L.bg);
    obstacles = [];
    spawn = { x: L.spawn[0], z: L.spawn[1] };

    // floor
    const fc =
      i === 0
        ? woodTex(12, 48, 21, 3)
        : i === 1
          ? slateTex(5)
          : woodTex(14, 22, 11, 8);
    const floor = mesh(
      new THREE.PlaneGeometry(16, 16),
      std(0xffffff, 0.85, { map: tex(fc, 4, 4) }),
      0,
      0,
      0,
      { cast: false },
    );
    floor.rotation.x = -Math.PI / 2;

    // walls
    const wc =
      i === 0 ? panelWallTex() : i === 1 ? stoneWallTex() : plasterWallTex();
    const wm = std(0xffffff, 0.9, { map: tex(wc, 4.1, 1) });
    mesh(new THREE.BoxGeometry(16.4, 4, 0.4), wm, -0.2, 2, -8.2);
    const wm2 = std(0xffffff, 0.9, { map: tex(wc, 4, 1) });
    mesh(new THREE.BoxGeometry(0.4, 4, 16), wm2, -8.2, 2, 0);

    // canvas + door placement (randomized, on opposite walls)
    const spots = [-4.5, -0.5, 3.5];
    const canvasWall = Math.random() < 0.5 ? "z" : "x",
      doorWall = canvasWall === "z" ? "x" : "z";
    const cs = spots[Math.floor(Math.random() * 3)],
      ds = spots[Math.floor(Math.random() * 3)];

    // windows
    const winPos = [-6, -2.4, 1.2, 4.8];
    const winTex =
      i === 0 ? null : i === 1 ? tex(archWindow()) : tex(gridWindow());
    ["z", "x"].forEach((wall) =>
      winPos.forEach((s, k) => {
        if (wall === doorWall && Math.abs(s - ds) < 1.6) return;
        let geo, mat;
        if (i === 0) {
          geo = new THREE.PlaneGeometry(1.3, 1.9);
          mat = new THREE.MeshBasicMaterial({
            map: tex(stainedGlass(128, 192, k * 7 + (wall === "z" ? 1 : 50))),
          });
        } else if (i === 1) {
          geo = new THREE.PlaneGeometry(0.9, 1.8);
          mat = new THREE.MeshBasicMaterial({
            map: winTex,
            transparent: true,
            alphaTest: 0.5,
          });
        } else {
          geo = new THREE.PlaneGeometry(1, 1);
          mat = new THREE.MeshBasicMaterial({ map: winTex });
        }
        const y = i === 2 ? 2.5 : 2.25;
        const m =
          wall === "z"
            ? mesh(geo, mat, s, y, -7.98, { cast: false })
            : mesh(geo, mat, -7.98, y, s, {
                cast: false,
                ry: Math.PI / 2,
              });
        m.receiveShadow = false;
      }),
    );

    // decor & pillars
    const beam = std(i === 2 ? 0x3a2620 : 0x2a170f, 0.7);
    if (i !== 1) {
      for (let s = -8; s <= 8; s += 4) {
        mesh(new THREE.BoxGeometry(0.35, 4, 0.35), beam, s - 0.01, 2, -7.85);
        mesh(new THREE.BoxGeometry(0.35, 4, 0.35), beam, -7.85, 2, s);
      }
      mesh(new THREE.BoxGeometry(16.4, 0.3, 0.5), beam, -0.2, 4.05, -7.9);
      mesh(new THREE.BoxGeometry(0.5, 0.3, 16), beam, -7.9, 4.05, 0);
    } else {
      mesh(
        new THREE.BoxGeometry(16.4, 0.25, 0.6),
        std(0x2e2924, 0.9),
        -0.2,
        4.05,
        -7.9,
      );
      mesh(
        new THREE.BoxGeometry(0.6, 0.25, 16),
        std(0x2e2924, 0.9),
        -7.9,
        4.05,
        0,
      );
    }
    if (i === 0) {
      // rug + table corner
      const rc = mk(256, 256),
        rx = rc.getContext("2d");
      rx.fillStyle = "#4a1414";
      rx.fillRect(0, 0, 256, 256);
      rx.strokeStyle = "#b8893a";
      rx.lineWidth = 10;
      rx.strokeRect(14, 14, 228, 228);
      rx.lineWidth = 3;
      rx.strokeRect(34, 34, 188, 188);
      rx.fillStyle = "#6a2020";
      rx.beginPath();
      rx.moveTo(128, 60);
      rx.lineTo(196, 128);
      rx.lineTo(128, 196);
      rx.lineTo(60, 128);
      rx.closePath();
      rx.fill();
      rx.stroke();
      const rug = mesh(
        new THREE.PlaneGeometry(5, 5),
        std(0xffffff, 0.95, { map: tex(rc) }),
        0,
        0.01,
        0,
        { cast: false },
      );
      rug.rotation.x = -Math.PI / 2;
      mesh(
        new THREE.CylinderGeometry(0.5, 0.5, 0.08, 16),
        std(0x3b2217, 0.6),
        -6.6,
        0.8,
        -6.6,
      );
      mesh(
        new THREE.CylinderGeometry(0.06, 0.1, 0.8, 8),
        std(0x2a170f),
        -6.6,
        0.4,
        -6.6,
      );
      mesh(
        new THREE.CylinderGeometry(0.05, 0.05, 0.25, 8),
        std(0xf2ead8, 0.5, {
          emissive: 0xffcc88,
          emissiveIntensity: 0.3,
        }),
        -6.6,
        0.97,
        -6.6,
      );
      obstacles.push({ x0: -7.2, x1: -6, z0: -7.2, z1: -6 });
    }
    if (i === 1) {
      const grass = std(0x5fd34a, 0.6, {
        emissive: 0x1f6a18,
        emissiveIntensity: 0.4,
      });
      const rr = rng(77);
      for (let t = 0; t < 14; t++) {
        let gx, gz;
        do {
          gx = (rr() - 0.5) * 14;
          gz = (rr() - 0.5) * 14;
        } while (Math.hypot(gx - spawn.x, gz - spawn.z) < 2.4);
        for (let b = 0; b < 6; b++) {
          const bl = mesh(
            new THREE.ConeGeometry(0.035, 0.35 + rr() * 0.3, 4),
            grass,
            gx + (rr() - 0.5) * 0.35,
            0.2,
            gz + (rr() - 0.5) * 0.35,
            { cast: false },
          );
          bl.rotation.z = (rr() - 0.5) * 0.6;
          bl.rotation.x = (rr() - 0.5) * 0.6;
        }
      }
      // raised stone slabs (walkable decoration)
      [
        [-3.5, -5],
        [3.5, -5.2],
        [-5, 4.2],
      ].forEach(([sx, sz]) => {
        mesh(
          new THREE.BoxGeometry(3, 0.08, 1.6),
          std(0x131318, 1),
          sx,
          0.04,
          sz,
          { cast: false },
        );
      });
    }
    if (i === 2) {
      // spotlight pool & tree outside
      const trunk = std(0x5a3a26, 0.8),
        leaf = std(0x6b5bd6, 0.55, {
          emissive: 0x251a60,
          emissiveIntensity: 0.5,
        });
      mesh(new THREE.CylinderGeometry(0.35, 0.55, 4, 10), trunk, 10.5, 2, -8.5);
      [
        [0, 0, 0, 2.2],
        [1.3, 0.4, 0.6, 1.6],
        [-1.1, 0.3, -0.5, 1.7],
        [0.3, 1, -0.8, 1.5],
        [-0.4, -0.2, 1.1, 1.5],
      ].forEach(([dx, dy, dz, rad]) => {
        const s = mesh(
          new THREE.SphereGeometry(rad, 20, 16),
          leaf,
          10.5 + dx,
          5 + dy,
          -8.5 + dz,
        );
        s.scale.y = 0.7;
      });
      mesh(
        new THREE.CylinderGeometry(0.06, 0.06, 2.4, 8),
        std(0x222222, 0.5),
        -6.8,
        1.2,
        6.2,
      );
      mesh(
        new THREE.SphereGeometry(0.22, 12, 10),
        new THREE.MeshBasicMaterial({ color: 0xffe0a0 }),
        -6.8,
        2.5,
        6.2,
        { cast: false },
      );
    }

    // obstacles
    L.obstacles.forEach((o) => {
      obstacles.push({
        x0: o.x - o.sx / 2,
        x1: o.x + o.sx / 2,
        z0: o.z - o.sz / 2,
        z1: o.z + o.sz / 2,
      });
      if (o.kind === "vase" || o.kind === "bust") {
        const marble = std(0xddd5c8, 0.45);
        mesh(new THREE.BoxGeometry(o.sx, 1.1, o.sz), marble, o.x, 0.55, o.z);
        mesh(
          new THREE.BoxGeometry(o.sx + 0.15, 0.12, o.sz + 0.15),
          marble,
          o.x,
          1.14,
          o.z,
        );
        if (o.kind === "vase") {
          const v = mesh(
            new THREE.SphereGeometry(0.34, 16, 12),
            std(0x2d5a8c, 0.3),
            o.x,
            1.5,
            o.z,
          );
          v.scale.y = 1.2;
          mesh(
            new THREE.CylinderGeometry(0.14, 0.2, 0.3, 12),
            std(0x2d5a8c, 0.3),
            o.x,
            1.9,
            o.z,
          );
        } else {
          mesh(
            new THREE.CylinderGeometry(0.25, 0.35, 0.35, 14),
            marble,
            o.x,
            1.37,
            o.z,
          );
          mesh(new THREE.SphereGeometry(0.26, 16, 12), marble, o.x, 1.78, o.z);
        }
      } else if (o.kind === "slab") {
        mesh(
          new THREE.BoxGeometry(o.sx, 0.6, o.sz),
          std(0x34343d, 0.9),
          o.x,
          0.3,
          o.z,
        );
        mesh(
          new THREE.BoxGeometry(o.sx - 0.3, 0.1, o.sz - 0.3),
          std(0x5b1d2a, 0.9),
          o.x,
          0.65,
          o.z,
        );
      } else {
        const ct = tex(woodTex(28, 40, 32, 11), 1, 1);
        const cm = std(0xffffff, 0.8, { map: ct });
        mesh(new THREE.BoxGeometry(o.sx, 1.2, o.sz), cm, o.x, 0.6, o.z);
        mesh(
          new THREE.BoxGeometry(o.sx * 0.6, 0.7, o.sz * 0.6),
          cm,
          o.x + 0.1,
          1.55,
          o.z - 0.1,
          { ry: 0.4 },
        );
      }
    });

    // easel with painting
    const [ptype, pseed, pw, ph] = L.hero;
    const paint = tex(painting(ptype, pseed, pw, ph));
    paint.wrapS = paint.wrapT = THREE.ClampToEdgeWrapping;
    const easel = new THREE.Group();
    const em = std(0x1e2a24, 0.6);
    const legGeo = new THREE.BoxGeometry(0.07, 2.3, 0.07);
    [
      [-0.45, 0.12, 0.15],
      [0.45, 0.12, -0.15],
    ].forEach(([lx, rz, rx]) => {
      const l = new THREE.Mesh(legGeo, em);
      l.position.set(lx, 1.1, 0.1);
      l.rotation.z = lx < 0 ? 0.18 : -0.18;
      l.rotation.x = -0.08;
      l.castShadow = true;
      easel.add(l);
    });
    const bl = new THREE.Mesh(legGeo, em);
    bl.position.set(0, 1.05, -0.4);
    bl.rotation.x = 0.3;
    bl.castShadow = true;
    easel.add(bl);
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.06, 0.18), em);
    shelf.position.set(0, 0.85, 0.13);
    easel.add(shelf);
    const pWidth = pw > ph ? 1.35 : 1.0,
      pHeight = (pWidth * ph) / pw;
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(pWidth + 0.12, pHeight + 0.12, 0.06),
      std(0xc9a14a, 0.35, { metalness: 0.7 }),
    );
    frame.position.set(0, 0.88 + pHeight / 2 + 0.06, 0.16);
    frame.rotation.x = -0.08;
    frame.castShadow = true;
    easel.add(frame);
    const pic = new THREE.Mesh(
      new THREE.PlaneGeometry(pWidth, pHeight),
      new THREE.MeshStandardMaterial({
        map: paint,
        emissiveMap: paint,
        emissive: 0xffffff,
        emissiveIntensity: 0.45,
        roughness: 0.7,
      }),
    );
    pic.position.set(0, 0.88 + pHeight / 2 + 0.06, 0.195);
    pic.rotation.x = -0.08;
    easel.add(pic);
    let ex, ez, ery;
    if (canvasWall === "z") {
      ex = cs;
      ez = -6.5;
      ery = 0.35;
    } else {
      ex = -6.5;
      ez = cs;
      ery = Math.PI / 2 - 0.35;
    }
    easel.position.set(ex, 0, ez);
    easel.rotation.y = ery;
    level.add(easel);
    obstacles.push({
      x0: ex - 0.5,
      x1: ex + 0.5,
      z0: ez - 0.5,
      z1: ez + 0.5,
    });
    canvasInfo = {
      x: ex + Math.sin(ery) * 1.15,
      z: ez + Math.cos(ery) * 1.15,
      mx: ex,
      mz: ez,
      my: 3.3,
    };

    // door
    let door;
    if (i === 0) {
      door = new THREE.Group();
      const glass = new THREE.Mesh(
        new THREE.PlaneGeometry(1.3, 2.7),
        new THREE.MeshBasicMaterial({
          map: tex(stainedGlass(120, 250, 99)),
        }),
      );
      glass.position.y = 1.35;
      door.add(glass);
      const fm = std(0x2a170f, 0.6);
      [
        [-0.72, 1.4, 0.12, 2.9],
        [0.72, 1.4, 0.12, 2.9],
      ].forEach(([fx, fy, fw, fh]) => {
        const f = new THREE.Mesh(new THREE.BoxGeometry(fw, fh, 0.15), fm);
        f.position.set(fx, fy, 0.02);
        door.add(f);
      });
      const top = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.14, 0.15), fm);
      top.position.set(0, 2.82, 0.02);
      door.add(top);
    } else {
      door = new THREE.Group();
      const d = new THREE.Mesh(
        new THREE.PlaneGeometry(1.5, 2.8),
        new THREE.MeshStandardMaterial({
          map: tex(woodDoor()),
          transparent: true,
          alphaTest: 0.5,
          roughness: 0.8,
          emissive: 0x3a2414,
          emissiveIntensity: 0.35,
        }),
      );
      d.position.y = 1.4;
      door.add(d);
      const knob = new THREE.Mesh(
        new THREE.SphereGeometry(0.07, 10, 8),
        std(0xc9a14a, 0.3, { metalness: 0.8 }),
      );
      knob.position.set(0.52, 1.3, 0.06);
      door.add(knob);
    }
    let dx, dz, dry;
    if (doorWall === "z") {
      dx = ds;
      dz = -7.96;
      dry = 0;
    } else {
      dx = -7.96;
      dz = ds;
      dry = Math.PI / 2;
    }
    door.position.set(dx, 0, dz);
    door.rotation.y = dry;
    level.add(door);
    doorInfo = {
      x: dx + Math.sin(dry) * 1.1,
      z: dz + Math.cos(dry) * 1.1,
      mx: dx + Math.sin(dry) * 0.3,
      mz: dz + Math.cos(dry) * 0.3,
      my: 3.4,
    };

    // entrance (safe zone)
    const ring = mesh(
      new THREE.RingGeometry(1.75, 1.95, 48),
      new THREE.MeshBasicMaterial({
        color: 0xc9a14a,
        transparent: true,
        opacity: 0.55,
      }),
      spawn.x,
      0.02,
      spawn.z,
      { cast: false },
    );
    ring.rotation.x = -Math.PI / 2;
    const mat = mesh(
      new THREE.CircleGeometry(1.75, 48),
      std(0x2a1d3a, 0.95, { transparent: true, opacity: 0.6 }),
      spawn.x,
      0.015,
      spawn.z,
      { cast: false },
    );
    mat.rotation.x = -Math.PI / 2;

    // lights
    const hemiC = [
      [0xffe0c0, 0x2b1a12, 0.95],
      [0xa9b5d6, 0x121218, 0.8],
      [0x9a80b8, 0x140c14, 0.7],
    ][i];
    level.add(new THREE.HemisphereLight(hemiC[0], hemiC[1], hemiC[2]));
    const dir = new THREE.DirectionalLight(
      [0xffd2a0, 0xc8d6ff, 0xd8c8ff][i],
      [0.95, 0.6, 0.4][i],
    );
    dir.position.set(7, 14, 5);
    dir.castShadow = true;
    dir.shadow.mapSize.set(2048, 2048);
    const sc = dir.shadow.camera;
    sc.left = -13;
    sc.right = 13;
    sc.top = 13;
    sc.bottom = -13;
    sc.near = 1;
    sc.far = 40;
    dir.shadow.bias = -0.0008;
    level.add(dir);
    level.add(dir.target);
    const pc = [0xff8a3a, 0xffcf6a, 0xffd98a][i];
    [
      [-6.5, 2.6, -3],
      [1, 2.6, -6.5],
      [-3, 2.6, 4],
    ].forEach(([px, py, pz]) => {
      const p = new THREE.PointLight(pc, [1.1, 0.9, 0.8][i], 10, 1.6);
      p.position.set(px, py, pz);
      level.add(p);
    });
    if (i === 2) {
      const sp = new THREE.SpotLight(0xfff0d8, 1.5, 24, 0.55, 0.6, 1.2);
      sp.position.set(0, 12, 0);
      sp.target.position.set(0, 0, 0);
      sp.castShadow = true;
      sp.shadow.mapSize.set(1024, 1024);
      level.add(sp, sp.target);
    }
  }

  /* ---------------- collision & sight ---------------- */
  const BOUND = 7.6;
  function collide(p, r) {
    for (const b of obstacles) {
      const cx = clamp(p.x, b.x0, b.x1),
        cz = clamp(p.z, b.z0, b.z1);
      let dx = p.x - cx,
        dz = p.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        if (d2 > 1e-8) {
          const d = Math.sqrt(d2);
          p.x = cx + (dx / d) * r;
          p.z = cz + (dz / d) * r;
        } else {
          const pen = [
            [p.x - b.x0, -1, 0],
            [b.x1 - p.x, 1, 0],
            [p.z - b.z0, 0, -1],
            [b.z1 - p.z, 0, 1],
          ].sort((a, c) => a[0] - c[0])[0];
          p.x += pen[1] * (pen[0] + r);
          p.z += pen[2] * (pen[0] + r);
        }
      }
    }
    p.x = clamp(p.x, -BOUND, BOUND);
    p.z = clamp(p.z, -BOUND, BOUND);
  }
  function rayDist(ox, oz, dx, dz, max) {
    let t = max;
    if (dx > 1e-6) t = Math.min(t, (7.95 - ox) / dx);
    else if (dx < -1e-6) t = Math.min(t, (-7.95 - ox) / dx);
    if (dz > 1e-6) t = Math.min(t, (7.95 - oz) / dz);
    else if (dz < -1e-6) t = Math.min(t, (-7.95 - oz) / dz);
    for (const b of obstacles) {
      const t1 = (b.x0 - ox) / dx,
        t2 = (b.x1 - ox) / dx,
        t3 = (b.z0 - oz) / dz,
        t4 = (b.z1 - oz) / dz;
      const tmin = Math.max(Math.min(t1, t2), Math.min(t3, t4)),
        tmax = Math.min(Math.max(t1, t2), Math.max(t3, t4));
      if (tmax >= Math.max(tmin, 0) && tmin > 0 && tmin < t) t = tmin;
    }
    return Math.max(0, t);
  }

  /* ---------------- game state ---------------- */
  let state = "title",
    read = false,
    timer = 0,
    caughtCount = 0,
    caughtT = 0;
  const guard = {
    obj: guardObj,
    heading: 0,
    state: "patrol",
    wi: 0,
    t: 0,
    last: null,
    lost: 0,
    cfg: null,
  };
  function resetGuard(farFromSpawn) {
    const cfg = LEVELS[curLevel].guard;
    guard.cfg = cfg;
    let wi = 0;
    if (farFromSpawn) {
      let best = -1;
      cfg.wp.forEach((w, k) => {
        const d =
          Math.hypot(w[0] - spawn.x, w[1] - spawn.z) + Math.random() * 3;
        if (d > best) {
          best = d;
          wi = k;
        }
      });
    }
    guard.obj.position.set(cfg.wp[wi][0], 0, cfg.wp[wi][1]);
    guard.wi = (wi + 1) % cfg.wp.length;
    guard.state = "patrol";
    guard.last = null;
    guard.lost = 0;
    setBubble(null);
    const nx = cfg.wp[guard.wi];
    guard.heading = Math.atan2(nx[0] - cfg.wp[wi][0], nx[1] - cfg.wp[wi][1]);
  }
  function resetPlayer() {
    player.position.set(spawn.x, 0, spawn.z);
    player.rotation.y = Math.PI * 1.25;
  }

  function startLevel(i) {
    hideAll();
    buildLevel(i);
    read = false;
    timer = 0;
    caughtCount = 0;
    resetPlayer();
    resetGuard(true);
    state = "play";
    keys.length = 0;
    $("title").classList.add("hidden");
    $("hud").classList.remove("hidden");
    if (isTouch) $("touch").classList.remove("hidden");
    if (gui) {
      gui.show();
      params.stage = LEVELS[i].key;
      params["Display Credits"] = false;
      gui.controllersRecursive().forEach((c) => c.updateDisplay());
    }
    updateHud();
  }
  function toTitle() {
    hideAll();
    buildLevel(0);
    resetPlayer();
    resetGuard(false);
    state = "title";
    $("title").classList.remove("hidden");
    $("hud").classList.add("hidden");
    $("touch").classList.add("hidden");
    $("prompt").classList.add("hidden");
    if (gui) gui.hide();
    renderGalleries();
  }
  function hideAll() {
    ["m-read", "m-quiz", "m-win", "credits", "toast"].forEach((id) =>
      $(id).classList.add("hidden"),
    );
  }
  function updateHud() {
    const L = LEVELS[curLevel];
    $("hud-room").textContent = `Gallery ${curLevel + 1}: ${L.name}`;
    $("hud-tech").textContent = read
      ? `Technique: ${L.technique}`
      : "Technique: unknown";
    $("hud-obj").textContent = read
      ? "Reach the door and pass the test."
      : "Sneak to the painting and study its technique.";
    $("hud-stats").textContent = caughtCount
      ? `Caught ${caughtCount} ${caughtCount === 1 ? "time" : "times"}`
      : "Not caught yet";
  }
  function renderGalleries() {
    const cleared = store.get("artdepart-cleared", []);
    const g = $("galleries");
    g.innerHTML = "";
    LEVELS.forEach((L, i) => {
      const b = document.createElement("button");
      b.className = "gallery-btn";
      b.innerHTML = `<b>${L.name}</b><span>${cleared.includes(i) ? '<span class="done">Stolen: </span>' : ""}${L.technique}</span>`;
      b.setAttribute(
        "aria-label",
        `Play gallery ${i + 1}, ${L.name}${cleared.includes(i) ? ", already stolen" : ""}`,
      );
      b.onclick = () => startLevel(i);
      g.appendChild(b);
    });
  }

  /* ---------------- input ---------------- */
  const keys = [];
  const KEYMAP = {
    KeyW: "up",
    ArrowUp: "up",
    KeyS: "down",
    ArrowDown: "down",
    KeyA: "left",
    ArrowLeft: "left",
    KeyD: "right",
    ArrowRight: "right",
  };
  const S2 = Math.SQRT1_2;
  const DIRS = {
    up: { x: -S2, z: -S2 },
    down: { x: S2, z: S2 },
    left: { x: -S2, z: S2 },
    right: { x: S2, z: -S2 },
  };
  addEventListener("keydown", (e) => {
    const d = KEYMAP[e.code];
    if (d && state === "play") {
      e.preventDefault();
      if (!keys.includes(d)) keys.push(d);
      return;
    }
    if (
      (e.code === "KeyE" || e.code === "Space" || e.code === "Enter") &&
      state === "play"
    ) {
      e.preventDefault();
      interact();
      return;
    }
    if (e.code === "Escape") {
      if (state === "modal") closeModals();
      else if (state === "credits") toTitle();
    }
  });
  addEventListener("keyup", (e) => {
    const d = KEYMAP[e.code];
    if (d) {
      const k = keys.indexOf(d);
      if (k >= 0) keys.splice(k, 1);
    }
  });
  addEventListener("blur", () => {
    keys.length = 0;
  });
  document.querySelectorAll(".dpad button").forEach((b) => {
    const d = b.dataset.dir;
    const on = (e) => {
      e.preventDefault();
      b.classList.add("on");
      if (!keys.includes(d)) keys.push(d);
    };
    const off = (e) => {
      b.classList.remove("on");
      const k = keys.indexOf(d);
      if (k >= 0) keys.splice(k, 1);
    };
    b.addEventListener("pointerdown", on);
    b.addEventListener("pointerup", off);
    b.addEventListener("pointercancel", off);
    b.addEventListener("pointerleave", off);
  });
  $("act").addEventListener("click", () => {
    if (state === "play") interact();
  });

  /* ---------------- interaction & modals ---------------- */
  function nearTarget() {
    const p = player.position;
    if (Math.hypot(p.x - canvasInfo.x, p.z - canvasInfo.z) < 1.7)
      return "canvas";
    if (Math.hypot(p.x - doorInfo.x, p.z - doorInfo.z) < 1.8) return "door";
    return null;
  }
  const verb = isTouch ? "Tap Interact" : "Press E";
  function updatePrompt() {
    const n = state === "play" ? nearTarget() : null,
      el = $("prompt");
    if (!n) {
      el.classList.add("hidden");
      return;
    }
    el.textContent =
      n === "canvas"
        ? `${verb} to study the painting`
        : read
          ? `${verb} to pick the lock`
          : "Locked. Study the painting first.";
    el.classList.remove("hidden");
  }
  function interact() {
    const n = nearTarget();
    if (n === "canvas") openRead();
    else if (n === "door") {
      if (read) openQuiz();
      else
        flash(
          "Locked",
          "The lock needs the technique. Study the painting first.",
          1.6,
          "#f1d98e",
        );
    }
  }
  let lastFocus = null;
  function openModal(id, focusSel) {
    keys.length = 0;
    state = "modal";
    lastFocus = document.activeElement;
    $(id).classList.remove("hidden");
    $("prompt").classList.add("hidden");
    const f = $(id).querySelector(focusSel || "button");
    if (f) f.focus();
  }
  function closeModals() {
    ["m-read", "m-quiz"].forEach((id) => $(id).classList.add("hidden"));
    if (state === "modal") state = "play";
    if (lastFocus && lastFocus.focus) lastFocus.blur();
  }
  document
    .querySelectorAll("[data-close]")
    .forEach((b) => b.addEventListener("click", closeModals));
  function openRead() {
    const L = LEVELS[curLevel],
      [t, s, w, h] = L.hero;
    $("read-img").src = paintingURL(t, s, w, h);
    $("read-img").alt =
      `A study painted in the ${L.technique.toLowerCase()} technique`;
    $("read-h").textContent = L.technique;
    $("read-def").textContent = L.def;
    $("read-seen").textContent = L.seen;
    read = true;
    updateHud();
    openModal("m-read", ".btn");
  }
  let quizDone = false;
  function openQuiz() {
    const L = LEVELS[curLevel];
    quizDone = false;
    $("m-read").classList.add("hidden");
    $("q-sub").textContent = `${L.technique}: ${L.def.split(". ")[0]}.`;
    $("q-feedback").textContent = "";
    const box = $("q-cards");
    box.innerHTML = "";
    const opts = L.options.slice().sort(() => Math.random() - 0.5);
    opts.forEach((o) => {
      const b = document.createElement("button");
      b.className = "qcard";
      b.style.setProperty(
        "--tilt",
        (Math.random() < 0.5 ? -1 : 1) * (2 + Math.random() * 3) + "deg",
      );
      b.setAttribute("aria-label", `Choose "${o.title}"`);
      b.innerHTML = `<div class="qinner"><div class="qface qfront"><img alt="" src="${paintingURL(o.p, o.seed, 300, 400)}"><span class="qcap">${o.title}</span></div><div class="qface qback ${o.correct ? "ok" : "bad"}">${o.correct ? "Correct" : "Incorrect"}</div></div>`;
      b.onclick = () => {
        if (quizDone || b.classList.contains("flipped")) return;
        b.classList.add("flipped");
        b.disabled = true;
        $("q-feedback").textContent = o.why;
        if (o.correct) {
          quizDone = true;
          box.querySelectorAll(".qcard").forEach((c) => (c.disabled = true));
          setTimeout(winLevel, 1500);
        }
      };
      box.appendChild(b);
    });
    openModal("m-quiz", ".qcard");
  }
  $("q-back").addEventListener("click", () => {
    if (!quizDone) closeModals();
  });
  function fmtTime(t) {
    const m = Math.floor(t / 60),
      s = Math.floor(t % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  }
  function winLevel() {
    $("m-quiz").classList.add("hidden");
    const L = LEVELS[curLevel],
      [t, s, w, h] = L.hero;
    const cleared = store.get("artdepart-cleared", []);
    if (!cleared.includes(curLevel)) {
      cleared.push(curLevel);
      store.set("artdepart-cleared", cleared);
    }
    $("win-img").src = paintingURL(t, s, w, h);
    $("win-img").alt = `The ${L.technique.toLowerCase()} study you stole`;
    $("win-tech").textContent = L.technique;
    $("win-time").textContent = fmtTime(timer);
    $("win-caught").textContent = caughtCount;
    const last = curLevel === LEVELS.length - 1;
    $("win-h").textContent = last
      ? "The final masterpiece is yours"
      : "Masterpiece acquired";
    $("win-next").textContent = last ? "Roll the credits" : "Next gallery";
    state = "won";
    $("m-win").classList.remove("hidden");
    $("win-next").focus();
  }
  $("win-next").addEventListener("click", () => {
    if (curLevel < LEVELS.length - 1) startLevel(curLevel + 1);
    else showCredits();
  });
  $("win-title").addEventListener("click", toTitle);

  let toastT = 0;
  function flash(h, p, dur, color) {
    $("toast-h").textContent = h;
    $("toast-h").style.color = color || "#ff9b7d";
    $("toast-p").textContent = p;
    $("toast").classList.remove("hidden");
    toastT = dur;
  }

  /* ---------------- credits ---------------- */
  let creditsDrawn = false;
  function drawCredits() {
    if (creditsDrawn) return;
    creditsDrawn = true;
    const c = $("credits-canvas"),
      x = c.getContext("2d"),
      w = c.width,
      h = c.height,
      r = rng(2024);
    const g = x.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#15122b");
    g.addColorStop(0.35, "#2c2156");
    g.addColorStop(0.62, "#4d3a93");
    g.addColorStop(1, "#2a1f55");
    x.fillStyle = g;
    x.fillRect(0, 0, w, h);
    x.fillStyle = "#3a2d72";
    for (let i = 0; i < 7; i++) {
      x.beginPath();
      x.ellipse(
        r() * w,
        h * (0.12 + r() * 0.35),
        w * (0.15 + r() * 0.25),
        h * (0.03 + r() * 0.04),
        0,
        0,
        TAU,
      );
      x.fill();
    }
    x.fillStyle = "#231a47";
    x.beginPath();
    x.moveTo(0, h * 0.66);
    for (let i = 0; i <= 12; i++) {
      x.lineTo(
        (i / 12) * w,
        h * (0.6 + Math.sin(i * 1.3) * 0.04 + (i % 3 ? 0 : -0.05)),
      );
    }
    x.lineTo(w, h);
    x.lineTo(0, h);
    x.fill();
    x.fillStyle = "#3b2d6e";
    x.beginPath();
    x.moveTo(0, h * 0.74);
    x.quadraticCurveTo(w * 0.5, h * 0.66, w, h * 0.76);
    x.lineTo(w, h);
    x.lineTo(0, h);
    x.fill();
    x.fillStyle = "#8d74d6";
    x.beginPath();
    x.moveTo(w * 0.485, h * 0.6);
    x.lineTo(w * 0.515, h * 0.6);
    x.lineTo(w * 0.68, h);
    x.lineTo(w * 0.32, h);
    x.closePath();
    x.fill();
    const glow = x.createRadialGradient(
      w * 0.5,
      h * 0.66,
      10,
      w * 0.5,
      h * 0.72,
      w * 0.3,
    );
    glow.addColorStop(0, "rgba(210,190,255,.55)");
    glow.addColorStop(1, "rgba(210,190,255,0)");
    x.fillStyle = glow;
    x.fillRect(0, 0, w, h);
    paintOver(x, w, h, r, {
      n: 5200,
      jit: 14,
      alpha: 0.4,
      lw: [6, 16],
      len: [18, 52],
      angJit: 0.35,
      accent: [
        0.02,
        [
          [90, 70, 160],
          [130, 110, 200],
        ],
      ],
    });
    // the thief, seen from behind
    const cx = w * 0.5,
      base = h * 0.64,
      s = h * 0.0011;
    const blob = (col, fn) => {
      x.fillStyle = col;
      x.beginPath();
      fn();
      x.fill();
    };
    blob("#231c2c", () => {
      x.roundRect
        ? x.roundRect(cx - 18 * s, base - 95 * s, 15 * s, 85 * s, 6 * s)
        : x.rect(cx - 18 * s, base - 95 * s, 15 * s, 85 * s);
    });
    blob("#231c2c", () => {
      x.roundRect
        ? x.roundRect(cx + 3 * s, base - 95 * s, 15 * s, 85 * s, 6 * s)
        : x.rect(cx + 3 * s, base - 95 * s, 15 * s, 85 * s);
    });
    blob("#d0583e", () => {
      x.ellipse(cx - 11 * s, base - 6 * s, 13 * s, 9 * s, 0, 0, TAU);
    });
    blob("#d0583e", () => {
      x.ellipse(cx + 11 * s, base - 6 * s, 13 * s, 9 * s, 0, 0, TAU);
    });
    blob("#e8c8a4", () => {
      x.rect(cx - 19 * s, base - 108 * s, 38 * s, 14 * s);
    });
    blob("#6e5140", () => {
      x.moveTo(cx - 24 * s, base - 106 * s);
      x.lineTo(cx - 28 * s, base - 160 * s);
      x.quadraticCurveTo(cx, base - 172 * s, cx + 28 * s, base - 160 * s);
      x.lineTo(cx + 24 * s, base - 106 * s);
      x.closePath();
    });
    blob("#6e5140", () => {
      x.moveTo(cx - 28 * s, base - 158 * s);
      x.lineTo(cx - 46 * s, base - 112 * s);
      x.lineTo(cx - 34 * s, base - 108 * s);
      x.lineTo(cx - 22 * s, base - 140 * s);
      x.closePath();
    });
    blob("#6e5140", () => {
      x.moveTo(cx + 28 * s, base - 158 * s);
      x.lineTo(cx + 46 * s, base - 112 * s);
      x.lineTo(cx + 34 * s, base - 108 * s);
      x.lineTo(cx + 22 * s, base - 140 * s);
      x.closePath();
    });
    blob("#1c1622", () => {
      x.ellipse(cx, base - 190 * s, 30 * s, 36 * s, 0, 0, TAU);
    });
    blob("#1c1622", () => {
      x.ellipse(cx, base - 165 * s, 32 * s, 22 * s, 0, 0, TAU);
    });
    const halo = x.createRadialGradient(
      cx,
      base - 120 * s,
      5,
      cx,
      base - 120 * s,
      160 * s,
    );
    halo.addColorStop(0, "rgba(230,210,255,.18)");
    halo.addColorStop(1, "rgba(230,210,255,0)");
    x.fillStyle = halo;
    x.fillRect(0, 0, w, h);
  }
  function showCredits() {
    hideAll();
    drawCredits();
    state = "credits";
    $("title").classList.add("hidden");
    $("hud").classList.add("hidden");
    $("touch").classList.add("hidden");
    $("prompt").classList.add("hidden");
    const roll = $("roll");
    roll.style.animation = "none";
    void roll.offsetWidth;
    roll.style.animation = "";
    $("credits").classList.remove("hidden");
    $("credits-close").focus();
    if (gui) {
      params["Display Credits"] = true;
      gui.controllersRecursive().forEach((c) => c.updateDisplay());
    }
  }
  $("credits-close").addEventListener("click", () => {
    if (gui && state === "credits" && wasPlaying) {
      wasPlaying = false;
      $("credits").classList.add("hidden");
      resumePlay();
    } else toTitle();
  });
  $("btn-start").addEventListener("click", () => startLevel(0));
  $("btn-credits").addEventListener("click", showCredits);

  /* ---------------- lil-gui (level select + credits) ---------------- */
  let gui = null,
    params = {
      stage: "Level1",
      "Display Credits": false,
      "Back to title": () => toTitle(),
    },
    wasPlaying = false;
  function resumePlay() {
    state = "play";
    $("hud").classList.remove("hidden");
    if (isTouch) $("touch").classList.remove("hidden");
    params["Display Credits"] = false;
    if (gui) gui.controllersRecursive().forEach((c) => c.updateDisplay());
  }
  if (window.lil && lil.GUI) {
    gui = new lil.GUI({ title: "Controls" });
    const env = gui.addFolder("Environment");
    env
      .add(
        params,
        "stage",
        LEVELS.map((l) => l.key),
      )
      .onChange((v) => startLevel(LEVELS.findIndex((l) => l.key === v)));
    const cr = gui.addFolder("Credits");
    cr.add(params, "Display Credits").onChange((v) => {
      if (v) {
        wasPlaying = state === "play" || state === "modal";
        hideAll();
        if (state === "modal") state = "play";
        showCredits();
      } else if (state === "credits") {
        $("credits").classList.add("hidden");
        if (wasPlaying) {
          wasPlaying = false;
          resumePlay();
        } else toTitle();
      }
    });
    gui.add(params, "Back to title");
    if (innerWidth < 700) gui.close();
    gui.hide();
  }

  /* ---------------- update loop ---------------- */
  function updatePlayer(dt) {
    const d = keys[keys.length - 1];
    const SPEED = 4.1;
    if (d) {
      const v = DIRS[d];
      player.rotation.y = Math.atan2(v.x, v.z);
      const p = player.position;
      p.x += v.x * SPEED * dt;
      p.z += v.z * SPEED * dt;
      collide(p, 0.32);
      animateChar(player, true, dt, SPEED);
    } else animateChar(player, false, dt, 0);
  }
  function updateGuard(dt, active) {
    const g = guard,
      cfg = g.cfg,
      p = g.obj.position,
      pl = player.position;
    const vx = pl.x - p.x,
      vz = pl.z - p.z,
      dist = Math.hypot(vx, vz);
    const inSafe = Math.hypot(pl.x - spawn.x, pl.z - spawn.z) < 1.9;
    const range = cfg.range,
      fov = (cfg.fov * Math.PI) / 180;
    let sees = false;
    if (active && !inSafe && dist > 0) {
      if (dist < 1.1) sees = true;
      else if (
        dist < range &&
        Math.abs(angDiff(Math.atan2(vx, vz), g.heading)) < fov / 2 &&
        rayDist(p.x, p.z, vx / dist, vz / dist, dist) >= dist - 0.05
      )
        sees = true;
    }
    let target = null,
      speed = 0;
    const alert = () => {
      g.state = "alert";
      g.t = 0.4;
      setBubble("!");
    };
    switch (g.state) {
      case "patrol":
        if (sees) {
          alert();
          break;
        }
        target = cfg.wp[g.wi];
        speed = cfg.speed;
        if (Math.hypot(target[0] - p.x, target[1] - p.z) < 0.15) {
          g.state = "pause";
          g.t = 0.8;
          g.baseH = g.heading;
          target = null;
        }
        break;
      case "pause":
        g.t -= dt;
        g.heading = g.baseH + Math.sin((0.8 - g.t) * 6) * 0.5;
        if (sees) {
          alert();
          break;
        }
        if (g.t <= 0) {
          g.wi = (g.wi + 1) % cfg.wp.length;
          g.state = "patrol";
        }
        break;
      case "alert":
        g.t -= dt;
        g.heading = turnToward(g.heading, Math.atan2(vx, vz), dt * 10);
        if (g.t <= 0) {
          g.state = "chase";
          g.last = [pl.x, pl.z];
          g.lost = 0;
        }
        break;
      case "chase":
        if (sees) {
          g.last = [pl.x, pl.z];
          g.lost = 0;
        } else g.lost += dt;
        target = g.last;
        speed = cfg.chase;
        if (
          inSafe ||
          g.lost > 2.2 ||
          (!sees && Math.hypot(g.last[0] - p.x, g.last[1] - p.z) < 0.3)
        ) {
          g.state = "search";
          g.t = 1.6;
          setBubble("?");
          target = null;
        }
        break;
      case "search":
        g.t -= dt;
        g.heading += dt * 2.6;
        if (sees) {
          alert();
          break;
        }
        if (g.t <= 0) {
          let best = 1e9;
          cfg.wp.forEach((w, k) => {
            const d = Math.hypot(w[0] - p.x, w[1] - p.z);
            if (d < best) {
              best = d;
              g.wi = k;
            }
          });
          g.state = "patrol";
          setBubble(null);
        }
        break;
    }
    let moving = false;
    if (target) {
      const tx = target[0] - p.x,
        tz = target[1] - p.z,
        td = Math.hypot(tx, tz);
      if (td > 0.05) {
        const step = Math.min(td, speed * dt);
        const want = Math.atan2(tx, tz);
        g.heading = turnToward(
          g.heading,
          want,
          dt * (g.state === "chase" ? 12 : 6),
        );
        const bx = p.x,
          bz = p.z;
        p.x += (tx / td) * step;
        p.z += (tz / td) * step;
        collide(p, 0.35);
        moving = true;
        if (
          g.state === "chase" &&
          Math.hypot(p.x - bx, p.z - bz) < step * 0.25
        ) {
          g.lost += dt * 2;
        }
      }
    }
    g.obj.rotation.y = g.heading;
    animateChar(g.obj, moving, dt, speed);
    // fan
    const pos = fanGeo.attributes.position.array;
    pos[0] = p.x;
    pos[1] = 0.04;
    pos[2] = p.z;
    for (let k = 0; k <= FAN; k++) {
      const a = g.heading - fov / 2 + (fov * k) / FAN,
        dx = Math.sin(a),
        dz = Math.cos(a),
        d = rayDist(p.x, p.z, dx, dz, range);
      pos[(k + 1) * 3] = p.x + dx * d;
      pos[(k + 1) * 3 + 1] = 0.04;
      pos[(k + 1) * 3 + 2] = p.z + dz * d;
    }
    fanGeo.attributes.position.needsUpdate = true;
    const hot = g.state === "alert" || g.state === "chase";
    fanMat.color.setHex(
      hot ? 0xff4a3a : g.state === "search" ? 0xffa040 : 0xffe28a,
    );
    fanMat.opacity = hot ? 0.3 : 0.2;
    if (active && !inSafe && dist < 0.8) caught();
  }
  function caught() {
    caughtCount++;
    state = "caught";
    caughtT = 1.5;
    keys.length = 0;
    setBubble("!");
    flash(
      "Caught!",
      "The curator marched you back to the entrance, then wandered off somewhere else.",
      1.5,
    );
    updateHud();
  }
  const clock = new THREE.Clock();
  let tAll = 0;
  function loop() {
    const dt = Math.min(clock.getDelta(), 0.05);
    tAll += dt;
    if (state === "play") {
      updatePlayer(dt);
      updateGuard(dt, true);
      timer += dt;
    } else if (state === "title") {
      updateGuard(dt, false);
      animateChar(player, false, dt, 0);
    } else if (state === "caught") {
      caughtT -= dt;
      if (caughtT <= 0) {
        resetPlayer();
        resetGuard(true);
        state = "play";
      }
    }
    if (toastT > 0) {
      toastT -= dt;
      if (toastT <= 0) $("toast").classList.add("hidden");
    }
    // marker
    if (canvasInfo) {
      const t = read ? doorInfo : canvasInfo;
      marker.visible = state === "play" || state === "caught";
      marker.position.set(t.mx, t.my + Math.sin(tAll * 3) * 0.15, t.mz);
      marker.rotation.y += dt * 1.8;
    }
    updatePrompt();
    renderer.render(scene, camera);
    requestAnimationFrame(loop);
  }
  toTitle();
  loop();
})();
