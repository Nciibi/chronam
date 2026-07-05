import { useEffect } from 'react';
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
import { useChronamStore } from './store/useChronamStore';
import { useWaveStore } from './store/useWaveStore';
import { postMessage } from './vscode';
import type { PanelId } from './store/useChronamStore';

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
      }
    };

    window.addEventListener('message', handleMessage);
    postMessage({ type: 'ready' });

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [setWaveformData, setActivePanel]);

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
      <SidebarNav />
      <div style={{
        flex: 1,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
      }}>
        <PanelComponent />
      </div>
    </div>
  );
}

export default App;
