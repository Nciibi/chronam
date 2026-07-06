import { useState, useRef, useEffect } from 'react';
import { useChronamStore } from '../store/useChronamStore';
import { postMessage } from '../vscode';
import { LoadingOverlay } from './LoadingOverlay';

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
  messages: {
    flex: 1,
    overflow: 'auto',
    marginBottom: 8,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  msg: {
    padding: '6px 8px',
    borderRadius: 2,
    fontSize: 11,
    lineHeight: '18px',
  },
  userMsg: {
    background: 'var(--vscode-textBlockQuote-background,#2a2d2e)',
    color: 'var(--vscode-editor-foreground,#d4d4d4)',
    borderLeft: '2px solid #0e639c',
  },
  aiMsg: {
    background: 'var(--vscode-terminal-background,#1e1e1e)',
    color: 'var(--vscode-terminal-foreground,#cccccc)',
    borderLeft: '2px solid #4ec9b0',
  },
  inputRow: {
    display: 'flex',
    gap: 4,
    flexShrink: 0,
  },
  input: {
    flex: 1,
    background: 'var(--vscode-input-background,#3c3c3c)',
    color: 'var(--vscode-input-foreground,#cccccc)',
    border: '1px solid var(--vscode-panel-border,#3c3c3c)',
    padding: '6px 8px',
    fontFamily: 'inherit',
    fontSize: 12,
    outline: 'none',
  },
  btn: {
    background: 'transparent',
    border: '1px solid var(--vscode-panel-border,#3c3c3c)',
    color: 'var(--vscode-editor-foreground,#d4d4d4)',
    padding: '4px 12px',
    cursor: 'pointer',
    fontSize: 12,
    fontFamily: 'inherit',
    transition: 'background .12s',
  },
  suggestionChip: {
    display: 'inline-block',
    padding: '3px 8px',
    border: '1px solid var(--vscode-panel-border,#3c3c3c)',
    borderRadius: 2,
    fontSize: 10,
    cursor: 'pointer',
    color: 'var(--vscode-editor-foreground,#d4d4d4)',
    opacity: 0.7,
    transition: 'opacity .12s',
    fontFamily: 'inherit',
  },
};

const suggestions = [
  'Explain this VHDL code',
  'Generate a testbench',
  'Fix simulation errors',
  'Optimize timing path',
];

export function AiAssistantPanel() {
  const projectInfo = useChronamStore((s) => s.projectInfo);
  const [messages, setMessages] = useState([
    { role: 'ai', text: `Hello! I can help you with VHDL development, testbenches, simulation, and timing analysis. ${projectInfo.topEntity ? `I see you're working on \`${projectInfo.topEntity}\`. ` : ''}What would you like to know?` },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = () => {
    if (!input.trim() || loading) return;
    setMessages((prev) => [...prev, { role: 'user', text: input }]);
    setInput('');
    setLoading(true);
    postMessage({ type: 'ai:query', text: input });
    setTimeout(() => {
      setMessages((prev) => [...prev, { role: 'ai', text: 'I understand your question. Let me analyze your design... (AI assistant integration pending)' }]);
      setLoading(false);
    }, 600);
  };

  return (
    <div style={s.panel}>
      <div style={s.header}>AI Assistant</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, marginBottom: 8, flexShrink: 0 }}>
        {suggestions.map((sg) => (
          <span
            key={sg}
            style={s.suggestionChip}
            onClick={() => setInput(sg)}
            onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
            onMouseLeave={(e) => e.currentTarget.style.opacity = '0.7'}
            title={`Ask: ${sg}`}
          >
            {sg}
          </span>
        ))}
      </div>
      <LoadingOverlay loading={loading} label="Thinking...">
        <div style={s.messages}>
          {messages.length === 0 && (
            <div style={{ textAlign: 'center', opacity: 0.3, padding: 32, fontSize: 12 }}>
              No messages yet. Ask a question above.
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} style={{ ...s.msg, ...(m.role === 'user' ? s.userMsg : s.aiMsg) }}>
              <span style={{ fontSize: 9, fontWeight: 700, opacity: 0.4, display: 'block', marginBottom: 2 }}>
                {m.role === 'user' ? 'YOU' : 'AI'}
              </span>
              {m.text}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </LoadingOverlay>
      <div style={s.inputRow}>
        <input
          style={s.input}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="Ask anything about your design..."
          disabled={loading}
          title="Type a message and press Enter to send"
        />
        <button style={s.btn} onClick={sendMessage} title="Send message" disabled={loading}>
          {loading ? '...' : 'Send'}
        </button>
      </div>
    </div>
  );
}
