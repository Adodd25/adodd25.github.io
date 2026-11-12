// Animated "network defense" background.
// Nodes drift and link up, data packets hop between them, and every few
// seconds a threat flies in and gets blocked by a shield pulse.
// The mouse acts as a scanner; clicking sends a burst of packets.
// Respects prefers-reduced-motion (draws one still frame) and pauses when
// the tab is hidden.
(() => {
  const canvas = document.getElementById("cyber-bg");
  if (!canvas || !canvas.getContext) return;
  const ctx = canvas.getContext("2d");
  const intensity = parseFloat(canvas.dataset.intensity || "1");
  const showLabels = intensity >= 1;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  const PALETTES = {
    light: { line: "15,118,110", node: "15,118,110", packet: "14,165,233", threat: "225,29,72", shield: "16,185,129", text: "15,118,110" },
    dark:  { line: "45,212,191", node: "94,234,212", packet: "56,189,248", threat: "251,113,133", shield: "52,211,153", text: "94,234,212" },
  };
  const palette = () =>
    PALETTES[document.documentElement.dataset.theme === "dark" ? "dark" : "light"];

  let W = 0, H = 0, dpr = 1, LINK = 140;
  let nodes = [], packets = [], threats = [], pulses = [];
  const mouse = { x: -1e4, y: -1e4, active: false };
  let running = false, lastPacket = 0, nextThreat = 0, lastTime = 0;

  const rand = (a, b) => a + Math.random() * (b - a);
  const dist2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

  function build() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    LINK = W < 600 ? 110 : 140;
    const density = W < 600 ? 8000 : 15000;
    const count = Math.max(36, Math.min(90, Math.round((W * H) / density)));
    nodes = Array.from({ length: count }, () => ({
      x: rand(0, W), y: rand(0, H),
      vx: rand(-0.18, 0.18), vy: rand(-0.18, 0.18),
      r: rand(1.2, 2.2),
      server: Math.random() < 0.12,
    }));
    packets = []; threats = []; pulses = [];
  }

  function neighbors(n) {
    const out = [];
    for (const m of nodes) if (m !== n && dist2(n, m) < LINK * LINK) out.push(m);
    return out;
  }

  function spawnPacket(from, hops = 3) {
    const nb = neighbors(from);
    if (!nb.length) return;
    packets.push({ a: from, b: nb[(Math.random() * nb.length) | 0], t: 0, speed: rand(0.008, 0.016), hops });
  }

  function spawnThreat() {
    const servers = nodes.filter((n) => n.server);
    const target = servers.length ? servers[(Math.random() * servers.length) | 0] : nodes[(Math.random() * nodes.length) | 0];
    const side = (Math.random() * 4) | 0;
    const x = side === 0 ? -20 : side === 1 ? W + 20 : rand(0, W);
    const y = side === 2 ? -20 : side === 3 ? H + 20 : rand(0, H);
    threats.push({ x, y, target, speed: rand(1.4, 2.2), trail: [] });
  }

  function step(now) {
    const dt = Math.min(now - lastTime, 50) / 16.67; // ~1 at 60fps
    lastTime = now;

    for (const n of nodes) {
      n.x += n.vx * dt; n.y += n.vy * dt;
      if (n.x < -10) n.x = W + 10; else if (n.x > W + 10) n.x = -10;
      if (n.y < -10) n.y = H + 10; else if (n.y > H + 10) n.y = -10;
    }

    if (now - lastPacket > 260 / intensity) {
      lastPacket = now;
      spawnPacket(nodes[(Math.random() * nodes.length) | 0]);
    }
    for (const p of packets) {
      p.t += p.speed * dt;
      if (p.t >= 1 && p.hops > 0 && Math.random() < 0.6) {
        p.done = true;
        spawnPacket(p.b, p.hops - 1);
      } else if (p.t >= 1) p.done = true;
    }
    packets = packets.filter((p) => !p.done).slice(-120);

    if (now > nextThreat) {
      nextThreat = now + rand(3500, 6500);
      spawnThreat();
    }
    for (const t of threats) {
      const dx = t.target.x - t.x, dy = t.target.y - t.y;
      const d = Math.hypot(dx, dy);
      t.trail.push({ x: t.x, y: t.y });
      if (t.trail.length > 14) t.trail.shift();
      if (d < 22) {
        t.done = true;
        pulses.push({ x: t.target.x, y: t.target.y, age: 0 });
      } else {
        t.x += (dx / d) * t.speed * dt;
        t.y += (dy / d) * t.speed * dt;
      }
    }
    threats = threats.filter((t) => !t.done);
    for (const p of pulses) p.age += dt;
    pulses = pulses.filter((p) => p.age < 90);
  }

  function draw() {
    const c = palette();
    const a = intensity;
    ctx.clearRect(0, 0, W, H);

    // links
    ctx.lineWidth = 1;
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      for (let j = i + 1; j < nodes.length; j++) {
        const m = nodes[j];
        const d2 = dist2(n, m);
        if (d2 < LINK * LINK) {
          const alpha = (1 - Math.sqrt(d2) / LINK) * 0.22 * a;
          ctx.strokeStyle = `rgba(${c.line},${alpha})`;
          ctx.beginPath(); ctx.moveTo(n.x, n.y); ctx.lineTo(m.x, m.y); ctx.stroke();
        }
      }
    }

    // mouse scanner
    if (mouse.active) {
      const R = 170;
      for (const n of nodes) {
        const d = Math.sqrt(dist2(n, mouse));
        if (d < R) {
          ctx.strokeStyle = `rgba(${c.packet},${(1 - d / R) * 0.5 * a})`;
          ctx.beginPath(); ctx.moveTo(n.x, n.y); ctx.lineTo(mouse.x, mouse.y); ctx.stroke();
        }
      }
      ctx.strokeStyle = `rgba(${c.packet},${0.18 * a})`;
      ctx.beginPath(); ctx.arc(mouse.x, mouse.y, R, 0, Math.PI * 2); ctx.stroke();
    }

    // nodes
    for (const n of nodes) {
      ctx.fillStyle = `rgba(${c.node},${(n.server ? 0.6 : 0.4) * a})`;
      if (n.server) {
        const s = 3.4;
        ctx.fillRect(n.x - s, n.y - s, s * 2, s * 2);
      } else {
        ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2); ctx.fill();
      }
    }

    // packets
    for (const p of packets) {
      const x = p.a.x + (p.b.x - p.a.x) * p.t;
      const y = p.a.y + (p.b.y - p.a.y) * p.t;
      ctx.fillStyle = `rgba(${c.packet},${0.85 * a})`;
      ctx.beginPath(); ctx.arc(x, y, 1.8, 0, Math.PI * 2); ctx.fill();
    }

    // threats
    for (const t of threats) {
      t.trail.forEach((pt, i) => {
        ctx.fillStyle = `rgba(${c.threat},${(i / t.trail.length) * 0.35 * a})`;
        ctx.beginPath(); ctx.arc(pt.x, pt.y, 1.6, 0, Math.PI * 2); ctx.fill();
      });
      ctx.fillStyle = `rgba(${c.threat},${0.9 * a})`;
      ctx.beginPath(); ctx.arc(t.x, t.y, 2.6, 0, Math.PI * 2); ctx.fill();
    }

    // shield pulses
    ctx.font = "600 10px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
    for (const p of pulses) {
      const k = p.age / 90;
      ctx.strokeStyle = `rgba(${c.shield},${(1 - k) * 0.8 * a})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(p.x, p.y, 6 + k * 34, 0, Math.PI * 2); ctx.stroke();
      ctx.lineWidth = 1;
      if (showLabels) {
        ctx.fillStyle = `rgba(${c.text},${(1 - k) * 0.7})`;
        ctx.fillText("BLOCKED", p.x + 10, p.y - 10 - k * 8);
      }
    }
  }

  function frame(now) {
    if (!running) return;
    step(now);
    draw();
    requestAnimationFrame(frame);
  }

  function start() {
    if (running || reduceMotion.matches || document.hidden) return;
    running = true;
    lastTime = performance.now();
    requestAnimationFrame(frame);
  }
  function stop() { running = false; }

  build();
  draw();
  start();

  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { build(); draw(); }, 150);
  });
  document.addEventListener("visibilitychange", () => (document.hidden ? stop() : start()));
  reduceMotion.addEventListener?.("change", () => (reduceMotion.matches ? stop() : start()));
  // Redraw the still frame when the theme flips while paused.
  new MutationObserver(() => { if (!running) draw(); })
    .observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

  window.addEventListener("pointermove", (e) => {
    mouse.x = e.clientX; mouse.y = e.clientY; mouse.active = e.pointerType === "mouse";
  }, { passive: true });
  document.addEventListener("pointerleave", () => { mouse.active = false; });
  window.addEventListener("click", (e) => {
    if (!running || e.target.closest("a, button, input, summary")) return;
    let nearest = null, best = Infinity;
    for (const n of nodes) {
      const d = (n.x - e.clientX) ** 2 + (n.y - e.clientY) ** 2;
      if (d < best) { best = d; nearest = n; }
    }
    if (nearest) for (let i = 0; i < 8; i++) spawnPacket(nearest, 4);
  });
})();

// Typing terminal line on the home page.
(() => {
  const el = document.getElementById("typed");
  if (!el) return;
  let phrases;
  try { phrases = JSON.parse(el.dataset.phrases || "[]"); } catch { phrases = []; }
  if (!phrases.length) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    el.textContent = phrases[0];
    return;
  }
  let i = 0, pos = 0, deleting = false;
  (function tick() {
    const text = phrases[i];
    pos += deleting ? -1 : 1;
    el.textContent = text.slice(0, pos);
    let delay = deleting ? 28 : 55 + Math.random() * 45;
    if (!deleting && pos === text.length) { deleting = true; delay = 2200; }
    else if (deleting && pos === 0) { deleting = false; i = (i + 1) % phrases.length; delay = 400; }
    setTimeout(tick, delay);
  })();
})();
