// ============================================================================
// Chronam — Waveform Canvas Renderer
// ============================================================================
// High-performance Canvas 2D renderer for digital waveforms. Renders:
// - Signal labels with hierarchy
// - Time ruler with adaptive tick spacing
// - Digital waveforms (scalar: high/low, vector: hex boxes)
// - Grid lines
// - Cursors with delta measurement
//
// Architecture:
//   WaveformData → Viewport → Renderer → Canvas draw calls
//
// Only visible signals and visible time ranges are rendered (virtualized).
// ============================================================================

import type {
  WaveformData,
  WaveformSignal,
  SignalTransition,
  CursorState,
  SignalDisplayConfig,
  SignalDisplayFormat,
} from '@chronam/shared-types';
import { formatSignalValue, formatTime } from '@chronam/shared-types';
import { Viewport } from './viewport.js';
import type { RenderColors } from './themes.js';
import { getDefaultColors } from './themes.js';

/** Configuration for the renderer */
export interface RendererConfig {
  signalHeight: number;
  labelWidth: number;
  rulerHeight: number;
  fontSize: number;
  fontFamily: string;
  signalPadding: number;
  transitionWidth: number;
}

const DEFAULT_CONFIG: RendererConfig = {
  signalHeight: 30,
  labelWidth: 200,
  rulerHeight: 32,
  fontSize: 11,
  fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
  signalPadding: 4,
  transitionWidth: 2,
};

/**
 * Main waveform renderer. Call render() on each animation frame
 * when viewport or data changes.
 */
export class WaveformRenderer {
  private ctx: CanvasRenderingContext2D;
  private data: WaveformData | null = null;
  private viewport: Viewport | null = null;
  private config: RendererConfig;
  private colors: RenderColors;
  private cursor: CursorState = { primary: null, secondary: null };
  private signalConfigs: Map<string, SignalDisplayConfig> = new Map();
  private dpr: number = 1;

  constructor(
    canvas: HTMLCanvasElement,
    config?: Partial<RendererConfig>,
    colors?: RenderColors
  ) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get 2D rendering context');

    this.ctx = ctx;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.colors = colors ?? getDefaultColors(true);

    // Handle HiDPI displays
    this.dpr = window.devicePixelRatio || 1;
  }

  /** Update the waveform data and recalculate viewport */
  setData(data: WaveformData): void {
    this.data = data;
    this.viewport = new Viewport(
      { minTime: 0, maxTime: data.endTime, totalSignals: data.signals.length },
      this.ctx.canvas.width / this.dpr,
      this.ctx.canvas.height / this.dpr,
      this.config.signalHeight,
      this.config.labelWidth
    );
  }

  /** Update theme colors */
  setColors(colors: RenderColors): void {
    this.colors = colors;
  }

  /** Update cursor positions */
  setCursor(cursor: CursorState): void {
    this.cursor = cursor;
  }

  /** Get the viewport for external zoom/pan control */
  getViewport(): Viewport | null {
    return this.viewport;
  }

  /** Resize the canvas (call on window/container resize) */
  resize(width: number, height: number): void {
    const canvas = this.ctx.canvas;
    canvas.width = width * this.dpr;
    canvas.height = height * this.dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    this.ctx.scale(this.dpr, this.dpr);
    this.viewport?.resize(width, height);
  }

  /** Main render method — call on requestAnimationFrame */
  render(): void {
    if (!this.data || !this.viewport) return;

    const { ctx, colors } = this;
    const width = ctx.canvas.width / this.dpr;
    const height = ctx.canvas.height / this.dpr;

    // Clear
    ctx.fillStyle = colors.background;
    ctx.fillRect(0, 0, width, height);

    // Save state
    ctx.save();

    // Render layers bottom-to-top
    this.renderGrid(width, height);
    this.renderSignals(width, height);
    this.renderLabels(height);
    this.renderTimeRuler(width);
    this.renderCursors(width, height);

    ctx.restore();
  }

  // ─── Time Ruler ─────────────────────────────────────────────────────────

  private renderTimeRuler(width: number): void {
    const { ctx, config, colors, viewport, data } = this;
    if (!viewport || !data) return;

    const rulerY = 0;
    const rulerH = config.rulerHeight;

    // Background
    ctx.fillStyle = colors.headerBg;
    ctx.fillRect(0, rulerY, width, rulerH);

    // Bottom border
    ctx.strokeStyle = colors.divider;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, rulerH - 0.5);
    ctx.lineTo(width, rulerH - 0.5);
    ctx.stroke();

    // Calculate tick spacing
    const { start, end } = viewport.visibleTimeRange;
    const timeRange = end - start;
    const tickSpacing = calculateTickSpacing(timeRange, viewport.waveAreaWidth);

    // Draw ticks
    ctx.fillStyle = colors.foreground;
    ctx.font = `${config.fontSize - 1}px ${config.fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';

    const firstTick = Math.floor(start / tickSpacing) * tickSpacing;

    for (let t = firstTick; t <= end; t += tickSpacing) {
      const x = viewport.timeToPixel(t);
      if (x < config.labelWidth - 10 || x > width + 10) continue;

      // Major tick line
      ctx.strokeStyle = colors.foreground + '80';
      ctx.beginPath();
      ctx.moveTo(x, rulerH - 10);
      ctx.lineTo(x, rulerH - 2);
      ctx.stroke();

      // Label
      const label = formatTime(t, data.timescale.unit);
      ctx.fillText(label, x, rulerH - 12);
    }

    // Minor ticks
    const minorSpacing = tickSpacing / 5;
    for (let t = firstTick; t <= end; t += minorSpacing) {
      const x = viewport.timeToPixel(t);
      if (x < config.labelWidth || x > width) continue;

      ctx.strokeStyle = colors.foreground + '30';
      ctx.beginPath();
      ctx.moveTo(x, rulerH - 5);
      ctx.lineTo(x, rulerH - 2);
      ctx.stroke();
    }
  }

  // ─── Grid Lines ─────────────────────────────────────────────────────────

  private renderGrid(width: number, height: number): void {
    const { ctx, config, colors, viewport, data } = this;
    if (!viewport || !data) return;

    const { start, end } = viewport.visibleTimeRange;
    const timeRange = end - start;
    const tickSpacing = calculateTickSpacing(timeRange, viewport.waveAreaWidth);

    ctx.strokeStyle = colors.gridLine;
    ctx.lineWidth = 0.5;

    // Vertical grid lines
    const firstTick = Math.floor(start / tickSpacing) * tickSpacing;
    for (let t = firstTick; t <= end; t += tickSpacing) {
      const x = viewport.timeToPixel(t);
      if (x < config.labelWidth || x > width) continue;

      ctx.beginPath();
      ctx.moveTo(x, config.rulerHeight);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    // Horizontal grid lines (signal separators)
    const signalRange = viewport.visibleSignalRange;
    for (let i = signalRange.start; i <= signalRange.end; i++) {
      const y = config.rulerHeight + viewport.signalIndexToY(i) + config.signalHeight;
      if (y < config.rulerHeight || y > height) continue;

      ctx.beginPath();
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(width, y + 0.5);
      ctx.stroke();
    }
  }

  // ─── Signal Labels ──────────────────────────────────────────────────────

  private renderLabels(height: number): void {
    const { ctx, config, colors, viewport, data } = this;
    if (!viewport || !data) return;

    // Label background
    ctx.fillStyle = colors.headerBg;
    ctx.fillRect(0, config.rulerHeight, config.labelWidth, height - config.rulerHeight);

    // Right border
    ctx.strokeStyle = colors.divider;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(config.labelWidth - 0.5, config.rulerHeight);
    ctx.lineTo(config.labelWidth - 0.5, height);
    ctx.stroke();

      // Signal names
    ctx.font = `${config.fontSize}px ${config.fontFamily}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    const signalRange = viewport.visibleSignalRange;

    for (let i = signalRange.start; i < signalRange.end; i++) {
      const signal = data.signals[i];
      if (!signal) continue;

      const y = config.rulerHeight + viewport.signalIndexToY(i);
      const centerY = y + config.signalHeight / 2;

      if (centerY < config.rulerHeight || centerY > height) continue;

      // Signal color indicator
      const colorIdx = i % colors.signalColors.length;
      ctx.fillStyle = colors.signalColors[colorIdx];
      ctx.fillRect(4, centerY - 4, 8, 8);

      // Signal name
      ctx.fillStyle = colors.foreground;
      const displayName = signal.fullName;
      ctx.fillText(
        truncateText(ctx, displayName, config.labelWidth - 24),
        18,
        centerY
      );
    }
  }

  // ─── Waveform Signals ───────────────────────────────────────────────────

  private renderSignals(width: number, height: number): void {
    const { ctx, config, colors, viewport, data } = this;
    if (!viewport || !data) return;

    const signalRange = viewport.visibleSignalRange;
    const { start: timeStart, end: timeEnd } = viewport.visibleTimeRange;

    ctx.save();
    ctx.beginPath();
    ctx.rect(config.labelWidth, config.rulerHeight,
      width - config.labelWidth, height - config.rulerHeight);
    ctx.clip();

    for (let i = signalRange.start; i < signalRange.end; i++) {
      const signal = data.signals[i];
      if (!signal) continue;

      const y = config.rulerHeight + viewport.signalIndexToY(i);
      const colorIdx = i % colors.signalColors.length;
      const signalColor = colors.signalColors[colorIdx];

      if (signal.width === 1) {
        this.renderScalarSignal(signal, y, signalColor, timeStart, timeEnd, width);
      } else {
        this.renderVectorSignal(signal, y, signalColor, timeStart, timeEnd, width);
      }
    }

    ctx.restore();
  }

  private renderScalarSignal(
    signal: WaveformSignal,
    y: number,
    color: string,
    timeStart: number,
    timeEnd: number,
    canvasWidth: number
  ): void {
    const { ctx, config, colors, viewport } = this;
    if (!viewport) return;

    const top = y + config.signalPadding;
    const bottom = y + config.signalHeight - config.signalPadding;
    const mid = y + config.signalHeight / 2;
    const highY = top;
    const lowY = bottom;

    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';

    // Get visible transitions
    const transitions = getVisibleTransitions(signal.transitions, timeStart, timeEnd);

    if (transitions.length === 0) return;

    for (let ti = 0; ti < transitions.length; ti++) {
      const t = transitions[ti];
      const nextT = transitions[ti + 1];
      const x = viewport.timeToPixel(t.time);
      const nextX = nextT ? viewport.timeToPixel(nextT.time) : canvasWidth;

      if (t.value.kind !== 'scalar') continue;
      const val = t.value.value;

      // Choose color
      if (val === 'x') {
        ctx.strokeStyle = colors.signalX;
        ctx.fillStyle = colors.signalX + '20';
      } else if (val === 'z') {
        ctx.strokeStyle = colors.signalZ;
      } else if (val === 'u') {
        ctx.strokeStyle = colors.signalU;
        ctx.fillStyle = colors.signalU + '20';
      } else {
        ctx.strokeStyle = color;
      }

      // Draw signal level
      const levelY = val === '1' || val === 'h' ? highY : lowY;

      ctx.beginPath();

      // Transition from previous value
      if (ti > 0) {
        const prevT = transitions[ti - 1];
        if (prevT.value.kind === 'scalar') {
          const prevLevel = prevT.value.value === '1' || prevT.value.value === 'h' ? highY : lowY;
          if (prevLevel !== levelY) {
            ctx.moveTo(x, prevLevel);
            ctx.lineTo(x, levelY);
          }
        }
      }

      ctx.moveTo(x, levelY);
      ctx.lineTo(Math.min(nextX, canvasWidth + 10), levelY);
      ctx.stroke();

      // Fill for X/U states
      if (val === 'x' || val === 'u') {
        ctx.fillRect(x, top, Math.min(nextX, canvasWidth) - x, bottom - top);
      }

      // Dashed line for Z
      if (val === 'z') {
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(x, mid);
        ctx.lineTo(Math.min(nextX, canvasWidth + 10), mid);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  }

  private renderVectorSignal(
    signal: WaveformSignal,
    y: number,
    color: string,
    timeStart: number,
    timeEnd: number,
    canvasWidth: number
  ): void {
    const { ctx, config, colors, viewport } = this;
    if (!viewport) return;

    const top = y + config.signalPadding;
    const bottom = y + config.signalHeight - config.signalPadding;
    const mid = (top + bottom) / 2;

    const transitions = getVisibleTransitions(signal.transitions, timeStart, timeEnd);
    if (transitions.length === 0) return;

    const displayConfig = this.signalConfigs.get(signal.id);
    const format: SignalDisplayFormat = displayConfig?.format ?? 'hex';

    for (let ti = 0; ti < transitions.length; ti++) {
      const t = transitions[ti];
      const nextT = transitions[ti + 1];
      const x1 = Math.max(viewport.timeToPixel(t.time), config.labelWidth);
      const x2 = nextT
        ? Math.min(viewport.timeToPixel(nextT.time), canvasWidth)
        : canvasWidth;

      const boxWidth = x2 - x1;
      if (boxWidth < 1) continue;

      // Check for X/Z values
      const hasX = t.value.kind === 'vector' && /[xXuU]/.test(t.value.value);
      const hasZ = t.value.kind === 'vector' && /[zZ]/.test(t.value.value);

      if (hasX) {
        ctx.fillStyle = colors.signalX + '30';
        ctx.strokeStyle = colors.signalX;
      } else if (hasZ) {
        ctx.fillStyle = colors.signalZ + '30';
        ctx.strokeStyle = colors.signalZ;
      } else {
        ctx.fillStyle = colors.vectorFill;
        ctx.strokeStyle = color;
      }

      // Draw diamond-ended box
      ctx.lineWidth = 1.5;
      const diamondW = Math.min(4, boxWidth / 3);

      ctx.beginPath();
      ctx.moveTo(x1 + diamondW, top);
      ctx.lineTo(x2 - diamondW, top);
      ctx.lineTo(x2, mid);
      ctx.lineTo(x2 - diamondW, bottom);
      ctx.lineTo(x1 + diamondW, bottom);
      ctx.lineTo(x1, mid);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Value text (only if box is wide enough)
      if (boxWidth > 20) {
        const valueStr = formatSignalValue(t.value, format);
        ctx.fillStyle = colors.vectorText;
        ctx.font = `${config.fontSize - 1}px ${config.fontFamily}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const maxTextWidth = boxWidth - diamondW * 2 - 4;
        const text = truncateText(ctx, valueStr, maxTextWidth);
        ctx.fillText(text, (x1 + x2) / 2, mid);
      }
    }
  }

  // ─── Cursors ────────────────────────────────────────────────────────────

  private renderCursors(width: number, height: number): void {
    const { ctx, config, colors, viewport, cursor } = this;
    if (!viewport) return;

    const drawCursor = (time: number, isPrimary: boolean) => {
      const x = viewport.timeToPixel(time);
      if (x < config.labelWidth || x > width) return;

      ctx.strokeStyle = isPrimary ? colors.cursorLine : colors.cursorLine + '80';
      ctx.lineWidth = isPrimary ? 1.5 : 1;

      if (!isPrimary) {
        ctx.setLineDash([4, 4]);
      }

      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
      ctx.setLineDash([]);

      // Time label at top
      if (this.data) {
        const label = formatTime(time, this.data.timescale.unit);
        ctx.fillStyle = colors.cursorLine;
        ctx.font = `bold ${config.fontSize}px ${config.fontFamily}`;
        ctx.textAlign = 'center';
        ctx.fillText(label, x, 10);
      }
    };

    if (cursor.primary !== null) {
      drawCursor(cursor.primary, true);
    }
    if (cursor.secondary !== null) {
      drawCursor(cursor.secondary, false);
    }

    // Delta measurement
    if (cursor.primary !== null && cursor.secondary !== null && this.data) {
      const delta = Math.abs(cursor.primary - cursor.secondary);
      const label = `Δ ${formatTime(delta, this.data.timescale.unit)}`;
      const x1 = viewport.timeToPixel(cursor.primary);
      const x2 = viewport.timeToPixel(cursor.secondary);
      const midX = (x1 + x2) / 2;

      ctx.fillStyle = colors.cursorLine + 'CC';
      ctx.font = `bold ${config.fontSize}px ${config.fontFamily}`;
      ctx.textAlign = 'center';
      ctx.fillText(label, midX, config.rulerHeight - 4);
    }
  }

  /** Set display config for a specific signal */
  setSignalConfig(signalId: string, config: SignalDisplayConfig): void {
    this.signalConfigs.set(signalId, config);
  }
}

// ─── Utility Functions ──────────────────────────────────────────────────────

function calculateTickSpacing(timeRange: number, pixelWidth: number): number {
  const targetPixelsBetweenTicks = 80;
  const idealTimePerTick = timeRange * targetPixelsBetweenTicks / pixelWidth;

  // Round to nearest "nice" number
  const magnitude = Math.pow(10, Math.floor(Math.log10(idealTimePerTick)));
  const residual = idealTimePerTick / magnitude;

  let nice: number;
  if (residual <= 1.5) nice = 1;
  else if (residual <= 3.5) nice = 2;
  else if (residual <= 7.5) nice = 5;
  else nice = 10;

  return nice * magnitude;
}

function getVisibleTransitions(
  transitions: SignalTransition[],
  startTime: number,
  endTime: number
): SignalTransition[] {
  if (transitions.length === 0) return [];

  // Binary search for first visible transition
  let lo = 0;
  let hi = transitions.length - 1;

  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (transitions[mid].time < startTime) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }

  // Include one transition before start for context
  const startIdx = Math.max(0, lo - 1);

  // Find end index
  let endIdx = startIdx;
  while (endIdx < transitions.length && transitions[endIdx].time <= endTime) {
    endIdx++;
  }

  return transitions.slice(startIdx, endIdx + 1);
}

function truncateText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;

  let truncated = text;
  while (truncated.length > 1 && ctx.measureText(truncated + '…').width > maxWidth) {
    truncated = truncated.substring(0, truncated.length - 1);
  }
  return truncated + '…';
}
