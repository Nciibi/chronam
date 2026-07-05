import { useChronamStore } from '../store/useChronamStore';
import { postMessage } from '../vscode';
import { CollapsibleSection } from './CollapsibleSection';
import { EmptyState } from './EmptyState';

const s: Record<string, React.CSSProperties> = {
  panel: {
    padding: 12,
    height: '100%',
    overflow: 'auto',
    fontFamily: '"Cascadia Code","JetBrains Mono","IBM Plex Mono",monospace',
    fontSize: 12,
  },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '4px 0',
    borderBottom: '1px solid var(--vscode-panel-border,#3c3c3c)',
    fontSize: 12,
  },
  label: {
    color: 'var(--vscode-editor-foreground,#d4d4d4)',
    opacity: 0.6,
  },
  value: {
    color: 'var(--vscode-editor-foreground,#d4d4d4)',
    fontWeight: 600,
  },
  btn: {
    background: 'transparent',
    border: '1px solid var(--vscode-panel-border,#3c3c3c)',
    color: 'var(--vscode-editor-foreground,#d4d4d4)',
    padding: '6px 14px',
    cursor: 'pointer',
    fontSize: 12,
    fontFamily: 'inherit',
    width: '100%',
    textAlign: 'left',
    marginBottom: 4,
    transition: 'background .12s',
  },
  statusBadge: {
    display: 'inlineBlock',
    padding: '2px 8px',
    borderRadius: 2,
    fontSize: 10,
    fontWeight: 700,
    fontFamily: 'inherit',
  },
};

export function DashboardPanel() {
  const projectInfo = useChronamStore((s) => s.projectInfo);
  const buildState = useChronamStore((s) => s.buildState);
  const simState = useChronamStore((s) => s.simulationState);
  const timingSummary = useChronamStore((s) => s.timingSummary);
  const setActivePanel = useChronamStore((s) => s.setActivePanel);

  const statusColor = (status: string) => {
    switch (status) {
      case 'completed': return '#4ec9b0';
      case 'failed': return '#f44747';
      case 'running':
      case 'compiling': return '#cca700';
      default: return '#858585';
    }
  };

  return (
    <div style={s.panel}>
      <CollapsibleSection title="Project">
        <div style={s.row}><span style={s.label}>Name</span><span style={s.value}>{projectInfo.name || '—'}</span></div>
        <div style={s.row}><span style={s.label}>Top Entity</span><span style={s.value}>{projectInfo.topEntity || '—'}</span></div>
        <div style={s.row}><span style={s.label}>Files</span><span style={s.value}>{projectInfo.files}</span></div>
        <div style={s.row}><span style={s.label}>Last Build</span><span style={s.value}>{projectInfo.lastBuild || '—'}</span></div>
        <div style={s.row}><span style={s.label}>Last Simulation</span><span style={s.value}>{projectInfo.lastSimulation || '—'}</span></div>
      </CollapsibleSection>

      <CollapsibleSection title="Build">
        <div style={s.row}>
          <span style={s.label}>Status</span>
          <span style={{ ...s.statusBadge, background: statusColor(buildState.status) + '22', color: statusColor(buildState.status), border: '1px solid ' + statusColor(buildState.status) }}>
            {buildState.status.toUpperCase()}
          </span>
        </div>
        <div style={s.row}><span style={s.label}>Errors</span><span style={{ ...s.value, color: buildState.errors > 0 ? '#f44747' : undefined }}>{buildState.errors}</span></div>
        <div style={s.row}><span style={s.label}>Warnings</span><span style={{ ...s.value, color: buildState.warnings > 0 ? '#cca700' : undefined }}>{buildState.warnings}</span></div>
      </CollapsibleSection>

      <CollapsibleSection title="Simulation">
        <div style={s.row}>
          <span style={s.label}>Status</span>
          <span style={{ ...s.statusBadge, background: statusColor(simState.status) + '22', color: statusColor(simState.status), border: '1px solid ' + statusColor(simState.status) }}>
            {simState.status.toUpperCase()}
          </span>
        </div>
        <div style={s.row}><span style={s.label}>Current Time</span><span style={s.value}>{simState.currentTime}</span></div>
        <div style={s.row}><span style={s.label}>Events</span><span style={s.value}>{simState.events.toLocaleString()}</span></div>
      </CollapsibleSection>

      <CollapsibleSection title="Timing">
        <div style={s.row}><span style={s.label}>Slack</span><span style={s.value}>{timingSummary.slack}</span></div>
        <div style={s.row}><span style={s.label}>Violations</span><span style={{ ...s.value, color: timingSummary.violations > 0 ? '#f44747' : '#4ec9b0' }}>{timingSummary.violations}</span></div>
      </CollapsibleSection>

      <CollapsibleSection title="Actions">
        <button style={s.btn} title="Build current project" onClick={() => { setActivePanel('build'); postMessage({ type: 'simulation:run', config: {} as any }); }}>
          ▶ Run Build
        </button>
        <button style={s.btn} title="Run VHDL simulation" onClick={() => { setActivePanel('simulation'); }}>
          ▶ Run Simulation
        </button>
        <button style={s.btn} title="Open waveform viewer" onClick={() => setActivePanel('waveforms')}>
          〰 Open Waveforms
        </button>
      </CollapsibleSection>
    </div>
  );
}
