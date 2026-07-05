import { useEffect } from 'react';
import { WaveCanvas } from './components/WaveCanvas';
import { Toolbar } from './components/Toolbar';
import { useWaveStore } from './store/useWaveStore';
import { postMessage } from './vscode';

function App() {
  const waveformData = useWaveStore((state) => state.waveformData);
  const setWaveformData = useWaveStore((state) => state.setWaveformData);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const msg = event.data;
      if (msg.type === 'waveform:load') {
        setWaveformData(msg.data);
      }
    };

    window.addEventListener('message', handleMessage);
    
    // Notify VS Code that webview is ready
    postMessage({ type: 'ready' });

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [setWaveformData]);

  return (
    <div style={{
      background: 'var(--vscode-editor-background, #1e1e1e)',
      color: 'var(--vscode-editor-foreground, #d4d4d4)',
      fontFamily: '"Segoe UI", system-ui, sans-serif',
      overflow: 'hidden',
      height: '100%',
      width: '100%',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <Toolbar />
      {waveformData ? (
        <WaveCanvas />
      ) : (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          flex: 1,
          opacity: 0.5,
          gap: '12px'
        }}>
          <div style={{ fontSize: '48px' }}>〰️</div>
          <p style={{ fontSize: '14px' }}>Run a simulation to view waveforms</p>
        </div>
      )}
    </div>
  );
}

export default App;
