import { Component, type ReactNode, type ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
  panelName: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

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
    fontSize: 28,
    opacity: 0.3,
  },
  text: {
    fontSize: 13,
    color: 'var(--vscode-editor-foreground,#d4d4d4)',
    opacity: 0.6,
    fontFamily: '"Cascadia Code","JetBrains Mono","IBM Plex Mono",monospace',
  },
  sub: {
    fontSize: 10,
    color: 'var(--vscode-editor-foreground,#d4d4d4)',
    opacity: 0.3,
    fontFamily: '"Cascadia Code","JetBrains Mono","IBM Plex Mono",monospace',
    maxWidth: 280,
    lineHeight: '16px',
    cursor: 'pointer',
  },
};

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[Chronam] ${this.props.panelName} crashed:`, error, info);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={s.container}>
          <div style={s.icon}>⚠</div>
          <div style={s.text}>Panel crashed</div>
          <div style={s.sub}>{this.state.error?.message || 'Unknown error'}</div>
          <div style={s.sub} onClick={this.handleRetry} title="Click to retry">
            ⟳ Retry
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
