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
  reportItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 8px',
    borderBottom: '1px solid var(--vscode-panel-border,#3c3c3c)',
    cursor: 'pointer',
    transition: 'background .1s',
  },
  icon: { fontSize: 14, width: 24, textAlign: 'center' as const },
  info: { flex: 1 },
  title: { fontSize: 12, color: 'var(--vscode-editor-foreground,#d4d4d4)' },
  meta: { fontSize: 10, color: 'var(--vscode-editor-foreground,#d4d4d4)', opacity: 0.4, marginTop: 2 },

};

const reportList = [
  { type: 'compilation', title: 'Build Report - counter.vhdl', date: '2026-07-05 14:32', status: 'pass' as const },
  { type: 'simulation', title: 'Simulation Report - counter', date: '2026-07-05 14:33', status: 'pass' as const },
  { type: 'timing', title: 'Timing Analysis - Top Level', date: '2026-07-05 14:34', status: 'warning' as const },
  { type: 'coverage', title: 'Coverage Report', date: '2026-07-05 14:35', status: 'pass' as const },
  { type: 'performance', title: 'Performance Benchmark', date: '2026-07-05 14:30', status: 'fail' as const },
];

const statusIcons: Record<string, string> = {
  pass: '✓',
  fail: '✗',
  warning: '⚠',
};

const statusColors: Record<string, string> = {
  pass: '#4ec9b0',
  fail: '#f44747',
  warning: '#cca700',
};

const typeIcons: Record<string, string> = {
  compilation: '⚙',
  simulation: '▶',
  timing: '⌚',
  coverage: '▤',
  performance: '⚡',
};

export function ReportsPanel() {
  return (
    <div style={s.panel}>
      <div style={s.header}>Reports</div>
      {reportList.map((r, i) => (
        <div key={i} style={s.reportItem}
          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--vscode-list-hoverBackground,#2a2d2e)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
        >
          <span style={s.icon}>{typeIcons[r.type]}</span>
          <div style={s.info}>
            <div style={s.title}>{r.title}</div>
            <div style={s.meta}>{r.date}</div>
          </div>
          <span style={s.badge(statusColors[r.status])}>{statusIcons[r.status]} {r.status.toUpperCase()}</span>
        </div>
      ))}
    </div>
  );
}
