import type { PanelId } from '../store/useChronamStore';
import { useChronamStore } from '../store/useChronamStore';

interface NavItem {
  id: PanelId;
  label: string;
  icon: string;
}

const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '◉' },
  { id: 'explorer', label: 'Explorer', icon: '◲' },
  { id: 'build', label: 'Build', icon: '⚙' },
  { id: 'simulation', label: 'Simulation', icon: '▶' },
  { id: 'waveforms', label: 'Waveforms', icon: '〰' },
  { id: 'timing', label: 'Timing', icon: '⌚' },
  { id: 'constraints', label: 'Constraints', icon: '⊞' },
  { id: 'hardware', label: 'Hardware', icon: '◈' },
  { id: 'ai-assistant', label: 'AI Assistant', icon: '✦' },
  { id: 'reports', label: 'Reports', icon: '▤' },
  { id: 'settings', label: 'Settings', icon: '⚑' },
];

const s: Record<string, React.CSSProperties> = {
  container: {
    width: 48,
    background: 'var(--vscode-activityBar-background,#1e1e1e)',
    borderRight: '1px solid var(--vscode-panel-border,#3c3c3c)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    paddingTop: 4,
    gap: 2,
    flexShrink: 0,
    userSelect: 'none',
  },
  item: {
    width: 40,
    height: 36,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    borderRadius: 4,
    fontSize: 16,
    color: 'var(--vscode-activityBar-inactiveForeground,#858585)',
    transition: 'color .15s, background .15s',
    position: 'relative',
  },
  active: {
    color: 'var(--vscode-activityBar-activeForeground,#ffffff)',
    background: 'var(--vscode-activityBar-activeBorder,#0e639c)22',
  },
  indicator: {
    position: 'absolute',
    left: 0,
    top: 6,
    width: 2,
    height: 24,
    background: 'var(--vscode-activityBar-activeBorder,#0e639c)',
    borderRadius: '0 2px 2px 0',
  },
};

export function SidebarNav() {
  const activePanel = useChronamStore((s) => s.activePanel);
  const setActivePanel = useChronamStore((s) => s.setActivePanel);

  return (
    <div style={s.container}>
      {navItems.map((item) => {
        const isActive = item.id === activePanel;
        return (
          <div
            key={item.id}
            style={{ ...s.item, ...(isActive ? s.active : {}) }}
            onClick={() => setActivePanel(item.id)}
            title={item.label}
          >
            {isActive && <div style={s.indicator} />}
            <span>{item.icon}</span>
          </div>
        );
      })}
    </div>
  );
}
