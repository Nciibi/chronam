import { useEffect, useCallback, useState, useRef } from 'react';
import { SidebarNav } from './components/SidebarNav';
import { DashboardPanel } from './components/DashboardPanel';
import { ExplorerPanel } from './components/ExplorerPanel';
import { BuildPanel } from './components/BuildPanel';
import { SimulationPanel } from './components/SimulationPanel';
import { WaveformsPanel } from './components/WaveformsPanel';
import { TimingPanel } from './components/TimingPanel';
import { ConstraintsPanel } from './components/ConstraintsPanel';
import { HardwarePanel } from './components/HardwarePanel';
import { AiAssistantPanel } from './components/AiAssistantPanel';
import { ReportsPanel } from './components/ReportsPanel';
import { SettingsPanel } from './components/SettingsPanel';
import { useChronamStore, type PanelId } from './store/useChronamStore';
import { useWaveStore } from './store/useWaveStore';
import { postMessage } from './vscode';

const panelOrder: PanelId[] = [
  'dashboard', 'explorer', 'build', 'simulation', 'waveforms',
  'timing', 'constraints', 'hardware', 'ai-assistant', 'reports', 'settings',
];

const panelComponents: Record<PanelId, React.FC> = {
  dashboard: DashboardPanel,
  explorer: ExplorerPanel,
  build: BuildPanel,
  simulation: SimulationPanel,
  waveforms: WaveformsPanel,
  timing: TimingPanel,
  constraints: ConstraintsPanel,
  hardware: HardwarePanel,
  'ai-assistant': AiAssistantPanel,
  reports: ReportsPanel,
  settings: SettingsPanel,
};

function App() {
  const activePanel = useChronamStore((s) => s.activePanel);
  const setWaveformData = useWaveStore((s) => s.setWaveformData);
  const setActivePanel = useChronamStore((s) => s.setActivePanel);
  const [animKey, setAnimKey] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);

  const navigatePanel = useCallback((dir: -1 | 1) => {
    const idx = panelOrder.indexOf(activePanel);
    const next = (idx + dir + panelOrder.length) % panelOrder.length;
    setActivePanel(panelOrder[next]);
  }, [activePanel, setActivePanel]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const msg = event.data;
      switch (msg.type) {
        case 'waveform:load':
          setWaveformData(msg.data);
          setActivePanel('waveforms');
          break;
        case 'simulation:status':
          useChronamStore.getState().setSimulationState({
            status: msg.status.state,
            currentTime: msg.status.currentTime || '0 ns',
            events: msg.status.events || 0,
          });
          break;
        case 'simulation:config':
          useChronamStore.getState().setProjectInfo({
            name: msg.config?.projectName || '',
            topEntity: msg.config?.topEntity || '',
          });
          break;
        case 'entity:detected':
          if (msg.entities?.length > 0) {
            useChronamStore.getState().setProjectInfo({
              name: msg.entities[0].name,
              topEntity: msg.entities[0].name,
              files: msg.entities.length,
            });
          }
          break;
        case 'panel:navigate':
          if (msg.direction === 'next') navigatePanel(1);
          else if (msg.direction === 'prev') navigatePanel(-1);
          break;
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'Tab') {
        e.preventDefault();
        navigatePanel(e.shiftKey ? -1 : 1);
      }
    };

    window.addEventListener('message', handleMessage);
    window.addEventListener('keydown', handleKeyDown);
    postMessage({ type: 'ready' });

    return () => {
      window.removeEventListener('message', handleMessage);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [setWaveformData, setActivePanel, navigatePanel]);

  useEffect(() => {
    setAnimKey((k) => k + 1);
    panelRef.current?.focus();
  }, [activePanel]);

  const PanelComponent = panelComponents[activePanel];

  return (
    <div style={{
      background: 'var(--vscode-editor-background, #1e1e1e)',
      color: 'var(--vscode-editor-foreground, #d4d4d4)',
      fontFamily: '"Cascadia Code","JetBrains Mono","IBM Plex Mono","Segoe UI",system-ui,sans-serif',
      overflow: 'hidden',
      height: '100%',
      width: '100%',
      display: 'flex',
    }}>
      <SidebarNav onNavigate={navigatePanel} />
      <div
        ref={panelRef}
        tabIndex={-1}
        key={animKey}
        className="panel-fade-in"
        style={{
          flex: 1,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          outline: 'none',
        }}
      >
        <PanelComponent />
      </div>
    </div>
  );
}

export default App;
