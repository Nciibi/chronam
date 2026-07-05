import { useChronamStore } from '../store/useChronamStore';
import { postMessage } from '../vscode';

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
  toolbar: {
    display: 'flex',
    gap: 4,
    marginBottom: 8,
    flexShrink: 0,
  },
  btn: {
    background: 'transparent',
    border: '1px solid var(--vscode-panel-border,#3c3c3c)',
    color: 'var(--vscode-editor-foreground,#d4d4d4)',
    padding: '4px 10px',
    cursor: 'pointer',
    fontSize: 11,
    fontFamily: 'inherit',
    transition: 'background .15s',
  },
  btnActive: {
    background: 'var(--vscode-button-background,#0e639c)',
    border: '1px solid var(--vscode-button-hoverBackground,#1177bb)',
    color: '#ffffff',
    padding: '4px 10px',
    cursor: 'pointer',
    fontSize: 11,
    fontFamily: 'inherit',
  },
  output: {
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
  statRow: {
    display: 'flex',
    gap: 16,
    padding: '4px 0',
    flexShrink: 0,
  },
  stat: {
    fontSize: 11,
    color: 'var(--vscode-editor-foreground,#d4d4d4)',
    opacity: 0.7,
  },
  statVal: {
    fontWeight: 700,
    color: 'var(--vscode-editor-foreground,#d4d4d4)',
  },
};

const mockOutput = [
  '> ghdl -a --std=08 counter.vhdl',
  '> ghdl -e --std=08 counter',
  '> ghdl -r --std=08 counter --vcd=.chronam/counter.vcd',
  '  Simulation complete: 8 signals (1000ns simulated)',
];

export function BuildPanel() {
  const buildState = useChronamStore((s) => s.buildState);

  return (
    <div style={s.panel}>
      <div style={s.header}>Build</div>
      <div style={s.toolbar}>
        <button
          style={buildState.status === 'running' ? s.btnActive : s.btn}
          onClick={() => postMessage({ type: 'simulation:run', config: {} as any })}
        >
          {buildState.status === 'running' ? '⏳ Building...' : '▶ Build'}
        </button>
        <button style={s.btn} onClick={() => postMessage({ type: 'simulation:run', config: {} as any })}>
          ↻ Rebuild
        </button>
        <button style={s.btn}>■ Stop</button>
        <button style={s.btn}>✕ Clear</button>
      </div>
      <div style={s.statRow}>
        <span style={s.stat}>Errors: <span style={{ ...s.statVal, color: buildState.errors > 0 ? '#f44747' : '#4ec9b0' }}>{buildState.errors}</span></span>
        <span style={s.stat}>Warnings: <span style={{ ...s.statVal, color: buildState.warnings > 0 ? '#cca700' : '#4ec9b0' }}>{buildState.warnings}</span></span>
        <span style={s.stat}>Status: <span style={{ ...s.statVal, textTransform: 'uppercase' }}>{buildState.status}</span></span>
      </div>
      <div style={s.output}>
        {mockOutput.map((line, i) => (
          <div key={i}>{line}</div>
        ))}
      </div>
    </div>
  );
}
