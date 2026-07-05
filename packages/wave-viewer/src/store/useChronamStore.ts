import { create } from 'zustand';

export type PanelId =
  | 'dashboard'
  | 'explorer'
  | 'build'
  | 'simulation'
  | 'waveforms'
  | 'timing'
  | 'constraints'
  | 'hardware'
  | 'ai-assistant'
  | 'reports'
  | 'settings';

export interface ProjectInfo {
  name: string;
  topEntity: string;
  files: number;
  lastSimulation: string | null;
  lastBuild: string | null;
}

export interface BuildState {
  status: 'idle' | 'compiling' | 'elaborating' | 'running' | 'completed' | 'failed';
  output: string[];
  errors: number;
  warnings: number;
}

export interface SimulationState {
  status: 'idle' | 'preparing' | 'compiling' | 'elaborating' | 'running' | 'completed' | 'failed';
  currentTime: string;
  events: number;
  speed: string;
}

export interface TimingSummary {
  slack: string;
  criticalPath: string;
  clockDomains: number;
  violations: number;
}

export interface ReportEntry {
  id: string;
  type: 'compilation' | 'simulation' | 'timing' | 'coverage' | 'performance';
  title: string;
  date: string;
  status: 'pass' | 'fail' | 'warning';
}

interface ChronamStore {
  activePanel: PanelId;
  projectInfo: ProjectInfo;
  buildState: BuildState;
  simulationState: SimulationState;
  timingSummary: TimingSummary;
  reports: ReportEntry[];
  ghdlVersion: string;
  settings: Record<string, any>;

  setActivePanel: (panel: PanelId) => void;
  setProjectInfo: (info: Partial<ProjectInfo>) => void;
  setBuildState: (state: Partial<BuildState>) => void;
  setSimulationState: (state: Partial<SimulationState>) => void;
  setTimingSummary: (summary: Partial<TimingSummary>) => void;
  setReports: (reports: ReportEntry[]) => void;
  setGHDLVersion: (version: string) => void;
  updateSetting: (key: string, value: any) => void;
}

export const useChronamStore = create<ChronamStore>((set) => ({
  activePanel: 'dashboard',
  projectInfo: {
    name: '',
    topEntity: '',
    files: 0,
    lastSimulation: null,
    lastBuild: null,
  },
  buildState: {
    status: 'idle',
    output: [],
    errors: 0,
    warnings: 0,
  },
  simulationState: {
    status: 'idle',
    currentTime: '0 ns',
    events: 0,
    speed: '—',
  },
  timingSummary: {
    slack: '—',
    criticalPath: '—',
    clockDomains: 0,
    violations: 0,
  },
  reports: [],
  ghdlVersion: '',
  settings: {},

  setActivePanel: (panel) => set({ activePanel: panel }),
  setProjectInfo: (info) => set((s) => ({ projectInfo: { ...s.projectInfo, ...info } })),
  setBuildState: (state) => set((s) => ({ buildState: { ...s.buildState, ...state } })),
  setSimulationState: (state) => set((s) => ({ simulationState: { ...s.simulationState, ...state } })),
  setTimingSummary: (summary) => set((s) => ({ timingSummary: { ...s.timingSummary, ...summary } })),
  setReports: (reports) => set({ reports }),
  setGHDLVersion: (version) => set({ ghdlVersion: version }),
  updateSetting: (key, value) => set((s) => ({ settings: { ...s.settings, [key]: value } })),
}));
