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
      alpha: true,
      antialias: true,
      depth: false,
      premultipliedAlpha: false,
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

      mat2 rotate2d(float angle) {
        float s = sin(angle);
        float c = cos(angle);
        return mat2(c, -s, s, c);
      }

      float hash(vec3 p) {
        p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
        p *= 17.0;
        return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
      }

      float noise3(vec3 p) {
        vec3 i = floor(p);
        vec3 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(mix(hash(i), hash(i + vec3(1.0, 0.0, 0.0)), f.x),
              mix(hash(i + vec3(0.0, 1.0, 0.0)), hash(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
          mix(mix(hash(i + vec3(0.0, 0.0, 1.0)), hash(i + vec3(1.0, 0.0, 1.0)), f.x),
              mix(hash(i + vec3(0.0, 1.0, 1.0)), hash(i + vec3(1.0, 1.0, 1.0)), f.x), f.y), f.z
        );
      }

      float fbm3(vec3 p) {
        float value = 0.0;
        float amplitude = 0.5;
        for (int i = 0; i < 4; i++) {
          value += amplitude * noise3(p);
          p = p * 2.02 + vec3(11.3, 5.7, 17.1);
          amplitude *= 0.5;
        }
        return value;
      }

      vec3 rotateObject(vec3 p, float time) {
        float yaw = 0.16 * sin(time * 0.26) + (u_pointer.x - 0.5) * 0.22;
        float pitch = 0.18 * cos(time * 0.21) + (u_pointer.y - 0.5) * 0.24;
        float roll = 0.055 * sin(time * 0.18) + (u_pointer.x - 0.5) * 0.055;
        p.xz = rotate2d(yaw) * p.xz;
        p.xy = rotate2d(pitch) * p.xy;
        p.yz = rotate2d(roll) * p.yz;
        return p;
      }

      float scene(vec3 point, float time) {
        vec3 p = rotateObject(point, time);
        vec2 tube = vec2(length(p.xy) - 0.47, p.z);
        float radius = length(tube) - 0.125;
        float broad = fbm3(p * 2.8 + vec3(time * 0.045, -time * 0.03, time * 0.035));
        float fold = 0.014 * sin(p.y * 19.0 + p.x * 4.0 + time * 0.18);
        fold += 0.010 * sin(p.z * 24.0 - p.y * 7.0 - time * 0.23);
        return radius + fold * smoothstep(0.05, 0.75, length(p)) + (broad - 0.5) * 0.03;
      }

      vec3 sceneNormal(vec3 point, float time) {
        vec2 e = vec2(0.0018, 0.0);
        return normalize(vec3(
          scene(point + e.xyy, time) - scene(point - e.xyy, time),
          scene(point + e.yxy, time) - scene(point - e.yxy, time),
          scene(point + e.yyx, time) - scene(point - e.yyx, time)
        ));
      }

      void main() {
        vec2 screen = v_uv - 0.5;
        float aspect = u_resolution.x / u_resolution.y;
        screen.x *= aspect;

        float time = u_time;
        vec3 camera = vec3(0.0, 0.0, 3.72);
        vec3 ray = normalize(vec3(screen * 1.04, -2.6));
        float cameraTilt = (u_pointer.x - 0.5) * 0.10;
        ray.xz = rotate2d(cameraTilt) * ray.xz;

        float distanceAlongRay = 0.0;
        vec3 point = camera;
        float hit = 0.0;
        for (int step = 0; step < 76; step++) {
          point = camera + ray * distanceAlongRay;
          float distanceToSurface = scene(point, time);
          if (distanceToSurface < 0.0015) {
            hit = 1.0;
            break;
          }
          distanceAlongRay += max(distanceToSurface * 0.72, 0.003);
          if (distanceAlongRay > 5.2) break;
        }

        float objectDistance = length(screen / vec2(0.70, 0.54));
        float halo = exp(-pow(objectDistance * 2.55, 2.0)) * 0.08;
        float contactShadow = exp(-pow(length((screen - vec2(0.035, -0.37)) / vec2(0.40, 0.075)), 2.0)) * 0.052;
        vec3 haloColor = vec3(0.32, 0.48, 0.38);

        if (hit < 0.5) {
          gl_FragColor = vec4(haloColor * 0.84, max(halo, contactShadow));
          return;
        }

        vec3 normal = sceneNormal(point, time);
        vec3 light = normalize(vec3(-0.52, 0.78, 0.94));
        vec3 fill = normalize(vec3(0.68, -0.24, -0.82));
        float diffuse = max(dot(normal, light), 0.0);
        float bounce = max(dot(normal, fill), 0.0);
        float view = max(dot(normal, -ray), 0.0);
        float rim = pow(1.0 - view, 2.1);
        float specular = pow(max(dot(reflect(-light, normal), -ray), 0.0), 28.0);

        vec3 local = rotateObject(point, time);
        float materialNoise = fbm3(local * 3.0 + vec3(0.0, time * 0.03, 0.0));
        float tubeAngle = atan(local.z, length(local.xy) - 0.47);
        float ringAngle = atan(local.y, local.x);
        float contours = 1.0 - smoothstep(0.0, 0.045, abs(fract((tubeAngle / 6.28318 + materialNoise * 0.07 + time * 0.006) * 8.0) - 0.5));
        float fineContours = 1.0 - smoothstep(0.0, 0.03, abs(fract((ringAngle / 6.28318 + materialNoise * 0.045) * 13.0) - 0.5));
        float innerCavity = smoothstep(0.02, 0.16, 0.47 - length(local.xy));

        vec3 shadowColor = vec3(0.18, 0.25, 0.21);
        vec3 lightColor = vec3(0.90, 0.92, 0.86);
        vec3 green = vec3(0.10, 0.37, 0.20);
        vec3 color = mix(shadowColor, lightColor, 0.08 + diffuse * 0.82 + bounce * 0.10);
        color = mix(color, shadowColor * 0.70, innerCavity * 0.30);
        color = mix(color, green, contours * 0.25);
        color += green * fineContours * 0.11;
        color += lightColor * specular * 0.46;
        color += green * rim * 0.24;

        float alpha = 0.30 + diffuse * 0.43 + rim * 0.18;
        alpha = clamp(alpha + contours * 0.10, 0.0, 0.94);
        gl_FragColor = vec4(color, alpha);
      }
    `;

    const program = createProgram(gl, vertexSource, fragmentSource);
    if (!program) {
      canvas.dataset.ready = 'true';
      canvas.dataset.renderer = 'webgl-error';
      return;
    }

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.useProgram(program);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

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
    canvas.dataset.renderer = 'webgl-raymarch';

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
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
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
      ctx.clearRect(0, 0, width, height);
      const glow = ctx.createRadialGradient(width * 0.5, height * 0.5, 8, width * 0.5, height * 0.5, Math.min(width, height) * 0.45);
      glow.addColorStop(0, 'rgba(47, 77, 61, .17)');
      glow.addColorStop(.72, 'rgba(47, 77, 61, .035)');
      glow.addColorStop(1, 'rgba(47, 77, 61, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, width, height);
      ctx.save();
      ctx.translate(width * 0.5, height * 0.52);
      ctx.rotate(Math.sin(time * 0.3) * 0.05);
      ctx.beginPath();
      ctx.ellipse(0, 0, width * 0.38, height * 0.28, 0, 0, Math.PI * 2);
      ctx.clip();
      for (let row = 0; row < 25; row += 1) {
        ctx.beginPath();
        const base = -height * 0.28 + row * height * 0.023;
        for (let x = -width * 0.52; x <= width * 0.52; x += 7) {
          const y = base + Math.sin(x * 0.012 + time + row * 0.31) * 8 + Math.sin(x * 0.004 - time * 1.2 + row) * 11;
          if (x === -width * 0.52) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = row === 12 ? 'rgba(40, 125, 78, .48)' : 'rgba(39, 71, 52, .13)';
        ctx.lineWidth = row === 12 ? 1.2 : 0.75;
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
