// Substrate — light editorial site behaviors (progressive enhancement only).
(() => {
  // Scroll-spy: highlight the nav link whose section is currently in view.
  const links = Array.from(document.querySelectorAll('.topbar nav a[href^="#"]'));
  const pairs = links
    .map((a) => [document.querySelector(a.getAttribute('href')), a])
    .filter(([el]) => el);

  if (pairs.length && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          links.forEach((link) => link.classList.remove('active'));
          const found = pairs.find(([el]) => el === entry.target);
          if (found) found[1].classList.add('active');
        });
      },
      { rootMargin: '-46% 0px -50% 0px' }
    );
    pairs.forEach(([el]) => io.observe(el));
  }

  // One coherent motion element for the homepage: a quiet, layered field
  // suggesting signals, contours, and changing internal structure.
  function initResearchField() {
    const canvas = document.getElementById('field-canvas');
    if (!canvas || canvas.dataset.ready) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.dataset.ready = 'true';

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const palette = getComputedStyle(document.documentElement);
    const ink = toRgb(palette.getPropertyValue('--ink').trim(), [23, 34, 28]);
    const accent = toRgb(palette.getPropertyValue('--accent').trim(), [31, 106, 72]);
    let width = 0;
    let height = 0;
    let pixelRatio = 1;
    let frame = 0;

    function toRgb(value, fallback) {
      const match = value.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
      if (!match) return fallback;
      const hex = match[1].length === 3
        ? match[1].split('').map((part) => part + part).join('')
        : match[1];
      return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
    }

    function rgba(rgb, alpha) {
      return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
    }

    function resize() {
      const bounds = canvas.getBoundingClientRect();
      pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(1, bounds.width);
      height = Math.max(1, bounds.height);
      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
      ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      draw(0);
    }

    function draw(now) {
      if (!width || !height) return;
      const time = now * 0.00022;
      const cx = width * 0.5;
      const cy = height * 0.53;
      const radius = Math.min(width, height) * 0.44;

      ctx.clearRect(0, 0, width, height);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(Math.sin(time * 0.32) * 0.07);

      // A diffuse core keeps the field soft at rest; the contour lines give it
      // enough structure to feel like a living system rather than a gradient.
      ctx.save();
      ctx.scale(1.26, 0.7);
      const glow = ctx.createRadialGradient(0, 0, radius * 0.04, 0, 0, radius);
      glow.addColorStop(0, rgba(ink, 0.16));
      glow.addColorStop(0.3, rgba(accent, 0.09));
      glow.addColorStop(0.72, rgba(accent, 0.025));
      glow.addColorStop(1, rgba(accent, 0));
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.beginPath();
      ctx.ellipse(0, 0, width * 0.43, height * 0.3, 0, 0, Math.PI * 2);
      ctx.clip();
      const rows = 25;
      for (let row = 0; row < rows; row += 1) {
        const base = -height * 0.28 + row * height * 0.023;
        ctx.beginPath();
        for (let x = -width * 0.55; x <= width * 0.55; x += 7) {
          const y = base
            + Math.sin(x * 0.012 + time + row * 0.37) * (5 + row * 0.16)
            + Math.sin(x * 0.004 - time * 1.35 + row * 0.8) * (8 + row * 0.24)
            + Math.sin(x * 0.002 + time * 0.42) * 7;
          if (x === -width * 0.55) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = row === 12 ? rgba(accent, 0.42) : rgba(ink, 0.12);
        ctx.lineWidth = row === 12 ? 1.25 : 0.75;
        ctx.stroke();
      }
      ctx.restore();

      // Two slow orbital traces add depth without turning the hero into a
      // decorative animation with several competing focal points.
      ctx.globalAlpha = 0.13;
      ctx.lineWidth = 0.8;
      ctx.strokeStyle = rgba(ink, 1);
      for (let orbit = 0; orbit < 2; orbit += 1) {
        ctx.save();
        ctx.rotate((orbit ? -1 : 1) * (0.16 + Math.sin(time * 0.25) * 0.04));
        ctx.beginPath();
        ctx.ellipse(0, 0, width * (0.29 + orbit * 0.08), height * (0.11 + orbit * 0.035), 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      ctx.globalAlpha = 1;
      ctx.restore();

      // A small moving signal is the only high-contrast detail in the field.
      const signalX = width * (0.27 + 0.46 * (0.5 + 0.5 * Math.sin(time * 0.8)));
      const signalY = height * 0.52 + Math.sin(time * 0.7) * height * 0.075;
      ctx.fillStyle = rgba(accent, 0.72);
      ctx.beginPath();
      ctx.arc(signalX, signalY, 2.8, 0, Math.PI * 2);
      ctx.fill();
    }

    function animate(now) {
      draw(now);
      if (!reduceMotion.matches) frame = window.requestAnimationFrame(animate);
    }

    const observer = 'ResizeObserver' in window ? new ResizeObserver(resize) : null;
    if (observer) observer.observe(canvas);
    else window.addEventListener('resize', resize, { passive: true });

    resize();
    if (!reduceMotion.matches) frame = window.requestAnimationFrame(animate);

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        window.cancelAnimationFrame(frame);
        frame = 0;
      } else if (!reduceMotion.matches && !frame) {
        frame = window.requestAnimationFrame(animate);
      }
    });
  }

  if (document.fonts && document.fonts.ready) document.fonts.ready.then(initResearchField);
  else initResearchField();
})();
