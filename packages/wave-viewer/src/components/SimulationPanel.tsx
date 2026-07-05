import { useChronamStore } from '../store/useChronamStore';
import { postMessage } from '../vscode';
import { EmptyState } from './EmptyState';

const s: Record<string, React.CSSProperties> = {
  panel: {
    padding: 8,
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: '"Cascadia Code","JetBrains Mono","IBM Plex Mono",monospace',
    fontSize: 12,
  },
  header: {
    fontSize: 10,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '1px',
    color: 'var(--vscode-editor-foreground,#d4d4d4)',
    opacity: 0.5,
    marginBottom: 8,
    paddingBottom: 4,
    borderBottom: '1px solid var(--vscode-panel-border,#3c3c3c)',
    flexShrink: 0,
  },
  controls: {
    display: 'grid',
    gridTemplateColumns: 'repeat(5, 1fr)',
    gap: 4,
    marginBottom: 12,
    flexShrink: 0,
  },
  btn: {
    background: 'transparent',
    border: '1px solid var(--vscode-panel-border,#3c3c3c)',
    color: 'var(--vscode-editor-foreground,#d4d4d4)',
    padding: '6px 0',
    cursor: 'pointer',
    fontSize: 12,
    fontFamily: 'inherit',
    textAlign: 'center',
    transition: 'background .12s',
  },
  btnActive: {
    background: '#0e639c',
    border: '1px solid #1177bb',
    color: '#fff',
    padding: '6px 0',
    cursor: 'pointer',
    fontSize: 12,
    fontFamily: 'inherit',
    textAlign: 'center',
  },
  infoGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '2px 16px',
    marginBottom: 12,
    flexShrink: 0,
  },
  infoLabel: {
    fontSize: 11,
    color: 'var(--vscode-editor-foreground,#d4d4d4)',
    opacity: 0.5,
  },
  infoValue: {
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--vscode-editor-foreground,#d4d4d4)',
    textAlign: 'right',
  },
  log: {
    flex: 1,
    background: 'var(--vscode-terminal-background,#1e1e1e)',
    border: '1px solid var(--vscode-panel-border,#3c3c3c)',
    padding: 8,
    overflow: 'auto',
    fontSize: 11,
    lineHeight: '18px',
    color: 'var(--vscode-terminal-foreground,#cccccc)',
    whiteSpace: 'pre-wrap',
    fontFamily: 'inherit',
  },
};

export function SimulationPanel() {
  const simState = useChronamStore((s) => s.simulationState);

  return (
    <div style={s.panel}>
      <div style={s.header}>Simulation Controls</div>
      <div style={s.controls}>
        <button style={simState.status === 'running' ? s.btnActive : s.btn} title="Run simulation" onClick={() => postMessage({ type: 'simulation:run', config: {} as any })}>
          ▶ Run
        </button>
        <button style={s.btn} title="Pause simulation">⏸ Pause</button>
        <button style={s.btn} title="Resume simulation">▶ Resume</button>
        <button style={s.btn} title="Restart simulation">⟳ Restart</button>
        <button style={s.btn} title="Stop simulation">■ Stop</button>
      </div>
      <div style={s.controls}>
        <button style={s.btn} title="Step one time unit">⏪ Step</button>
        <button style={s.btn} title="Step over">⏩ Step Over</button>
        <button style={s.btn} title="Step into">↕ Step Into</button>
      </div>
      {simState.status === 'idle' ? (
        <EmptyState icon="▶" text="No simulation running" sub="Click Run to start a simulation" />
      ) : (
        <>
          <div style={s.infoGrid}>
            <span style={s.infoLabel}>Simulation Time</span>
            <span style={s.infoValue}>{simState.currentTime}</span>
            <span style={s.infoLabel}>Events</span>
            <span style={s.infoValue}>{simState.events.toLocaleString()}</span>
            <span style={s.infoLabel}>Speed</span>
            <span style={s.infoValue}>{simState.speed}</span>
            <span style={s.infoLabel}>Status</span>
            <span style={{ ...s.infoValue, textTransform: 'uppercase', color: simState.status === 'failed' ? '#f44747' : simState.status === 'completed' ? '#4ec9b0' : undefined }}>
              {simState.status}
            </span>
          </div>
          <div style={s.header}>Simulation Log</div>
          <div style={s.log}>
            {['> Analyzing design units...', '> Elaborating entity counter...', '> Running simulation...', '  Time: 0 ns | Events: 0', '  Time: 500 ns | Events: 1250', '  Time: 1000 ns | Events: 2500'].map((line, i) => (
              <div key={i}>{line}</div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
