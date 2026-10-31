const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

// Reveal on scroll
const io = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  });
}, { threshold: 0.15 });
$$('.reveal').forEach((el) => io.observe(el));

// Count-up numbers
const countIO = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    if (!e.isIntersecting) return;
    countIO.unobserve(e.target);
    const el = e.target, target = +el.dataset.count, dur = 1600, t0 = performance.now();
    const tick = (t) => {
      const p = Math.min((t - t0) / dur, 1);
      el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3))).toLocaleString();
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}, { threshold: 0.6 });
$$('[data-count]').forEach((el) => countIO.observe(el));

// Scroll-driven effects
const progress = $('#progress'), nav = $('#nav'), marquee = $('#marquee');
const blobs = $$('.blob'), how = $('#how'), steps = $$('#steps li'), lines = $$('#page .line');
const isDesktop = () => matchMedia('(min-width: 821px)').matches;
let ticking = false;

function update() {
  const y = scrollY, max = document.documentElement.scrollHeight - innerHeight;
  progress.style.transform = `scaleX(${max > 0 ? y / max : 0})`;
  nav.classList.toggle('scrolled', y > 40);

  if (!reduced) {
    blobs.forEach((b) => (b.style.transform = `translateY(${y * b.dataset.speed}px)`));
    marquee.style.transform = `translateX(${-y * 0.5}px)`;
  }

  // Pinned "how it works": scroll position decides step and visible lines
  if (isDesktop()) {
    const r = how.getBoundingClientRect();
    const p = Math.min(Math.max(-r.top / (r.height - innerHeight), 0), 0.999);
    const step = Math.floor(p * steps.length);
    steps.forEach((li, i) => li.classList.toggle('active', i === step));
    const inStep = (p * steps.length) % 1;
    lines.forEach((l) => {
      const s = +l.dataset.step;
      const siblings = lines.filter((x) => +x.dataset.step === s);
      const idx = siblings.indexOf(l);
      const visible = s < step || (s === step && inStep >= idx / siblings.length * 0.9);
      l.classList.toggle('show', visible);
    });
  }
  ticking = false;
}
addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
addEventListener('resize', update);
update();

$('#yr').textContent = new Date().getFullYear();
