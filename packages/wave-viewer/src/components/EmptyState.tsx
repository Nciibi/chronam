const s: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    gap: 8,
    padding: 32,
    textAlign: 'center',
  },
  icon: {
    fontSize: 32,
    lineHeight: 1,
    opacity: 0.25,
    marginBottom: 4,
  },
  text: {
    fontSize: 13,
    color: 'var(--vscode-editor-foreground,#d4d4d4)',
    opacity: 0.5,
    fontFamily: '"Cascadia Code","JetBrains Mono","IBM Plex Mono",monospace',
  },
  sub: {
    fontSize: 11,
    color: 'var(--vscode-editor-foreground,#d4d4d4)',
    opacity: 0.3,
    fontFamily: '"Cascadia Code","JetBrains Mono","IBM Plex Mono",monospace',
    maxWidth: 240,
    lineHeight: '16px',
  },
};

interface Props {
  icon: string;
  text: string;
  sub?: string;
}

export function EmptyState({ icon, text, sub }: Props) {
  return (
    <div style={s.container}>
      <div style={s.icon}>{icon}</div>
      <div style={s.text}>{text}</div>
      {sub && <div style={s.sub}>{sub}</div>}
    </div>
  );
}
