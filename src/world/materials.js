import * as THREE from 'three';

// 大观园调色板：取宣纸、朱砂、竹青、瓦黛诸色
export const PALETTE = {
  wallWhite: 0xf0e9d6,     // 粉墙
  roofTile: 0x46525c,      // 黛瓦
  roofRidge: 0x37414a,     // 屋脊
  thatch: 0x9a7b46,        // 茅草
  column: 0x8e3b2f,        // 朱柱
  beam: 0x6e4630,          // 梁木
  wood: 0x7a5238,          // 门窗木
  woodDark: 0x54371f,
  stone: 0xb5ad9c,         // 台基石
  stoneDark: 0x8d8578,
  path: 0xc8c0ac,          // 甬路
  rock: 0x8f948e,          // 湖石
  rockDark: 0x767b76,
  grass: 0x7d9b62,         // 草地
  grassDry: 0xa8a266,
  bamboo: 0x5a8a42,        // 竹
  bambooStem: 0x7f9a4e,
  pine: 0x3d5c40,          // 松
  foliage: 0x63904c,       // 杂树
  begonia: 0xe59ab0,       // 海棠
  plum: 0xc94f63,          // 红梅
  lotus: 0xe8a2b4,         // 荷
  lotusPad: 0x4a7a4f,
  lantern: 0xc23a2a,       // 灯笼
  lanternGlow: 0xffb35c,
  waterShallow: 0x6a9a8a,
  waterDeep: 0x356055,
  gold: 0xc9a55c,
  inkBlack: 0x2b2620,
};

const textureCache = new Map();

function canvasTexture(key, size, draw) {
  if (textureCache.has(key)) return textureCache.get(key);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  draw(ctx, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  textureCache.set(key, tex);
  return tex;
}

function noiseOn(ctx, size, base, vary, alpha = 0.5) {
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < size * size * 0.08; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const v = Math.floor(Math.random() * vary);
    ctx.fillStyle = `rgba(${v}, ${v}, ${v}, ${alpha * Math.random()})`;
    ctx.fillRect(x, y, 1.5, 1.5);
  }
}

// 瓦垄纹理：竖向瓦陇 + 横向瓦当
export function roofTileTexture() {
  return canvasTexture('roofTile', 256, (ctx, s) => {
    noiseOn(ctx, s, '#46525c', 30, 0.25);
    for (let x = 0; x < s; x += 16) {
      const grad = ctx.createLinearGradient(x, 0, x + 16, 0);
      grad.addColorStop(0, 'rgba(0,0,0,0.28)');
      grad.addColorStop(0.45, 'rgba(255,255,255,0.10)');
      grad.addColorStop(1, 'rgba(0,0,0,0.28)');
      ctx.fillStyle = grad;
      ctx.fillRect(x, 0, 16, s);
    }
    for (let y = 0; y < s; y += 42) {
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.fillRect(0, y, s, 2);
    }
  });
}

// 窗棂纹理：步步锦纹样
export function latticeTexture() {
  return canvasTexture('lattice', 256, (ctx, s) => {
    ctx.fillStyle = '#e8dcc2';
    ctx.fillRect(0, 0, s, s);
    ctx.strokeStyle = '#54371f';
    ctx.lineWidth = 7;
    const cell = s / 4;
    for (let i = 0; i <= 4; i++) {
      ctx.beginPath(); ctx.moveTo(i * cell, 0); ctx.lineTo(i * cell, s); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i * cell); ctx.lineTo(s, i * cell); ctx.stroke();
    }
    ctx.lineWidth = 4;
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        const cx = i * cell + cell / 2;
        const cy = j * cell + cell / 2;
        ctx.strokeRect(cx - cell * 0.22, cy - cell * 0.22, cell * 0.44, cell * 0.44);
      }
    }
  });
}

// 草地纹理
export function grassTexture() {
  const tex = canvasTexture('grass', 512, (ctx, s) => {
    noiseOn(ctx, s, '#7d9b62', 60, 0.18);
    for (let i = 0; i < 2600; i++) {
      const x = Math.random() * s;
      const y = Math.random() * s;
      const g = 120 + Math.floor(Math.random() * 60);
      ctx.fillStyle = `rgba(${g * 0.55}, ${g}, ${g * 0.42}, 0.35)`;
      ctx.fillRect(x, y, 2, 3 + Math.random() * 3);
    }
    for (let i = 0; i < 26; i++) {
      ctx.fillStyle = 'rgba(168, 162, 102, 0.13)';
      ctx.beginPath();
      ctx.arc(Math.random() * s, Math.random() * s, 12 + Math.random() * 30, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  tex.repeat.set(24, 24);
  return tex;
}

// 泥土纹理（稻香村）
export function dirtTexture() {
  const tex = canvasTexture('dirt', 256, (ctx, s) => {
    noiseOn(ctx, s, '#a8916a', 45, 0.3);
  });
  tex.repeat.set(4, 4);
  return tex;
}

// 匾额文字纹理
export function plaqueTexture(text, { bg = '#26201a', fg = '#d8b96a', vertical = false } = {}) {
  const key = `plaque:${text}:${bg}:${fg}:${vertical}`;
  return canvasTexture(key, 256, (ctx, s) => {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, s, s);
    ctx.strokeStyle = fg;
    ctx.lineWidth = 8;
    ctx.strokeRect(8, 8, s - 16, s - 16);
    ctx.fillStyle = fg;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `bold ${vertical ? 56 : 64}px "Songti SC", "STSong", serif`;
    if (vertical) {
      const chars = [...text];
      const step = (s - 60) / chars.length;
      chars.forEach((ch, i) => ctx.fillText(ch, s / 2, 34 + step * (i + 0.5)));
    } else {
      const chars = [...text];
      const step = (s - 60) / chars.length;
      chars.forEach((ch, i) => ctx.fillText(ch, 34 + step * (i + 0.5), s / 2));
    }
  });
}

// 诗碑文字纹理
export function steleTexture(lines) {
  const key = `stele:${lines.join('|')}`;
  return canvasTexture(key, 512, (ctx, s) => {
    noiseOn(ctx, s, '#b8b0a0', 35, 0.35);
    ctx.fillStyle = '#3a352c';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 44px "Songti SC", "STSong", serif';
    const cols = lines.slice(0, 6);
    const stepX = s / (cols.length + 1);
    cols.forEach((col, ci) => {
      const chars = [...col];
      const stepY = (s - 80) / Math.max(chars.length, 1);
      [...chars].forEach((ch, i) => {
        ctx.fillText(ch, s - stepX * (ci + 1), 50 + stepY * (i + 0.5));
      });
    });
  });
}

const materialCache = new Map();

export function flat(color, opts = {}) {
  const key = `flat:${color}:${JSON.stringify(opts)}`;
  if (materialCache.has(key)) return materialCache.get(key);
  const mat = new THREE.MeshLambertMaterial({ color, ...opts });
  materialCache.set(key, mat);
  return mat;
}

export function makeMaterials() {
  const roofTex = roofTileTexture();
  roofTex.repeat.set(3, 2);
  const thatchTex = dirtTexture();

  return {
    wall: flat(PALETTE.wallWhite),
    roof: new THREE.MeshLambertMaterial({ map: roofTex, side: THREE.DoubleSide }),
    roofPlain: flat(PALETTE.roofTile, { side: THREE.DoubleSide }),
    ridge: flat(PALETTE.roofRidge),
    thatch: new THREE.MeshLambertMaterial({ map: thatchTex, color: 0xcbb27e, side: THREE.DoubleSide }),
    column: flat(PALETTE.column),
    beam: flat(PALETTE.beam),
    wood: flat(PALETTE.wood),
    woodDark: flat(PALETTE.woodDark),
    stone: flat(PALETTE.stone),
    stoneDark: flat(PALETTE.stoneDark),
    path: flat(PALETTE.path),
    rock: new THREE.MeshLambertMaterial({ color: PALETTE.rock, flatShading: true }),
    rockDark: new THREE.MeshLambertMaterial({ color: PALETTE.rockDark, flatShading: true }),
    grass: new THREE.MeshLambertMaterial({ map: grassTexture() }),
    dirt: new THREE.MeshLambertMaterial({ map: dirtTexture() }),
    bamboo: flat(PALETTE.bamboo, { side: THREE.DoubleSide }),
    bambooStem: flat(PALETTE.bambooStem),
    pine: flat(PALETTE.pine),
    foliage: flat(PALETTE.foliage),
    foliageLight: flat(0x74a058),
    begonia: flat(PALETTE.begonia),
    plum: flat(PALETTE.plum),
    lotus: flat(PALETTE.lotus, { side: THREE.DoubleSide }),
    lotusPad: flat(PALETTE.lotusPad, { side: THREE.DoubleSide }),
    lattice: new THREE.MeshLambertMaterial({ map: latticeTexture() }),
    gold: new THREE.MeshLambertMaterial({ color: PALETTE.gold, emissive: 0x3a2c10 }),
    ink: flat(PALETTE.inkBlack),
  };
}
