import { useWaveStore } from '../store/useWaveStore';
import { postMessage } from '../vscode';

const LABEL_WIDTH = 180;

export function Toolbar() {
  const waveformData = useWaveStore((state) => state.waveformData);
  const viewport = useWaveStore((state) => state.viewport);
  const setViewport = useWaveStore((state) => state.setViewport);
  const fitAll = useWaveStore((state) => state.fitAll);

  const handleZoomIn = () => {
    const center = (viewport.startTime + viewport.endTime) / 2;
    setViewport((prev) => {
      const pxPerTime = prev.pxPerTime * 1.5;
      const w = window.innerWidth - LABEL_WIDTH;
      return {
        ...prev,
        pxPerTime,
        startTime: center - w / pxPerTime / 2,
        endTime: center + w / pxPerTime / 2,
      };
    });
  };

  const handleZoomOut = () => {
    const center = (viewport.startTime + viewport.endTime) / 2;
    setViewport((prev) => {
      const pxPerTime = prev.pxPerTime / 1.5;
      const w = window.innerWidth - LABEL_WIDTH;
      return {
        ...prev,
        pxPerTime,
        startTime: center - w / pxPerTime / 2,
        endTime: center + w / pxPerTime / 2,
      };
    });
  };

  const handleFit = () => {
    fitAll(window.innerWidth, LABEL_WIDTH);
  };

  const handleRerun = () => {
    postMessage({ type: 'simulation:run', config: {} as any });
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '6px 12px',
      background: 'var(--vscode-sideBar-background, #252526)',
      borderBottom: '1px solid var(--vscode-panel-border, #3c3c3c)',
      fontSize: '12px',
      height: '36px'
    }}>
      <button onClick={handleZoomIn} title="Zoom In" style={btnStyle}>🔍+</button>
      <button onClick={handleZoomOut} title="Zoom Out" style={btnStyle}>🔍−</button>
      <button onClick={handleFit} title="Fit All" style={btnStyle}>⊞ Fit</button>
      
      <div style={{ width: '1px', height: '20px', background: 'var(--vscode-panel-border, #3c3c3c)' }}></div>
      
      <button onClick={handleRerun} title="Re-run Simulation" style={btnStyle}>▶ Re-run</button>
      
      <span style={{ opacity: 0.7, fontSize: '11px', marginLeft: 'auto' }}>
        {waveformData 
          ? `${waveformData.signals.length} signals | ${waveformData.endTime} ${waveformData.timescale?.unit || 'ns'}`
          : 'No waveform loaded'}
      </span>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid var(--vscode-panel-border, #3c3c3c)',
  color: 'var(--vscode-editor-foreground, #d4d4d4)',
  padding: '3px 10px',
  borderRadius: '4px',
  cursor: 'pointer',
  fontSize: '11px',
  transition: 'all 0.15s'
};
