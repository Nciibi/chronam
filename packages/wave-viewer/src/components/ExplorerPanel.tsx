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
    padding: '4px 4px 4px 0',
    borderBottom: '1px solid var(--vscode-panel-border,#3c3c3c)',
  },
  fileItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '4px 8px',
    cursor: 'pointer',
    borderRadius: 2,
    transition: 'background .1s',
    color: 'var(--vscode-editor-foreground,#d4d4d4)',
  },
  icon: {
    width: 16,
    textAlign: 'center' as const,
    fontSize: 12,
    opacity: 0.7,
  },
  name: {
    flex: 1,
    fontSize: 12,
  },
  badge: {
    fontSize: 10,
    padding: '1px 6px',
    borderRadius: 2,
    background: 'var(--vscode-panel-border,#3c3c3c)',
    color: 'var(--vscode-editor-foreground,#d4d4d4)',
    opacity: 0.6,
  },
};

const mockFiles = [
  { name: 'counter.vhdl', type: 'entity' },
  { name: 'tb_counter.vhdl', type: 'testbench' },
  { name: 'alu.vhd', type: 'entity' },
  { name: 'tb_alu.vhd', type: 'testbench' },
  { name: 'top.sdc', type: 'constraints' },
];

export function ExplorerPanel() {
  const setActivePanel = useChronamStore((s) => s.setActivePanel);

  return (
    <div style={s.panel}>
      <div style={s.header}>Project Files</div>
      {mockFiles.map((file) => (
        <div
          key={file.name}
          style={s.fileItem}
          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--vscode-list-hoverBackground,#2a2d2e)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
        >
          <span style={s.icon}>{file.type === 'entity' ? '◇' : file.type === 'testbench' ? '▰' : '⊞'}</span>
          <span style={s.name}>{file.name}</span>
          <span style={s.badge}>{file.type}</span>
        </div>
      ))}
      <div style={{ marginTop: 16 }}>
        <div style={s.header}>Quick Actions</div>
        <div
          style={{ ...s.fileItem, marginTop: 4 }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--vscode-list-hoverBackground,#2a2d2e)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          onClick={() => setActivePanel('build')}
        >
          <span style={s.icon}>+</span>
          <span style={s.name}>Add Files to Project</span>
        </div>
      </div>
    </div>
  );
}
