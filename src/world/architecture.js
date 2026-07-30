import * as THREE from 'three';
import { plaqueTexture, steleTexture } from './materials.js';

/*
 * 中式建筑程序化生成器。
 * 约定：所有 builder 返回 THREE.Group，碰撞体与可行走平台记录在
 * group.userData.colliders / .ground / .groundFns（局部坐标），
 * 由 garden.js 在放置后统一变换到世界坐标。
 */

// ---------- 屋顶 ----------

// 庑殿式曲面屋顶：举折曲线 + 翼角起翘
export function hipRoofGeometry({ w, d, h = 1.6, overhang = 0.9, ridgeRatio = 0.45, upturn = 0.42, rings = 12 }) {
  const W = w / 2 + overhang;
  const D = d / 2 + overhang;
  const ridgeHalf = Math.max((w * ridgeRatio) / 2, 0.06);
  const positions = [];
  const uvs = [];
  const indices = [];

  for (let i = 0; i <= rings; i++) {
    const t = i / rings;
    const k = t * t; // 举折：愈近脊愈陡
    const hw = THREE.MathUtils.lerp(W, ridgeHalf, k);
    const hd = THREE.MathUtils.lerp(D, 0.05, k);
    const y = h * k;
    const lift = upturn * Math.pow(1 - t, 3); // 翼角
    positions.push(
      hw, y + lift, hd,
      -hw, y + lift, hd,
      -hw, y + lift, -hd,
      hw, y + lift, -hd,
    );
    const u = Math.max(w, d) / 3;
    uvs.push(u, t * 2, 0, t * 2, u, t * 2, 0, t * 2);
  }

  for (let i = 0; i < rings; i++) {
    const a = i * 4;
    const b = (i + 1) * 4;
    for (let c = 0; c < 4; c++) {
      const c2 = (c + 1) % 4;
      indices.push(a + c, b + c2, b + c);
      indices.push(a + c, a + c2, b + c2);
    }
  }
  const top = rings * 4;
  indices.push(top, top + 2, top + 1, top, top + 3, top + 2);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// 攒尖圆顶（亭）
export function coneRoofGeometry({ r, h = 1.5, overhang = 0.7, segments = 14, rings = 10 }) {
  const R = r + overhang;
  const positions = [];
  const uvs = [];
  const indices = [];

  for (let i = 0; i <= rings; i++) {
    const t = i / rings;
    const k = t * t;
    const rr = THREE.MathUtils.lerp(R, 0.03, k);
    const y = h * k;
    for (let s = 0; s < segments; s++) {
      const a = (s / segments) * Math.PI * 2;
      positions.push(Math.cos(a) * rr, y, Math.sin(a) * rr);
      uvs.push(s / segments * 4, t * 2);
    }
  }
  for (let i = 0; i < rings; i++) {
    const a = i * segments;
    const b = (i + 1) * segments;
    for (let s = 0; s < segments; s++) {
      const s2 = (s + 1) % segments;
      indices.push(a + s, b + s2, b + s);
      indices.push(a + s, a + s2, b + s2);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function ridgeAssembly(w, h, ridgeRatio, mats, { chiwei = true } = {}) {
  const g = new THREE.Group();
  const ridgeLen = Math.max(w * ridgeRatio, 0.3);
  const ridge = new THREE.Mesh(new THREE.BoxGeometry(ridgeLen + 0.3, 0.22, 0.24), mats.ridge);
  ridge.position.y = h + 0.08;
  g.add(ridge);
  if (chiwei) {
    for (const side of [-1, 1]) {
      const horn = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.55, 0.24), mats.ridge);
      horn.position.set(side * (ridgeLen / 2 + 0.12), h + 0.3, 0);
      horn.rotation.z = -side * 0.5;
      g.add(horn);
    }
  }
  return g;
}

function goldFinial(h, mats) {
  const g = new THREE.Group();
  const orb = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), mats.gold);
  orb.position.y = h + 0.18;
  const spike = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.5, 8), mats.gold);
  spike.position.y = h + 0.5;
  g.add(orb, spike);
  return g;
}

// ---------- 台基与台阶 ----------

export function platform(w, d, h, mats) {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats.stone);
  base.position.y = h / 2;
  const lip = new THREE.Mesh(new THREE.BoxGeometry(w + 0.24, 0.1, d + 0.24), mats.stoneDark);
  lip.position.y = h - 0.05;
  g.add(base, lip);
  g.userData.ground = [{ minX: -w / 2, maxX: w / 2, minZ: -d / 2, maxZ: d / 2, y: h }];
  return g;
}

// dir=+1：沿 +z 方向上行（顶端在 z=0 一侧需配合放置）；dir=-1：沿 -z 方向上行，顶端在局部 z=0
export function steps(width, totalRise, count, mats, run = 0.42, dir = -1) {
  const g = new THREE.Group();
  const stepH = totalRise / count;
  for (let i = 0; i < count; i++) {
    const h = stepH * (i + 1);
    const s = new THREE.Mesh(new THREE.BoxGeometry(width, h, run), mats.stone);
    const z = dir === -1
      ? (count - i) * run - run / 2
      : -(count - i) * run + run / 2;
    s.position.set(0, h / 2, z);
    g.add(s);
  }
  g.userData.groundFns = [{
    minX: -width / 2, maxX: width / 2,
    minZ: dir === -1 ? 0 : -count * run,
    maxZ: dir === -1 ? count * run : 0,
    axis: 'z',
    from: dir === -1 ? count * run : -count * run, y0: 0,
    to: 0, y1: totalRise,
  }];
  return g;
}

// ---------- 栏杆 ----------

function railing(len, mats, { postEvery = 1.4, height = 0.62 } = {}) {
  const g = new THREE.Group();
  const rail = new THREE.Mesh(new THREE.BoxGeometry(len, 0.08, 0.12), mats.wood);
  rail.position.y = height;
  const mid = new THREE.Mesh(new THREE.BoxGeometry(len, 0.05, 0.08), mats.wood);
  mid.position.y = height * 0.55;
  g.add(rail, mid);
  const n = Math.max(2, Math.round(len / postEvery) + 1);
  for (let i = 0; i < n; i++) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, height, 6), mats.wood);
    post.position.set(-len / 2 + (len / (n - 1)) * i, height / 2, 0);
    g.add(post);
  }
  return g;
}

// ---------- 亭子 ----------

export function squarePavilion({ w = 4, d = 4, name, mats, roofH = 1.7, platformH = 0.5 }) {
  const g = new THREE.Group();
  const base = platform(w, d, platformH, mats);
  g.add(base);

  const colH = 2.7;
  const inset = 0.55;
  const cols = [];
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const x = sx * (w / 2 - inset);
      const z = sz * (d / 2 - inset);
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, colH, 10), mats.column);
      col.position.set(x, platformH + colH / 2, z);
      const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.18, 10), mats.stoneDark);
      drum.position.set(x, platformH + 0.09, z);
      g.add(col, drum);
      cols.push({ x, z });
    }
  }

  // 额枋
  for (const [len, rot, x, z] of [
    [w - inset, 0, 0, d / 2 - inset],
    [w - inset, 0, 0, -(d / 2 - inset)],
    [d - inset, Math.PI / 2, w / 2 - inset, 0],
    [d - inset, Math.PI / 2, -(w / 2 - inset), 0],
  ]) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(len + 0.4, 0.26, 0.18), mats.beam);
    beam.position.set(x, platformH + colH + 0.13, z);
    beam.rotation.y = rot;
    g.add(beam);
  }

  // 三面栏杆（前面留空）
  for (const [len, rot, x, z] of [
    [w - inset * 2, 0, 0, -(d / 2 - inset)],
    [d - inset * 2, Math.PI / 2, w / 2 - inset, 0],
    [d - inset * 2, Math.PI / 2, -(w / 2 - inset), 0],
  ]) {
    const r = railing(len, mats);
    r.position.set(x, platformH, z);
    r.rotation.y = rot;
    g.add(r);
  }

  const roof = new THREE.Mesh(
    hipRoofGeometry({ w: w - 0.6, d: d - 0.6, h: roofH, overhang: 1.1, ridgeRatio: 0.18, upturn: 0.5 }),
    mats.roof,
  );
  roof.position.y = platformH + colH + 0.28;
  g.add(roof);
  g.add(ridgeAssembly(w - 0.6, roofH, 0.18, mats).translateY(platformH + colH + 0.28));
  g.add(goldFinial(roofH, mats).translateY(platformH + colH + 0.28));

  if (name) {
    const board = signboard(name, mats);
    board.position.set(0, platformH + colH - 0.05, d / 2 - inset + 0.14);
    g.add(board);
  }

  g.userData.colliders = cols.map(({ x, z }) => ({ kind: 'circle', x, z, r: 0.22 }));
  g.userData.ground = base.userData.ground;
  return g;
}

export function hexPavilion({ r = 2.4, name, mats, platformH = 0.5 }) {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(r, r + 0.15, platformH, 6), mats.stone);
  base.position.y = platformH / 2;
  g.add(base);

  const colH = 2.6;
  const cols = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    const x = Math.cos(a) * (r - 0.45);
    const z = Math.sin(a) * (r - 0.45);
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, colH, 10), mats.column);
    col.position.set(x, platformH + colH / 2, z);
    g.add(col);
    cols.push({ x, z });
  }

  const roof = new THREE.Mesh(coneRoofGeometry({ r: r - 0.2, h: 1.9, overhang: 0.9 }), mats.roof);
  roof.position.y = platformH + colH + 0.15;
  g.add(roof);
  g.add(goldFinial(1.9, mats).translateY(platformH + colH + 0.15));

  if (name) {
    const board = signboard(name, mats);
    board.position.set(0, platformH + colH - 0.05, r - 0.4);
    g.add(board);
  }

  g.userData.colliders = cols.map(({ x, z }) => ({ kind: 'circle', x, z, r: 0.2 }));
  g.userData.ground = [{ minX: -r * 0.8, maxX: r * 0.8, minZ: -r * 0.8, maxZ: r * 0.8, y: platformH }];
  return g;
}

// ---------- 厅堂（可进入） ----------

export function hall({
  w = 10, d = 7, name, mats,
  platformH = 0.6, doubleEave = false, roofH = 2.2,
  wallMat, doorWidth = 2.0,
}) {
  const g = new THREE.Group();
  const base = platform(w + 1.5, d + 1.5, platformH, mats);
  g.add(base);

  // 正面台阶（顶端接台基前缘）
  const st = steps(2.6, platformH, 2, mats, 0.42, -1);
  st.position.set(0, 0, (d + 1.5) / 2);
  g.add(st);

  const colH = 3.0;
  const wall = wallMat || mats.wood;
  const wallH = colH;
  const t = 0.22; // 墙厚

  // 后墙与两侧墙
  const back = new THREE.Mesh(new THREE.BoxGeometry(w, wallH, t), wall);
  back.position.set(0, platformH + wallH / 2, -d / 2 + t / 2);
  const left = new THREE.Mesh(new THREE.BoxGeometry(t, wallH, d), wall);
  left.position.set(-w / 2 + t / 2, platformH + wallH / 2, 0);
  const right = left.clone();
  right.position.x = w / 2 - t / 2;
  g.add(back, left, right);

  // 前墙：门洞两侧窗棂墙
  const frontSeg = (w - doorWidth) / 2;
  for (const side of [-1, 1]) {
    const seg = new THREE.Mesh(new THREE.BoxGeometry(frontSeg, wallH, t), mats.lattice);
    seg.position.set(side * (doorWidth / 2 + frontSeg / 2), platformH + wallH / 2, d / 2 - t / 2);
    g.add(seg);
  }
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(doorWidth + 0.4, 0.5, t), mats.woodDark);
  lintel.position.set(0, platformH + wallH - 0.25, d / 2 - t / 2);
  g.add(lintel);

  // 木地板 + 顶棚
  const floor = new THREE.Mesh(new THREE.BoxGeometry(w, 0.06, d), mats.woodDark);
  floor.position.set(0, platformH + 0.03, 0);
  const ceiling = new THREE.Mesh(new THREE.BoxGeometry(w, 0.08, d), mats.woodDark);
  ceiling.position.set(0, platformH + wallH + 0.04, 0);
  g.add(floor, ceiling);

  // 前檐柱
  const cols = [];
  const nCol = Math.max(2, Math.round(w / 2.6));
  for (let i = 0; i <= nCol; i++) {
    const x = -w / 2 + 0.4 + ((w - 0.8) / nCol) * i;
    if (Math.abs(x) < doorWidth / 2 + 0.2) continue;
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.17, colH, 10), mats.column);
    col.position.set(x, platformH + colH / 2, d / 2 + 0.55);
    g.add(col);
    cols.push({ x, z: d / 2 + 0.55 });
  }

  const beam = new THREE.Mesh(new THREE.BoxGeometry(w + 1, 0.3, 0.2), mats.beam);
  beam.position.set(0, platformH + colH + 0.15, d / 2 + 0.55);
  g.add(beam);

  // 屋顶（重檐可选）
  const roof = new THREE.Mesh(
    hipRoofGeometry({ w: w + 0.6, d: d + 0.6, h: roofH, overhang: 1.3, ridgeRatio: 0.55, upturn: 0.46 }),
    mats.roof,
  );
  roof.position.y = platformH + wallH + 0.3;
  g.add(roof);
  g.add(ridgeAssembly(w + 0.6, roofH, 0.55, mats).translateY(platformH + wallH + 0.3));

  if (doubleEave) {
    const lower = new THREE.Mesh(
      hipRoofGeometry({ w: w + 0.9, d: d + 0.9, h: 0.9, overhang: 1.5, ridgeRatio: 0.7, upturn: 0.4 }),
      mats.roof,
    );
    lower.position.y = platformH + wallH - 0.35;
    g.add(lower);
  }

  if (name) {
    const board = signboard(name, mats, 2.4);
    board.position.set(0, platformH + colH - 0.1, d / 2 + 0.7);
    g.add(board);
  }

  g.userData.colliders = [
    { kind: 'box', minX: -w / 2, maxX: w / 2, minZ: -d / 2 - 0.1, maxZ: -d / 2 + t },
    { kind: 'box', minX: -w / 2 - 0.1, maxX: -w / 2 + t, minZ: -d / 2, maxZ: d / 2 },
    { kind: 'box', minX: w / 2 - t, maxX: w / 2 + 0.1, minZ: -d / 2, maxZ: d / 2 },
    { kind: 'box', minX: -w / 2, maxX: -doorWidth / 2, minZ: d / 2 - t, maxZ: d / 2 + 0.1 },
    { kind: 'box', minX: doorWidth / 2, maxX: w / 2, minZ: d / 2 - t, maxZ: d / 2 + 0.1 },
    ...cols.map(({ x, z }) => ({ kind: 'circle', x, z, r: 0.22 })),
  ];
  g.userData.ground = [...base.userData.ground];
  return g;
}

// ---------- 游廊 ----------

export function corridor(len, mats, { width = 1.8 } = {}) {
  const g = new THREE.Group();
  const colH = 2.3;
  const cols = [];
  const n = Math.max(2, Math.round(len / 2.2) + 1);
  for (let i = 0; i < n; i++) {
    const x = -len / 2 + (len / (n - 1)) * i;
    for (const side of [-1, 1]) {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, colH, 8), mats.column);
      col.position.set(x, colH / 2, side * (width / 2 - 0.15));
      g.add(col);
      cols.push({ x, z: side * (width / 2 - 0.15) });
    }
  }
  const roof = new THREE.Mesh(
    hipRoofGeometry({ w: len, d: width, h: 0.7, overhang: 0.55, ridgeRatio: 0.86, upturn: 0.22, rings: 6 }),
    mats.roof,
  );
  roof.position.y = colH + 0.15;
  g.add(roof);
  const ridge = new THREE.Mesh(new THREE.BoxGeometry(len + 0.4, 0.14, 0.16), mats.ridge);
  ridge.position.y = colH + 0.15 + 0.7 + 0.05;
  g.add(ridge);

  // 两侧坐槛
  for (const side of [-1, 1]) {
    const bench = new THREE.Mesh(new THREE.BoxGeometry(len, 0.35, 0.3), mats.wood);
    bench.position.set(0, 0.28, side * (width / 2 - 0.28));
    g.add(bench);
  }

  g.userData.colliders = cols.map(({ x, z }) => ({ kind: 'circle', x, z, r: 0.16 }));
  return g;
}

// ---------- 墙体与门 ----------

export function wallSegment(len, mats, { h = 2.7, thickness = 0.28 } = {}) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(len, h, thickness), mats.wall);
  body.position.y = h / 2;
  g.add(body);
  // 瓦顶墙帽
  const cap = new THREE.Mesh(
    hipRoofGeometry({ w: len, d: thickness + 0.3, h: 0.28, overhang: 0.28, ridgeRatio: 0.9, upturn: 0.06, rings: 4 }),
    mats.roofPlain,
  );
  cap.position.y = h;
  g.add(cap);
  g.userData.colliders = [{ kind: 'box', minX: -len / 2, maxX: len / 2, minZ: -thickness / 2 - 0.05, maxZ: thickness / 2 + 0.05 }];
  return g;
}

// 月洞门
export function moonGate(mats, { w = 3.8, h = 2.9, holeR = 1.12 } = {}) {
  const g = new THREE.Group();
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2, 0);
  shape.lineTo(w / 2, 0);
  shape.lineTo(w / 2, h);
  shape.lineTo(-w / 2, h);
  shape.closePath();
  const hole = new THREE.Path();
  hole.absarc(0, h * 0.48, holeR, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.3, bevelEnabled: false });
  geo.translate(0, 0, -0.15);
  const body = new THREE.Mesh(geo, mats.wall);
  g.add(body);

  // 砖雕包边（石色宽缘 + 内圈细线）
  for (const zoff of [0.16, -0.16]) {
    const rim = new THREE.Mesh(new THREE.TorusGeometry(holeR, 0.09, 8, 32), mats.stoneDark);
    rim.position.set(0, h * 0.48, zoff);
    const trim = new THREE.Mesh(new THREE.TorusGeometry(holeR + 0.13, 0.03, 6, 32), mats.stone);
    trim.position.set(0, h * 0.48, zoff);
    g.add(rim, trim);
  }

  const cap = new THREE.Mesh(
    hipRoofGeometry({ w, d: 0.6, h: 0.3, overhang: 0.3, ridgeRatio: 0.9, upturn: 0.08, rings: 4 }),
    mats.roofPlain,
  );
  cap.position.y = h;
  g.add(cap);

  g.userData.colliders = [
    { kind: 'box', minX: -w / 2, maxX: -holeR + 0.1, minZ: -0.25, maxZ: 0.25 },
    { kind: 'box', minX: holeR - 0.1, maxX: w / 2, minZ: -0.25, maxZ: 0.25 },
  ];
  return g;
}

// 垂花门楼（院门）
export function gateHouse(mats, { w = 3.4 } = {}) {
  const g = new THREE.Group();
  const colH = 2.8;
  const cols = [];
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, colH, 8), mats.column);
      col.position.set(sx * w / 2, colH / 2, sz * 0.6);
      g.add(col);
      cols.push({ x: sx * w / 2, z: sz * 0.6 });
    }
  }
  const roof = new THREE.Mesh(
    hipRoofGeometry({ w: w + 0.8, d: 1.8, h: 1.2, overhang: 0.9, ridgeRatio: 0.5, upturn: 0.4 }),
    mats.roof,
  );
  roof.position.y = colH + 0.1;
  g.add(roof);
  g.add(ridgeAssembly(w + 0.8, 1.2, 0.5, mats).translateY(colH + 0.1));
  g.userData.colliders = cols.map(({ x, z }) => ({ kind: 'circle', x, z, r: 0.2 }));
  return g;
}

// ---------- 桥 ----------

export function archBridge({ span = 8, width = 3, rise = 1.4, mats }) {
  const g = new THREE.Group();
  const END_H = 0.45; // 桥端高度，与 groundFn 的 y0 一致
  // 侧剖面挤出成桥身；桥面高度 y(t) = END_H + 4.8·rise·t(1-t)
  const shape = new THREE.Shape();
  shape.moveTo(-span / 2, END_H);
  shape.quadraticCurveTo(0, END_H + rise * 2.4, span / 2, END_H);
  shape.lineTo(span / 2, -0.6);
  shape.quadraticCurveTo(0, END_H + rise * 2.4 - 1.2, -span / 2, -0.6);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: width, bevelEnabled: false, curveSegments: 20 });
  geo.translate(0, 0, -width / 2);
  const deck = new THREE.Mesh(geo, mats.stone);
  g.add(deck);

  const deckY = (t) => END_H + 4.8 * rise * t * (1 - t);

  // 栏杆望柱与扶手
  const n = 7;
  for (const side of [-1, 1]) {
    let prev = null;
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const x = -span / 2 + span * t;
      const y = deckY(t);
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.8, 6), mats.stoneDark);
      post.position.set(x, y + 0.3, side * (width / 2 - 0.18));
      g.add(post);
      if (prev) {
        const dx = x - prev.x;
        const dy = y - prev.y;
        const railLen = Math.hypot(dx, dy);
        const rail = new THREE.Mesh(new THREE.BoxGeometry(railLen + 0.1, 0.08, 0.1), mats.stoneDark);
        rail.position.set((x + prev.x) / 2, (y + prev.y) / 2 + 0.68, side * (width / 2 - 0.18));
        rail.rotation.z = Math.atan2(dy, dx);
        g.add(rail);
      }
      prev = { x, y };
    }
  }

  g.userData.colliders = [];
  g.userData.groundFns = [{
    minX: -span / 2, maxX: span / 2, minZ: -width / 2, maxZ: width / 2,
    axis: 'x', from: -span / 2, to: span / 2,
    arch: true, rise: rise * 1.2, y0: END_H,
  }];
  return g;
}

// ---------- 匾额 / 诗碑 ----------

export function signboard(text, mats, width = 1.9) {
  const g = new THREE.Group();
  const tex = plaqueTexture(text);
  const board = new THREE.Mesh(new THREE.BoxGeometry(width, width * 0.34, 0.07), mats.ink);
  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(width * 0.94, width * 0.3),
    new THREE.MeshLambertMaterial({ map: tex, emissive: 0x2a2218, emissiveIntensity: 0.35 }),
  );
  face.position.z = 0.045;
  const face2 = face.clone();
  face2.rotation.y = Math.PI;
  face2.position.z = -0.045;
  g.add(board, face, face2);
  return g;
}

export function stele(lines, mats) {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.35, 0.8), mats.stoneDark);
  base.position.y = 0.17;
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.9, 0.3), mats.stone);
  body.position.y = 1.28;
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.3, 3, 1), mats.stoneDark);
  cap.rotation.z = Math.PI / 2;
  cap.rotation.y = Math.PI / 2;
  cap.position.y = 2.28;
  const tex = steleTexture(lines);
  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(1.3, 1.8),
    new THREE.MeshLambertMaterial({ map: tex }),
  );
  face.position.set(0, 1.28, 0.16);
  g.add(base, body, cap, face);
  g.userData.colliders = [{ kind: 'box', minX: -0.8, maxX: 0.8, minZ: -0.45, maxZ: 0.45 }];
  return g;
}

// ---------- 灯笼 ----------

export function lantern(mats, { scale = 1 } = {}) {
  const g = new THREE.Group();
  const pts = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    pts.push(new THREE.Vector2(Math.sin(t * Math.PI) * 0.32 + 0.02, (t - 0.5) * 0.6));
  }
  const bodyMat = new THREE.MeshLambertMaterial({
    color: 0xc23a2a,
    emissive: 0xff7a30,
    emissiveIntensity: 0.0,
  });
  const body = new THREE.Mesh(new THREE.LatheGeometry(pts, 12), bodyMat);
  const capTop = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.08, 8), mats.gold);
  capTop.position.y = 0.34;
  const capBot = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.12, 0.08, 8), mats.gold);
  capBot.position.y = -0.34;
  const tassel = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.3, 6), new THREE.MeshLambertMaterial({ color: 0xd8b96a }));
  tassel.position.y = -0.55;
  tassel.rotation.x = Math.PI;
  g.add(body, capTop, capBot, tassel);
  g.scale.setScalar(scale);
  g.userData.lanternMat = bodyMat;
  return g;
}

export function lanternPost(mats, { h = 2.6 } = {}) {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, h, 8), mats.woodDark);
  pole.position.y = h / 2;
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.08, 0.08), mats.woodDark);
  arm.position.set(0.3, h - 0.05, 0);
  const l = lantern(mats);
  l.position.set(0.58, h - 0.5, 0);
  const string = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.3, 4), mats.ink);
  string.position.set(0.58, h - 0.2, 0);
  g.add(pole, arm, l, string);
  g.userData.colliders = [{ kind: 'circle', x: 0, z: 0, r: 0.14 }];
  g.userData.lanternMat = l.userData.lanternMat;
  return g;
}
