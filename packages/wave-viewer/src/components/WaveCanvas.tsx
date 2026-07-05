import { useEffect, useRef, useCallback } from 'react';
import { useWaveStore } from '../store/useWaveStore';

const LABEL_WIDTH = 180;
const SCROLLBAR_SIZE = 14;
const RULER_HEIGHT = 30;
const SIGNAL_HEIGHT = 28;
const PADDING = 3;

const COLORS = {
  bg: 'var(--vscode-editor-background, #1e1e1e)',
  fg: 'var(--vscode-editor-foreground, #d4d4d4)',
  grid: 'var(--vscode-editor-lineHighlightBorder, #2a2a2a)',
  header: 'var(--vscode-sideBar-background, #252526)',
  border: 'var(--vscode-panel-border, #3c3c3c)',
  cursor: '#ffcc00',
  scrollbar: 'var(--vscode-scrollbarSlider-background, #424242)',
  scrollbarHover: 'var(--vscode-scrollbarSlider-hoverBackground, #4f4f4f)',
  signalX: '#ff5555',
  signalZ: '#ffaa00',
  signalU: '#ff79c6',
  vectorFill: '#264f78',
  vectorText: '#d4d4d4',
  palette: ['#4fc1ff', '#61e294', '#ff79c6', '#f1fa8c', '#bd93f9', '#ff6b6b', '#8be9fd', '#ffb86c'],
  hierarchy: '#888888',
};

export function WaveCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hScrollRef = useRef<HTMLDivElement>(null);
  const vScrollRef = useRef<HTMLDivElement>(null);

  const waveformData = useWaveStore((s) => s.waveformData);
  const viewport = useWaveStore((s) => s.viewport);
  const cursor = useWaveStore((s) => s.cursor);
  const setViewport = useWaveStore((s) => s.setViewport);
  const setCursor = useWaveStore((s) => s.setCursor);
  const signals = waveformData?.signals ?? [];
  const endTime = waveformData?.endTime ?? 100;
  const totalHeight = signals.length * SIGNAL_HEIGHT;
  const viewHeight = RULER_HEIGHT + totalHeight;

  const timeToX = useCallback((t: number) => LABEL_WIDTH + (t - viewport.startTime) * viewport.pxPerTime, [viewport]);
  const xToTime = useCallback((x: number) => viewport.startTime + (x - LABEL_WIDTH) / viewport.pxPerTime, [viewport]);

  // Canvas drawing
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || !waveformData) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = container.clientWidth;
    const h = container.clientHeight;

    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    }

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, w, h);

    const range = viewport.endTime - viewport.startTime;
    const niceTick = (r: number, px: number) => {
      if (r <= 0 || px <= 0) return 1;
      const ideal = r * 80 / px;
      const mag = Math.pow(10, Math.floor(Math.log10(ideal)));
      const n = ideal / mag;
      return (n <= 1.5 ? 1 : n <= 3.5 ? 2 : n <= 7.5 ? 5 : 10) * mag;
    };
    const tickSpacing = niceTick(range, w - LABEL_WIDTH);

    // Grid
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 0.5;
    for (let t = Math.floor(viewport.startTime / tickSpacing) * tickSpacing; t <= viewport.endTime; t += tickSpacing) {
      const x = timeToX(t);
      if (x < LABEL_WIDTH) continue;
      ctx.beginPath(); ctx.moveTo(x, RULER_HEIGHT); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let i = 0; i <= signals.length; i++) {
      const y = RULER_HEIGHT + i * SIGNAL_HEIGHT - viewport.scrollY;
      if (y < RULER_HEIGHT || y > h) continue;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }

    // Clip waveform area
    ctx.save();
    ctx.beginPath();
    ctx.rect(LABEL_WIDTH, RULER_HEIGHT, w - LABEL_WIDTH, h - RULER_HEIGHT);
    ctx.clip();

    signals.forEach((sig, i) => {
      const y = RULER_HEIGHT + i * SIGNAL_HEIGHT - viewport.scrollY;
      if (y + SIGNAL_HEIGHT < RULER_HEIGHT || y > h) return;

      const color = COLORS.palette[i % COLORS.palette.length];
      const top = y + PADDING, bot = y + SIGNAL_HEIGHT - PADDING, mid = (top + bot) / 2;

      if (sig.width === 1) {
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = color;
        for (let ti = 0; ti < sig.transitions.length; ti++) {
          const t = sig.transitions[ti];
          const next = sig.transitions[ti + 1];
          const x1 = timeToX(t.time);
          const x2 = next ? timeToX(next.time) : w;
          if (x2 < LABEL_WIDTH || x1 > w) continue;

          const val = t.value.kind === 'scalar' ? t.value.value : '0';
          const levelY = (val === '1' || val === 'h') ? top : bot;

          if (val === 'x') { ctx.strokeStyle = COLORS.signalX; ctx.fillStyle = COLORS.signalX + '25'; ctx.fillRect(x1, top, x2 - x1, bot - top); }
          else if (val === 'z') ctx.strokeStyle = COLORS.signalZ;
          else if (val === 'u') ctx.strokeStyle = COLORS.signalU;
          else ctx.strokeStyle = color;

          if (ti > 0) {
            const pv = sig.transitions[ti - 1];
            const pvVal = pv.value.kind === 'scalar' ? pv.value.value : '0';
            const pvY = (pvVal === '1' || pvVal === 'h') ? top : bot;
            if (pvY !== levelY) { ctx.beginPath(); ctx.moveTo(x1, pvY); ctx.lineTo(x1, levelY); ctx.stroke(); }
          }
          ctx.beginPath(); ctx.moveTo(Math.max(x1, LABEL_WIDTH), levelY); ctx.lineTo(Math.min(x2, w), levelY); ctx.stroke();
        }
      } else {
        ctx.lineWidth = 1;
        for (let ti = 0; ti < sig.transitions.length; ti++) {
          const t = sig.transitions[ti];
          const next = sig.transitions[ti + 1];
          const x1 = Math.max(timeToX(t.time), LABEL_WIDTH);
          const x2 = next ? Math.min(timeToX(next.time), w) : w;
          if (x2 - x1 < 1) continue;

          ctx.fillStyle = COLORS.vectorFill; ctx.strokeStyle = color;
          const dw = Math.min(4, (x2 - x1) / 3);
          ctx.beginPath();
          ctx.moveTo(x1 + dw, top); ctx.lineTo(x2 - dw, top); ctx.lineTo(x2, mid);
          ctx.lineTo(x2 - dw, bot); ctx.lineTo(x1 + dw, bot); ctx.lineTo(x1, mid);
          ctx.closePath(); ctx.fill(); ctx.stroke();

          if (x2 - x1 > 24 && t.value.kind === 'vector') {
            ctx.fillStyle = COLORS.vectorText;
            ctx.font = '10px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText('0x' + parseInt(t.value.value, 2).toString(16).toUpperCase(), (x1 + x2) / 2, mid);
          }
        }
      }
    });
    ctx.restore();

    // Labels
    ctx.fillStyle = COLORS.header;
    ctx.fillRect(0, RULER_HEIGHT, LABEL_WIDTH, h - RULER_HEIGHT);
    ctx.strokeStyle = COLORS.border;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(LABEL_WIDTH, RULER_HEIGHT); ctx.lineTo(LABEL_WIDTH, h); ctx.stroke();

    ctx.font = '12px "Segoe UI", sans-serif';
    ctx.textAlign = 'left';
    signals.forEach((sig, i) => {
      const y = RULER_HEIGHT + i * SIGNAL_HEIGHT - viewport.scrollY;
      if (y + SIGNAL_HEIGHT < RULER_HEIGHT || y > h) return;

      const color = COLORS.palette[i % COLORS.palette.length];
      ctx.fillStyle = color;
      ctx.fillRect(8, y + SIGNAL_HEIGHT / 2 - 4, 8, 8);

      // Show hierarchy path if present
      const path = sig.hierarchyPath?.length ? sig.hierarchyPath.join('.') + '.' : '';
      ctx.fillStyle = COLORS.hierarchy;
      ctx.font = '10px "Segoe UI", sans-serif';
      ctx.textBaseline = 'middle';
      const pathW = ctx.measureText(path).width;
      ctx.fillText(path, 24, y + SIGNAL_HEIGHT / 2);

      ctx.fillStyle = COLORS.fg;
      ctx.font = '12px "Segoe UI", sans-serif';
      ctx.fillText(sig.name, 24 + pathW, y + SIGNAL_HEIGHT / 2);

      // Bit width indicator
      if (sig.width > 1) {
        ctx.fillStyle = COLORS.hierarchy;
        ctx.font = '9px "Segoe UI", sans-serif';
        ctx.textBaseline = 'bottom';
        ctx.fillText(`[${sig.width}:0]`, LABEL_WIDTH - 4, y + SIGNAL_HEIGHT - 2);
      }
    });

    // Ruler
    ctx.fillStyle = COLORS.header;
    ctx.fillRect(0, 0, w, RULER_HEIGHT);
    ctx.strokeStyle = COLORS.border;
    ctx.beginPath(); ctx.moveTo(0, RULER_HEIGHT); ctx.lineTo(w, RULER_HEIGHT); ctx.stroke();

    ctx.fillStyle = COLORS.fg;
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    for (let t = Math.floor(viewport.startTime / tickSpacing) * tickSpacing; t <= viewport.endTime; t += tickSpacing) {
      const x = timeToX(t);
      if (x < LABEL_WIDTH - 5 || x > w + 5) continue;
      ctx.strokeStyle = '#88888840';
      ctx.beginPath(); ctx.moveTo(x, RULER_HEIGHT - 8); ctx.lineTo(x, RULER_HEIGHT - 1); ctx.stroke();
      ctx.fillText(t + (waveformData.timescale ? ' ' + waveformData.timescale.unit : 'ns'), x, RULER_HEIGHT - 12);
    }

    // Cursor
    if (cursor.primary !== null) {
      const x = timeToX(cursor.primary);
      if (x >= LABEL_WIDTH && x <= w) {
        ctx.strokeStyle = COLORS.cursor; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
        ctx.fillStyle = COLORS.cursor; ctx.font = 'bold 10px monospace'; ctx.textAlign = 'center';
        ctx.fillText(cursor.primary + 'ns', x, 10);
      }
    }

    ctx.restore();
  }, [waveformData, viewport, cursor, signals, timeToX]);

  // Wheel handler
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        const factor = e.deltaY < 0 ? 1.2 : 1 / 1.2;
        const mt = xToTime(e.offsetX);
        setViewport((prev) => {
          const pxPerTime = prev.pxPerTime * factor;
          const cw = container.clientWidth;
          return {
            ...prev,
            pxPerTime,
            startTime: mt - (e.offsetX - LABEL_WIDTH) / pxPerTime,
            endTime: mt + (cw - LABEL_WIDTH) / pxPerTime - (e.offsetX - LABEL_WIDTH) / pxPerTime,
          };
        });
      } else if (e.shiftKey) {
        const dt = e.deltaY / viewport.pxPerTime;
        setViewport((prev) => ({
          ...prev,
          startTime: Math.max(0, prev.startTime + dt),
          endTime: Math.min(endTime, prev.endTime + dt),
        }));
      } else {
        setViewport((prev) => ({
          ...prev,
          scrollY: Math.max(0, Math.min(totalHeight - (container.clientHeight - RULER_HEIGHT), prev.scrollY + e.deltaY)),
        }));
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [viewport, endTime, setViewport, xToTime]);

  // Mouse handlers
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let isDragging = false, dragStartX = 0, dragStartTime = 0;

    const hMDown = (e: MouseEvent) => {
      if (e.offsetX > LABEL_WIDTH) {
        if (e.button === 0 && !e.altKey) setCursor(() => ({ primary: Math.round(xToTime(e.offsetX)), secondary: null }));
        if (e.button === 1 || (e.button === 0 && e.altKey)) { isDragging = true; dragStartX = e.offsetX; dragStartTime = viewport.startTime; }
      }
    };
    const hMMove = (e: MouseEvent) => {
      if (isDragging) {
        const dt = (e.offsetX - dragStartX) / viewport.pxPerTime;
        setViewport((prev) => ({
          ...prev,
          startTime: Math.max(0, dragStartTime - dt),
          endTime: Math.min(endTime, dragStartTime - dt + (container.clientWidth - LABEL_WIDTH) / prev.pxPerTime),
        }));
      }
    };
    const hMUp = () => { isDragging = false; };

    container.addEventListener('mousedown', hMDown);
    container.addEventListener('mousemove', hMMove);
    window.addEventListener('mouseup', hMUp);
    return () => {
      container.removeEventListener('mousedown', hMDown);
      container.removeEventListener('mousemove', hMMove);
      window.removeEventListener('mouseup', hMUp);
    };
  }, [viewport, endTime, setViewport, setCursor, xToTime]);

  // Scrollbars: sync DOM → store
  useEffect(() => {
    const hs = hScrollRef.current;
    const vs = vScrollRef.current;
    if (!hs || !vs) return;

    const viewW = containerRef.current?.clientWidth ?? 1;
    const totalW = endTime * viewport.pxPerTime + LABEL_WIDTH;
    const thumbW = Math.max(20, viewW * (viewW / totalW));
    const scrollLeft = (viewport.startTime * viewport.pxPerTime / totalW) * viewW;
    hs.style.width = thumbW + 'px';
    hs.style.left = scrollLeft + 'px';

    const viewH = containerRef.current?.clientHeight ?? 1;
    const thumbH = Math.max(20, viewH * (viewH / totalHeight));
    const scrollTop = (viewport.scrollY / totalHeight) * viewH;
    vs.style.height = thumbH + 'px';
    vs.style.top = scrollTop + 'px';

    return () => {};
  }, [viewport, endTime, totalHeight]);

  const handleHScroll = useCallback((e: React.MouseEvent) => {
    const bar = hScrollRef.current?.parentElement;
    if (!bar) return;
    const startX = e.clientX;
    const startTime = viewport.startTime;
    const barW = bar.clientWidth;
    const totalW = endTime * viewport.pxPerTime + LABEL_WIDTH;

    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX;
      const ratio = dx / barW;
      const dt = ratio * totalW / viewport.pxPerTime;
      setViewport((prev) => ({
        ...prev,
        startTime: Math.max(0, startTime + dt),
        endTime: Math.min(endTime, startTime + dt + (barW - LABEL_WIDTH) / prev.pxPerTime),
      }));
    };
    const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [viewport, endTime, setViewport]);

  const handleVScroll = useCallback((e: React.MouseEvent) => {
    const bar = vScrollRef.current?.parentElement;
    if (!bar) return;
    const startY = e.clientY;
    const startScroll = viewport.scrollY;
    const barH = bar.clientHeight;

    const onMove = (ev: MouseEvent) => {
      const dy = ev.clientY - startY;
      const ratio = dy / barH;
      const maxScroll = Math.max(0, totalHeight - (containerRef.current?.clientHeight ?? 0));
      setViewport((prev) => ({
        ...prev,
        scrollY: Math.max(0, Math.min(maxScroll, startScroll + ratio * totalHeight)),
      }));
    };
    const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [viewport, totalHeight, setViewport]);

  return (
    <div style={{ width: '100%', height: '100%', flex: 1, display: 'flex', flexDirection: 'column', background: COLORS.bg }}>
      {/* Waveform area */}
      <div ref={containerRef} style={{ flex: 1, overflow: 'hidden', cursor: 'crosshair', position: 'relative' }}>
        <canvas ref={canvasRef} style={{ position: 'absolute', top: 0, left: 0 }} />
      </div>

      {/* Horizontal scrollbar */}
      <div
        style={{
          height: SCROLLBAR_SIZE, background: COLORS.header,
          borderTop: `1px solid ${COLORS.border}`, position: 'relative', cursor: 'pointer',
          marginRight: SCROLLBAR_SIZE,
        }}
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const ratio = (e.clientX - rect.left) / rect.width;
          const newStart = ratio * endTime;
          setViewport((prev) => ({
            ...prev,
            startTime: Math.max(0, newStart - (rect.width - LABEL_WIDTH) / prev.pxPerTime / 2),
            endTime: Math.min(endTime, newStart + (rect.width - LABEL_WIDTH) / prev.pxPerTime / 2),
          }));
        }}
      >
        <div
          ref={hScrollRef}
          onMouseDown={handleHScroll}
          style={{
            position: 'absolute', top: 2, height: SCROLLBAR_SIZE - 4, borderRadius: 4,
            background: COLORS.scrollbar, cursor: 'pointer', transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = COLORS.scrollbarHover}
          onMouseLeave={(e) => e.currentTarget.style.background = COLORS.scrollbar}
        />
      </div>

      {/* Vertical scrollbar */}
      <div
        style={{
          position: 'absolute', right: 0, top: 0, bottom: SCROLLBAR_SIZE, width: SCROLLBAR_SIZE,
          background: COLORS.header, borderLeft: `1px solid ${COLORS.border}`, cursor: 'pointer',
        }}
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const ratio = (e.clientY - rect.top) / rect.height;
          const maxScroll = Math.max(0, totalHeight - (containerRef.current?.clientHeight ?? 0));
          setViewport((prev) => ({ ...prev, scrollY: ratio * maxScroll }));
        }}
      >
        <div
          ref={vScrollRef}
          onMouseDown={handleVScroll}
          style={{
            position: 'absolute', left: 2, width: SCROLLBAR_SIZE - 4, borderRadius: 4,
            background: COLORS.scrollbar, cursor: 'pointer', transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = COLORS.scrollbarHover}
          onMouseLeave={(e) => e.currentTarget.style.background = COLORS.scrollbar}
        />
      </div>
    </div>
  );
}
