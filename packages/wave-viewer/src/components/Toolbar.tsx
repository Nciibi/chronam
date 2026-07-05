import { useWaveStore } from '../store/useWaveStore';
import { postMessage } from '../vscode';

const LABEL_W = 180;

export function Toolbar() {
  const wf = useWaveStore(s => s.waveformData);
  const vp = useWaveStore(s => s.viewport);
  const cur = useWaveStore(s => s.cursor);
  const setVp = useWaveStore(s => s.setViewport);
  const fit = useWaveStore(s => s.fitAll);

  const zoomIn = () => {
    const c = (vp.startTime + vp.endTime) / 2;
    setVp(p => { const px = p.pxPerTime * 1.5; return { ...p, pxPerTime: px, startTime: c - window.innerWidth / px / 2, endTime: c + window.innerWidth / px / 2 }; });
  };
  const zoomOut = () => {
    const c = (vp.startTime + vp.endTime) / 2;
    setVp(p => { const px = p.pxPerTime / 1.5; return { ...p, pxPerTime: px, startTime: c - window.innerWidth / px / 2, endTime: c + window.innerWidth / px / 2 }; });
  };
  const fitAll = () => fit(window.innerWidth, LABEL_W);
  const rerun = () => postMessage({ type: 'simulation:run', config: {} as any });

  const endT = wf?.endTime ?? 100;
  const pct = vp.pxPerTime > 0 ? Math.round((vp.endTime - vp.startTime) / endT * 100) : 0;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', height: 32,
      background: 'var(--vscode-sideBar-background,#252526)',
      borderBottom: '1px solid var(--vscode-panel-border,#3c3c3c)', fontSize: '12px', flexShrink: 0,
    }}>
      <button onClick={zoomIn} title="Zoom In (Ctrl+Scroll)" style={btnS}>+</button>
      <button onClick={zoomOut} title="Zoom Out (Ctrl+Scroll)" style={btnS}>−</button>
      <button onClick={fitAll} title="Fit All" style={btnS}>Fit</button>
      <span style={{ fontSize: 10, opacity: 0.6, minWidth: 36, textAlign: 'center' }}>{pct}%</span>

      <div style={{ width: 1, height: 18, background: 'var(--vscode-panel-border,#3c3c3c)' }} />

      <button onClick={rerun} title="Re-run Simulation" style={btnS}>▶ Run</button>

      <div style={{ flex: 1 }} />

      {/* Cursor time readout */}
      <span style={{ fontSize: 11, opacity: 0.8, fontFamily: 'monospace' }}>
        {cur.primary !== null ? `@ ${cur.primary} ns` : ''}
      </span>

      <span style={{ fontSize: 11, opacity: 0.6 }}>
        {wf ? (wf.signals.length + ' sigs | ' + wf.endTime + ' ' + (wf.timescale?.unit || 'ns')) : 'No waveform'}
      </span>
    </div>
  );
}

const btnS: React.CSSProperties = {
  background: 'transparent', border: '1px solid var(--vscode-panel-border,#3c3c3c)',
  color: 'var(--vscode-editor-foreground,#d4d4d4)', padding: '2px 8px',
  borderRadius: 3, cursor: 'pointer', fontSize: 11, lineHeight: '18px',
};
