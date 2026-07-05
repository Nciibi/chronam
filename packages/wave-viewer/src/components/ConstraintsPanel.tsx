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
  constraintItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 8px',
    borderBottom: '1px solid var(--vscode-panel-border,#3c3c3c)',
    cursor: 'pointer',
    transition: 'background .1s',
  },
  icon: { fontSize: 12, opacity: 0.6, width: 20, textAlign: 'center' as const },
  name: { flex: 1, fontSize: 12, color: 'var(--vscode-editor-foreground,#d4d4d4)' },
  detail: { fontSize: 11, opacity: 0.5, color: 'var(--vscode-editor-foreground,#d4d4d4)' },
  badge: { fontSize: 10, padding: '1px 6px', borderRadius: 2, background: 'var(--vscode-panel-border,#3c3c3c)', opacity: 0.6, color: 'var(--vscode-editor-foreground,#d4d4d4)' },
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

const constraints = [
  { name: 'create_clock -period 10 [get_ports clk]', type: 'clock', target: 'clk' },
  { name: 'set_input_delay -clock clk 2 [get_ports data_in]', type: 'input', target: 'data_in' },
  { name: 'set_output_delay -clock clk 3 [get_ports data_out]', type: 'output', target: 'data_out' },
  { name: 'set_false_path -from [get_clocks rst]', type: 'false_path', target: 'rst' },
];

export function ConstraintsPanel() {
  return (
    <div style={s.panel}>
      <div style={s.header}>Timing Constraints</div>
      {constraints.map((c, i) => (
        <div key={i} style={s.constraintItem}
          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--vscode-list-hoverBackground,#2a2d2e)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
        >
          <span style={s.icon}>⊞</span>
          <span style={s.name}>{c.name}</span>
          <span style={s.badge}>{c.type}</span>
        </div>
      ))}
      <button style={s.btn}>+ Add Constraint</button>
    </div>
  );
}
