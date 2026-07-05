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
    padding: '6px 0',
    borderBottom: '1px solid var(--vscode-panel-border,#3c3c3c)',
  },
  label: {
    color: 'var(--vscode-editor-foreground,#d4d4d4)',
    fontSize: 12,
  },
  desc: {
    color: 'var(--vscode-editor-foreground,#d4d4d4)',
    fontSize: 10,
    opacity: 0.4,
    marginTop: 2,
  },
  select: {
    background: 'var(--vscode-dropdown-background,#3c3c3c)',
    color: 'var(--vscode-dropdown-foreground,#cccccc)',
    border: '1px solid var(--vscode-panel-border,#3c3c3c)',
    padding: '3px 6px',
    fontSize: 11,
    fontFamily: 'inherit',
    outline: 'none',
  },
  input: {
    width: 60,
    background: 'var(--vscode-input-background,#3c3c3c)',
    color: 'var(--vscode-input-foreground,#cccccc)',
    border: '1px solid var(--vscode-panel-border,#3c3c3c)',
    padding: '3px 6px',
    fontSize: 11,
    fontFamily: 'inherit',
    textAlign: 'right',
    outline: 'none',
  },
  toggle: {
    width: 36,
    height: 18,
    borderRadius: 9,
    border: 'none',
    cursor: 'pointer',
    position: 'relative' as const,
    transition: 'background .2s',
  },
  toggleKnob: {
    width: 14,
    height: 14,
    borderRadius: 7,
    background: '#fff',
    position: 'absolute' as const,
    top: 2,
    transition: 'left .2s',
  },
};

function Toggle({ value, title }: { value: boolean; title?: string }) {
  return (
    <button title={title || `Toggle ${value ? 'off' : 'on'}`} style={{ ...s.toggle, background: value ? '#0e639c' : '#3c3c3c' }}>
      <div style={{ ...s.toggleKnob, left: value ? 20 : 2 }} />
    </button>
  );
}

export function SettingsPanel() {
  return (
    <div style={s.panel}>
      <div style={s.header}>Simulator</div>
      <div style={s.row}>
        <div><div style={s.label}>Preferred Simulator</div><div style={s.desc}>VHDL simulator backend</div></div>
        <select style={s.select} defaultValue="ghdl">
          <option value="ghdl">GHDL</option>
          <option value="modelsim" disabled>ModelSim (coming soon)</option>
        </select>
      </div>
      <div style={s.row}>
        <div><div style={s.label}>VHDL Standard</div><div style={s.desc}>Default VHDL language version</div></div>
        <select style={s.select} defaultValue="2008">
          <option value="1987">1987</option>
          <option value="1993">1993</option>
          <option value="2002">2002</option>
          <option value="2008">2008</option>
        </select>
      </div>
      <div style={s.row}>
        <div><div style={s.label}>Default Duration</div><div style={s.desc}>Simulation time in nanoseconds</div></div>
        <input style={s.input} type="number" defaultValue={1000} />
      </div>

      <div style={{ ...s.header, marginTop: 16 }}>Waveform Viewer</div>
      <div style={s.row}>
        <div><div style={s.label}>Signal Height</div><div style={s.desc}>Row height in pixels</div></div>
        <input style={s.input} type="number" defaultValue={38} />
      </div>
      <div style={s.row}>
        <div><div style={s.label}>Default Format</div><div style={s.desc}>Vector signal display format</div></div>
        <select style={s.select} defaultValue="hex">
          <option value="hex">Hexadecimal</option>
          <option value="binary">Binary</option>
          <option value="decimal">Decimal</option>
          <option value="unsigned">Unsigned</option>
          <option value="signed">Signed</option>
        </select>
      </div>

      <div style={{ ...s.header, marginTop: 16 }}>General</div>
      <div style={s.row}>
        <div><div style={s.label}>Auto-open Wave Viewer</div><div style={s.desc}>Open waveform after simulation</div></div>
        <Toggle value={true} />
      </div>
      <div style={s.row}>
        <div><div style={s.label}>Live Preview</div><div style={s.desc}>Auto-re-run on file save</div></div>
        <Toggle value={true} />
      </div>

      <div style={{ ...s.header, marginTop: 16 }}>Information</div>
      <div style={s.row}>
        <div><div style={s.label}>Version</div></div>
        <span style={{ fontSize: 11, opacity: 0.6, color: 'var(--vscode-editor-foreground,#d4d4d4)' }}>Chronam v0.1.0</span>
      </div>
      <div style={s.row}>
        <div><div style={s.label}>GHDL</div></div>
        <span style={{ fontSize: 11, opacity: 0.6, color: 'var(--vscode-editor-foreground,#d4d4d4)' }}>4.1.0</span>
      </div>
    </div>
  );
}
