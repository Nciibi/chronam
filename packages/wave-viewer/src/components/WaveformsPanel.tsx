import { useWaveStore } from '../store/useWaveStore';
import { Toolbar } from './Toolbar';
import { WaveCanvas } from './WaveCanvas';
import { EmptyState } from './EmptyState';

export function WaveformsPanel() {
  const waveformData = useWaveStore((s) => s.waveformData);

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Toolbar />
      {waveformData ? (
        <WaveCanvas />
      ) : (
        <EmptyState icon="〰" text="No waveform data" sub="Run a simulation to view signal waveforms" />
      )}
    </div>
  );
}
