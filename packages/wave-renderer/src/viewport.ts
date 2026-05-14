// ============================================================================
// WaveForge — Viewport Manager
// ============================================================================
// Manages the visible region of the waveform (zoom, pan, scroll).
// Computes pixel ↔ time coordinate mappings for the renderer.
// ============================================================================

import type { ViewportState, WaveformData } from '@waveforge/shared-types';

export interface ViewportBounds {
  minTime: number;
  maxTime: number;
  totalSignals: number;
}

export class Viewport {
  private state: ViewportState;
  private bounds: ViewportBounds;
  private canvasWidth: number;
  private canvasHeight: number;
  private signalHeight: number;
  private labelWidth: number;

  constructor(
    bounds: ViewportBounds,
    canvasWidth: number,
    canvasHeight: number,
    signalHeight: number = 30,
    labelWidth: number = 200
  ) {
    this.bounds = bounds;
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;
    this.signalHeight = signalHeight;
    this.labelWidth = labelWidth;

    // Initialize to show full time range
    const waveWidth = canvasWidth - labelWidth;
    const timeRange = bounds.maxTime - bounds.minTime || 1;

    this.state = {
      startTime: bounds.minTime,
      endTime: bounds.maxTime,
      scrollY: 0,
      pixelsPerTimeUnit: waveWidth / timeRange,
    };
  }

  getState(): ViewportState {
    return { ...this.state };
  }

  /** Width available for waveform rendering (total - labels) */
  get waveAreaWidth(): number {
    return this.canvasWidth - this.labelWidth;
  }

  /** Convert simulation time → pixel X coordinate */
  timeToPixel(time: number): number {
    return this.labelWidth +
      (time - this.state.startTime) * this.state.pixelsPerTimeUnit;
  }

  /** Convert pixel X → simulation time */
  pixelToTime(pixelX: number): number {
    return this.state.startTime +
      (pixelX - this.labelWidth) / this.state.pixelsPerTimeUnit;
  }

  /** Convert signal index → pixel Y coordinate */
  signalIndexToY(index: number): number {
    return index * this.signalHeight - this.state.scrollY;
  }

  /** Get the visible time range */
  get visibleTimeRange(): { start: number; end: number } {
    return { start: this.state.startTime, end: this.state.endTime };
  }

  /** Get the visible signal index range */
  get visibleSignalRange(): { start: number; end: number } {
    const start = Math.max(0, Math.floor(this.state.scrollY / this.signalHeight));
    const visible = Math.ceil(this.canvasHeight / this.signalHeight) + 1;
    const end = Math.min(this.bounds.totalSignals, start + visible);
    return { start, end };
  }

  /** Zoom centered on a pixel position */
  zoom(factor: number, centerPixelX: number): void {
    const centerTime = this.pixelToTime(centerPixelX);
    const newPPT = Math.max(0.001, Math.min(10000, this.state.pixelsPerTimeUnit * factor));

    this.state.pixelsPerTimeUnit = newPPT;

    // Recalculate start/end to keep centerTime at the same pixel
    const offsetFromLabel = centerPixelX - this.labelWidth;
    this.state.startTime = centerTime - offsetFromLabel / newPPT;
    this.state.endTime = this.state.startTime + this.waveAreaWidth / newPPT;

    this.clampTimeRange();
  }

  /** Pan horizontally by pixel delta */
  panX(deltaPixels: number): void {
    const deltaTime = deltaPixels / this.state.pixelsPerTimeUnit;
    this.state.startTime -= deltaTime;
    this.state.endTime -= deltaTime;
    this.clampTimeRange();
  }

  /** Scroll vertically by pixel delta */
  scrollY(deltaPixels: number): void {
    const maxScroll = Math.max(0,
      this.bounds.totalSignals * this.signalHeight - this.canvasHeight);
    this.state.scrollY = Math.max(0, Math.min(maxScroll,
      this.state.scrollY + deltaPixels));
  }

  /** Fit the entire waveform in view */
  fitAll(): void {
    this.state.startTime = this.bounds.minTime;
    this.state.endTime = this.bounds.maxTime;
    const timeRange = this.bounds.maxTime - this.bounds.minTime || 1;
    this.state.pixelsPerTimeUnit = this.waveAreaWidth / timeRange;
    this.state.scrollY = 0;
  }

  /** Update canvas dimensions (e.g., on resize) */
  resize(width: number, height: number): void {
    this.canvasWidth = width;
    this.canvasHeight = height;
    // Recalculate end time based on new width
    this.state.endTime = this.state.startTime + this.waveAreaWidth / this.state.pixelsPerTimeUnit;
  }

  private clampTimeRange(): void {
    // Prevent scrolling too far left or right
    if (this.state.startTime < this.bounds.minTime) {
      const shift = this.bounds.minTime - this.state.startTime;
      this.state.startTime += shift;
      this.state.endTime += shift;
    }
    if (this.state.endTime > this.bounds.maxTime * 1.1) {
      const shift = this.state.endTime - this.bounds.maxTime * 1.1;
      this.state.startTime -= shift;
      this.state.endTime -= shift;
    }
  }
}

/** Create a viewport from waveform data */
export function createViewport(
  data: WaveformData,
  canvasWidth: number,
  canvasHeight: number,
  signalHeight?: number,
  labelWidth?: number
): Viewport {
  return new Viewport(
    {
      minTime: 0,
      maxTime: data.endTime,
      totalSignals: data.signals.length,
    },
    canvasWidth,
    canvasHeight,
    signalHeight,
    labelWidth
  );
}
