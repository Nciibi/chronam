// ============================================================================
// Chronam — Theme Manager
// ============================================================================
// Color themes for the waveform renderer, designed to integrate with
// VS Code's light and dark themes.
// ============================================================================

import type { ThemeConfig } from '@chronam/shared-types';
import { DEFAULT_DARK_THEME, DEFAULT_LIGHT_THEME } from '@chronam/shared-types';

export interface RenderColors {
  background: string;
  foreground: string;
  gridLine: string;
  cursorLine: string;
  signalHigh: string;
  signalLow: string;
  signalX: string;
  signalZ: string;
  signalU: string;
  vectorFill: string;
  vectorText: string;
  selectionBg: string;
  headerBg: string;
  divider: string;
  // Derived signal colors for multi-signal views
  signalColors: string[];
}

/** Signal color palette for distinguishing multiple signals */
const SIGNAL_PALETTE_DARK = [
  '#4fc1ff', '#61e294', '#ff79c6', '#f1fa8c',
  '#bd93f9', '#ff6b6b', '#8be9fd', '#ffb86c',
  '#50fa7b', '#ff5555', '#caa9fa', '#6272a4',
];

const SIGNAL_PALETTE_LIGHT = [
  '#0066cc', '#228b22', '#cc0088', '#b8860b',
  '#6a0dad', '#cc3333', '#008b8b', '#cc6600',
  '#2e8b57', '#b22222', '#7b68ee', '#4682b4',
];

export function getColorsFromTheme(theme: ThemeConfig): RenderColors {
  return {
    ...theme.colors,
    signalColors: theme.kind === 'dark' ? SIGNAL_PALETTE_DARK : SIGNAL_PALETTE_LIGHT,
  };
}

export function getDefaultColors(isDark: boolean = true): RenderColors {
  const theme = isDark ? DEFAULT_DARK_THEME : DEFAULT_LIGHT_THEME;
  return getColorsFromTheme(theme);
}
