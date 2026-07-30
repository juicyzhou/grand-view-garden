import * as THREE from 'three';
import { makeMaterials } from './materials.js';
import {
  hipRoofGeometry, squarePavilion, hexPavilion, hall, corridor,
  wallSegment, moonGate, gateHouse, archBridge, stele, signboard,
  lantern, lanternPost,
} from './architecture.js';
import {
  bambooGrove, tree, pine, willow, rock, rockCluster, hillMesh,
  waterMaterial, waterGeometry, lotusCluster, flowerBed, reeds,
} from './nature.js';

/*
 * 大观园总体布局：
 *   北枕大观楼，南开门于沁芳闸外；
 *   一泓池水横陈园中，沁芳亭立洲上，南北双桥相连；
 *   东为潇湘馆、怡红院，西为稻香村、蘅芜苑，西北隅栊翠庵。
 */
export class Garden {
  constructor(scene) {
    this.scene = scene;
    this.mats = makeMaterials();
    this.colliders = [];      // 实体碰撞（局部已变换到世界）
    this.groundRects = [];    // 可行走平台
    this.groundFns = [];      // 函数地面（桥、台阶）
    this.hills = [];          // 土山（余弦缓坡）
    this.lanternMats = [];
    this.waterMats = [];
    this.swayMats = [];
    this.interactables = [];
    this.zones = [];
    this.npcSpots = [];
    this.pond = { cx: 2, cz: 16, rx: 17, rz: 8 };
  }

  // 放置构件并收集碰撞/地面信息
  place(obj, x = 0, z = 0, rotY = 0, { y = 0, collide = true } = {}) {
    obj.position.set(x, y, z);
    obj.rotation.y = rotY;
    this.scene.add(obj);
    obj.updateMatrixWorld(true);
    if (obj.userData.lanternMat) this.lanternMats.push(obj.userData.lanternMat);
    if (obj.userData.swayMats) this.swayMats.push(...obj.userData.swayMats);
    if (!collide) return obj;

    obj.traverse((node) => {
      const ud = node.userData;
      const m = node.matrixWorld;
      if (ud.colliders) {
        for (const c of ud.colliders) {
          if (c.kind === 'circle') {
            const p = new THREE.Vector3(c.x, 0, c.z).applyMatrix4(m);
            this.colliders.push({ kind: 'circle', x: p.x, z: p.z, r: c.r });
          } else {
            const pts = [
              new THREE.Vector3(c.minX, 0, c.minZ).applyMatrix4(m),
              new THREE.Vector3(c.maxX, 0, c.maxZ).applyMatrix4(m),
            ];
            this.colliders.push({
              kind: 'box',
              minX: Math.min(pts[0].x, pts[1].x), maxX: Math.max(pts[0].x, pts[1].x),
              minZ: Math.min(pts[0].z, pts[1].z), maxZ: Math.max(pts[0].z, pts[1].z),
            });
          }
        }
      }
      if (ud.ground) {
        for (const r of ud.ground) {
          const pts = [
            new THREE.Vector3(r.minX, r.y, r.minZ).applyMatrix4(m),
            new THREE.Vector3(r.maxX, r.y, r.maxZ).applyMatrix4(m),
          ];
          this.groundRects.push({
            minX: Math.min(pts[0].x, pts[1].x), maxX: Math.max(pts[0].x, pts[1].x),
            minZ: Math.min(pts[0].z, pts[1].z), maxZ: Math.max(pts[0].z, pts[1].z),
            y: Math.max(pts[0].y, pts[1].y),
          });
        }
      }
      if (ud.groundFns) {
        for (const f of ud.groundFns) {
          const midOther = f.axis === 'x' ? (f.minZ + f.maxZ) / 2 : (f.minX + f.maxX) / 2;
          const pFrom = f.axis === 'x'
            ? new THREE.Vector3(f.from, f.y0, midOther).applyMatrix4(m)
            : new THREE.Vector3(midOther, f.y0, f.from).applyMatrix4(m);
          const pTo = f.axis === 'x'
            ? new THREE.Vector3(f.to, f.y1, midOther).applyMatrix4(m)
            : new THREE.Vector3(midOther, f.y1, f.to).applyMatrix4(m);
          const corners = [
            new THREE.Vector3(f.minX, 0, f.minZ).applyMatrix4(m),
            new THREE.Vector3(f.maxX, 0, f.maxZ).applyMatrix4(m),
          ];
          const axis = Math.abs(pTo.x - pFrom.x) >= Math.abs(pTo.z - pFrom.z) ? 'x' : 'z';
          this.groundFns.push({
            minX: Math.min(corners[0].x, corners[1].x), maxX: Math.max(corners[0].x, corners[1].x),
            minZ: Math.min(corners[0].z, corners[1].z), maxZ: Math.max(corners[0].z, corners[1].z),
            axis,
            from: axis === 'x' ? pFrom.x : pFrom.z, y0: pFrom.y,
            to: axis === 'x' ? pTo.x : pTo.z, y1: pTo.y,
            arch: f.arch, rise: f.rise,
          });
        }
      }
    });
    return obj;
  }

  getGroundHeight(x, z) {
    let h = 0;
    for (const r of this.groundRects) {
      if (x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ && r.y > h) h = r.y;
    }
    for (const f of this.groundFns) {
      if (x < f.minX || x > f.maxX || z < f.minZ || z > f.maxZ) continue;
      const c = f.axis === 'x' ? x : z;
      const t = THREE.MathUtils.clamp((c - f.from) / (f.to - f.from), 0, 1);
      let y;
      if (f.arch) y = f.y0 + Math.sin(t * Math.PI) * f.rise;
      else y = THREE.MathUtils.lerp(f.y0, f.y1, t);
      if (y > h) h = y;
    }
    for (const hill of this.hills) {
      const d = Math.hypot(x - hill.x, z - hill.z);
      if (d < hill.r) {
        const y = hill.h * (0.5 + 0.5 * Math.cos((d / hill.r) * Math.PI));
        if (y > h) h = y;
      }
    }
    return h;
  }

  build() {
    const M = this.mats;

    // ---------- 大地与园墙 ----------
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(220, 220), M.grass);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    const BX = 62, BZ = 46; // 园墙半界
    this.place(wallSegment(BX * 2, M), 0, -BZ);
    this.place(wallSegment(BZ * 2, M), -BX, 0, Math.PI / 2);
    this.place(wallSegment(BZ * 2, M), BX, 0, Math.PI / 2);
    // 南墙留门
    this.place(wallSegment(BX - 2.5, M), -(BX / 2 + 1.25), BZ);
    this.place(wallSegment(BX - 2.5, M), BX / 2 + 1.25, BZ);
    const southGate = gateHouse(M, { w: 4.4 });
    this.place(southGate, 0, BZ);
    const gateBoard = signboard('大观园', M, 2.6);
    gateBoard.position.set(0, 3.1, BZ + 0.8);
    this.scene.add(gateBoard);
    // 园墙外挡板（防止出界）
    this.colliders.push(
      { kind: 'box', minX: -BX - 2, maxX: BX + 2, minZ: -BZ - 0.6, maxZ: -BZ - 0.1 },
      { kind: 'box', minX: -BX - 0.6, maxX: -BX - 0.1, minZ: -BZ - 2, maxZ: BZ + 2 },
      { kind: 'box', minX: BX + 0.1, maxX: BX + 0.6, minZ: -BZ - 2, maxZ: BZ + 2 },
      { kind: 'box', minX: -BX - 2, maxX: BX + 2, minZ: BZ + 0.1, maxZ: BZ + 0.6 },
    );

    // ---------- 水系 ----------
    const waterMat = waterMaterial();
    this.waterMats.push(waterMat);
    const pondGeo = waterGeometry(2, 16, 17, 8);
    const westGeo = waterGeometry(-32, 16, 15, 3.6, 0.1);
    const eastGeo = waterGeometry(34, 15, 14, 3.2, 0.1);
    for (const geo of [pondGeo, westGeo, eastGeo]) {
      const bed = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: 0x2e4a42 }));
      bed.position.y = -0.3;
      this.scene.add(bed);
      const water = new THREE.Mesh(geo, waterMat);
      water.position.y = 0.06;
      this.scene.add(water);
    }
    // 水体碰撞（低位阻挡：桥上/榭上不受限）
    const waterCircles = [
      [2, 16, 7.6], [-8, 16, 6.2], [12, 16, 6.2], [-4, 21, 4], [6, 11.5, 4.5],
    ];
    for (let x = -18; x >= -46; x -= 5.5) waterCircles.push([x, 16, 3.1]);
    for (let x = 20; x <= 46; x += 5.5) waterCircles.push([x, 15, 2.9]);
    for (const [x, z, r] of waterCircles) {
      this.colliders.push({ kind: 'circle', x, z, r, lowBlock: true });
    }

    // ---------- 沁芳亭（池心洲 + 双桥） ----------
    const isle = new THREE.Mesh(new THREE.CylinderGeometry(5, 5.6, 0.5, 24), M.stone);
    isle.position.set(0, 0.25, 16);
    this.scene.add(isle);
    this.groundRects.push({ minX: -3.9, maxX: 3.9, minZ: 12.1, maxZ: 19.9, y: 0.5 });
    this.colliders.push({ kind: 'circle', x: 0, z: 16, r: 5.2, lowBlock: true });

    const qinfangTing = squarePavilion({ w: 4.6, d: 4.6, name: '沁芳亭', mats: M, platformH: 0.4 });
    this.place(qinfangTing, 0, 16, 0, { y: 0.5 });

    const bridgeN = archBridge({ span: 9, width: 3.2, rise: 1.1, mats: M });
    this.place(bridgeN, 0, 8.2, Math.PI / 2);
    const bridgeS = archBridge({ span: 9, width: 3.2, rise: 1.1, mats: M });
    this.place(bridgeS, 0, 23.8, Math.PI / 2);
    // 桥接岸的过渡平台
    for (const z of [3.2, 28.4]) {
      this.groundRects.push({ minX: -1.6, maxX: 1.6, minZ: z - 1.2, maxZ: z + 1.2, y: 0.45 });
    }

    // ---------- 大观楼（北主殿） ----------
    const daguanlou = hall({
      w: 15, d: 9, name: '大观楼', mats: M,
      platformH: 0.9, doubleEave: true, roofH: 2.6, doorWidth: 2.6,
    });
    this.place(daguanlou, 0, -32);

    // 牌坊：省亲别墅
    this.buildPaifang(0, -18);

    // 殿前游廊
    this.place(corridor(18, M), -14, -26, Math.PI / 2);
    this.place(corridor(18, M), 14, -26, Math.PI / 2);
    // 殿前松柏
    this.place(pine(M, { scale: 1.3 }), -8, -24);
    this.place(pine(M, { scale: 1.3 }), 8, -24);

    // ---------- 曲径通幽（南入口） ----------
    this.place(rockCluster(M, { count: 5, spread: 4, maxW: 3.4, maxH: 4.2 }), -5.5, 37);
    this.place(rockCluster(M, { count: 5, spread: 4, maxW: 3.2, maxH: 3.8 }), 5.5, 35.5);
    const qujingStele = stele(['曲径通幽处', '禅房花木深'], M);
    this.place(qujingStele, 4.2, 41);
    this.interactables.push({
      x: 4.2, z: 41, r: 3, type: 'poem',
      label: '品读诗碑',
      poem: { title: '曲径通幽', body: '曲径通幽处，禅房花木深。\n山光悦鸟性，潭影空人心。' },
    });

    // ---------- 潇湘馆（东） ----------
    this.buildCourtyard({
      cx: 34, cz: 2, w: 18, d: 14,
      gate: 'moon', gateSide: 'w',
      hallOpts: { w: 7.5, d: 5.5, name: '有凤来仪', platformH: 0.5 },
      hallPos: [36.5, -1], hallRot: -Math.PI / 2,
    });
    // 月洞门上匾额
    const xiaoxiangBoard = signboard('潇湘馆', M, 1.7);
    this.place(xiaoxiangBoard, 25, 2, -Math.PI / 2, { y: 3.05, collide: false });
    // 竹林环合（门路与迎门视线留白）
    const bambooSpots = [];
    for (let i = 0; i < 220; i++) {
      const a = Math.random() * Math.PI * 2;
      const rr = 6 + Math.random() * 5;
      const x = 34 + Math.cos(a) * rr * 1.25;
      const z = 2 + Math.sin(a) * rr * 0.95;
      if (x > 26 && x < 43 && z > -4 && z < 8) continue; // 院内留白
      if (x > 21 && x < 28.5 && z > -2 && z < 6) continue; // 月洞门迎宾通道
      if (Math.abs(x) > 59 || Math.abs(z) > 43) continue;
      bambooSpots.push({ x, z });
    }
    for (let i = 0; i < 24; i++) { // 院内疏竹退至东南隅，让出月门至厅堂的花径
      bambooSpots.push({ x: 27 + Math.random() * 2.5, z: 3.8 + Math.random() * 3.8 });
    }
    const grove = bambooGrove(bambooSpots, M);
    this.scene.add(grove);
    this.swayMats.push(...grove.userData.swayMats);
    // 竹干碰撞（每竿细柱，隔竿取一）
    bambooSpots.forEach(({ x, z }, i) => {
      if (i % 2 === 0) this.colliders.push({ kind: 'circle', x, z, r: 0.14 });
    });

    const daiyuStele = stele(['花谢花飞飞满天', '红消香断有谁怜'], M);
    this.place(daiyuStele, 27, 6.5);
    this.interactables.push({
      x: 27, z: 6.5, r: 3, type: 'poem',
      label: '品读《葬花吟》',
      poem: { title: '葬花吟（节选）', body: '花谢花飞飞满天，红消香断有谁怜？\n游丝软系飘春榭，落絮轻沾扑绣帘。\n……\n一朝春尽红颜老，花落人亡两不知！' },
    });
    this.npcSpots.push({ id: 'daiyu', x: 33.5, z: 3.5, face: -Math.PI / 2 });

    // ---------- 怡红院（东北） ----------
    this.buildCourtyard({
      cx: 34, cz: -24, w: 18, d: 13,
      gate: 'house', gateSide: 'w',
      hallOpts: { w: 8.5, d: 6, name: '怡红快绿', platformH: 0.6 },
      hallPos: [36.5, -26], hallRot: -Math.PI / 2,
    });
    this.place(tree(M, { blossom: M.begonia, scale: 1.25 }), 30, -21);
    this.place(tree(M, { blossom: M.begonia, scale: 1.1 }), 31, -27.5);
    this.place(tree(M, { scale: 1 }), 40, -21.5);
    this.scene.add(flowerBed(30, -19.5, 2, 40, M.begonia, M));
    this.place(lanternPost(M), 27, -20.5);
    this.place(lanternPost(M), 27, -27.5);
    this.npcSpots.push({ id: 'baoyu', x: 33, z: -24, face: Math.PI / 2 });

    // ---------- 蘅芜苑（西北，土山之上） ----------
    this.hills.push({ x: -34, z: -22, r: 15, h: 2.6 });
    const mound = hillMesh(M, { r: 15, h: 2.65 });
    mound.position.set(-34, -0.15, -22);
    this.scene.add(mound);
    const hengwu = hall({ w: 8, d: 6, name: '蘅芷清芬', mats: M, platformH: 0.5 });
    this.place(hengwu, -34, -23, 0, { y: 2.15 });
    this.place(rockCluster(M, { count: 4, spread: 3.4, maxW: 2.8, maxH: 3.4 }), -40, -18);
    this.place(rockCluster(M, { count: 3, spread: 2.6, maxW: 2.2, maxH: 2.6 }), -28, -26);
    this.place(rockCluster(M, { count: 3, spread: 2.4, maxW: 2, maxH: 2.4 }), -38, -28);
    this.scene.add(flowerBed(-29, -19, 3, 50, M.foliage, M, { y: this.getGroundHeight(-29, -19), noColor: true }));
    this.place(pine(M, { scale: 1.15 }), -42, -26);
    this.npcSpots.push({ id: 'baochai', x: -33, z: -17.5, face: Math.PI });

    // ---------- 栊翠庵（西北隅） ----------
    this.buildCourtyard({
      cx: -17, cz: -36, w: 12, d: 9,
      gate: 'moon', gateSide: 'e',
      hallOpts: { w: 6, d: 4.5, name: '栊翠庵', platformH: 0.45 },
      hallPos: [-19.5, -37.5], hallRot: Math.PI / 2,
    });
    this.place(tree(M, { blossom: M.plum, scale: 1.15 }), -13.5, -34);
    this.place(tree(M, { blossom: M.plum, scale: 1 }), -15.5, -38.5);
    const miaoyuStele = stele(['寻春问腊到蓬莱', '不求大士瓶中露'], M);
    this.place(miaoyuStele, -12.5, -31.5);
    this.interactables.push({
      x: -12.5, z: -31.5, r: 3, type: 'poem',
      label: '品读《访妙玉乞红梅》',
      poem: { title: '访妙玉乞红梅', body: '酒未开樽句未裁，寻春问腊到蓬莱。\n不求大士瓶中露，为乞嫦娥槛外梅。' },
    });
    this.npcSpots.push({ id: 'miaoyu', x: -16.5, z: -35, face: Math.PI / 2 });

    // ---------- 稻香村（西） ----------
    this.buildDaoxiangcun(-38, 8);
    this.npcSpots.push({ id: 'liwan', x: -35, z: 6, face: Math.PI / 2 });

    // ---------- 藕香榭（池东，临水） ----------
    const ouxiang = hexPavilion({ r: 2.6, name: '藕香榭', mats: M, platformH: 0.5 });
    this.place(ouxiang, 16, 13, 0, { y: 0.1 });
    // 连岸平桥（直达榭台）
    this.buildFlatBridge(16, 6.4, 16, 12.4);
    // 水中立柱意象
    for (const [px, pz] of [[13.8, 11.2], [18.2, 11.2], [13.8, 14.8], [18.2, 14.8]]) {
      const pile = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.2, 8), M.woodDark);
      pile.position.set(px, 0.1, pz);
      this.scene.add(pile);
    }
    this.scene.add(lotusCluster(20, 12, 14, M, 3.5));

    // ---------- 蓼汀花溆（西溪） ----------
    this.scene.add(lotusCluster(-30, 15.5, 22, M, 5));
    this.scene.add(reeds(-25, 12.5, 30, M, 3));
    this.scene.add(reeds(-35, 19.5, 30, M, 3));
    this.buildFlatBridge(-30, 11.6, -30, 20.4); // 西溪平桥

    // ---------- 池岸垂柳与湖石 ----------
    const willowSpots = [[-12, 9.5], [10, 22.5], [-6, 24], [22, 10], [-16, 20]];
    for (const [x, z] of willowSpots) this.place(willow(M, { scale: 1 + Math.random() * 0.3 }), x, z);
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + 0.3;
      const x = 2 + Math.cos(a) * (17 + 1.5);
      const z = 16 + Math.sin(a) * (8 + 1.2);
      if (Math.abs(x) < 3.5) continue; // 避开双桥
      this.place(rock(M, { w: 1.4 + Math.random(), h: 1.2 + Math.random() * 0.8 }), x, z, Math.random() * Math.PI, { collide: true });
    }

    // ---------- 散点花木 ----------
    const treeSpots = [
      [-10, 32], [12, 34], [20, 30], [-22, 33], [26, 22], [-45, 30],
      [46, 30], [50, -8], [-50, -6], [24, -34], [44, -36], [-52, -34],
      [12, -10], [-12, -8],
    ];
    for (const [x, z] of treeSpots) this.place(tree(M, { scale: 0.9 + Math.random() * 0.5 }), x, z);
    this.scene.add(flowerBed(8, 30, 2.5, 40, M.begonia, M));
    this.scene.add(flowerBed(-8, 30, 2.5, 40, M.lotus, M));
    this.scene.add(flowerBed(6, -14, 2.2, 36, M.begonia, M));
    this.scene.add(flowerBed(-6, -14, 2.2, 36, M.lotus, M));

    // ---------- 甬路 ----------
    this.buildPaths();
    this.buildGuideLamps();

    // ---------- 灯笼 ----------
    const lanternSpots = [
      [2.8, 40], [-2.8, 40], [2.8, 26], [-2.8, 26], [2.8, 6], [-2.8, 6],
      [2.8, -10], [-2.8, -10], [2.8, -16], [-2.8, -16],
      [26, 0], [26, -22], [-30, 24], [-32, -2],
    ];
    for (const [x, z] of lanternSpots) this.place(lanternPost(M), x, z, Math.random() * Math.PI);
    // 檐下挂灯
    for (const [x, z, y] of [[0, 13.9, 3.6], [16, 11.4, 3.3], [0, -27.2, 4.6]]) {
      const l = lantern(M, { scale: 1.2 });
      l.position.set(x, y, z);
      this.scene.add(l);
      this.lanternMats.push(l.userData.lanternMat);
    }

    // ---------- 区域（HUD 题名） ----------
    this.zones = [
      { name: '曲径通幽', x: 0, z: 37, r: 9 },
      { name: '沁芳亭', x: 0, z: 16, r: 9 },
      { name: '省亲别墅', x: 0, z: -18, r: 7 },
      { name: '大观楼', x: 0, z: -31, r: 10 },
      { name: '潇湘馆', x: 34, z: 2, r: 11 },
      { name: '怡红院', x: 34, z: -24, r: 10 },
      { name: '蘅芜苑', x: -34, z: -22, r: 13 },
      { name: '栊翠庵', x: -17, z: -36, r: 8 },
      { name: '稻香村', x: -38, z: 8, r: 10 },
      { name: '藕香榭', x: 16, z: 13, r: 6 },
      { name: '蓼汀花溆', x: -30, z: 17, r: 9 },
    ];

    this.scene.traverse((o) => {
      if (o.isMesh && o.castShadow === undefined) o.castShadow = false;
    });
  }

  // ---------- 省亲别墅牌坊 ----------
  buildPaifang(x, z) {
    const M = this.mats;
    const g = new THREE.Group();
    const w = 8;
    const cols = [];
    for (const sx of [-1, -0.38, 0.38, 1]) {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 5.4, 10), M.column);
      col.position.set(sx * w / 2, 2.7, 0);
      g.add(col);
      cols.push({ x: sx * w / 2, z: 0 });
    }
    const beam1 = new THREE.Mesh(new THREE.BoxGeometry(w + 0.8, 0.34, 0.3), M.beam);
    beam1.position.y = 4.2;
    const beam2 = new THREE.Mesh(new THREE.BoxGeometry(w + 0.8, 0.3, 0.28), M.beam);
    beam2.position.y = 5.2;
    g.add(beam1, beam2);
    for (const [bw, bx, by] of [[3.2, 0, 6.1], [2.2, -w / 2 + 0.4, 5.6], [2.2, w / 2 - 0.4, 5.6]]) {
      const roof = new THREE.Mesh(
        hipRoofGeometry({ w: bw, d: 0.9, h: 0.9, overhang: 0.7, ridgeRatio: 0.5, upturn: 0.35 }),
        M.roof,
      );
      roof.position.set(bx, by, 0);
      g.add(roof);
    }
    const board = signboard('省亲别墅', M, 2.2);
    board.position.set(0, 4.7, 0.2);
    g.add(board);
    g.userData.colliders = cols.map(({ x: cx, z: cz }) => ({ kind: 'circle', x: cx, z: cz, r: 0.24 }));
    this.place(g, x, z);
  }

  // ---------- 合院 ----------
  buildCourtyard({ cx, cz, w, d, gate, gateSide, hallOpts, hallPos, hallRot }) {
    const M = this.mats;
    const hw = w / 2, hd = d / 2;
    const gateW = gate === 'moon' ? 3.8 : 4.4;
    // 四面墙，门侧留缺口
    const sides = {
      n: { len: w, x: cx, z: cz - hd, rot: 0 },
      s: { len: w, x: cx, z: cz + hd, rot: 0 },
      w: { len: d, x: cx - hw, z: cz, rot: Math.PI / 2 },
      e: { len: d, x: cx + hw, z: cz, rot: Math.PI / 2 },
    };
    for (const [key, s] of Object.entries(sides)) {
      if (key === gateSide) {
        const segLen = (s.len - gateW) / 2;
        const off = (s.len / 2 + gateW / 2) / 2 + segLen / 2 - segLen / 2; // 两端各一段
        const gapHalf = gateW / 2 + segLen / 2;
        if (s.rot === 0) {
          this.place(wallSegment(segLen, M), s.x - gapHalf, s.z);
          this.place(wallSegment(segLen, M), s.x + gapHalf, s.z);
        } else {
          this.place(wallSegment(segLen, M), s.x, s.z - gapHalf, Math.PI / 2);
          this.place(wallSegment(segLen, M), s.x, s.z + gapHalf, Math.PI / 2);
        }
        const gateObj = gate === 'moon' ? moonGate(M) : gateHouse(M);
        this.place(gateObj, s.x, s.z, s.rot === 0 ? 0 : Math.PI / 2);
      } else {
        this.place(wallSegment(s.len, M), s.x, s.z, s.rot);
      }
    }
    const hallObj = hall({ mats: M, ...hallOpts });
    this.place(hallObj, hallPos[0], hallPos[1], hallRot || 0);
  }

  // ---------- 稻香村 ----------
  buildDaoxiangcun(cx, cz) {
    const M = this.mats;
    // 柴扉矮墙
    const fenceMat = M.wood;
    const mkFence = (len) => {
      const g = new THREE.Group();
      const rail = new THREE.Mesh(new THREE.BoxGeometry(len, 0.06, 0.06), fenceMat);
      rail.position.y = 0.7;
      const rail2 = rail.clone();
      rail2.position.y = 0.4;
      g.add(rail, rail2);
      const n = Math.round(len / 1.2) + 1;
      for (let i = 0; i < n; i++) {
        const p = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.85, 5), fenceMat);
        p.position.set(-len / 2 + (len / (n - 1)) * i, 0.42, 0);
        g.add(p);
      }
      g.userData.colliders = [{ kind: 'box', minX: -len / 2, maxX: len / 2, minZ: -0.1, maxZ: 0.1 }];
      return g;
    };
    // 田畦
    const field = new THREE.Mesh(new THREE.PlaneGeometry(14, 9), M.dirt);
    field.rotation.x = -Math.PI / 2;
    field.position.set(cx - 2, 0.03, cz + 1);
    field.receiveShadow = true;
    this.scene.add(field);
    const cropMat = new THREE.MeshLambertMaterial({ color: 0x6a9a3e });
    for (let row = 0; row < 6; row++) {
      this.scene.add(flowerBed(cx - 7 + row * 2.1, cz + 1, 0.5, 8, cropMat, M, { noColor: true }));
    }
    this.place(mkFence(15), cx - 2, cz + 5.8);
    this.place(mkFence(9), cx - 9.4, cz + 1, Math.PI / 2);
    this.place(mkFence(9), cx + 5.4, cz + 1, Math.PI / 2);

    // 茅屋两楹
    const cottage1 = hall({
      w: 6.5, d: 4.5, name: '杏帘在望', mats: M,
      platformH: 0.3, roofH: 1.8, wallMat: M.dirt, doorWidth: 1.6,
    });
    cottage1.traverse((o) => {
      if (o.isMesh && o.material === M.roof) o.material = M.thatch;
    });
    this.place(cottage1, cx + 1, cz - 5.5, Math.PI / 2);

    const cottage2 = hall({
      w: 5, d: 4, mats: M, platformH: 0.3, roofH: 1.5, wallMat: M.dirt, doorWidth: 1.4,
    });
    cottage2.traverse((o) => {
      if (o.isMesh && o.material === M.roof) o.material = M.thatch;
    });
    this.place(cottage2, cx - 5.5, cz - 5, 0);

    // 酒幌
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 4.2, 6), M.woodDark);
    pole.position.set(cx + 4.6, 2.1, cz - 2.5);
    this.scene.add(pole);
    const bannerTex = signboard('杏帘在望', M, 1.4);
    bannerTex.position.set(cx + 4.6, 3.2, cz - 2.4);
    this.scene.add(bannerTex);
    this.colliders.push({ kind: 'circle', x: cx + 4.6, z: cz - 2.5, r: 0.15 });

    // 井亭
    const well = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.8, 0.8, 10), M.stoneDark);
    well.position.set(cx - 3, 0.4, cz - 1.5);
    this.scene.add(well);
    this.colliders.push({ kind: 'circle', x: cx - 3, z: cz - 1.5, r: 0.9 });

    // 杏树
    this.place(tree(M, { blossom: M.begonia, scale: 1.2 }), cx + 6, cz - 6.5);
    this.place(tree(M, { scale: 1 }), cx - 8, cz - 7);

    const steleObj = stele(['杏帘招客饮', '在望有山庄'], M);
    this.place(steleObj, cx + 6.5, cz + 4);
    this.interactables.push({
      x: cx + 6.5, z: cz + 4, r: 3, type: 'poem',
      label: '品读《杏帘在望》',
      poem: { title: '杏帘在望', body: '杏帘招客饮，在望有山庄。\n菱荇鹅儿水，桑榆燕子梁。\n一畦春韭绿，十里稻花香。' },
    });
  }

  // ---------- 平桥 ----------
  buildFlatBridge(x1, z1, x2, z2) {
    const M = this.mats;
    const len = Math.hypot(x2 - x1, z2 - z1);
    const g = new THREE.Group();
    const deck = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.3, len), M.stone);
    deck.position.y = 0.3;
    g.add(deck);
    for (const side of [-1, 1]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, len), M.stoneDark);
      rail.position.set(side * 1.0, 0.95, 0);
      g.add(rail);
      const n = Math.round(len / 1.4) + 1;
      for (let i = 0; i < n; i++) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.6, 6), M.stoneDark);
        post.position.set(side * 1.0, 0.7, -len / 2 + (len / (n - 1)) * i);
        g.add(post);
      }
    }
    const cx = (x1 + x2) / 2, cz = (z1 + z2) / 2;
    const rot = Math.atan2(x2 - x1, z2 - z1);
    g.userData.ground = [{ minX: -1.1, maxX: 1.1, minZ: -len / 2, maxZ: len / 2, y: 0.45 }];
    this.place(g, cx, cz, rot);
  }

  // ---------- 甬路 ----------
  buildPaths() {
    const M = this.mats;
    const polylines = [
      // 主轴：南门 → 曲径通幽 → 南桥头 / 北桥头 → 牌坊 → 大观楼
      [[0, 45], [0, 29.5]],
      [[0, 2.2], [0, -24]],
      // 东西向横街（曲径通幽前）
      [[-40, 30], [40, 30]],
      // 东路：横街 → 潇湘馆 → 怡红院
      [[26, 30], [26, -24]],
      // 西路：横街 → 西溪桥 → 稻香村 → 蘅芜苑山麓 → 栊翠庵
      [[-30, 30], [-30, 10]],
      [[-30, 10], [-36, 3]],
      [[-30, 10], [-30, -12]],
      [[-30, -12], [-20, -30]],
      // 大观楼前东西路
      [[-14, -14], [14, -14]],
      // 潇湘馆内：月洞门 → 有凤来仪厅前的卵石花径
      [[25.5, 2], [30, 0.8], [32.8, -0.6]],
    ];
    const slabs = [];
    for (const line of polylines) {
      for (let s = 0; s < line.length - 1; s++) {
        const [x1, z1] = line[s];
        const [x2, z2] = line[s + 1];
        const len = Math.hypot(x2 - x1, z2 - z1);
        const n = Math.floor(len / 1.1);
        for (let i = 0; i < n; i++) {
          const t = (i + 0.5) / n;
          slabs.push({
            x: x1 + (x2 - x1) * t,
            z: z1 + (z2 - z1) * t,
            rot: Math.atan2(x2 - x1, z2 - z1) + (Math.random() - 0.5) * 0.06,
          });
        }
      }
    }
    const geo = new THREE.BoxGeometry(1.5, 0.08, 1.0);
    const inst = new THREE.InstancedMesh(geo, M.path, slabs.length);
    const dummy = new THREE.Object3D();
    slabs.forEach((s, i) => {
      dummy.position.set(s.x, 0.04, s.z);
      dummy.rotation.set(0, s.rot, 0);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
    });
    inst.receiveShadow = true;
    this.scene.add(inst);
  }

  // ---------- 引路莲花灯：沿主线的发光花灯，引导新客前行 ----------
  buildGuideLamps() {
    const M = this.mats;
    // 主轴南段、主轴北段、横街东路、潇湘馆甬路
    const lines = [
      { x1: 0, z1: 44, x2: 0, z2: 26, step: 6, side: 1.8 },
      { x1: 0, z1: 1, x2: 0, z2: -15, step: 5.5, side: 1.8 },
      { x1: 4, z1: 30, x2: 22, z2: 30, step: 6, side: -1.8 },
      { x1: 26, z1: 26, x2: 26, z2: 8, step: 6, side: -1.6 },
    ];
    const stemMat = M.woodDark;
    this.guideLampMats = [];
    const petalGeo = new THREE.ConeGeometry(0.07, 0.16, 6);
    const heartGeo = new THREE.SphereGeometry(0.055, 8, 6);
    const stemGeo = new THREE.CylinderGeometry(0.022, 0.03, 0.62, 6);
    const baseGeo = new THREE.CylinderGeometry(0.09, 0.12, 0.1, 8);

    let idx = 0;
    for (const ln of lines) {
      const len = Math.hypot(ln.x2 - ln.x1, ln.z2 - ln.z1);
      const n = Math.max(1, Math.floor(len / ln.step));
      for (let i = 0; i <= n; i++) {
        const t = n === 0 ? 0 : i / n;
        const x = ln.x1 + (ln.x2 - ln.x1) * t + (idx % 2 ? ln.side : -ln.side);
        const z = ln.z1 + (ln.z2 - ln.z1) * t;
        const g = new THREE.Group();

        const petalMat = new THREE.MeshLambertMaterial({
          color: 0xe8a0b0, emissive: 0xff88a0, emissiveIntensity: 0.3,
        });
        const heartMat = new THREE.MeshLambertMaterial({
          color: 0xf2d08a, emissive: 0xffc860, emissiveIntensity: 0.3,
        });
        this.guideLampMats.push(petalMat, heartMat);

        const base = new THREE.Mesh(baseGeo, M.stone);
        base.position.y = 0.05;
        const stem = new THREE.Mesh(stemGeo, stemMat);
        stem.position.y = 0.4;
        g.add(base, stem);
        // 莲瓣六出
        for (let p = 0; p < 6; p++) {
          const a = (p / 6) * Math.PI * 2;
          const petal = new THREE.Mesh(petalGeo, petalMat);
          petal.position.set(Math.cos(a) * 0.075, 0.74, Math.sin(a) * 0.075);
          petal.rotation.set(Math.sin(a) * 0.7, 0, -Math.cos(a) * 0.7);
          g.add(petal);
        }
        const heart = new THREE.Mesh(heartGeo, heartMat);
        heart.position.y = 0.76;
        g.add(heart);

        g.position.set(x, 0, z);
        g.userData.phase = idx * 0.7;
        this.scene.add(g);
        idx += 1;
      }
    }
  }

  // 当前所在区域
  zoneAt(x, z) {
    for (const zn of this.zones) {
      if (Math.hypot(x - zn.x, z - zn.z) < zn.r) return zn.name;
    }
    return null;
  }

  update(t, nightFactor = 0) {
    for (const m of this.waterMats) {
      if (m.userData.shader) m.userData.shader.uniforms.uTime.value = t;
    }
    for (const m of this.swayMats) {
      if (m.userData.shader) m.userData.shader.uniforms.uTime.value = t;
    }
    // 引路花灯：昼间微光，入夜大明，次第明灭如呼吸
    if (this.guideLampMats) {
      this.guideLampMats.forEach((m, i) => {
        const breathe = 0.5 + 0.5 * Math.sin(t * 1.8 + i * 0.9);
        m.emissiveIntensity = 0.22 + nightFactor * 1.35 + breathe * 0.18;
      });
    }
  }
}
