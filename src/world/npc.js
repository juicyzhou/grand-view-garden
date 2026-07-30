import * as THREE from 'three';

/*
 * 园中人物：红楼诸钗 + 巡游丫鬟。
 * 风格化造型（襦裙/发髻/披帛），人物各有辨识度：
 *   黛玉罥烟眉垂鬟、宝玉束发金冠通灵宝玉、宝钗圆髻金锁、
 *   妙玉尼帽拂尘、李纨素髻；近人时转身面向，附人物对话。
 */

const CHARACTERS = {
  daiyu: {
    name: '林黛玉', robe: 0xa8bfd4, sash: 0x7a94b0,
    face: { brow: 'misty', eye: 'slender', blush: 0.35, mouth: 0.55 },
    hair: 'daiyu', stole: 0xe8eef4, props: ['hoe', 'pouch'],
    lines: [
      '你来了？这满院的竹子倒也听话，不吵不闹的。',
      '方才风过竹梢，我竟以为是雨……这园子里，最易听错的便是风声。',
      '那池里的荷花，开时热闹，败时干净，倒比人强些。',
      '我这身子，恰似这竿竹——看着挺直，其实腹中空得很呢。',
    ],
  },
  baoyu: {
    name: '贾宝玉', robe: 0xc25b4e, sash: 0xd8b96a,
    face: { brow: 'gentle', eye: 'round', blush: 0.5, mouth: 0.7 },
    hair: 'baoyu', stole: 0xd8b96a, props: ['jadeNecklace'],
    lines: [
      '你瞧这海棠，开起来不要命似的，倒像是从前在哪里见过的一般。',
      '我最厌那"经济学问"四个字，不如在园子里同姊妹们一处清净。',
      '这院子里的丫头们，个个都有自己的脾气，有趣得紧。',
    ],
  },
  baochai: {
    name: '薛宝钗', robe: 0xd8c8a0, sash: 0xa89878,
    face: { brow: 'soft', eye: 'almond', blush: 0.42, mouth: 0.62 },
    hair: 'baochai', stole: 0xf2e2c0, props: ['goldLock'],
    lines: [
      '这院里无甚花木，只有些香草，倒也省心。花多了，倒惹虫子。',
      '山中高士晶莹雪——你闻闻，这风里可有冷香？',
      '凡事淡些好，浓了，便不长久。',
    ],
  },
  miaoyu: {
    name: '妙玉', robe: 0x7d8590, sash: 0x5d6570,
    face: { brow: 'plain', eye: 'slender', blush: 0.15, mouth: 0.5 },
    hair: 'miaoyu', stole: 0xdde3e8, props: ['whisk'],
    lines: [
      '槛外之人，不拜俗佛。你既来了，吃一杯茶再走。',
      '这梅花上的雪水，我收了五年，今日才舍得煎茶。',
      '园子虽好，终究是尘嚣之地，我只守我这几株梅。',
    ],
  },
  liwan: {
    name: '李纨', robe: 0x6a7a68, sash: 0x4e5c4c,
    face: { brow: 'plain', eye: 'almond', blush: 0.2, mouth: 0.55 },
    hair: 'liwan', stole: 0x9aa890,
    props: [],
    lines: [
      '我倒爱这稻香村，竹篱茅舍，比那雕梁画栋住着踏实。',
      '你瞧这畦春韭，昨夜才割，今早又冒头了，比什么都精神。',
      '兰哥儿念书去了，我在这儿看看庄稼，心里也静。',
    ],
  },
  maid: {
    name: '小丫鬟', robe: 0xb8a0c0, sash: 0x9078a0,
    face: { brow: 'plain', eye: 'round', blush: 0.45, mouth: 0.6 },
    hair: 'maid', stole: null, props: [],
    lines: [
      '姑娘们在里头说话呢，客人随意逛，仔细脚下青苔滑。',
      '方才老太太房里来人要糕点，我抄近道送去，你可别挡道呀。',
    ],
  },
};

// 面部纹理：Canvas 画眉眼唇腮，贴于头部球面（正面 +z 对应 u=0.25）
function faceTexture(f = {}) {
  const { brow = 'plain', eye = 'almond', blush = 0.3, mouth = 0.6 } = f;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#f0d0b8';
  ctx.fillRect(0, 0, 256, 256);
  // 微渐变让后脑勺稍暗，增强立体感
  const grad = ctx.createLinearGradient(0, 0, 256, 0);
  grad.addColorStop(0, 'rgba(190, 150, 120, 0.25)');
  grad.addColorStop(0.25, 'rgba(190, 150, 120, 0)');
  grad.addColorStop(1, 'rgba(190, 150, 120, 0.3)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);

  const cx = 64; // u = 0.25 → 正面
  const eyeY = 138, mouthY = 178, browY = 118, blushY = 160;
  const eyeDX = 21;

  // 腮红
  ctx.fillStyle = `rgba(235, 140, 130, ${blush * 0.5})`;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(cx + s * 30, blushY, 12, 7, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // 眉
  ctx.strokeStyle = '#3a2a22';
  ctx.lineCap = 'round';
  for (const s of [-1, 1]) {
    ctx.beginPath();
    if (brow === 'misty') { // 黛玉罥烟眉：细长高远，似蹙非蹙
      ctx.lineWidth = 2.4;
      ctx.moveTo(cx + s * 9, browY + 3);
      ctx.quadraticCurveTo(cx + s * 22, browY - 8, cx + s * 33, browY - 2);
    } else if (brow === 'gentle') { // 宝玉：柔和微弯
      ctx.lineWidth = 3.2;
      ctx.moveTo(cx + s * 9, browY + 2);
      ctx.quadraticCurveTo(cx + s * 21, browY - 6, cx + s * 32, browY);
    } else if (brow === 'soft') { // 宝钗：平缓温润
      ctx.lineWidth = 3;
      ctx.moveTo(cx + s * 10, browY + 1);
      ctx.quadraticCurveTo(cx + s * 21, browY - 3, cx + s * 31, browY + 1);
    } else { // plain：简淡
      ctx.lineWidth = 2.4;
      ctx.moveTo(cx + s * 10, browY + 2);
      ctx.lineTo(cx + s * 30, browY);
    }
    ctx.stroke();
  }

  // 眼（杏核形 + 高光）
  for (const s of [-1, 1]) {
    const ex = cx + s * eyeDX;
    ctx.fillStyle = '#2a201c';
    ctx.beginPath();
    if (eye === 'round') ctx.ellipse(ex, eyeY, 7.5, 6.5, 0, 0, Math.PI * 2);
    else if (eye === 'slender') ctx.ellipse(ex, eyeY, 9, 4.2, 0, 0, Math.PI * 2);
    else ctx.ellipse(ex, eyeY, 8.5, 5.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.arc(ex + 2, eyeY - 2, 1.8, 0, Math.PI * 2);
    ctx.fill();
  }

  // 唇
  const mw = 9 * mouth + 4;
  ctx.strokeStyle = '#a8504a';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - mw / 2, mouthY);
  ctx.quadraticCurveTo(cx, mouthY + 2.5, cx + mw / 2, mouthY);
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeFigure(cfg) {
  const g = new THREE.Group();
  const robeMat = new THREE.MeshLambertMaterial({ color: cfg.robe });
  const sashMat = new THREE.MeshLambertMaterial({ color: cfg.sash });
  const hairMat = new THREE.MeshLambertMaterial({ color: 0x241c18 });
  const goldMat = new THREE.MeshLambertMaterial({ color: 0xd8b96a, emissive: 0x8a6a20, emissiveIntensity: 0.25 });
  const redMat = new THREE.MeshLambertMaterial({ color: 0xb03a2e });

  // 襦裙（窄肩宽摆）
  const pts = [
    new THREE.Vector2(0.03, 0),
    new THREE.Vector2(0.27, 0.03),
    new THREE.Vector2(0.24, 0.42),
    new THREE.Vector2(0.185, 0.9),
    new THREE.Vector2(0.16, 1.1),
    new THREE.Vector2(0.135, 1.22),
    new THREE.Vector2(0.06, 1.3),
  ];
  const robe = new THREE.Mesh(new THREE.LatheGeometry(pts, 14), robeMat);
  g.add(robe);

  // 腰带与垂绦
  const sash = new THREE.Mesh(new THREE.CylinderGeometry(0.175, 0.185, 0.09, 12), sashMat);
  sash.position.y = 0.95;
  g.add(sash);
  for (const side of [-0.05, 0.05]) {
    const cord = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.34, 0.012), sashMat);
    cord.position.set(side, 0.72, 0.19);
    g.add(cord);
  }

  // 广袖
  for (const side of [-1, 1]) {
    const sleeve = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.52, 8), robeMat);
    sleeve.position.set(side * 0.22, 1.02, 0);
    sleeve.rotation.z = side * 0.5;
    g.add(sleeve);
  }

  // 披帛：自左肩后绕臂垂落的长帛
  if (cfg.stole) {
    const stoleMat = new THREE.MeshLambertMaterial({ color: cfg.stole, side: THREE.DoubleSide });
    const curve = new THREE.CubicBezierCurve3(
      new THREE.Vector3(-0.16, 1.24, -0.1),
      new THREE.Vector3(-0.34, 1.05, -0.12),
      new THREE.Vector3(-0.3, 0.72, 0.12),
      new THREE.Vector3(-0.12, 0.52, 0.22),
    );
    const stole = new THREE.Mesh(new THREE.TubeGeometry(curve, 20, 0.045, 6), stoleMat);
    g.add(stole);
  }

  // 首（贴面部纹理）与发
  const headMat = new THREE.MeshLambertMaterial({ map: faceTexture(cfg.face) });
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 14, 12), headMat);
  head.position.y = 1.44;
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.145, 14, 12), hairMat);
  hair.position.set(0, 1.48, -0.035);
  hair.scale.set(1, 0.92, 1);
  g.add(head, hair);

  // 各式发型
  const hairStyle = cfg.hair || 'maid';
  if (hairStyle === 'daiyu') {
    // 垂鬟分髾：双环垂鬟 + 额前碎刘海 + 脑后长发
    for (const side of [-1, 1]) {
      const loop = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.022, 6, 12), hairMat);
      loop.position.set(side * 0.115, 1.55, 0.01);
      loop.rotation.y = side * 0.4;
      g.add(loop);
    }
    const bang = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 8), hairMat);
    bang.scale.set(0.9, 0.42, 0.55);
    bang.position.set(0, 1.53, 0.075);
    g.add(bang);
    const fall = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), hairMat);
    fall.scale.set(1, 2.6, 0.6);
    fall.position.set(0, 1.18, -0.16);
    g.add(fall);
  } else if (hairStyle === 'baoyu') {
    // 束发金冠 + 二龙戏珠金抹额 + 红绒簪缨
    const knot = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 0.09, 8), hairMat);
    knot.position.set(0, 1.62, -0.01);
    g.add(knot);
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.065, 0.05, 10), goldMat);
    crown.position.set(0, 1.665, -0.01);
    g.add(crown);
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.132, 0.018, 6, 20), goldMat);
    band.position.set(0, 1.5, 0.01);
    band.rotation.x = Math.PI / 2 - 0.18;
    g.add(band);
    const tassel = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 6), redMat);
    tassel.position.set(0, 1.7, -0.01);
    g.add(tassel);
    for (const side of [-1, 1]) {
      const ribbon = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.16, 0.008), redMat);
      ribbon.position.set(side * 0.045, 1.55, -0.11);
      ribbon.rotation.x = 0.25;
      g.add(ribbon);
    }
  } else if (hairStyle === 'baochai') {
    // 圆髻 + 金簪
    const bun = new THREE.Mesh(new THREE.SphereGeometry(0.065, 10, 8), hairMat);
    bun.position.set(0, 1.62, -0.045);
    g.add(bun);
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.2, 4), goldMat);
    pin.rotation.z = Math.PI / 2.3;
    pin.position.set(0.04, 1.63, -0.045);
    g.add(pin);
    const pinHead = new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 6), goldMat);
    pinHead.position.set(0.135, 1.665, -0.045);
    g.add(pinHead);
    // 侧分刘海
    const bang = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8), hairMat);
    bang.scale.set(0.95, 0.35, 0.5);
    bang.position.set(0.03, 1.54, 0.07);
    g.add(bang);
  } else if (hairStyle === 'miaoyu') {
    // 缁衣尼帽：覆首软帽 + 额带
    const hoodMat = new THREE.MeshLambertMaterial({ color: 0x5d6570 });
    const hood = new THREE.Mesh(new THREE.SphereGeometry(0.155, 14, 10), hoodMat);
    hood.scale.set(1, 1.05, 1);
    hood.position.set(0, 1.47, -0.045);
    g.add(hood);
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.128, 0.014, 6, 20), sashMat);
    band.position.set(0, 1.5, 0.015);
    band.rotation.x = Math.PI / 2 - 0.12;
    g.add(band);
    const cape = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.3, 10, 1, true), hoodMat);
    cape.position.set(0, 1.32, -0.09);
    cape.rotation.x = 0.35;
    g.add(cape);
  } else if (hairStyle === 'liwan') {
    // 素髻 + 布带
    const bun = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), hairMat);
    bun.position.set(0, 1.6, -0.05);
    g.add(bun);
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.012, 5, 12), sashMat);
    band.position.set(0, 1.6, -0.05);
    band.rotation.x = Math.PI / 2;
    g.add(band);
  } else {
    // maid：双丫髻 + 红绳
    for (const side of [-1, 1]) {
      const bun = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), hairMat);
      bun.position.set(side * 0.09, 1.62, 0);
      g.add(bun);
      const tie = new THREE.Mesh(new THREE.TorusGeometry(0.032, 0.009, 5, 10), redMat);
      tie.position.set(side * 0.09, 1.585, 0);
      tie.rotation.x = Math.PI / 2;
      g.add(tie);
    }
  }

  // 标志性手持/佩饰
  const props = cfg.props || [];
  if (props.includes('jadeNecklace')) {
    // 通灵宝玉：金璎珞项圈 + 碧玉坠
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.014, 6, 18), goldMat);
    collar.position.set(0, 1.28, 0.03);
    collar.rotation.x = Math.PI / 2 - 0.25;
    g.add(collar);
    const jade = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.035),
      new THREE.MeshLambertMaterial({ color: 0x4e9a68, emissive: 0x1e5a30, emissiveIntensity: 0.4 }),
    );
    jade.position.set(0, 1.2, 0.14);
    g.add(jade);
  }
  if (props.includes('goldLock')) {
    // 金锁：璎珞金锁片垂于胸前
    const cord = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.01, 5, 16), redMat);
    cord.position.set(0, 1.28, 0.03);
    cord.rotation.x = Math.PI / 2 - 0.25;
    g.add(cord);
    const lock = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.055, 0.02), goldMat);
    lock.position.set(0, 1.19, 0.145);
    g.add(lock);
  }
  if (props.includes('hoe')) {
    // 花锄（葬花）：细柄小锄，荷于右肩侧
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.85, 5), new THREE.MeshLambertMaterial({ color: 0x6a4a30 }));
    handle.position.set(0.3, 1.15, 0.05);
    handle.rotation.z = -0.5;
    g.add(handle);
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.13, 0.015), new THREE.MeshLambertMaterial({ color: 0x8a8f96 }));
    blade.position.set(0.48, 1.52, 0.05);
    blade.rotation.z = -0.5;
    g.add(blade);
  }
  if (props.includes('pouch')) {
    // 绢袋（收花）：左臂挎素色小锦囊
    const pouch = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshLambertMaterial({ color: 0xe8e0d0 }));
    pouch.scale.set(1, 1.25, 0.8);
    pouch.position.set(-0.26, 0.82, 0.08);
    g.add(pouch);
  }
  if (props.includes('whisk')) {
    // 拂尘：木柄白麈尾
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.014, 0.3, 5), new THREE.MeshLambertMaterial({ color: 0x4a3526 }));
    handle.position.set(0.26, 0.85, 0.12);
    handle.rotation.z = -0.35;
    g.add(handle);
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.3, 8), new THREE.MeshLambertMaterial({ color: 0xf0ece0 }));
    tail.position.set(0.36, 0.62, 0.14);
    tail.rotation.z = 0.35;
    g.add(tail);
  }

  // 名讳牌
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 72;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(23, 20, 16, 0.55)';
  ctx.beginPath();
  ctx.roundRect(58, 8, 140, 54, 8);
  ctx.fill();
  ctx.fillStyle = '#e8d8ae';
  ctx.font = 'bold 34px "Songti SC", "STSong", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(cfg.name, 128, 38);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  label.scale.set(1.35, 0.38, 1);
  label.position.y = 1.95;
  g.add(label);

  g.traverse((o) => { if (o.isMesh && o !== label) { o.castShadow = true; } });
  return g;
}

export class NPCManager {
  constructor(scene, spots) {
    this.scene = scene;
    this.npcs = [];
    this.interactables = [];

    for (const spot of spots) {
      const cfg = CHARACTERS[spot.id] || CHARACTERS.maid;
      const fig = makeFigure(cfg);
      fig.position.set(spot.x, spot.y || 0, spot.z);
      fig.rotation.y = spot.face || 0;
      scene.add(fig);
      const npc = {
        id: spot.id, cfg, fig,
        baseY: spot.y || 0,
        defaultFace: spot.face || 0,
        phase: Math.random() * 10,
        lineIdx: 0,
        x: spot.x, z: spot.z,
      };
      this.npcs.push(npc);
      this.interactables.push({
        x: spot.x, z: spot.z, r: 2.8, type: 'npc', npc,
        label: `与 ${cfg.name} 交谈`,
      });
    }

    // 巡游丫鬟
    this.addWalker([{ x: 10, z: 30 }, { x: -10, z: 30 }]);
    this.addWalker([{ x: 3, z: -4 }, { x: 3, z: -16 }]);
  }

  addWalker(waypoints) {
    const cfg = CHARACTERS.maid;
    const fig = makeFigure(cfg);
    fig.position.set(waypoints[0].x, 0, waypoints[0].z);
    this.scene.add(fig);
    const npc = {
      id: 'maid', cfg, fig,
      baseY: 0, phase: Math.random() * 10, lineIdx: 0,
      walker: { waypoints, target: 1, pauseT: 0, speed: 1.0 },
      x: waypoints[0].x, z: waypoints[0].z,
    };
    this.npcs.push(npc);
    this.interactables.push({
      get x() { return npc.fig.position.x; },
      get z() { return npc.fig.position.z; },
      r: 2.4, type: 'npc', npc,
      label: `与 ${cfg.name} 交谈`,
    });
  }

  nextLine(npc) {
    const line = npc.cfg.lines[npc.lineIdx % npc.cfg.lines.length];
    npc.lineIdx += 1;
    return { speaker: npc.cfg.name, line };
  }

  update(dt, playerPos, t) {
    for (const npc of this.npcs) {
      const fig = npc.fig;
      // 呼吸起伏
      fig.position.y = npc.baseY + Math.sin(t * 1.3 + npc.phase) * 0.015;

      if (npc.walker) {
        const w = npc.walker;
        const target = w.waypoints[w.target];
        const dx = target.x - fig.position.x;
        const dz = target.z - fig.position.z;
        const dist = Math.hypot(dx, dz);
        const dPlayer = fig.position.distanceTo(playerPos);
        if (w.pauseT > 0) {
          w.pauseT -= dt;
        } else if (dPlayer < 2.2) {
          // 遇人驻足
        } else if (dist < 0.3) {
          w.target = (w.target + 1) % w.waypoints.length;
          w.pauseT = 2.5;
        } else {
          fig.position.x += (dx / dist) * w.speed * dt;
          fig.position.z += (dz / dist) * w.speed * dt;
          fig.rotation.y = Math.atan2(dx, dz);
          // 行走小步幅摆动
          fig.rotation.z = Math.sin(t * 8) * 0.02;
        }
        npc.x = fig.position.x;
        npc.z = fig.position.z;
        if (dPlayer < 3.5) {
          const want = Math.atan2(playerPos.x - fig.position.x, playerPos.z - fig.position.z);
          fig.rotation.y += (want - fig.rotation.y) * Math.min(1, dt * 4);
        }
      } else {
        // 定点人物：近则面向来客
        const dx = playerPos.x - fig.position.x;
        const dz = playerPos.z - fig.position.z;
        const d = Math.hypot(dx, dz);
        let want = npc.defaultFace;
        if (d < 5) want = Math.atan2(dx, dz);
        let diff = want - fig.rotation.y;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        fig.rotation.y += diff * Math.min(1, dt * 3);
      }
    }
  }
}
