import * as THREE from 'three';

/*
 * 园中人物：红楼诸钗 + 巡游丫鬟。
 * 风格化造型（襦裙/发髻），近人时转身面向，附人物对话。
 */

const CHARACTERS = {
  daiyu: {
    name: '林黛玉', robe: 0xa8bfd4, sash: 0x7a94b0,
    lines: [
      '你来了？这满院的竹子倒也听话，不吵不闹的。',
      '方才风过竹梢，我竟以为是雨……这园子里，最易听错的便是风声。',
      '那池里的荷花，开时热闹，败时干净，倒比人强些。',
      '我这身子，恰似这竿竹——看着挺直，其实腹中空得很呢。',
    ],
  },
  baoyu: {
    name: '贾宝玉', robe: 0xc25b4e, sash: 0xd8b96a,
    lines: [
      '你瞧这海棠，开起来不要命似的，倒像是从前在哪里见过的一般。',
      '我最厌那"经济学问"四个字，不如在园子里同姊妹们一处清净。',
      '这院子里的丫头们，个个都有自己的脾气，有趣得紧。',
    ],
  },
  baochai: {
    name: '薛宝钗', robe: 0xd8c8a0, sash: 0xa89878,
    lines: [
      '这院里无甚花木，只有些香草，倒也省心。花多了，倒惹虫子。',
      '山中高士晶莹雪——你闻闻，这风里可有冷香？',
      '凡事淡些好，浓了，便不长久。',
    ],
  },
  miaoyu: {
    name: '妙玉', robe: 0x7d8590, sash: 0x5d6570,
    lines: [
      '槛外之人，不拜俗佛。你既来了，吃一杯茶再走。',
      '这梅花上的雪水，我收了五年，今日才舍得煎茶。',
      '园子虽好，终究是尘嚣之地，我只守我这几株梅。',
    ],
  },
  liwan: {
    name: '李纨', robe: 0x6a7a68, sash: 0x4e5c4c,
    lines: [
      '我倒爱这稻香村，竹篱茅舍，比那雕梁画栋住着踏实。',
      '你瞧这畦春韭，昨夜才割，今早又冒头了，比什么都精神。',
      '兰哥儿念书去了，我在这儿看看庄稼，心里也静。',
    ],
  },
  maid: {
    name: '小丫鬟', robe: 0xb8a0c0, sash: 0x9078a0,
    lines: [
      '姑娘们在里头说话呢，客人随意逛，仔细脚下青苔滑。',
      '方才老太太房里来人要糕点，我抄近道送去，你可别挡道呀。',
    ],
  },
};

function makeFigure(cfg) {
  const g = new THREE.Group();
  const robeMat = new THREE.MeshLambertMaterial({ color: cfg.robe });
  const sashMat = new THREE.MeshLambertMaterial({ color: cfg.sash });
  const skinMat = new THREE.MeshLambertMaterial({ color: 0xf0d0b8 });
  const hairMat = new THREE.MeshLambertMaterial({ color: 0x241c18 });

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

  // 腰带
  const sash = new THREE.Mesh(new THREE.CylinderGeometry(0.175, 0.185, 0.09, 12), sashMat);
  sash.position.y = 0.95;
  g.add(sash);

  // 广袖
  for (const side of [-1, 1]) {
    const sleeve = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.52, 8), robeMat);
    sleeve.position.set(side * 0.22, 1.02, 0);
    sleeve.rotation.z = side * 0.5;
    g.add(sleeve);
  }

  // 首与发髻
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 14, 12), skinMat);
  head.position.y = 1.44;
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.145, 14, 12), hairMat);
  hair.position.set(0, 1.48, -0.035);
  hair.scale.set(1, 0.92, 1);
  g.add(head, hair);
  if (cfg.buns === 2) {
    for (const side of [-1, 1]) {
      const bun = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), hairMat);
      bun.position.set(side * 0.09, 1.62, 0);
      g.add(bun);
    }
  } else {
    const bun = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), hairMat);
    bun.position.set(0, 1.62, -0.03);
    g.add(bun);
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.22, 4), sashMat);
    pin.rotation.z = Math.PI / 2.3;
    pin.position.set(0.03, 1.62, -0.03);
    g.add(pin);
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
    const fig = makeFigure({ ...cfg, buns: 2 });
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
