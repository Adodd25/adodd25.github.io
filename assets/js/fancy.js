
// Small flourishes: reading-progress bar, cards that fade in on scroll,
// and headline stats that count up. All skipped for prefers-reduced-motion,
// and the page reads fine with no JavaScript at all.
(() => {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Reading progress on long pages.
  if (document.querySelector(".post-single")) {
    const bar = document.createElement("div");
    bar.className = "read-progress";
    bar.setAttribute("aria-hidden", "true");
    document.body.appendChild(bar);
    const update = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.transform = `scaleX(${max > 0 ? Math.min(1, window.scrollY / max) : 0})`;
    };
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    update();
  }

  if (reduce || !("IntersectionObserver" in window)) return;

  const countUp = (el) => {
    const end = parseFloat(el.dataset.count);
    const pre = el.dataset.prefix || "", suf = el.dataset.suffix || "";
    const t0 = performance.now(), dur = 1400;
    (function tick(now) {
      const k = Math.min(1, (now - t0) / dur);
      const eased = 1 - Math.pow(1 - k, 3);
      el.textContent = pre + Math.round(end * eased) + suf;
      if (k < 1) requestAnimationFrame(tick);
    })(t0);
  };

  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      e.target.classList.add("is-visible");
      e.target.querySelectorAll("[data-count]").forEach(countUp);
      io.unobserve(e.target);
    }
  }, { threshold: 0.12 });

  document.querySelectorAll(".post-entry, .page-link-card, .stat").forEach((el, i) => {
    el.classList.add("reveal");
    el.style.transitionDelay = `${Math.min(i % 4, 3) * 70}ms`;
    io.observe(el);
  });
})();
