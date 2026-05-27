import { create } from 'zustand';
import type { WaveformData } from '@chronam/shared-types';

interface ViewportState {
  startTime: number;
  endTime: number;
  pxPerTime: number;
  scrollY: number;
}

interface CursorState {
  primary: number | null;
  secondary: number | null;
}

interface WaveStore {
  waveformData: WaveformData | null;
  viewport: ViewportState;
  cursor: CursorState;
  
  // Actions
  setWaveformData: (data: WaveformData) => void;
  setViewport: (updater: (prev: ViewportState) => ViewportState) => void;
  setCursor: (updater: (prev: CursorState) => CursorState) => void;
  fitAll: (canvasWidth: number, labelWidth: number) => void;
}

export const useWaveStore = create<WaveStore>((set) => ({
  waveformData: null,
  viewport: {
    startTime: 0,
    endTime: 100,
    pxPerTime: 1,
    scrollY: 0,
  },
  cursor: {
    primary: null,
    secondary: null,
  },

  setWaveformData: (data) => set({ 
    waveformData: data,
    viewport: {
      startTime: 0,
      endTime: data.endTime || 100,
      pxPerTime: 1,
      scrollY: 0,
    }
  }),
  
  setViewport: (updater) => set((state) => ({ 
    viewport: updater(state.viewport) 
  })),

  setCursor: (updater) => set((state) => ({ 
    cursor: updater(state.cursor) 
  })),

  fitAll: (canvasWidth, labelWidth) => set((state) => {
    if (!state.waveformData) return state;
    const endTime = state.waveformData.endTime || 100;
    return {
      viewport: {
        startTime: 0,
        endTime,
        pxPerTime: (canvasWidth - labelWidth) / endTime,
        scrollY: 0,
      }
    };
  })
}));
