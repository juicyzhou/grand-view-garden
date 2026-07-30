import * as THREE from 'three';

/*
 * 第一人称控制器：
 *  - 桌面：指针锁定 + WASD + Shift 疾行 + 空格跳跃
 *  - 触屏：左侧虚拟摇杆 + 右侧滑动环视 + 交互/跳跃按钮
 *  - 碰撞：圆/盒两级，低障（水面）仅在地表生效；台阶步高 0.55
 */
export class Player {
  constructor(camera, garden, dom) {
    this.camera = camera;
    this.garden = garden;
    this.dom = dom;

    this.pos = new THREE.Vector3(0, 0, 41.5); // 出生：南门内
    this.vel = new THREE.Vector3();
    this.yaw = 0;   // 朝北（-z）
    this.pitch = 0;
    this.eyeH = 1.62;
    this.radius = 0.35;
    this.stepH = 0.55;
    this.grounded = true;
    this.bobT = 0;
    this.enabled = false;

    this.keys = new Set();
    this.touch = { active: false, move: new THREE.Vector2(), look: null, joyId: null, lookId: null };
    this.isTouchDevice = matchMedia('(pointer: coarse)').matches;

    this.bindDesktop();
    if (this.isTouchDevice) this.bindTouch();
  }

  bindDesktop() {
    document.addEventListener('keydown', (e) => {
      if (e.code === 'Space') e.preventDefault();
      this.keys.add(e.code);
    });
    document.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());

    document.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement !== this.dom) return;
      this.yaw -= e.movementX * 0.0023;
      this.pitch -= e.movementY * 0.0021;
      this.pitch = THREE.MathUtils.clamp(this.pitch, -1.45, 1.45);
    });
  }

  bindTouch() {
    const joy = document.getElementById('joystick');
    const knob = document.getElementById('joystick-knob');
    const joyRadius = 40;

    const setKnob = (dx, dy) => {
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
    };

    joy.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const t = e.changedTouches[0];
      this.touch.joyId = t.identifier;
    }, { passive: false });

    const joyMove = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier !== this.touch.joyId) continue;
        const rect = joy.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        let dx = t.clientX - cx;
        let dy = t.clientY - cy;
        const len = Math.hypot(dx, dy);
        if (len > joyRadius) { dx = dx / len * joyRadius; dy = dy / len * joyRadius; }
        setKnob(dx, dy);
        this.touch.move.set(dx / joyRadius, dy / joyRadius);
      }
    };
    joy.addEventListener('touchmove', joyMove, { passive: false });
    const joyEnd = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier !== this.touch.joyId) continue;
        this.touch.joyId = null;
        this.touch.move.set(0, 0);
        setKnob(0, 0);
      }
    };
    joy.addEventListener('touchend', joyEnd);
    joy.addEventListener('touchcancel', joyEnd);

    // 右半屏环视
    document.addEventListener('touchstart', (e) => {
      for (const t of e.changedTouches) {
        if (t.clientX < window.innerWidth * 0.45) continue;
        if (t.target.closest('button') || t.target.closest('#joystick')) continue;
        if (this.touch.lookId !== null) continue;
        this.touch.lookId = t.identifier;
        this.touch.look = { x: t.clientX, y: t.clientY };
      }
    }, { passive: true });
    document.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier !== this.touch.lookId) continue;
        this.yaw -= (t.clientX - this.touch.look.x) * 0.0042;
        this.pitch -= (t.clientY - this.touch.look.y) * 0.0038;
        this.pitch = THREE.MathUtils.clamp(this.pitch, -1.45, 1.45);
        this.touch.look = { x: t.clientX, y: t.clientY };
      }
    }, { passive: true });
    const lookEnd = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this.touch.lookId) this.touch.lookId = null;
      }
    };
    document.addEventListener('touchend', lookEnd);
    document.addEventListener('touchcancel', lookEnd);

    document.getElementById('touch-jump').addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.tryJump();
    }, { passive: false });
  }

  lock() {
    if (!this.isTouchDevice && document.pointerLockElement !== this.dom) {
      this.dom.requestPointerLock();
    }
  }

  tryJump() {
    if (this.grounded && this.enabled) {
      this.vel.y = 5.2;
      this.grounded = false;
    }
  }

  // 某点是否被碰撞体阻挡（已陷入的碰撞体不再阻挡，保证总能脱身）
  blockedAt(x, z) {
    const r = this.radius;
    for (const c of this.garden.colliders) {
      if (c.lowBlock && this.pos.y > 0.35) continue;
      if (c.kind === 'circle') {
        const dx = x - c.x, dz = z - c.z;
        const dist2 = dx * dx + dz * dz;
        if (dist2 < (c.r + r) * (c.r + r)) {
          const pdx = this.pos.x - c.x, pdz = this.pos.z - c.z;
          if (pdx * pdx + pdz * pdz > (c.r - 0.05) * (c.r - 0.05)) return true;
        }
      } else {
        const cx = THREE.MathUtils.clamp(x, c.minX, c.maxX);
        const cz = THREE.MathUtils.clamp(z, c.minZ, c.maxZ);
        const dx = x - cx, dz = z - cz;
        if (dx * dx + dz * dz < r * r) {
          const inside = this.pos.x > c.minX - r * 0.5 && this.pos.x < c.maxX + r * 0.5
            && this.pos.z > c.minZ - r * 0.5 && this.pos.z < c.maxZ + r * 0.5;
          if (!inside) return true;
        }
      }
    }
    return false;
  }

  update(dt) {
    if (!this.enabled) return;
    dt = Math.min(dt, 0.05);

    // 输入 → 期望方向
    let ix = 0, iz = 0;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) iz -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) iz += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) ix -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) ix += 1;
    ix += this.touch.move.x;
    iz += this.touch.move.y;
    const iLen = Math.hypot(ix, iz);
    if (iLen > 1) { ix /= iLen; iz /= iLen; }
    if (this.keys.has('Space')) this.tryJump();

    const running = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
    const speed = running ? 7.2 : 4.2;

    // 朝向旋转：view = (-sin yaw, 0, -cos yaw)，right = (cos yaw, 0, -sin yaw)
    // W 时 iz=-1，应沿 view 方向移动
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    const wishX = (ix * cos + iz * sin) * speed;
    const wishZ = (iz * cos - ix * sin) * speed;

    // 平滑加減速
    const accel = this.grounded ? 14 : 4;
    this.vel.x = THREE.MathUtils.damp(this.vel.x, wishX, accel, dt);
    this.vel.z = THREE.MathUtils.damp(this.vel.z, wishZ, accel, dt);

    // 分轴移动 + 碰撞
    const curGround = this.garden.getGroundHeight(this.pos.x, this.pos.z);
    const tryAxis = (dx, dz) => {
      const nx = this.pos.x + dx;
      const nz = this.pos.z + dz;
      if (this.blockedAt(nx, nz)) return;
      const g = this.garden.getGroundHeight(nx, nz);
      if (this.grounded && g - this.pos.y > this.stepH) return; // 台阶过高
      if (!this.grounded && g - this.pos.y > 0.2) return;      // 空中不许穿台
      this.pos.x = nx;
      this.pos.z = nz;
    };
    tryAxis(this.vel.x * dt, 0);
    tryAxis(0, this.vel.z * dt);

    // 重力与地面
    const groundY = this.garden.getGroundHeight(this.pos.x, this.pos.z);
    if (this.grounded) {
      // 平滑上下台阶/坡
      this.pos.y = THREE.MathUtils.damp(this.pos.y, groundY, 22, dt);
      if (groundY < this.pos.y - 0.6) this.grounded = false; // 走出平台边缘
    }
    if (!this.grounded) {
      this.vel.y -= 14 * dt;
      this.pos.y += this.vel.y * dt;
      if (this.pos.y <= groundY && this.vel.y <= 0) {
        this.pos.y = groundY;
        this.vel.y = 0;
        this.grounded = true;
      }
    }

    // 头部微晃
    const planarSpeed = Math.hypot(this.vel.x, this.vel.z);
    if (this.grounded && planarSpeed > 0.5) {
      this.bobT += dt * planarSpeed * 1.6;
    }
    const bob = Math.sin(this.bobT) * 0.035 * Math.min(planarSpeed / 4, 1);

    // 相机
    this.camera.position.set(this.pos.x, this.pos.y + this.eyeH + bob, this.pos.z);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.set(this.pitch, this.yaw, 0);
  }
}
