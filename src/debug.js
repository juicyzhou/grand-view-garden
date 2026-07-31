// 诊断模式：URL 带 ?debug=1 时启用。
// 顶部固定信息条：版本/视口/dvh 支持/GPU 型号；
// 点按屏幕任意处，枚举所有「可见且矩形覆盖该点」的层（无视 pointer-events 盲区），
// 直接回答「那层灰罩到底是哪个元素」——是 DOM 层还是 3D 画布本身。

const PROBE_IDS = [
  'vignette', 'loading', 'title-screen', 'hud', 'touch-ui', 'resume-overlay',
  'celebration', 'quest-journal', 'dialogue', 'poem-panel', 'tutorial-hint',
  'location-banner', 'interact-hint', 'quest-tracker', 'scene',
];

export function maybeEnableDebug({ engine, version }) {
  if (!new URLSearchParams(location.search).has('debug')) return;

  const bar = document.createElement('div');
  bar.id = 'debug-bar';
  bar.style.cssText = `
    position: fixed; top: 0; left: 0; right: 0; z-index: 99999;
    background: rgba(0, 0, 0, 0.88); color: #7fff9a;
    font: 11px/1.5 Menlo, monospace; padding: 6px 8px;
    pointer-events: none; white-space: pre-wrap; word-break: break-all;
  `;
  document.body.appendChild(bar);

  let gpu = 'n/a';
  let glVer = 'n/a';
  try {
    const gl = engine.renderer.getContext();
    glVer = gl instanceof WebGL2RenderingContext ? 'webgl2' : 'webgl1';
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    gpu = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
  } catch (e) { gpu = `err:${e.message}`; }

  const lines = [];
  const refresh = () => {
    const vv = window.visualViewport;
    lines[0] = `v${version} | ${innerWidth}x${innerHeight} dpr${devicePixelRatio}` +
      ` | vv:${vv ? `${Math.round(vv.width)}x${Math.round(vv.height)}` : 'n/a'}` +
      ` | dvh:${CSS.supports('height', '100dvh') ? 'Y' : 'N'}` +
      ` inset:${CSS.supports('inset', '0') ? 'Y' : 'N'}`;
    lines[1] = `GPU: ${gpu} | ${glVer}`;
    lines[2] = `fog:${engine.scene.fog ? `${engine.scene.fog.near}-${engine.scene.fog.far}` : 'off'}` +
      ` skyY:${engine.sky ? engine.sky.position.y.toFixed(1) : '?'}` +
      ` cam:${engine.camera.position.y.toFixed(1)}/${engine.camera.fov}deg`;
    bar.textContent = lines.filter(Boolean).join('\n');
  };
  refresh();
  addEventListener('resize', refresh);
  addEventListener('orientationchange', refresh);
  setInterval(refresh, 2000);

  addEventListener('pointerdown', (e) => {
    const x = e.clientX, y = e.clientY;
    const hits = [];
    for (const id of PROBE_IDS) {
      const el = document.getElementById(id);
      if (!el) continue;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') continue;
      const r = el.getBoundingClientRect();
      if (x < r.left || x > r.right || y < r.top || y > r.bottom) continue;
      hits.push(`${id}[z${cs.zIndex} bg${cs.backgroundColor} h${Math.round(r.height)}]`);
    }
    const top = document.elementFromPoint(x, y);
    lines[3] = `tap(${Math.round(x)},${Math.round(y)}) top:${top ? top.id || top.tagName : 'none'}`;
    lines[4] = hits.join(' | ') || '(无可见层覆盖)';
    bar.textContent = lines.filter(Boolean).join('\n');
  }, { capture: true });
}
