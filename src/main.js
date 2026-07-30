import { version } from '../package.json';
import { Engine } from './core/engine.js';
import { Player } from './core/player.js';
import { AudioManager } from './core/audio.js';
import { Garden } from './world/garden.js';
import { NPCManager } from './world/npc.js';
import { HUD } from './ui/hud.js';
import { QuestManager } from './ui/quest.js';

const canvas = document.getElementById('scene');
document.getElementById('version-tag').textContent = `v${version}`;

const engine = new Engine(canvas);
const garden = new Garden(engine.scene);
garden.build();
engine.lanternMats = garden.lanternMats;

// NPC 落位（按地面高度，如山上的宝钗）
const npcSpots = garden.npcSpots.map((s) => ({
  ...s,
  y: Math.max(0, garden.getGroundHeight(s.x, s.z) - 0.02),
}));
const npcMgr = new NPCManager(engine.scene, npcSpots);

const player = new Player(engine.camera, garden, canvas);
player.pos.y = garden.getGroundHeight(player.pos.x, player.pos.z);

const audio = new AudioManager();
const quest = new QuestManager();
const hud = new HUD({ garden, npcMgr, audio, engine, player, canvas, quest });

// 调试/自动化测试句柄
window.__game = { engine, garden, player, npcMgr, audio, hud, quest };

// 场景阴影设置
engine.scene.traverse((o) => {
  if (o.isMesh) {
    if (o.material === garden.mats.grass || o.material === garden.mats.dirt) {
      o.receiveShadow = true;
    }
  }
});

let prevMs = performance.now();
let elapsed = 0;
let firstFrame = true;

function animate() {
  requestAnimationFrame(animate);
  const now = performance.now();
  const dt = Math.min((now - prevMs) / 1000, 0.1);
  prevMs = now;
  elapsed += dt;
  const t = elapsed;

  player.update(dt);
  npcMgr.update(dt, player.pos, t);
  garden.update(t, engine.nightFactor);
  engine.update(dt, player.pos, t);
  audio.setNight(engine.nightFactor);
  hud.update(dt);
  engine.render();

  if (firstFrame) {
    firstFrame = false;
    document.getElementById('loading').classList.add('hidden');
    document.getElementById('title-screen').classList.remove('hidden');
  }
}

animate();
