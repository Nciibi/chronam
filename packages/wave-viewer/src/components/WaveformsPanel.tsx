import { useWaveStore } from '../store/useWaveStore';
import { Toolbar } from './Toolbar';
import { WaveCanvas } from './WaveCanvas';

export function WaveformsPanel() {
  const waveformData = useWaveStore((s) => s.waveformData);

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
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
          gap: 12,
          fontFamily: '"Cascadia Code","JetBrains Mono","IBM Plex Mono",monospace',
          fontSize: 13,
        }}>
          <div style={{ fontSize: 48 }}>〰</div>
          <p>No waveform data available</p>
          <p style={{ fontSize: 11, opacity: 0.6 }}>Run a simulation to view waveforms</p>
        </div>
      )}
    </div>
  );
}
