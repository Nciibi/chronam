import { create } from 'zustand';
import type { WaveformData } from '@chronam/shared-types';

export interface ViewportState {
  startTime: number;
  endTime: number;
  pxPerTime: number;
  scrollY: number;
}

export interface CursorState {
  primary: number | null;
  secondary: number | null;
}

export interface PlayState {
  playing: boolean;
  speed: number;
  currentTime: number;
}

interface WaveStore {
  waveformData: WaveformData | null;
  viewport: ViewportState;
  cursor: CursorState;
  play: PlayState;

  setWaveformData: (data: WaveformData) => void;
  setViewport: (updater: (prev: ViewportState) => ViewportState) => void;
  setCursor: (updater: (prev: CursorState) => CursorState) => void;
  fitAll: (canvasWidth: number, labelWidth: number) => void;
  togglePlay: () => void;
  setPlaySpeed: (speed: number) => void;
  setPlayCurrentTime: (t: number) => void;
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
  play: {
    playing: false,
    speed: 1,
    currentTime: 0,
  },

  setWaveformData: (data) => set({
    waveformData: {
      ...data,
      signals: (() => {
        const sigs = data.signals;
        const hasDeep = sigs.some(s => s.hierarchyPath.length > 1);
        return hasDeep ? sigs.filter(s => s.hierarchyPath.length > 1) : sigs;
      })(),
    },
    viewport: {
      startTime: 0,
      endTime: data.endTime || 100,
      pxPerTime: 1,
      scrollY: 0,
    },
    cursor: { primary: null, secondary: null },
    play: { playing: false, speed: 1, currentTime: 0 },
  }),

  setViewport: (updater) => set((state) => ({
    viewport: updater(state.viewport),
  })),

  setCursor: (updater) => set((state) => ({
    cursor: updater(state.cursor),
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
      },
      play: { ...state.play, currentTime: 0 },
    };
  }),

  togglePlay: () => set((state) => ({
    play: { ...state.play, playing: !state.play.playing },
  })),

  setPlaySpeed: (speed) => set((state) => ({
    play: { ...state.play, speed },
  })),

  setPlayCurrentTime: (t) => set((state) => ({
    play: { ...state.play, currentTime: t },
  })),
}));
