import { useState, type ReactNode } from 'react';

const s: Record<string, React.CSSProperties> = {
  header: {
    fontSize: 10,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '1px',
    color: 'var(--vscode-editor-foreground,#d4d4d4)',
    opacity: 0.5,
    marginBottom: 8,
    paddingBottom: 4,
    paddingTop: 4,
    borderBottom: '1px solid var(--vscode-panel-border,#3c3c3c)',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    cursor: 'pointer',
    userSelect: 'none',
    transition: 'opacity .12s',
  },
  caret: {
    fontSize: 8,
    transition: 'transform .12s',
    lineHeight: '14px',
  },
};

interface Props {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}

export function CollapsibleSection({ title, defaultOpen = true, children }: Props) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div style={{ marginBottom: open ? 16 : 4 }}>
      <div
        style={s.header}
        onClick={() => setOpen((v) => !v)}
        onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
        onMouseLeave={(e) => e.currentTarget.style.opacity = '0.5'}
        title={open ? `Collapse ${title}` : `Expand ${title}`}
      >
        <span style={{ ...s.caret, transform: open ? 'rotate(90deg)' : 'rotate(0deg)', display: 'inline-block' }}>▶</span>
        {title}
      </div>
      {open && children}
    </div>
  );
}
