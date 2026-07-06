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
    alignItems: 'center',
    padding: '5px 0',
    borderBottom: '1px solid var(--vscode-panel-border,#3c3c3c)',
  },
  label: { color: 'var(--vscode-editor-foreground,#d4d4d4)', opacity: 0.6 },
  value: { color: 'var(--vscode-editor-foreground,#d4d4d4)', fontWeight: 600 },
  badge: { fontSize: 10, padding: '1px 6px', borderRadius: 2, background: '#4ec9b022', color: '#4ec9b0', border: '1px solid #4ec9b0' },
  bar: {
    height: 4,
    borderRadius: 2,
    background: 'var(--vscode-panel-border,#3c3c3c)',
    flex: 1,
    marginLeft: 12,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 2,
    transition: 'width .3s ease',
  },
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
    transition: 'background .12s',
  },
};

const resources = [
  { name: 'LUTs', used: 128, total: 6272, color: '#4ec9b0' },
  { name: 'Flip-Flops', used: 64, total: 12544, color: '#569cd6' },
  { name: 'BRAM', used: 0, total: 20, color: '#ce9178' },
  { name: 'DSP', used: 0, total: 14, color: '#c586c0' },
];

export function HardwarePanel() {
  const ghdlVersion = useChronamStore((s) => s.ghdlVersion);

  return (
    <div style={s.panel}>
      <div style={s.header}>Simulator</div>
      <div style={s.row}>
        <span style={s.label}>Detected</span>
        <span style={s.badge}>{ghdlVersion || 'GHDL 4.1.0'}</span>
      </div>
      <div style={{ marginTop: 16 }}>
        <div style={s.header}>Resource Usage</div>
        {resources.map((r) => {
          const pct = r.total > 0 ? Math.round((r.used / r.total) * 100) : 0;
          return (
            <div key={r.name} style={s.row}>
              <span style={s.label}>{r.name}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, justifyContent: 'flex-end' }}>
                <div style={s.bar}>
                  <div style={{ ...s.barFill, width: `${pct}%`, background: r.color }} />
                </div>
                <span style={{ ...s.value, fontSize: 11, whiteSpace: 'nowrap' }}>{r.used} / {r.total} ({pct}%)</span>
              </div>
            </div>
          );
        })}
      </div>
      <button style={s.btn} title="Refresh hardware device information">⟳ Refresh Device Info</button>
    </div>
  );
}
