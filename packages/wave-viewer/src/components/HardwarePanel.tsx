import { useChronamStore } from '../store/useChronamStore';

const s: Record<string, React.CSSProperties> = {
  panel: {
    padding: 8,
    height: '100%',
    overflow: 'auto',
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
  },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '5px 0',
    borderBottom: '1px solid var(--vscode-panel-border,#3c3c3c)',
  },
  label: { color: 'var(--vscode-editor-foreground,#d4d4d4)', opacity: 0.6 },
  value: { color: 'var(--vscode-editor-foreground,#d4d4d4)', fontWeight: 600 },
  badge: { fontSize: 10, padding: '1px 6px', borderRadius: 2, background: '#4ec9b022', color: '#4ec9b0', border: '1px solid #4ec9b0' },
  btn: {
    background: 'transparent',
    border: '1px solid var(--vscode-panel-border,#3c3c3c)',
    color: 'var(--vscode-editor-foreground,#d4d4d4)',
    padding: '4px 10px',
    cursor: 'pointer',
    fontSize: 11,
    fontFamily: 'inherit',
    width: '100%',
    textAlign: 'center',
    marginTop: 8,
    transition: 'background .15s',
  },
};

export function HardwarePanel() {
  return (
    <div style={s.panel}>
      <div style={s.header}>Hardware Devices</div>
      <div style={s.row}>
        <span style={s.label}>Detected Simulator</span>
        <span style={s.badge}>GHDL 4.1.0</span>
      </div>
      <div style={{ marginTop: 16 }}>
        <div style={s.header}>Resource Usage</div>
        <div style={s.row}><span style={s.label}>LUTs</span><span style={s.value}>128 / 6,272 (2%)</span></div>
        <div style={s.row}><span style={s.label}>Flip-Flops</span><span style={s.value}>64 / 12,544 (1%)</span></div>
        <div style={s.row}><span style={s.label}>BRAM</span><span style={s.value}>0 / 20 (0%)</span></div>
        <div style={s.row}><span style={s.label}>DSP</span><span style={s.value}>0 / 14 (0%)</span></div>
      </div>
      <button style={s.btn}>⟳ Refresh Device Info</button>
    </div>
  );
}
