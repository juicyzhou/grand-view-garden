import * as THREE from 'three';

/*
 * 渲染引擎：渲染器、天空穹顶、昼夜循环、星月云霞。
 * cycleMode: 'auto' 自动轮转 | 'day' 永昼 | 'night' 永夜
 */
export class Engine {
  constructor(canvas) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0xcfe0dd, 45, 165);

    this.camera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.1, 400);
    this.camera.position.set(0, 1.7, 42);

    // 光照
    this.hemi = new THREE.HemisphereLight(0xbcd6e8, 0x8a7a5e, 0.85);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff2d8, 2.6);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.left = -55;
    this.sun.shadow.camera.right = 55;
    this.sun.shadow.camera.top = 55;
    this.sun.shadow.camera.bottom = -55;
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 260;
    this.sun.shadow.bias = -0.0015;
    this.sun.shadow.normalBias = 0.02;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);

    this.buildSky();
    this.buildStars();
    this.buildClouds();

    this.cycleMode = 'auto';
    this.cycleT = 0.32; // 自清晨始
    this.cycleDuration = 360; // 秒/全天
    this.nightFactor = 0;
    this.lanternMats = [];
    this.celebrationT = 0; // 集章圆满：灯笼齐明计时

    window.addEventListener('resize', () => this.onResize());
  }

  buildSky() {
    const geo = new THREE.SphereGeometry(320, 24, 16);
    this.skyUniforms = {
      uTop: { value: new THREE.Color(0x7fb2e0) },
      uHorizon: { value: new THREE.Color(0xdce8e8) },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uSunColor: { value: new THREE.Color(0xfff2d8) },
      uSunGlow: { value: 1.0 },
    };
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: this.skyUniforms,
      vertexShader: `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vDir;
        uniform vec3 uTop;
        uniform vec3 uHorizon;
        uniform vec3 uSunDir;
        uniform vec3 uSunColor;
        uniform float uSunGlow;
        void main() {
          float h = clamp(vDir.y * 1.6 + 0.12, 0.0, 1.0);
          vec3 col = mix(uHorizon, uTop, pow(h, 0.8));
          float sunAmt = max(dot(normalize(vDir), normalize(uSunDir)), 0.0);
          col += uSunColor * (pow(sunAmt, 220.0) * 1.1 + pow(sunAmt, 14.0) * 0.22) * uSunGlow;
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    this.sky = new THREE.Mesh(geo, mat);
    this.sky.frustumCulled = false;
    this.scene.add(this.sky);

    // 月亮
    const moonCanvas = document.createElement('canvas');
    moonCanvas.width = moonCanvas.height = 128;
    const mctx = moonCanvas.getContext('2d');
    const grad = mctx.createRadialGradient(64, 64, 20, 64, 64, 62);
    grad.addColorStop(0, 'rgba(240, 244, 255, 1)');
    grad.addColorStop(0.75, 'rgba(220, 228, 250, 0.9)');
    grad.addColorStop(1, 'rgba(220, 228, 250, 0)');
    mctx.fillStyle = grad;
    mctx.fillRect(0, 0, 128, 128);
    const moonTex = new THREE.CanvasTexture(moonCanvas);
    this.moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: moonTex, transparent: true, opacity: 0, fog: false }));
    this.moon.scale.setScalar(26);
    this.scene.add(this.moon);
  }

  buildStars() {
    const n = 700;
    const positions = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const e = Math.random() * Math.PI * 0.48 + 0.03;
      const r = 290;
      positions[i * 3] = Math.cos(a) * Math.cos(e) * r;
      positions[i * 3 + 1] = Math.sin(e) * r;
      positions[i * 3 + 2] = Math.sin(a) * Math.cos(e) * r;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.starMat = new THREE.PointsMaterial({
      color: 0xdfe8ff, size: 1.4, sizeAttenuation: false,
      transparent: true, opacity: 0, fog: false,
    });
    this.stars = new THREE.Points(geo, this.starMat);
    this.stars.frustumCulled = false;
    this.scene.add(this.stars);
  }

  buildClouds() {
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 128;
    const ctx = canvas.getContext('2d');
    for (let i = 0; i < 9; i++) {
      const x = 40 + Math.random() * 176;
      const y = 45 + Math.random() * 38;
      const r = 22 + Math.random() * 26;
      const grad = ctx.createRadialGradient(x, y, 2, x, y, r);
      grad.addColorStop(0, 'rgba(255,255,255,0.75)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 256, 128);
    }
    const tex = new THREE.CanvasTexture(canvas);
    this.clouds = [];
    for (let i = 0; i < 9; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0.5, depthWrite: false }));
      sp.position.set((Math.random() - 0.5) * 320, 55 + Math.random() * 40, (Math.random() - 0.5) * 320);
      sp.scale.set(40 + Math.random() * 40, 16 + Math.random() * 12, 1);
      sp.userData.speed = 0.5 + Math.random() * 0.7;
      this.scene.add(sp);
      this.clouds.push(sp);
    }
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  toggleCycle() {
    this.cycleMode = this.cycleMode === 'auto' ? 'day' : this.cycleMode === 'day' ? 'night' : 'auto';
    if (this.cycleMode === 'day') this.cycleT = 0.35;
    if (this.cycleMode === 'night') this.cycleT = 0.8;
    return this.cycleMode;
  }

  celebrate(seconds = 24) {
    this.celebrationT = seconds;
  }

  update(dt, playerPos, elapsed) {
    if (this.cycleMode === 'auto') {
      this.cycleT = (this.cycleT + dt / this.cycleDuration) % 1;
    }
    const t = this.cycleT;

    // 太阳方位：t=0.25 日出，0.5 正午，0.75 日落
    const sunAngle = (t - 0.25) * Math.PI * 2;
    const sunElev = Math.sin(sunAngle);
    const sunDir = new THREE.Vector3(Math.cos(sunAngle) * 0.55, sunElev, Math.sin(sunAngle) * 0.35 + 0.3).normalize();

    // 昼夜权重
    const day = THREE.MathUtils.smoothstep(sunElev, -0.08, 0.25);
    const dusk = Math.max(0, 1 - Math.abs(sunElev) * 5.5) * (sunElev > -0.15 ? 1 : 0);
    const night = 1 - day;
    this.nightFactor = THREE.MathUtils.smoothstep(-sunElev, 0.02, 0.3);

    // 天空配色
    const lerpC = (a, b, k) => a.clone().lerp(b, k);
    const top = lerpC(new THREE.Color(0x0b1026), new THREE.Color(0x7fb2e0), day);
    top.lerp(new THREE.Color(0x5a5f9e), dusk * 0.55);
    const horizon = lerpC(new THREE.Color(0x18223c), new THREE.Color(0xdce8e8), day);
    horizon.lerp(new THREE.Color(0xe8a35c), dusk * 0.6);
    this.skyUniforms.uTop.value.copy(top);
    this.skyUniforms.uHorizon.value.copy(horizon);
    this.skyUniforms.uSunGlow.value = day + dusk * 0.7;

    const isDay = sunElev > 0;
    this.skyUniforms.uSunDir.value.copy(isDay ? sunDir : sunDir.clone().negate());

    // 雾与底色
    const fogC = lerpC(new THREE.Color(0x141c2e), new THREE.Color(0xcfe0dd), day);
    fogC.lerp(new THREE.Color(0xd8b49a), dusk * 0.5);
    this.scene.fog.color.copy(fogC);

    // 日光/月光
    if (isDay) {
      this.sun.color.set(0xfff2d8).lerp(new THREE.Color(0xffb060), dusk * 0.8);
      this.sun.intensity = 0.5 + day * 2.2;
    } else {
      this.sun.color.set(0x9fb8e8);
      this.sun.intensity = 0.4;
    }
    const lightDir = isDay ? sunDir : sunDir.clone().negate();
    this.sun.position.copy(playerPos).addScaledVector(lightDir, 120);
    this.sun.target.position.copy(playerPos);

    this.hemi.intensity = 0.22 + day * 0.65;
    this.hemi.color.set(0xbcd6e8).lerp(new THREE.Color(0x2a3455), night);
    this.hemi.groundColor.set(0x8a7a5e).lerp(new THREE.Color(0x1c2030), night);

    // 星月
    this.starMat.opacity = this.nightFactor * 0.9;
    this.moon.material.opacity = this.nightFactor * 0.95;
    this.moon.position.copy(playerPos).addScaledVector(sunDir.clone().negate(), 260);
    this.moon.position.y = Math.max(this.moon.position.y, 40);

    // 云
    for (const c of this.clouds) {
      c.position.x += c.userData.speed * dt;
      if (c.position.x > 190) c.position.x = -190;
      c.material.opacity = 0.5 * day;
    }

    // 灯笼（圆满庆祝时白昼亦明）
    this.celebrationT = Math.max(0, this.celebrationT - dt);
    const cele = Math.min(1, this.celebrationT / 3);
    const lanternGlow = Math.max(this.nightFactor, cele);
    this.lanternMats.forEach((m, i) => {
      const flicker = 0.9 + 0.18 * Math.sin(elapsed * 6 + i * 1.7) * Math.sin(elapsed * 3.3 + i);
      m.emissiveIntensity = lanternGlow * (1.5 + cele * 0.8) * flicker + 0.03;
    });

    // 天穹跟随玩家
    this.sky.position.copy(playerPos);
    this.stars.position.copy(playerPos);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
