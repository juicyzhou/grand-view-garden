import { CHAPTERS } from './quest.js';

/*
 * HUD 与交互：
 *  - 入画标题屏 / 地点题名横幅 / 交互提示
 *  - 人物对话（打字机）/ 诗碑品读
 *  - 昼夜切换、音乐开关、帮助
 *  - 「大观园游记」：目标追踪、游记册、印章与圆满庆祝
 *  - 新手引导（移动 → 环视 → 沿灯前行）
 */

const NUMERALS = ['零', '壹', '贰', '叁', '肆', '伍', '陆', '柒', '捌', '玖'];

export class HUD {
  constructor({ garden, npcMgr, audio, engine, player, canvas, quest }) {
    this.garden = garden;
    this.npcMgr = npcMgr;
    this.audio = audio;
    this.engine = engine;
    this.player = player;
    this.canvas = canvas;
    this.quest = quest;

    this.$ = (id) => document.getElementById(id);
    this.started = false;
    this.dialogue = null;   // { npc, lineQueue, typing }
    this.poemOpen = false;
    this.journalOpen = false;
    this.celebrating = false;
    this.zone = null;
    this.zoneT = 0;
    this.interactTarget = null;
    this.typeTimer = null;

    // 新手引导状态机
    this.tutorial = null; // { step, startX, startZ, startYaw, hintT }

    this.interactables = [...garden.interactables, ...npcMgr.interactables];

    this.buildResumeOverlay();
    this.buildJournal();
    this.bind();

    this.quest.onChange((chapter) => this.onQuestChange(chapter));
    this.updateTracker();
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

  buildJournal() {
    const list = this.$('journal-list');
    list.innerHTML = '';
    this.journalRows = new Map();
    for (const c of CHAPTERS) {
      const row = document.createElement('div');
      row.className = 'journal-row';
      row.innerHTML = `
        <div class="journal-stamp">${c.num}</div>
        <div class="journal-name">${c.title}</div>
        <div class="journal-state">未至</div>
      `;
      list.appendChild(row);
      this.journalRows.set(c.id, row);
    }
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
      if (e.code === 'KeyJ') this.toggleJournal();
      if (e.code === 'Escape') this.closePanels();
    });

    this.$('dialogue').addEventListener('click', () => this.advanceDialogue());
    this.$('poem-panel').addEventListener('click', () => this.closePanels());
    // 移动端：显式触摸事件，确保点按文本框即可推进/合上
    this.$('dialogue').addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.advanceDialogue();
    }, { passive: false });
    this.$('poem-panel').addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.closePanels();
    }, { passive: false });

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
    this.$('btn-quest').addEventListener('click', () => this.toggleJournal());
    this.$('quest-tracker').addEventListener('click', () => this.toggleJournal());
    this.$('journal-reset').addEventListener('click', (e) => {
      e.stopPropagation();
      this.quest.reset();
    });
    this.$('quest-journal').addEventListener('click', (e) => e.stopPropagation());
    this.$('celebration').addEventListener('click', () => this.dismissCelebration());
    this.$('celebration').addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.dismissCelebration();
    }, { passive: false });

    // 游记册开着时点空白处合上
    document.addEventListener('mousedown', (e) => {
      if (this.journalOpen && !e.target.closest('#quest-journal')) this.toggleJournal(false);
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

    this.quest.begin();
    this.updateTracker();

    // 未完成「曲径通幽」则视为新客，启动引导
    if (!this.quest.isDone('qujing')) {
      this.tutorial = {
        step: 0,
        startX: this.player.pos.x,
        startZ: this.player.pos.z,
        startYaw: this.player.yaw,
        hintT: 0,
      };
      this.showTutorialHint();
    }
  }

  /* ---------- 任务追踪与游记 ---------- */

  updateTracker() {
    const cur = this.quest.currentChapter();
    const done = this.quest.doneCount;
    this.$('tracker-progress').textContent = `游记 · ${NUMERALS[done]}/${NUMERALS[this.quest.total]}`;
    this.$('tracker-hint').textContent = cur ? `下一站 · ${cur.hint}` : '九章集齐 · 游园圆满';
  }

  refreshJournal() {
    for (const c of CHAPTERS) {
      const row = this.journalRows.get(c.id);
      const done = this.quest.isDone(c.id);
      row.classList.toggle('done', done);
      row.querySelector('.journal-stamp').textContent = done ? '成' : c.num;
      row.querySelector('.journal-state').textContent = done ? '已印' : '未至';
    }
  }

  toggleJournal(force) {
    const want = force !== undefined ? force : !this.journalOpen;
    if (want === this.journalOpen) return;
    this.journalOpen = want;
    this.$('quest-journal').classList.toggle('hidden', !want);
    if (want) {
      this.refreshJournal();
      this.player.enabled = false;
      document.exitPointerLock?.();
    } else {
      this.player.enabled = this.started && !this.dialogue && !this.poemOpen;
      this.player.lock();
    }
    this.syncResumeOverlay();
  }

  onQuestChange(chapter) {
    this.updateTracker();
    this.refreshJournal();
    if (!chapter) return; // reset

    if (chapter.id !== 'enter') {
      // 追踪器闪动提示
      const tracker = this.$('quest-tracker');
      tracker.style.transition = 'none';
      tracker.style.borderColor = '#c9a55c';
      tracker.style.boxShadow = '0 0 18px rgba(201, 165, 92, 0.5)';
      requestAnimationFrame(() => {
        tracker.style.transition = 'border-color 1.2s, box-shadow 1.2s';
        tracker.style.borderColor = '';
        tracker.style.boxShadow = '';
      });
    }

    if (chapter.id === 'qujing' && this.tutorial) {
      this.tutorial = null;
      this.$('tutorial-hint').classList.add('hidden');
    }

    if (this.quest.finished && !this.celebrating) {
      this.celebrating = true;
      this.engine.celebrate(26);
      setTimeout(() => {
        this.$('celebration').classList.remove('hidden');
        document.exitPointerLock?.();
      }, 900);
    }
  }

  dismissCelebration() {
    this.$('celebration').classList.add('hidden');
    if (this.started) this.player.lock();
  }

  /* ---------- 新手引导 ---------- */

  showTutorialHint() {
    const el = this.$('tutorial-hint');
    const touch = this.player.isTouchDevice;
    const step = this.tutorial?.step;
    if (step === 0) {
      el.innerHTML = touch ? '左下摇杆 · 试着走几步' : '按 <b>W A S D</b> 走一走 · 按住 <b>Shift</b> 快步';
    } else if (step === 1) {
      el.innerHTML = touch ? '手指在右侧屏幕滑动 · 环视四周' : '移动鼠标 · 环视四周';
    } else if (step === 2) {
      el.innerHTML = '沿<b>引路花灯</b>前行 · 穿过「曲径通幽」';
      this.tutorial.hintT = 7; // 七秒后交由目标追踪
    }
    el.classList.remove('hidden');
  }

  updateTutorial(dt) {
    const tu = this.tutorial;
    const p = this.player;
    if (tu.step === 0) {
      if (Math.hypot(p.pos.x - tu.startX, p.pos.z - tu.startZ) > 2.5) {
        tu.step = 1;
        this.showTutorialHint();
      }
    } else if (tu.step === 1) {
      if (Math.abs(p.yaw - tu.startYaw) > 0.8) {
        tu.step = 2;
        this.showTutorialHint();
      }
    } else if (tu.step === 2) {
      tu.hintT -= dt;
      if (tu.hintT <= 0) {
        this.tutorial = null;
        this.$('tutorial-hint').classList.add('hidden');
      }
    }
  }

  panelOpen() {
    return !!this.dialogue || this.poemOpen || this.journalOpen;
  }

  syncResumeOverlay() {
    const locked = document.pointerLockElement === this.canvas;
    const need = this.started && !locked && !this.panelOpen() && !this.player.isTouchDevice && !this.celebrating;
    this.resumeOverlay.classList.toggle('hidden', !need);
  }

  onInteractKey() {
    if (this.journalOpen) return;
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
    this.$('dlg-next').textContent = this.player.isTouchDevice ? '点击文本继续 ▸' : '按 E 或点击继续 ▸';
    this.showLine();
    this.syncResumeOverlay();
    this.quest.talkTo(npc.id);
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
    if (this.journalOpen) this.toggleJournal(false);
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

    // 新手引导
    if (this.tutorial) this.updateTutorial(dt);

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
        this.quest.visitZone(zn);
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
        hint.innerHTML = this.player.isTouchDevice ? best.label : `<b>E</b>${best.label}`;
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
