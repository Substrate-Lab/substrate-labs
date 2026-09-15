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

  function initResearchField() {
    const canvas = document.getElementById('field-canvas');
    if (!canvas || canvas.dataset.ready) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const gl = canvas.getContext('webgl', {
      alpha: false,
      antialias: false,
      depth: false,
      powerPreference: 'low-power',
    });

    if (!gl) {
      initFieldFallback(canvas, reduceMotion);
      return;
    }

    const vertexSource = `
      attribute vec2 a_position;
      varying vec2 v_uv;

      void main() {
        v_uv = a_position * 0.5 + 0.5;
        gl_Position = vec4(a_position, 0.0, 1.0);
      }
    `;

    const fragmentSource = `
      precision highp float;

      uniform float u_time;
      uniform vec2 u_resolution;
      uniform vec2 u_pointer;
      varying vec2 v_uv;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
          mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
          f.y
        );
      }

      float fbm(vec2 p) {
        float value = 0.0;
        float amplitude = 0.5;
        for (int i = 0; i < 4; i++) {
          value += amplitude * noise(p);
          p = p * 2.03 + vec2(13.7, 7.1);
          amplitude *= 0.5;
        }
        return value;
      }

      void main() {
        vec2 uv = v_uv - 0.5;
        uv.x *= u_resolution.x / u_resolution.y;

        vec2 pointer = u_pointer - 0.5;
        pointer.x *= u_resolution.x / u_resolution.y;
        float pointerPull = exp(-length(uv - pointer * vec2(1.15, 0.78)) * 4.3);
        vec2 p = uv + pointerPull * pointer * 0.105;

        float time = u_time;
        float broadNoise = fbm(p * 2.35 + vec2(time * 0.06, -time * 0.035));
        float fineNoise = fbm(p * 5.4 - vec2(time * 0.025, time * 0.04));
        float surface = p.y
          + 0.12 * sin(p.x * 3.0 + time * 0.28)
          + 0.045 * sin(p.x * 9.0 - time * 0.22)
          + 0.12 * (broadNoise - 0.5)
          + 0.035 * (fineNoise - 0.5);

        float ellipse = length(p / vec2(1.12, 0.7));
        float mask = 1.0 - smoothstep(0.66, 1.02, ellipse);
        float contourA = 1.0 - smoothstep(0.0, 0.035, abs(fract(surface * 19.0) - 0.5));
        float contourB = 1.0 - smoothstep(0.0, 0.024, abs(fract((surface + broadNoise * 0.08) * 38.0) - 0.5));
        float tracer = exp(-abs(surface + 0.06 * sin(p.x * 4.0 + time * 0.22) - 0.045) * 48.0);
        float core = exp(-length(p * vec2(0.72, 1.22)) * 2.8);
        float pointerGlow = exp(-length(uv - pointer * vec2(1.15, 0.78)) * 5.0);

        vec3 deep = vec3(0.035, 0.075, 0.057);
        vec3 surfaceColor = vec3(0.075, 0.17, 0.12);
        vec3 green = vec3(0.24, 0.72, 0.44);
        vec3 pale = vec3(0.72, 0.87, 0.69);

        vec3 color = mix(deep, surfaceColor, mask * (0.35 + broadNoise * 0.42));
        color += green * contourA * mask * 0.33;
        color += pale * contourB * mask * 0.075;
        color += green * tracer * mask * 0.58;
        color += green * core * 0.055;
        color += pale * pointerGlow * 0.035;

        float vignette = 1.0 - smoothstep(0.62, 1.28, length(uv * vec2(0.76, 0.82)));
        color *= 0.76 + vignette * 0.24;
        gl_FragColor = vec4(color, 1.0);
      }
    `;

    const program = createProgram(gl, vertexSource, fragmentSource);
    if (!program) {
      initFieldFallback(canvas, reduceMotion);
      return;
    }

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.useProgram(program);

    const position = gl.getAttribLocation(program, 'a_position');
    const timeUniform = gl.getUniformLocation(program, 'u_time');
    const resolutionUniform = gl.getUniformLocation(program, 'u_resolution');
    const pointerUniform = gl.getUniformLocation(program, 'u_pointer');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    let width = 0;
    let height = 0;
    let pixelRatio = 1;
    let frame = 0;
    let pointerX = 0.5;
    let pointerY = 0.5;
    let targetX = 0.5;
    let targetY = 0.5;
    let startedAt = 0;
    canvas.dataset.ready = 'true';
    canvas.dataset.renderer = 'webgl';

    function resize() {
      const bounds = canvas.getBoundingClientRect();
      pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(1, bounds.width);
      height = Math.max(1, bounds.height);
      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(resolutionUniform, width, height);
      draw(0);
    }

    function draw(now) {
      if (!width || !height) return;
      const elapsed = reduceMotion.matches ? 0 : (now - startedAt) * 0.001;
      pointerX += (targetX - pointerX) * 0.075;
      pointerY += (targetY - pointerY) * 0.075;
      gl.uniform1f(timeUniform, elapsed);
      gl.uniform2f(pointerUniform, reduceMotion.matches ? 0.5 : pointerX, reduceMotion.matches ? 0.5 : pointerY);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    function animate(now) {
      draw(now);
      if (!reduceMotion.matches) frame = window.requestAnimationFrame(animate);
    }

    function updatePointer(event) {
      if (reduceMotion.matches) return;
      const bounds = canvas.getBoundingClientRect();
      targetX = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width));
      targetY = 1 - Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height));
    }

    canvas.addEventListener('pointermove', updatePointer, { passive: true });
    canvas.addEventListener('pointerleave', () => {
      targetX = 0.5;
      targetY = 0.5;
    }, { passive: true });

    const observer = 'ResizeObserver' in window ? new ResizeObserver(resize) : null;
    if (observer) observer.observe(canvas);
    else window.addEventListener('resize', resize, { passive: true });

    resize();
    startedAt = performance.now();
    if (!reduceMotion.matches) frame = window.requestAnimationFrame(animate);

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        window.cancelAnimationFrame(frame);
        frame = 0;
      } else if (!reduceMotion.matches && !frame) {
        startedAt = performance.now();
        frame = window.requestAnimationFrame(animate);
      }
    });
  }

  function createProgram(gl, vertexSource, fragmentSource) {
    const vertex = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
    const fragment = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
    if (!vertex || !fragment) return null;

    const program = gl.createProgram();
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
    return program;
  }

  function compileShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return null;
    return shader;
  }

  function initFieldFallback(canvas, reduceMotion) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let width = 0;
    let height = 0;
    let frame = 0;

    canvas.dataset.ready = 'true';
    canvas.dataset.renderer = 'canvas-2d';

    function resize() {
      const bounds = canvas.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(1, bounds.width);
      height = Math.max(1, bounds.height);
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      draw(0);
    }

    function draw(now) {
      const time = reduceMotion.matches ? 0 : now * 0.00022;
      ctx.fillStyle = '#102019';
      ctx.fillRect(0, 0, width, height);
      ctx.save();
      ctx.translate(width * 0.5, height * 0.52);
      ctx.rotate(Math.sin(time * 0.32) * 0.05);
      ctx.beginPath();
      ctx.ellipse(0, 0, width * 0.42, height * 0.3, 0, 0, Math.PI * 2);
      ctx.clip();
      for (let row = 0; row < 27; row += 1) {
        ctx.beginPath();
        const base = -height * 0.3 + row * height * 0.024;
        for (let x = -width * 0.55; x <= width * 0.55; x += 7) {
          const y = base
            + Math.sin(x * 0.011 + time + row * 0.32) * 7
            + Math.sin(x * 0.004 - time * 1.25 + row) * 10;
          if (x === -width * 0.55) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = row === 13 ? 'rgba(93, 196, 125, .48)' : 'rgba(175, 220, 179, .15)';
        ctx.lineWidth = row === 13 ? 1.2 : 0.75;
        ctx.stroke();
      }
      ctx.restore();
    }

    const observer = 'ResizeObserver' in window ? new ResizeObserver(resize) : null;
    if (observer) observer.observe(canvas);
    else window.addEventListener('resize', resize, { passive: true });
    resize();
    if (!reduceMotion.matches) {
      const animate = (now) => {
        draw(now);
        frame = window.requestAnimationFrame(animate);
      };
      frame = window.requestAnimationFrame(animate);
    }
  }

  if (document.fonts && document.fonts.ready) document.fonts.ready.then(initResearchField);
  else initResearchField();
})();
