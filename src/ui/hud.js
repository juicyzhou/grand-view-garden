/*
 * HUD 与交互：
 *  - 入画标题屏 / 地点题名横幅 / 交互提示
 *  - 人物对话（打字机）/ 诗碑品读
 *  - 昼夜切换、音乐开关、帮助
 */
export class HUD {
  constructor({ garden, npcMgr, audio, engine, player, canvas }) {
    this.garden = garden;
    this.npcMgr = npcMgr;
    this.audio = audio;
    this.engine = engine;
    this.player = player;
    this.canvas = canvas;

    this.$ = (id) => document.getElementById(id);
    this.started = false;
    this.dialogue = null;   // { npc, lineQueue, typing }
    this.poemOpen = false;
    this.zone = null;
    this.zoneT = 0;
    this.interactTarget = null;
    this.typeTimer = null;

    this.interactables = [...garden.interactables, ...npcMgr.interactables];

    this.buildResumeOverlay();
    this.bind();
  }

  buildResumeOverlay() {
    const div = document.createElement('div');
    div.id = 'resume-overlay';
    div.className = 'hidden';
    div.style.cssText = `
      position: fixed; inset: 0; z-index: 14;
      display: flex; align-items: center; justify-content: center;
      background: rgba(23, 20, 16, 0.45); cursor: pointer;
      color: #f2ead8; font-size: 20px; letter-spacing: 8px;
      font-family: inherit;
    `;
    div.textContent = '点击画面 · 继续游园';
    div.addEventListener('click', () => this.player.lock());
    document.body.appendChild(div);
    this.resumeOverlay = div;
  }

  bind() {
    this.$('enter-btn').addEventListener('click', () => this.start());

    document.addEventListener('pointerlockchange', () => this.syncResumeOverlay());
    this.canvas.addEventListener('click', () => {
      if (this.started && !this.panelOpen()) this.player.lock();
    });

    document.addEventListener('keydown', (e) => {
      if (!this.started) return;
      if (e.code === 'KeyE') this.onInteractKey();
      if (e.code === 'Escape') this.closePanels();
    });

    this.$('dialogue').addEventListener('click', () => this.advanceDialogue());
    this.$('poem-panel').addEventListener('click', () => this.closePanels());

    this.$('btn-cycle').addEventListener('click', () => {
      const mode = this.engine.toggleCycle();
      this.$('btn-cycle').textContent = mode === 'auto' ? '昼夜' : mode === 'day' ? '昼' : '夜';
    });
    this.$('btn-audio').addEventListener('click', () => {
      const on = this.audio.toggle();
      this.$('btn-audio').classList.toggle('off', !on);
    });
    this.$('btn-help').addEventListener('click', () => {
      this.$('help-panel').classList.toggle('hidden');
    });

    this.$('touch-interact').addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.onInteractKey();
    }, { passive: false });
  }

  start() {
    this.started = true;
    this.audio.start();
    this.$('title-screen').classList.add('hidden');
    this.$('hud').classList.remove('hidden');
    if (this.player.isTouchDevice) {
      this.$('touch-ui').classList.remove('hidden');
      this.$('touch-interact').classList.add('hidden');
    }
    this.player.enabled = true;
    this.player.lock();
  }

  panelOpen() {
    return !!this.dialogue || this.poemOpen;
  }

  syncResumeOverlay() {
    const locked = document.pointerLockElement === this.canvas;
    const need = this.started && !locked && !this.panelOpen() && !this.player.isTouchDevice;
    this.resumeOverlay.classList.toggle('hidden', !need);
  }

  onInteractKey() {
    if (this.dialogue) { this.advanceDialogue(); return; }
    if (this.poemOpen) { this.closePanels(); return; }
    const it = this.interactTarget;
    if (!it) return;
    if (it.type === 'npc') this.openDialogue(it.npc);
    else if (it.type === 'poem') this.openPoem(it.poem);
  }

  openDialogue(npc) {
    this.dialogue = {
      npc,
      speaker: npc.cfg.name,
      linesLeft: 3, // 每次攀谈至多三句
    };
    this.player.enabled = false;
    this.$('dialogue').classList.remove('hidden');
    this.$('dlg-name').textContent = npc.cfg.name;
    this.showLine();
    this.syncResumeOverlay();
  }

  showLine() {
    const { line } = this.npcMgr.nextLine(this.dialogue.npc);
    this.typeText(this.$('dlg-text'), line);
  }

  advanceDialogue() {
    if (!this.dialogue) return;
    if (this.typing) { this.finishTyping(); return; }
    this.dialogue.linesLeft -= 1;
    if (this.dialogue.linesLeft <= 0) { this.closePanels(); return; }
    this.showLine();
  }

  openPoem(poem) {
    this.poemOpen = true;
    this.player.enabled = false;
    this.$('poem-title').textContent = poem.title;
    this.$('poem-body').textContent = poem.body;
    this.$('poem-panel').classList.remove('hidden');
    this.syncResumeOverlay();
  }

  closePanels() {
    this.dialogue = null;
    this.poemOpen = false;
    clearInterval(this.typeTimer);
    this.typing = false;
    this.$('dialogue').classList.add('hidden');
    this.$('poem-panel').classList.add('hidden');
    if (this.started) this.player.enabled = true;
    this.player.lock();
    this.syncResumeOverlay();
  }

  typeText(el, text) {
    clearInterval(this.typeTimer);
    el.textContent = '';
    this.typing = true;
    let i = 0;
    this.typeTimer = setInterval(() => {
      i += 1;
      el.textContent = text.slice(0, i);
      if (i >= text.length) this.finishTyping();
    }, 55);
    this.fullText = text;
    this.typeEl = el;
  }

  finishTyping() {
    clearInterval(this.typeTimer);
    if (this.typeEl && this.fullText) this.typeEl.textContent = this.fullText;
    this.typing = false;
  }

  update(dt) {
    if (!this.started) return;
    const p = this.player.pos;

    // 地点题名
    this.zoneT -= dt;
    if (this.zoneT <= 0) {
      this.zoneT = 0.4;
      const zn = this.garden.zoneAt(p.x, p.z);
      if (zn && zn !== this.zone) {
        this.zone = zn;
        const el = this.$('location-name');
        el.textContent = zn;
        el.classList.add('show');
        clearTimeout(this.zoneTimer);
        this.zoneTimer = setTimeout(() => el.classList.remove('show'), 3600);
      } else if (!zn) {
        this.zone = null;
      }
    }

    // 最近交互物
    if (!this.panelOpen()) {
      let best = null;
      let bestD = Infinity;
      for (const it of this.interactables) {
        const d = Math.hypot(p.x - it.x, p.z - it.z);
        if (d < it.r && d < bestD) { best = it; bestD = d; }
      }
      this.interactTarget = best;
      const hint = this.$('interact-hint');
      if (best) {
        hint.innerHTML = `<b>E</b>${best.label}`;
        hint.classList.remove('hidden');
        if (this.player.isTouchDevice) {
          const btn = this.$('touch-interact');
          btn.textContent = best.type === 'npc' ? '交谈' : '品读';
          btn.classList.remove('hidden');
        }
      } else {
        hint.classList.add('hidden');
        if (this.player.isTouchDevice) this.$('touch-interact').classList.add('hidden');
      }
    } else {
      this.$('interact-hint').classList.add('hidden');
      if (this.player.isTouchDevice) this.$('touch-interact').classList.add('hidden');
    }
  }
}
