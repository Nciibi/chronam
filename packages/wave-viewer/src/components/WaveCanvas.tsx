import { useEffect, useRef } from 'react';
import { useWaveStore } from '../store/useWaveStore';

const LABEL_WIDTH = 180;
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
  signalX: '#ff5555',
  signalZ: '#ffaa00',
  signalU: '#ff79c6',
  vectorFill: '#264f78',
  vectorText: '#d4d4d4',
  palette: ['#4fc1ff', '#61e294', '#ff79c6', '#f1fa8c', '#bd93f9', '#ff6b6b', '#8be9fd', '#ffb86c']
};

export function WaveCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const waveformData = useWaveStore((state) => state.waveformData);
  const viewport = useWaveStore((state) => state.viewport);
  const cursor = useWaveStore((state) => state.cursor);
  const setViewport = useWaveStore((state) => state.setViewport);
  const setCursor = useWaveStore((state) => state.setCursor);

  // Drawing functions
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || !waveformData) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = container.clientWidth;
    const h = container.clientHeight;
    
    // Only resize if actually changed
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

    const timeToX = (t: number) => LABEL_WIDTH + (t - viewport.startTime) * viewport.pxPerTime;
    
    const niceTickSpacing = (range: number, pixels: number) => {
      const ideal = range * 80 / pixels;
      if (ideal <= 0) return 1;
      const mag = Math.pow(10, Math.floor(Math.log10(ideal)));
      const r = ideal / mag;
      const nice = r <= 1.5 ? 1 : r <= 3.5 ? 2 : r <= 7.5 ? 5 : 10;
      return nice * mag;
    };

    // 1. Render Grid
    const range = viewport.endTime - viewport.startTime;
    const tickSpacing = niceTickSpacing(range, w - LABEL_WIDTH);
    const first = Math.floor(viewport.startTime / tickSpacing) * tickSpacing;

    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 0.5;
    for (let t = first; t <= viewport.endTime; t += tickSpacing) {
      const x = timeToX(t);
      if (x < LABEL_WIDTH) continue;
      ctx.beginPath(); ctx.moveTo(x, RULER_HEIGHT); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let i = 0; i <= waveformData.signals.length; i++) {
      const y = RULER_HEIGHT + i * SIGNAL_HEIGHT - viewport.scrollY;
      if (y < RULER_HEIGHT || y > h) continue;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }

    // 2. Render Signals
    ctx.save();
    ctx.beginPath();
    ctx.rect(LABEL_WIDTH, RULER_HEIGHT, w - LABEL_WIDTH, h - RULER_HEIGHT);
    ctx.clip();

    waveformData.signals.forEach((sig, i) => {
      const y = RULER_HEIGHT + i * SIGNAL_HEIGHT - viewport.scrollY;
      if (y + SIGNAL_HEIGHT < RULER_HEIGHT || y > h) return;

      const color = COLORS.palette[i % COLORS.palette.length];
      const top = y + PADDING, bot = y + SIGNAL_HEIGHT - PADDING, mid = (top + bot) / 2;
      ctx.lineWidth = 1.5;

      if (sig.width === 1) {
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
          else if (val === 'z') { ctx.strokeStyle = COLORS.signalZ; }
          else if (val === 'u') { ctx.strokeStyle = COLORS.signalU; }
          else { ctx.strokeStyle = color; }

          if (ti > 0) {
            const prev = sig.transitions[ti - 1];
            const prevVal = prev.value.kind === 'scalar' ? prev.value.value : '0';
            const prevY = (prevVal === '1' || prevVal === 'h') ? top : bot;
            if (prevY !== levelY) { ctx.beginPath(); ctx.moveTo(x1, prevY); ctx.lineTo(x1, levelY); ctx.stroke(); }
          }
          ctx.beginPath(); ctx.moveTo(Math.max(x1, LABEL_WIDTH), levelY); ctx.lineTo(Math.min(x2, w), levelY); ctx.stroke();
        }
      } else {
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
            const hex = parseInt(t.value.value, 2).toString(16).toUpperCase();
            ctx.fillStyle = COLORS.vectorText;
            ctx.font = '10px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText('0x' + hex, (x1 + x2) / 2, mid);
          }
        }
      }
    });
    ctx.restore();

    // 3. Render Labels
    ctx.fillStyle = COLORS.header;
    ctx.fillRect(0, RULER_HEIGHT, LABEL_WIDTH, h - RULER_HEIGHT);
    ctx.strokeStyle = COLORS.border;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(LABEL_WIDTH, RULER_HEIGHT); ctx.lineTo(LABEL_WIDTH, h); ctx.stroke();

    ctx.font = '12px "Segoe UI", sans-serif';
    ctx.textAlign = 'left';

    waveformData.signals.forEach((sig, i) => {
      const y = RULER_HEIGHT + i * SIGNAL_HEIGHT - viewport.scrollY;
      if (y + SIGNAL_HEIGHT < RULER_HEIGHT || y > h) return;

      const color = COLORS.palette[i % COLORS.palette.length];
      ctx.fillStyle = color;
      ctx.fillRect(8, y + SIGNAL_HEIGHT/2 - 4, 8, 8);
      ctx.fillStyle = COLORS.fg;
      ctx.textBaseline = 'middle';
      ctx.fillText(sig.name, 24, y + SIGNAL_HEIGHT / 2);
    });

    // 4. Render Ruler
    ctx.fillStyle = COLORS.header;
    ctx.fillRect(0, 0, w, RULER_HEIGHT);
    ctx.strokeStyle = COLORS.border;
    ctx.beginPath(); ctx.moveTo(0, RULER_HEIGHT); ctx.lineTo(w, RULER_HEIGHT); ctx.stroke();

    ctx.fillStyle = COLORS.fg;
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';

    for (let t = first; t <= viewport.endTime; t += tickSpacing) {
      const x = timeToX(t);
      if (x < LABEL_WIDTH - 5 || x > w + 5) continue;
      ctx.strokeStyle = '#88888840';
      ctx.beginPath(); ctx.moveTo(x, RULER_HEIGHT - 8); ctx.lineTo(x, RULER_HEIGHT - 1); ctx.stroke();
      ctx.fillText(t + (waveformData.timescale ? ' ' + waveformData.timescale.unit : ''), x, RULER_HEIGHT - 12);
    }

    // 5. Render Cursors
    if (cursor.primary !== null) {
      const x = timeToX(cursor.primary);
      ctx.strokeStyle = COLORS.cursor; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
      ctx.fillStyle = COLORS.cursor; ctx.font = 'bold 10px monospace'; ctx.textAlign = 'center';
      ctx.fillText(cursor.primary + '', x, 10);
    }

    ctx.restore();
  }, [waveformData, viewport, cursor]);

  // Event handlers
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let isDragging = false;
    let dragStartX = 0;
    let dragStartTime = 0;

    const xToTime = (x: number) => viewport.startTime + (x - LABEL_WIDTH) / viewport.pxPerTime;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        const factor = e.deltaY < 0 ? 1.2 : 1 / 1.2;
        const mouseTime = xToTime(e.offsetX);
        setViewport(prev => {
          const pxPerTime = prev.pxPerTime * factor;
          return {
            ...prev,
            pxPerTime,
            startTime: mouseTime - (e.offsetX - LABEL_WIDTH) / pxPerTime,
            endTime: mouseTime + (container.clientWidth - LABEL_WIDTH) / pxPerTime - (e.offsetX - LABEL_WIDTH) / pxPerTime,
          };
        });
      } else if (e.shiftKey) {
        const dt = e.deltaY / viewport.pxPerTime;
        setViewport(prev => ({ ...prev, startTime: prev.startTime + dt, endTime: prev.endTime + dt }));
      } else {
        setViewport(prev => ({ ...prev, scrollY: Math.max(0, prev.scrollY + e.deltaY) }));
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (e.offsetX > LABEL_WIDTH) {
        if (e.button === 0 && !e.altKey) {
          setCursor(() => ({ primary: Math.round(xToTime(e.offsetX)), secondary: null }));
        }
        if (e.button === 1 || (e.button === 0 && e.altKey)) {
          isDragging = true;
          dragStartX = e.offsetX;
          dragStartTime = viewport.startTime;
        }
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const dx = e.offsetX - dragStartX;
        const dt = dx / viewport.pxPerTime;
        setViewport(prev => ({
          ...prev,
          startTime: dragStartTime - dt,
          endTime: dragStartTime - dt + (container.clientWidth - LABEL_WIDTH) / prev.pxPerTime,
        }));
      }
    };

    const handleMouseUp = () => { isDragging = false; };
    const handleResize = () => setViewport(prev => ({ ...prev })); // trigger re-render

    container.addEventListener('wheel', handleWheel, { passive: false });
    container.addEventListener('mousedown', handleMouseDown);
    container.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('resize', handleResize);

    return () => {
      container.removeEventListener('wheel', handleWheel);
      container.removeEventListener('mousedown', handleMouseDown);
      container.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('resize', handleResize);
    };
  }, [viewport, setViewport, setCursor]);

  return (
    <div ref={containerRef} style={{ width: '100%', height: 'calc(100vh - 36px)', overflow: 'hidden', cursor: 'crosshair', position: 'relative' }}>
      <canvas ref={canvasRef} style={{ position: 'absolute', top: 0, left: 0 }} />
    </div>
  );
}
