import { useChronamStore } from '../store/useChronamStore';
import { CollapsibleSection } from './CollapsibleSection';
import { EmptyState } from './EmptyState';

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
    padding: '5px 0',
    borderBottom: '1px solid var(--vscode-panel-border,#3c3c3c)',
  },
  label: {
    color: 'var(--vscode-editor-foreground,#d4d4d4)',
    opacity: 0.6,
  },
  value: {
    color: 'var(--vscode-editor-foreground,#d4d4d4)',
    fontWeight: 600,
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 11,
    marginTop: 8,
  },
  th: {
    textAlign: 'left',
    padding: '4px 8px',
    borderBottom: '1px solid var(--vscode-panel-border,#3c3c3c)',
    color: 'var(--vscode-editor-foreground,#d4d4d4)',
    opacity: 0.5,
    fontWeight: 700,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  td: {
    padding: '4px 8px',
    borderBottom: '1px solid var(--vscode-panel-border,#3c3c3c)',
    color: 'var(--vscode-editor-foreground,#d4d4d4)',
    fontSize: 11,
  },
  hoverRow: {
    cursor: 'pointer',
    transition: 'background .1s',
  },
};

const clockDomains = [
  { name: 'clk_100mhz', freq: '100 MHz', period: '10.000 ns', slack: '+0.532 ns', violations: 0 },
  { name: 'clk_50mhz', freq: '50 MHz', period: '20.000 ns', slack: '+5.210 ns', violations: 0 },
  { name: 'spi_clk', freq: '10 MHz', period: '100.000 ns', slack: '+42.100 ns', violations: 0 },
];

export function TimingPanel() {
  const timingSummary = useChronamStore((s) => s.timingSummary);

  return (
    <div style={s.panel}>
      <CollapsibleSection title="Timing Summary">
        <div style={s.row}>
          <span style={s.label}>Worst Slack</span>
          <span style={{ ...s.value, color: timingSummary.slack.startsWith('-') ? '#f44747' : '#4ec9b0' }}>{timingSummary.slack}</span>
        </div>
        <div style={s.row}>
          <span style={s.label}>Critical Path</span>
          <span style={s.value}>{timingSummary.criticalPath}</span>
        </div>
        <div style={s.row}>
          <span style={s.label}>Clock Domains</span>
          <span style={s.value}>{timingSummary.clockDomains}</span>
        </div>
        <div style={s.row}>
          <span style={s.label}>Timing Violations</span>
          <span style={{ ...s.value, color: timingSummary.violations > 0 ? '#f44747' : '#4ec9b0' }}>{timingSummary.violations}</span>
        </div>
      </CollapsibleSection>

      {clockDomains.length > 0 ? (
        <CollapsibleSection title="Clock Domains">
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>Clock</th>
                <th style={s.th}>Freq</th>
                <th style={s.th}>Period</th>
                <th style={s.th}>Slack</th>
                <th style={s.th}>Violations</th>
              </tr>
            </thead>
            <tbody>
              {clockDomains.map((cd) => (
                <tr
                  key={cd.name}
                  style={s.hoverRow}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--vscode-list-hoverBackground,#2a2d2e)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  title={`${cd.name}: ${cd.freq}, slack ${cd.slack}`}
                >
                  <td style={s.td}>{cd.name}</td>
                  <td style={s.td}>{cd.freq}</td>
                  <td style={s.td}>{cd.period}</td>
                  <td style={{ ...s.td, color: cd.violations > 0 ? '#f44747' : '#4ec9b0' }}>{cd.slack}</td>
                  <td style={s.td}>{cd.violations}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CollapsibleSection>
      ) : (
        <EmptyState icon="⌚" text="No timing data" sub="Run synthesis to generate timing analysis" />
      )}
    </div>
  );
}
