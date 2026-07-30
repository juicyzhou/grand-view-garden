/*
 * 「大观园游记」任务系统：
 * 九章主线，达成条件为到访某地或与人物交谈；
 * 允许乱序完成，目标指引总是指向最早的未完章节。
 * 进度经 localStorage 持久化。
 */

export const CHAPTERS = [
  { id: 'enter',   num: '壹', title: '入园',       hint: '穿曲径，访名园',          type: 'auto' },
  { id: 'qujing',  num: '贰', title: '曲径通幽',   hint: '沿引路花灯，穿过曲径通幽', type: 'zone', zone: '曲径通幽' },
  { id: 'qinfang', num: '叁', title: '沁芳观鱼',   hint: '过双桥，上沁芳亭',         type: 'zone', zone: '沁芳亭' },
  { id: 'daiyu',   num: '肆', title: '潇湘访黛',   hint: '东行入潇湘馆，访林妹妹',   type: 'npc', npc: 'daiyu' },
  { id: 'baoyu',   num: '伍', title: '怡红夜话',   hint: '怡红院中，会一会宝二爷',   type: 'npc', npc: 'baoyu' },
  { id: 'baochai', num: '陆', title: '蘅芜寻香',   hint: '登西麓土山，寻蘅芜苑冷香', type: 'npc', npc: 'baochai' },
  { id: 'miaoyu',  num: '柒', title: '栊翠乞梅',   hint: '西北隅栊翠庵，向妙玉讨红梅', type: 'npc', npc: 'miaoyu' },
  { id: 'liwan',   num: '捌', title: '稻香尝新',   hint: '过蓼汀花溆，稻香村里尝新韭', type: 'npc', npc: 'liwan' },
  { id: 'daguan',  num: '玖', title: '登临大观',   hint: '北登大观楼，一览全园',     type: 'zone', zone: '大观楼' },
];

const STORAGE_KEY = 'dgy-quest-v1';

export class QuestManager {
  constructor() {
    this.completed = new Set();
    this.listeners = [];
    this.finished = false;
    this.load();
  }

  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        for (const id of JSON.parse(raw)) this.completed.add(id);
      }
    } catch { /* 隐私模式等场景忽略 */ }
  }

  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...this.completed]));
    } catch { /* ignore */ }
  }

  reset() {
    this.completed.clear();
    this.finished = false;
    this.save();
    this.emit(null);
  }

  onChange(fn) {
    this.listeners.push(fn);
  }

  emit(chapter) {
    for (const fn of this.listeners) fn(chapter);
  }

  // 自动完成的序章
  begin() {
    this.complete('enter');
  }

  get total() { return CHAPTERS.length; }
  get doneCount() { return this.completed.size; }

  isDone(id) { return this.completed.has(id); }

  // 当前目标：最早未完成的一章
  currentChapter() {
    return CHAPTERS.find((c) => !this.completed.has(c.id)) || null;
  }

  complete(id) {
    if (this.completed.has(id)) return false;
    const chapter = CHAPTERS.find((c) => c.id === id);
    if (!chapter) return false;
    this.completed.add(id);
    this.save();
    if (this.doneCount >= this.total) this.finished = true;
    this.emit(chapter);
    return true;
  }

  // 地点到访
  visitZone(zoneName) {
    for (const c of CHAPTERS) {
      if (c.type === 'zone' && c.zone === zoneName && !this.completed.has(c.id)) {
        this.complete(c.id);
      }
    }
  }

  // 与人物交谈
  talkTo(npcId) {
    for (const c of CHAPTERS) {
      if (c.type === 'npc' && c.npc === npcId && !this.completed.has(c.id)) {
        this.complete(c.id);
      }
    }
  }
}
