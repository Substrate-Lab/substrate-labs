// Substrate - a generative tree growing from its substrate, in the hero.
// Curved, tapering branches grow from a ground surface and root into the
// strata below it. Grows once on load, then holds and sways gently. Cream on dark.
(() => {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const hero = document.querySelector('.hero');
  if (!hero) return;

  const canvas = document.createElement('canvas');
  canvas.className = 'field-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  hero.insertBefore(canvas, hero.firstChild);

  const ctx = canvas.getContext('2d');
  const INK = '232,229,220';

  let w = 0, h = 0, dpr = 1;
  let tree = null;
  let roots = null;
  let maxDepth = 10;
  let groundY = 0;
  let baseX = 0;

  // Lifecycle: grow once, then hold forever (gentle sway only)
  let phase = 'grow';
  let progress = 0;      // growth front, measured in generations
  let opacity = 1;
  let lastT = 0;

  const GROW_RATE = 2.2;   // generations revealed per second (slower = calmer)

  function rand(a, b) { return a + Math.random() * (b - a); }

  // ── Build a tree as nested nodes with relative angles + a gentle bend ──
  function buildNode(depth, len, maxD) {
    const node = {
      depth,
      len,
      relAngle: 0,
      bend: rand(-0.9, 0.9),     // perpendicular curvature of the segment
      children: [],
      tip: false,
    };
    if (depth >= maxD || len < 7) {
      node.tip = true;
      return node;
    }
    const r = Math.random();
    const count = r < 0.18 ? 1 : (r > 0.9 ? 3 : 2);
    const spread = rand(0.34, 0.58);
    for (let i = 0; i < count; i++) {
      const child = buildNode(depth + 1, len * rand(0.74, 0.83), maxD);
      let a;
      if (count === 1) a = rand(-0.16, 0.16);
      else a = -spread + (i / (count - 1)) * (spread * 2) + rand(-0.08, 0.08);
      child.relAngle = a;
      node.children.push(child);
    }
    return node;
  }

  // scale a subtree's curvature (roots should curve more gently than branches)
  function dampenBend(node, scale) {
    node.bend *= scale;
    for (const ch of node.children) dampenBend(ch, scale);
  }

  function makeTree() {
    const trunkLen = Math.max(72, Math.min(150, h * 0.16));
    maxDepth = h < 520 ? 10 : 11;

    const canopy = buildNode(0, trunkLen, maxDepth);
    canopy.relAngle = -Math.PI / 2;   // up
    canopy.bend = 0;                  // trunk stays plumb
    tree = canopy;

    // roots: several primary roots fanning downward from the base, kept within a
    // mostly-downward cone so they read as roots and stay under the surface
    roots = [];
    const rootCount = 5;
    for (let i = 0; i < rootCount; i++) {
      const root = buildNode(0, trunkLen * rand(0.34, 0.5), 5);
      const f = rootCount === 1 ? 0.5 : i / (rootCount - 1);
      root.relAngle = Math.PI * 0.32 + f * (Math.PI * 0.36);  // ~58°..122° downward fan
      root.bend = 0;               // primary root descends straight from the base
      dampenBend(root, 0.5);       // gentler curvature than the canopy
      roots.push(root);
    }
  }

  function resize() {
    const rect = hero.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      requestAnimationFrame(resize);
      return;
    }
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = rect.width;
    h = rect.height;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    baseX = w < 900 ? w * 0.5 : w * 0.30;
    groundY = h - Math.max(48, h * 0.12);
    makeTree();
  }

  // quadratic point + tangent at parameter u
  function qpoint(p0, c, p1, u) {
    const v = 1 - u;
    return {
      x: v * v * p0.x + 2 * v * u * c.x + u * u * p1.x,
      y: v * v * p0.y + 2 * v * u * c.y + u * u * p1.y,
    };
  }

  // ── Draw a node's curved segment, then recurse ─────────────────────────
  function drawNode(node, x, y, parentAngle, t, tint, floorY) {
    const f = Math.max(0, Math.min(1, progress - node.depth));
    if (f <= 0) return;

    // sway increases toward the tips
    const sway = Math.sin(t * 0.00045 + node.depth * 0.6) * 0.045 * (node.depth / maxDepth);
    let angle = parentAngle + node.relAngle + sway;
    // roots (passed a floorY) only ever grow downward: never tilt a segment above
    // the surface, so they descend into the substrate instead of splaying along it
    if (floorY != null) {
      const minDown = 0.16 * Math.PI;
      angle = Math.max(minDown, Math.min(Math.PI - minDown, angle));
    }

    const p0 = { x, y };
    const p1 = {
      x: x + Math.cos(angle) * node.len,
      y: y + Math.sin(angle) * node.len,
    };
    // control point offset perpendicular to the segment for an organic curve
    const perp = angle + Math.PI / 2;
    const bendAmt = node.bend * node.len * 0.18;
    const c = {
      x: (x + p1.x) / 2 + Math.cos(perp) * bendAmt,
      y: (y + p1.y) / 2 + Math.sin(perp) * bendAmt,
    };
    // roots get a floorY (the ground line). A quadratic curve stays within the
    // y-range of its control points, so clamping these keeps roots below ground.
    if (floorY != null) {
      if (p1.y < floorY) p1.y = floorY;
      if (c.y < floorY) c.y = floorY;
    }

    // taper: thicker at the trunk, hairline at the tips
    const lw = Math.max(0.5, (1 - node.depth / (maxDepth + 1)) * 5.2);
    const a = (0.62 - node.depth * 0.022) * opacity * tint;
    ctx.strokeStyle = `rgba(${INK},${Math.max(0.05, a).toFixed(3)})`;
    ctx.lineWidth = lw;
    ctx.lineCap = 'round';

    // draw the curve up to the growth fraction f by sampling
    const STEPS = 10;
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    for (let i = 1; i <= STEPS; i++) {
      const u = (i / STEPS) * f;
      const pt = qpoint(p0, c, p1, u);
      ctx.lineTo(pt.x, pt.y);
    }
    ctx.stroke();

    if (f >= 0.97) {
      if (node.tip) {
        // a small, faint bud - never a cartoon leaf
        const bs = Math.min(1, (progress - node.depth - 0.5) * 1.4);
        if (bs > 0 && tint > 0.6) {
          ctx.fillStyle = `rgba(${INK},${(0.4 * opacity).toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(p1.x, p1.y, 1.4 * bs, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        for (const ch of node.children) drawNode(ch, p1.x, p1.y, angle, t, tint, floorY);
      }
    }
  }

  function drawSubstrate() {
    // ground plane - a soft band of earth the tree sits on, fading downward
    const grad = ctx.createLinearGradient(0, groundY, 0, h);
    grad.addColorStop(0, `rgba(${INK},${(0.075 * opacity).toFixed(3)})`);
    grad.addColorStop(1, `rgba(${INK},0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, groundY, w, h - groundY);

    // surface line
    ctx.strokeStyle = `rgba(${INK},${(0.32 * opacity).toFixed(3)})`;
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(w, groundY);
    ctx.stroke();

    // faint strata within the ground - the layered substrate
    const strata = [{ dy: 16, a: 0.07 }, { dy: 34, a: 0.04 }];
    for (const s of strata) {
      const yy = groundY + s.dy;
      if (yy > h) continue;
      ctx.strokeStyle = `rgba(${INK},${(s.a * opacity).toFixed(3)})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, yy);
      ctx.lineTo(w, yy);
      ctx.stroke();
    }
  }

  function frame(t) {
    if (!lastT) lastT = t;
    const dt = Math.min(64, t - lastT);
    lastT = t;

    if (phase === 'grow') {
      progress += (GROW_RATE * dt) / 1000;
      if (progress >= maxDepth + 1.2) { progress = maxDepth + 1.2; phase = 'hold'; }
    }
    // once grown, the tree simply stays - it only sways gently, never regrows

    ctx.clearRect(0, 0, w, h);
    drawSubstrate();
    for (const root of roots) drawNode(root, baseX, groundY, 0, t, 0.3, groundY);  // roots: faint, kept below the surface
    drawNode(tree, baseX, groundY, 0, t, 1);       // canopy: full, upward

    requestAnimationFrame(frame);
  }

  let rt;
  window.addEventListener('resize', () => {
    clearTimeout(rt);
    rt = setTimeout(() => {
      resize();
      progress = 0; phase = 'grow'; opacity = 1;
    }, 150);
  });

  window.addEventListener('load', () => {
    resize();
    requestAnimationFrame(frame);
  });
})();
