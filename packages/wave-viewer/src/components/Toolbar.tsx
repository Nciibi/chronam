import { useWaveStore } from '../store/useWaveStore';
import { postMessage } from '../vscode';

const LABEL_W = 200;

const btnS: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid var(--vscode-panel-border,#3c3c3c)',
  color: 'var(--vscode-editor-foreground,#d4d4d4)',
  padding: '3px 10px',
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: 12,
  lineHeight: '20px',
  transition: 'background .15s',
};

const btnActive: React.CSSProperties = {
  ...btnS,
  background: 'var(--vscode-button-background,#0e639c)',
  borderColor: 'var(--vscode-button-hoverBackground,#1177bb)',
};

export function Toolbar() {
  const wf = useWaveStore(s => s.waveformData);
  const vp = useWaveStore(s => s.viewport);
  const cur = useWaveStore(s => s.cursor);
  const play = useWaveStore(s => s.play);
  const setVp = useWaveStore(s => s.setViewport);
  const fit = useWaveStore(s => s.fitAll);
  const togglePlay = useWaveStore(s => s.togglePlay);

  const zoomIn = () => {
    const c = (vp.startTime + vp.endTime) / 2;
    setVp(p => { const px = p.pxPerTime * 1.5; return { ...p, pxPerTime: px, startTime: c - 800 / px / 2, endTime: c + 800 / px / 2 }; });
  };
  const zoomOut = () => {
    const c = (vp.startTime + vp.endTime) / 2;
    setVp(p => { const px = p.pxPerTime / 1.5; return { ...p, pxPerTime: px, startTime: c - 800 / px / 2, endTime: c + 800 / px / 2 }; });
  };
  const fitAll = () => fit(window.innerWidth, LABEL_W);
  const rerun = () => postMessage({ type: 'simulation:run', config: {} as any });

  const endT = wf?.endTime ?? 100;
  const pct = vp.pxPerTime > 0 ? Math.round((vp.endTime - vp.startTime) / endT * 100) : 0;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', height: 38,
      background: 'var(--vscode-sideBar-background,#252526)',
      borderBottom: '1px solid var(--vscode-panel-border,#3c3c3c)', fontSize: 12, flexShrink: 0,
    }}>
      <button onClick={zoomIn} title="Zoom In (Ctrl+Scroll)" style={btnS}>+</button>
      <button onClick={zoomOut} title="Zoom Out (Ctrl+Scroll)" style={btnS}>−</button>
      <button onClick={fitAll} title="Fit All" style={btnS}>Fit</button>
      <span style={{ fontSize: 11, opacity: 0.6, minWidth: 40, textAlign: 'center', fontFamily: 'monospace' }}>{pct}%</span>

      <div style={{ width: 1, height: 22, background: 'var(--vscode-panel-border,#3c3c3c)' }} />

      <button onClick={togglePlay} title={play.playing ? 'Pause' : 'Play (auto-scroll)'} style={play.playing ? btnActive : btnS}>
        {play.playing ? '⏸' : '▶ Play'}
      </button>

      <div style={{ width: 1, height: 22, background: 'var(--vscode-panel-border,#3c3c3c)' }} />

      <button onClick={rerun} title="Re-run Simulation" style={btnS}>↻ Run</button>

      <div style={{ flex: 1 }} />

      <span style={{ fontSize: 12, opacity: 0.9, fontFamily: 'monospace', fontWeight: 500 }}>
        {cur.primary !== null ? `@ ${cur.primary} ns` : ''}
      </span>

      <span style={{ fontSize: 11, opacity: 0.6 }}>
        {wf ? (wf.signals.length + ' sigs | ' + wf.endTime + ' ' + (wf.timescale?.unit || 'ns')) : 'No waveform'}
      </span>
    </div>
  );
}
