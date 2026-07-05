import { useState } from 'react';

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
  },
  suggestionChip: {
    display: 'inline-block',
    padding: '3px 8px',
    margin: 2,
    border: '1px solid var(--vscode-panel-border,#3c3c3c)',
    borderRadius: 2,
    fontSize: 10,
    cursor: 'pointer',
    color: 'var(--vscode-editor-foreground,#d4d4d4)',
    opacity: 0.7,
    transition: 'opacity .15s',
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
  const [messages, setMessages] = useState([
    { role: 'ai', text: 'Hello! I can help you with VHDL development, testbenches, simulation, and timing analysis. What would you like to know?' },
  ]);
  const [input, setInput] = useState('');

  const sendMessage = () => {
    if (!input.trim()) return;
    setMessages((prev) => [...prev, { role: 'user', text: input }, { role: 'ai', text: 'I understand your question. Let me analyze your design... (AI assistant integration pending)' }]);
    setInput('');
  };

  return (
    <div style={s.panel}>
      <div style={s.header}>AI Assistant</div>
      <div style={s.header}></div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, marginBottom: 8, flexShrink: 0 }}>
        {suggestions.map((sg) => (
          <span
            key={sg}
            style={s.suggestionChip}
            onClick={() => setInput(sg)}
            onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
            onMouseLeave={(e) => e.currentTarget.style.opacity = '0.7'}
          >
            {sg}
          </span>
        ))}
      </div>
      <div style={s.messages}>
        {messages.map((m, i) => (
          <div key={i} style={{ ...s.msg, ...(m.role === 'user' ? s.userMsg : s.aiMsg) }}>
            {m.text}
          </div>
        ))}
      </div>
      <div style={s.inputRow}>
        <input
          style={s.input}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="Ask anything about your design..."
        />
        <button style={s.btn} onClick={sendMessage}>Send</button>
      </div>
    </div>
  );
}
