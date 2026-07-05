import { useEffect, useRef } from 'react';
import { useWaveStore } from '../store/useWaveStore';

const LABEL_W = 180;
const SCROLL_W = 12;
const RULER_H = 30;
const SIG_H = 28;
const PAD = 3;

const C = {
  bg: 'var(--vscode-editor-background,#1e1e1e)',
  fg: 'var(--vscode-editor-foreground,#d4d4d4)',
  grid: 'var(--vscode-editor-lineHighlightBorder,#2a2a2a)',
  hdr: 'var(--vscode-sideBar-background,#252526)',
  bdr: 'var(--vscode-panel-border,#3c3c3c)',
  cur: '#ffcc00',
  sb: 'var(--vscode-scrollbarSlider-background,#424242)',
  sbH: 'var(--vscode-scrollbarSlider-hoverBackground,#4f4f4f)',
  x: '#ff5555', z: '#ffaa00', u: '#ff79c6',
  vFill: '#264f78', vTxt: '#d4d4d4',
  pal: ['#4fc1ff','#61e294','#ff79c6','#f1fa8c','#bd93f9','#ff6b6b','#8be9fd','#ffb86c'],
  hi: '#888888',
};

export function WaveCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const hThumbRef = useRef<HTMLDivElement>(null);
  const vThumbRef = useRef<HTMLDivElement>(null);

  const wf = useWaveStore(s => s.waveformData);
  const vp = useWaveStore(s => s.viewport);
  const cur = useWaveStore(s => s.cursor);
  const setVp = useWaveStore(s => s.setViewport);
  const setCur = useWaveStore(s => s.setCursor);

  const sigs = wf?.signals ?? [];
  const endT = wf?.endTime ?? 100;
  const totalH = sigs.length * SIG_H;

  const t2x = (t: number) => LABEL_W + (t - vp.startTime) * vp.pxPerTime;
  const x2t = (x: number) => vp.startTime + (x - LABEL_W) / vp.pxPerTime;

  // Canvas draw
  useEffect(() => {
    const ca = canvasRef.current, bx = boxRef.current;
    if (!ca || !bx || !wf) return;
    const ctx = ca.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const w = bx.clientWidth, h = bx.clientHeight;
    if (ca.width !== w * dpr || ca.height !== h * dpr) { ca.width = w * dpr; ca.height = h * dpr; ca.style.width = w + 'px'; ca.style.height = h + 'px'; }
    ctx.save(); ctx.scale(dpr, dpr); ctx.clearRect(0, 0, w, h); ctx.fillStyle = C.bg; ctx.fillRect(0, 0, w, h);

    const range = vp.endTime - vp.startTime;
    const tick = (() => {
      if (range <= 0 || w - LABEL_W <= 0) return 1;
      const ideal = range * 80 / (w - LABEL_W);
      const mag = Math.pow(10, Math.floor(Math.log10(ideal)));
      const n = ideal / mag;
      return (n <= 1.5 ? 1 : n <= 3.5 ? 2 : n <= 7.5 ? 5 : 10) * mag;
    })();

    ctx.strokeStyle = C.grid; ctx.lineWidth = 0.5;
    for (let t = Math.floor(vp.startTime / tick) * tick; t <= vp.endTime; t += tick) { const x = t2x(t); if (x < LABEL_W) continue; ctx.beginPath(); ctx.moveTo(x, RULER_H); ctx.lineTo(x, h); ctx.stroke(); }
    for (let i = 0; i <= sigs.length; i++) { const y = RULER_H + i * SIG_H - vp.scrollY; if (y < RULER_H || y > h) continue; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }

    ctx.save(); ctx.beginPath(); ctx.rect(LABEL_W, RULER_H, w - LABEL_W, h - RULER_H); ctx.clip();
    sigs.forEach((sig, i) => {
      const y = RULER_H + i * SIG_H - vp.scrollY;
      if (y + SIG_H < RULER_H || y > h) return;
      const col = C.pal[i % C.pal.length];
      const top = y + PAD, bot = y + SIG_H - PAD, mid = (top + bot) / 2;
      ctx.lineWidth = 1.5;
      if (sig.width === 1) {
        ctx.strokeStyle = col;
        for (let ti = 0; ti < sig.transitions.length; ti++) {
          const t = sig.transitions[ti], nx = sig.transitions[ti + 1];
          const x1 = t2x(t.time), x2 = nx ? t2x(nx.time) : w;
          if (x2 < LABEL_W || x1 > w) continue;
          const val = t.value.kind === 'scalar' ? t.value.value : '0';
          const ly = (val === '1' || val === 'h') ? top : bot;
          if (val === 'x') { ctx.strokeStyle = C.x; ctx.fillStyle = C.x + '25'; ctx.fillRect(x1, top, x2 - x1, bot - top); }
          else if (val === 'z') ctx.strokeStyle = C.z;
          else if (val === 'u') ctx.strokeStyle = C.u;
          else ctx.strokeStyle = col;
          if (ti > 0) { const pv = sig.transitions[ti - 1]; const pvy = (pv.value.kind === 'scalar' && (pv.value.value === '1' || pv.value.value === 'h')) ? top : bot; if (pvy !== ly) { ctx.beginPath(); ctx.moveTo(x1, pvy); ctx.lineTo(x1, ly); ctx.stroke(); } }
          ctx.beginPath(); ctx.moveTo(Math.max(x1, LABEL_W), ly); ctx.lineTo(Math.min(x2, w), ly); ctx.stroke();
        }
      } else {
        ctx.lineWidth = 1;
        for (let ti = 0; ti < sig.transitions.length; ti++) {
          const t = sig.transitions[ti], nx = sig.transitions[ti + 1];
          const x1 = Math.max(t2x(t.time), LABEL_W), x2 = nx ? Math.min(t2x(nx.time), w) : w;
          if (x2 - x1 < 1) continue;
          ctx.fillStyle = C.vFill; ctx.strokeStyle = col;
          const dw = Math.min(4, (x2 - x1) / 3);
          ctx.beginPath(); ctx.moveTo(x1 + dw, top); ctx.lineTo(x2 - dw, top); ctx.lineTo(x2, mid); ctx.lineTo(x2 - dw, bot); ctx.lineTo(x1 + dw, bot); ctx.lineTo(x1, mid); ctx.closePath(); ctx.fill(); ctx.stroke();
          if (x2 - x1 > 24 && t.value.kind === 'vector') { ctx.fillStyle = C.vTxt; ctx.font = '10px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('0x' + parseInt(t.value.value, 2).toString(16).toUpperCase(), (x1 + x2) / 2, mid); }
        }
      }
    });
    ctx.restore();

    // Labels
    ctx.fillStyle = C.hdr; ctx.fillRect(0, RULER_H, LABEL_W, h - RULER_H);
    ctx.strokeStyle = C.bdr; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(LABEL_W, RULER_H); ctx.lineTo(LABEL_W, h); ctx.stroke();
    ctx.textAlign = 'left';
    sigs.forEach((sig, i) => {
      const y = RULER_H + i * SIG_H - vp.scrollY;
      if (y + SIG_H < RULER_H || y > h) return;
      ctx.fillStyle = C.pal[i % C.pal.length]; ctx.fillRect(8, y + SIG_H / 2 - 4, 8, 8);
      const path = sig.hierarchyPath?.length ? sig.hierarchyPath.join('.') + '.' : '';
      ctx.fillStyle = C.hi; ctx.font = '10px "Segoe UI",sans-serif'; ctx.textBaseline = 'middle';
      const pw = ctx.measureText(path).width;
      ctx.fillText(path, 24, y + SIG_H / 2);
      ctx.fillStyle = C.fg; ctx.font = '12px "Segoe UI",sans-serif';
      ctx.fillText(sig.name, 24 + pw, y + SIG_H / 2);
      if (sig.width > 1) { ctx.fillStyle = C.hi; ctx.font = '9px "Segoe UI",sans-serif'; ctx.textBaseline = 'bottom'; ctx.fillText('[' + sig.width + ':0]', LABEL_W - 4, y + SIG_H - 2); }
    });

    // Ruler
    ctx.fillStyle = C.hdr; ctx.fillRect(0, 0, w, RULER_H);
    ctx.strokeStyle = C.bdr; ctx.beginPath(); ctx.moveTo(0, RULER_H); ctx.lineTo(w, RULER_H); ctx.stroke();
    ctx.fillStyle = C.fg; ctx.font = '10px monospace'; ctx.textAlign = 'center';
    for (let t = Math.floor(vp.startTime / tick) * tick; t <= vp.endTime; t += tick) { const x = t2x(t); if (x < LABEL_W - 5 || x > w + 5) continue; ctx.strokeStyle = '#88888840'; ctx.beginPath(); ctx.moveTo(x, RULER_H - 8); ctx.lineTo(x, RULER_H - 1); ctx.stroke(); ctx.fillText(t + (wf.timescale ? ' ' + wf.timescale.unit : 'ns'), x, RULER_H - 12); }

    // Cursor
    if (cur.primary !== null) { const x = t2x(cur.primary); if (x >= LABEL_W && x <= w) { ctx.strokeStyle = C.cur; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); ctx.fillStyle = C.cur; ctx.font = 'bold 10px monospace'; ctx.textAlign = 'center'; ctx.fillText(cur.primary + 'ns', x, 10); } }
    ctx.restore();
  }, [wf, vp, cur, sigs, t2x]);

  // Events
  useEffect(() => {
    const bx = boxRef.current;
    if (!bx) return;
    let drag = false, dX = 0, dT = 0;
    const ww = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        const f = e.deltaY < 0 ? 1.2 : 1 / 1.2;
        const mt = x2t(e.offsetX);
        setVp(p => { const px = p.pxPerTime * f; return { ...p, pxPerTime: px, startTime: mt - (e.offsetX - LABEL_W) / px, endTime: mt + (bx.clientWidth - LABEL_W) / px - (e.offsetX - LABEL_W) / px }; });
      } else if (e.shiftKey) { const dt = e.deltaY / vp.pxPerTime; setVp(p => ({ ...p, startTime: Math.max(0, p.startTime + dt), endTime: Math.min(endT, p.endTime + dt) })); }
      else { setVp(p => ({ ...p, scrollY: Math.max(0, Math.min(totalH - bx.clientHeight, p.scrollY + e.deltaY)) })); }
    };
    const md = (e: MouseEvent) => { if (e.offsetX > LABEL_W) { if (e.button === 0 && !e.altKey) setCur(() => ({ primary: Math.round(x2t(e.offsetX)), secondary: null })); if (e.button === 1 || (e.button === 0 && e.altKey)) { drag = true; dX = e.offsetX; dT = vp.startTime; } } };
    const mm = (e: MouseEvent) => { if (drag) { const dt = (e.offsetX - dX) / vp.pxPerTime; setVp(p => ({ ...p, startTime: Math.max(0, dT - dt), endTime: Math.min(endT, dT - dt + (bx.clientWidth - LABEL_W) / p.pxPerTime) })); } };
    const mu = () => { drag = false; };
    bx.addEventListener('wheel', ww, { passive: false }); bx.addEventListener('mousedown', md); bx.addEventListener('mousemove', mm); window.addEventListener('mouseup', mu);
    return () => { bx.removeEventListener('wheel', ww); bx.removeEventListener('mousedown', md); bx.removeEventListener('mousemove', mm); window.removeEventListener('mouseup', mu); };
  }, [vp, endT, totalH, setVp, setCur, x2t]);

  // Scrollbar thumbs
  useEffect(() => {
    const ht = hThumbRef.current, vt = vThumbRef.current, bx = boxRef.current;
    if (!ht || !vt || !bx) return;
    const viewW = bx.clientWidth, totW = endT * vp.pxPerTime + LABEL_W;
    ht.style.width = Math.max(20, viewW * viewW / totW) + 'px';
    ht.style.left = (vp.startTime * vp.pxPerTime / totW * viewW) + 'px';
    const viewH = bx.clientHeight;
    vt.style.height = Math.max(20, viewH * viewH / totalH) + 'px';
    vt.style.top = (vp.scrollY / Math.max(totalH, 1) * viewH) + 'px';
  }, [vp, endT, totalH]);

  const onHTrack = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    const newS = ratio * endT - (rect.width - LABEL_W) / vp.pxPerTime / 2;
    setVp(p => ({ ...p, startTime: Math.max(0, newS), endTime: Math.min(endT, newS + (rect.width - LABEL_W) / p.pxPerTime) }));
  };
  const onHDrag = (e: React.MouseEvent) => {
    const bar = (e.target as HTMLElement).parentElement!;
    const sX = e.clientX, sT = vp.startTime, bW = bar.clientWidth, totW = endT * vp.pxPerTime + LABEL_W;
    const mv = (ev: MouseEvent) => { const dt = (ev.clientX - sX) / bW * totW / vp.pxPerTime; setVp(p => ({ ...p, startTime: Math.max(0, sT + dt), endTime: Math.min(endT, sT + dt + (bW - LABEL_W) / p.pxPerTime) })); };
    const mu = () => { window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', mu); };
    window.addEventListener('mousemove', mv); window.addEventListener('mouseup', mu);
  };
  const onVTrack = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const maxS = Math.max(0, totalH - (boxRef.current?.clientHeight ?? 0));
    setVp(p => ({ ...p, scrollY: ((e.clientY - rect.top) / rect.height) * maxS }));
  };
  const onVDrag = (e: React.MouseEvent) => {
    const bar = (e.target as HTMLElement).parentElement!;
    const sY = e.clientY, sS = vp.scrollY, bH = bar.clientHeight;
    const mv = (ev: MouseEvent) => { const dy = (ev.clientY - sY) / bH; setVp(p => ({ ...p, scrollY: Math.max(0, Math.min(totalH - (boxRef.current?.clientHeight ?? 0), sS + dy * totalH)) })); };
    const mu = () => { window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', mu); };
    window.addEventListener('mousemove', mv); window.addEventListener('mouseup', mu);
  };

  return (
    <div style={{ width: '100%', height: '100%', flex: 1, display: 'flex', flexDirection: 'column', background: C.bg, position: 'relative' }}>
      <div ref={boxRef} style={{ flex: 1, overflow: 'hidden', cursor: 'crosshair', position: 'relative', marginRight: SCROLL_W }}>
        <canvas ref={canvasRef} style={{ position: 'absolute', top: 0, left: 0 }} />
      </div>
      {/* H-scrollbar */}
      <div onClick={onHTrack} style={{ height: SCROLL_W, background: C.hdr, borderTop: '1px solid ' + C.bdr, position: 'relative', cursor: 'pointer', marginRight: SCROLL_W }}>
        <div ref={hThumbRef} onMouseDown={onHDrag} style={{ position: 'absolute', top: 2, height: SCROLL_W - 4, borderRadius: 3, background: C.sb, cursor: 'pointer' }}
          onMouseEnter={e => (e.target as HTMLElement).style.background = C.sbH} onMouseLeave={e => (e.target as HTMLElement).style.background = C.sb} />
      </div>
      {/* V-scrollbar */}
      <div onClick={onVTrack} style={{ position: 'absolute', right: 0, top: 0, bottom: SCROLL_W, width: SCROLL_W, background: C.hdr, borderLeft: '1px solid ' + C.bdr, cursor: 'pointer' }}>
        <div ref={vThumbRef} onMouseDown={onVDrag} style={{ position: 'absolute', left: 2, width: SCROLL_W - 4, borderRadius: 3, background: C.sb, cursor: 'pointer' }}
          onMouseEnter={e => (e.target as HTMLElement).style.background = C.sbH} onMouseLeave={e => (e.target as HTMLElement).style.background = C.sb} />
      </div>
    </div>
  );
}
