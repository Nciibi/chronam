import type { ReactNode } from 'react';

const s: Record<string, React.CSSProperties> = {
  container: {
    position: 'relative',
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
  },
  overlay: {
    position: 'absolute',
    inset: 0,
    background: 'var(--vscode-editor-background,#1e1e1e)cc',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    zIndex: 10,
  },
  spinner: {
    width: 20,
    height: 20,
    border: '2px solid var(--vscode-panel-border,#3c3c3c)',
    borderTopColor: 'var(--vscode-activityBar-activeBorder,#0e639c)',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  label: {
    fontSize: 11,
    color: 'var(--vscode-editor-foreground,#d4d4d4)',
    opacity: 0.6,
    fontFamily: '"Cascadia Code","JetBrains Mono","IBM Plex Mono",monospace',
  },
};

interface Props {
  loading: boolean;
  label?: string;
  children: ReactNode;
}

export function LoadingOverlay({ loading, label = 'Loading...', children }: Props) {
  return (
    <div style={s.container}>
      {loading && (
        <div style={s.overlay}>
          <div style={s.spinner} />
          <div style={s.label}>{label}</div>
        </div>
      )}
      {children}
    </div>
  );
}
