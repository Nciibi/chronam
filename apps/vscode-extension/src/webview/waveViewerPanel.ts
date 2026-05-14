// ============================================================================
// WaveForge — Wave Viewer Webview Panel
// ============================================================================
import * as vscode from 'vscode';
import type { WaveformData, Entity, SimulationConfig, ExtensionToWebviewMessage, WebviewToExtensionMessage } from '@waveforge/shared-types';

export class WaveViewerPanel {
  public static readonly viewType = 'waveforge.waveViewer';
  private static instance: WaveViewerPanel | undefined;

  private readonly panel: vscode.WebviewPanel;
  private readonly extensionUri: vscode.Uri;
  private disposables: vscode.Disposable[] = [];
  private waveformData: WaveformData | null = null;

  public static createOrShow(
    context: vscode.ExtensionContext,
    waveformData?: WaveformData,
    entity?: Entity,
    config?: SimulationConfig
  ): WaveViewerPanel {
    if (WaveViewerPanel.instance) {
      WaveViewerPanel.instance.panel.reveal(vscode.ViewColumn.Beside);
      if (waveformData) {
        WaveViewerPanel.instance.loadWaveform(waveformData);
      }
      return WaveViewerPanel.instance;
    }

    const panel = vscode.window.createWebviewPanel(
      WaveViewerPanel.viewType,
      'WaveForge Viewer',
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [context.extensionUri],
      }
    );

    WaveViewerPanel.instance = new WaveViewerPanel(panel, context.extensionUri);

    if (waveformData) {
      WaveViewerPanel.instance.loadWaveform(waveformData);
    }

    return WaveViewerPanel.instance;
  }

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this.panel = panel;
    this.extensionUri = extensionUri;
    this.panel.webview.html = this.getHtmlContent();

    // Handle messages from the webview
    this.panel.webview.onDidReceiveMessage(
      (msg: WebviewToExtensionMessage) => this.handleMessage(msg),
      null,
      this.disposables
    );

    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
  }

  public loadWaveform(data: WaveformData): void {
    this.waveformData = data;
    this.postMessage({ type: 'waveform:load', data });
  }

  private postMessage(message: ExtensionToWebviewMessage): void {
    this.panel.webview.postMessage(message);
  }

  private handleMessage(message: WebviewToExtensionMessage): void {
    switch (message.type) {
      case 'ready':
        if (this.waveformData) {
          this.postMessage({ type: 'waveform:load', data: this.waveformData });
        }
        break;
      case 'simulation:run':
        vscode.commands.executeCommand('waveforge.runSimulation');
        break;
    }
  }

  private dispose(): void {
    WaveViewerPanel.instance = undefined;
    this.panel.dispose();
    while (this.disposables.length) {
      const d = this.disposables.pop();
      if (d) d.dispose();
    }
  }

  private getHtmlContent(): string {
    const nonce = getNonce();
    return /*html*/ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <title>WaveForge Viewer</title>
  <style>
    :root {
      --bg: var(--vscode-editor-background, #1e1e1e);
      --fg: var(--vscode-editor-foreground, #d4d4d4);
      --header-bg: var(--vscode-sideBar-background, #252526);
      --border: var(--vscode-panel-border, #3c3c3c);
      --accent: #4fc1ff;
      --signal-high: #4fc1ff;
      --signal-x: #ff5555;
      --signal-z: #ffaa00;
      --vector-fill: #264f78;
      --grid: #2a2a2a;
      --cursor: #ffcc00;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: var(--bg);
      color: var(--fg);
      font-family: 'Segoe UI', system-ui, sans-serif;
      overflow: hidden;
      height: 100vh;
    }
    .toolbar {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 12px;
      background: var(--header-bg);
      border-bottom: 1px solid var(--border);
      font-size: 12px;
      height: 36px;
    }
    .toolbar button {
      background: transparent;
      border: 1px solid var(--border);
      color: var(--fg);
      padding: 3px 10px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 11px;
      transition: all 0.15s;
    }
    .toolbar button:hover { background: var(--accent); color: #000; border-color: var(--accent); }
    .toolbar .separator { width: 1px; height: 20px; background: var(--border); }
    .toolbar .info { opacity: 0.7; font-size: 11px; margin-left: auto; }
    #wave-canvas {
      display: block;
      width: 100%;
      height: calc(100vh - 36px);
      cursor: crosshair;
    }
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: calc(100vh - 36px);
      opacity: 0.5;
      gap: 12px;
    }
    .empty-state .icon { font-size: 48px; }
    .empty-state p { font-size: 14px; }
  </style>
</head>
<body>
  <div class="toolbar">
    <button id="btn-zoom-in" title="Zoom In">🔍+</button>
    <button id="btn-zoom-out" title="Zoom Out">🔍−</button>
    <button id="btn-fit" title="Fit All">⊞ Fit</button>
    <div class="separator"></div>
    <button id="btn-rerun" title="Re-run Simulation">▶ Re-run</button>
    <span class="info" id="info-text">No waveform loaded</span>
  </div>
  <canvas id="wave-canvas"></canvas>
  <div class="empty-state" id="empty-state">
    <div class="icon">〰️</div>
    <p>Run a simulation to view waveforms</p>
  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const canvas = document.getElementById('wave-canvas');
    const ctx = canvas.getContext('2d');
    const emptyState = document.getElementById('empty-state');
    const infoText = document.getElementById('info-text');

    let waveData = null;
    let viewport = { startTime: 0, endTime: 100, pxPerTime: 1, scrollY: 0 };
    let cursor = { primary: null, secondary: null };
    let isDragging = false;
    let dragStartX = 0;
    let dragStartTime = 0;

    const LABEL_WIDTH = 180;
    const RULER_HEIGHT = 30;
    const SIGNAL_HEIGHT = 28;
    const PADDING = 3;
    const dpr = window.devicePixelRatio || 1;

    const COLORS = {
      bg: '#1e1e1e', fg: '#d4d4d4', grid: '#2a2a2a', header: '#252526',
      border: '#3c3c3c', cursor: '#ffcc00',
      signalX: '#ff5555', signalZ: '#ffaa00', signalU: '#ff79c6',
      vectorFill: '#264f78', vectorText: '#d4d4d4',
      palette: ['#4fc1ff','#61e294','#ff79c6','#f1fa8c','#bd93f9','#ff6b6b','#8be9fd','#ffb86c']
    };

    function resize() {
      canvas.width = canvas.clientWidth * dpr;
      canvas.height = canvas.clientHeight * dpr;
      ctx.scale(dpr, dpr);
      render();
    }

    function timeToX(t) { return LABEL_WIDTH + (t - viewport.startTime) * viewport.pxPerTime; }
    function xToTime(x) { return viewport.startTime + (x - LABEL_WIDTH) / viewport.pxPerTime; }

    function render() {
      if (!waveData) return;
      const w = canvas.clientWidth, h = canvas.clientHeight;
      ctx.clearRect(0, 0, w, h);

      // Background
      ctx.fillStyle = COLORS.bg;
      ctx.fillRect(0, 0, w, h);

      renderGrid(w, h);
      renderSignals(w, h);
      renderLabels(h);
      renderRuler(w);
      renderCursors(w, h);
    }

    function renderRuler(w) {
      ctx.fillStyle = COLORS.header;
      ctx.fillRect(0, 0, w, RULER_HEIGHT);
      ctx.strokeStyle = COLORS.border;
      ctx.beginPath(); ctx.moveTo(0, RULER_HEIGHT); ctx.lineTo(w, RULER_HEIGHT); ctx.stroke();

      const range = viewport.endTime - viewport.startTime;
      const tickSpacing = niceTickSpacing(range, w - LABEL_WIDTH);
      const first = Math.floor(viewport.startTime / tickSpacing) * tickSpacing;

      ctx.fillStyle = COLORS.fg;
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';

      for (let t = first; t <= viewport.endTime; t += tickSpacing) {
        const x = timeToX(t);
        if (x < LABEL_WIDTH - 5 || x > w + 5) continue;
        ctx.strokeStyle = COLORS.fg + '60';
        ctx.beginPath(); ctx.moveTo(x, RULER_HEIGHT - 8); ctx.lineTo(x, RULER_HEIGHT - 1); ctx.stroke();
        ctx.fillText(t + (waveData.timescale ? ' ' + waveData.timescale.unit : ''), x, RULER_HEIGHT - 10);
      }
    }

    function renderGrid(w, h) {
      const range = viewport.endTime - viewport.startTime;
      const tickSpacing = niceTickSpacing(range, w - LABEL_WIDTH);
      const first = Math.floor(viewport.startTime / tickSpacing) * tickSpacing;

      ctx.strokeStyle = COLORS.grid;
      ctx.lineWidth = 0.5;
      for (let t = first; t <= viewport.endTime; t += tickSpacing) {
        const x = timeToX(t);
        if (x < LABEL_WIDTH) continue;
        ctx.beginPath(); ctx.moveTo(x, RULER_HEIGHT); ctx.lineTo(x, h); ctx.stroke();
      }
      for (let i = 0; i <= waveData.signals.length; i++) {
        const y = RULER_HEIGHT + i * SIGNAL_HEIGHT - viewport.scrollY;
        if (y < RULER_HEIGHT || y > h) continue;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      }
      ctx.lineWidth = 1;
    }

    function renderLabels(h) {
      ctx.fillStyle = COLORS.header;
      ctx.fillRect(0, RULER_HEIGHT, LABEL_WIDTH, h - RULER_HEIGHT);
      ctx.strokeStyle = COLORS.border;
      ctx.beginPath(); ctx.moveTo(LABEL_WIDTH, RULER_HEIGHT); ctx.lineTo(LABEL_WIDTH, h); ctx.stroke();

      ctx.font = '11px monospace';
      ctx.textAlign = 'left';

      for (let i = 0; i < waveData.signals.length; i++) {
        const y = RULER_HEIGHT + i * SIGNAL_HEIGHT - viewport.scrollY;
        if (y + SIGNAL_HEIGHT < RULER_HEIGHT || y > h) continue;

        const color = COLORS.palette[i % COLORS.palette.length];
        ctx.fillStyle = color;
        ctx.fillRect(6, y + SIGNAL_HEIGHT/2 - 3, 6, 6);
        ctx.fillStyle = COLORS.fg;
        ctx.textBaseline = 'middle';
        ctx.fillText(waveData.signals[i].name, 18, y + SIGNAL_HEIGHT / 2);
      }
    }

    function renderSignals(w, h) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(LABEL_WIDTH, RULER_HEIGHT, w - LABEL_WIDTH, h - RULER_HEIGHT);
      ctx.clip();

      for (let i = 0; i < waveData.signals.length; i++) {
        const sig = waveData.signals[i];
        const y = RULER_HEIGHT + i * SIGNAL_HEIGHT - viewport.scrollY;
        if (y + SIGNAL_HEIGHT < RULER_HEIGHT || y > h) continue;

        const color = COLORS.palette[i % COLORS.palette.length];
        if (sig.width === 1) drawScalar(sig, y, color, w);
        else drawVector(sig, y, color, w);
      }
      ctx.restore();
    }

    function drawScalar(sig, y, color, canvasW) {
      const top = y + PADDING, bot = y + SIGNAL_HEIGHT - PADDING;
      ctx.lineWidth = 1.5; ctx.strokeStyle = color;

      for (let ti = 0; ti < sig.transitions.length; ti++) {
        const t = sig.transitions[ti];
        const next = sig.transitions[ti + 1];
        const x1 = timeToX(t.time);
        const x2 = next ? timeToX(next.time) : canvasW;
        if (x2 < LABEL_WIDTH || x1 > canvasW) continue;

        const val = t.value.kind === 'scalar' ? t.value.value : '0';
        const levelY = (val === '1' || val === 'h' || val === 'H') ? top : bot;

        if (val === 'x' || val === 'X') { ctx.strokeStyle = COLORS.signalX; ctx.fillStyle = COLORS.signalX + '25'; ctx.fillRect(x1, top, x2 - x1, bot - top); }
        else if (val === 'z' || val === 'Z') { ctx.strokeStyle = COLORS.signalZ; }
        else if (val === 'u' || val === 'U') { ctx.strokeStyle = COLORS.signalU; }
        else { ctx.strokeStyle = color; }

        // Transition line
        if (ti > 0) {
          const prev = sig.transitions[ti - 1];
          const prevVal = prev.value.kind === 'scalar' ? prev.value.value : '0';
          const prevY = (prevVal === '1' || prevVal === 'h') ? top : bot;
          if (prevY !== levelY) { ctx.beginPath(); ctx.moveTo(x1, prevY); ctx.lineTo(x1, levelY); ctx.stroke(); }
        }
        ctx.beginPath(); ctx.moveTo(Math.max(x1, LABEL_WIDTH), levelY); ctx.lineTo(Math.min(x2, canvasW), levelY); ctx.stroke();
      }
    }

    function drawVector(sig, y, color, canvasW) {
      const top = y + PADDING, bot = y + SIGNAL_HEIGHT - PADDING, mid = (top + bot) / 2;
      ctx.lineWidth = 1.5;

      for (let ti = 0; ti < sig.transitions.length; ti++) {
        const t = sig.transitions[ti];
        const next = sig.transitions[ti + 1];
        const x1 = Math.max(timeToX(t.time), LABEL_WIDTH);
        const x2 = next ? Math.min(timeToX(next.time), canvasW) : canvasW;
        if (x2 - x1 < 1) continue;

        ctx.fillStyle = COLORS.vectorFill; ctx.strokeStyle = color;
        const dw = Math.min(4, (x2 - x1) / 3);
        ctx.beginPath();
        ctx.moveTo(x1 + dw, top); ctx.lineTo(x2 - dw, top); ctx.lineTo(x2, mid);
        ctx.lineTo(x2 - dw, bot); ctx.lineTo(x1 + dw, bot); ctx.lineTo(x1, mid);
        ctx.closePath(); ctx.fill(); ctx.stroke();

        if (x2 - x1 > 24 && t.value.kind === 'vector') {
          const hex = parseInt(t.value.value, 2).toString(16).toUpperCase();
          ctx.fillStyle = COLORS.vectorText;
          ctx.font = '10px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText('0x' + hex, (x1 + x2) / 2, mid);
        }
      }
    }

    function renderCursors(w, h) {
      if (cursor.primary !== null) {
        const x = timeToX(cursor.primary);
        ctx.strokeStyle = COLORS.cursor; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
        ctx.fillStyle = COLORS.cursor; ctx.font = 'bold 10px monospace'; ctx.textAlign = 'center';
        ctx.fillText(cursor.primary + '', x, 10);
      }
    }

    function niceTickSpacing(range, pixels) {
      const ideal = range * 80 / pixels;
      const mag = Math.pow(10, Math.floor(Math.log10(ideal)));
      const r = ideal / mag;
      let nice = r <= 1.5 ? 1 : r <= 3.5 ? 2 : r <= 7.5 ? 5 : 10;
      return nice * mag;
    }

    // Event handlers
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        const factor = e.deltaY < 0 ? 1.2 : 1 / 1.2;
        const mouseTime = xToTime(e.offsetX);
        viewport.pxPerTime *= factor;
        viewport.startTime = mouseTime - (e.offsetX - LABEL_WIDTH) / viewport.pxPerTime;
        viewport.endTime = viewport.startTime + (canvas.clientWidth - LABEL_WIDTH) / viewport.pxPerTime;
      } else if (e.shiftKey) {
        const dt = e.deltaY / viewport.pxPerTime;
        viewport.startTime += dt; viewport.endTime += dt;
      } else {
        viewport.scrollY = Math.max(0, viewport.scrollY + e.deltaY);
      }
      render();
    });

    canvas.addEventListener('mousedown', (e) => {
      if (e.offsetX > LABEL_WIDTH) {
        if (e.button === 0) { cursor.primary = Math.round(xToTime(e.offsetX)); render(); }
        if (e.button === 1 || (e.button === 0 && e.altKey)) { isDragging = true; dragStartX = e.offsetX; dragStartTime = viewport.startTime; }
      }
    });
    canvas.addEventListener('mousemove', (e) => {
      if (isDragging) {
        const dx = e.offsetX - dragStartX;
        const dt = dx / viewport.pxPerTime;
        viewport.startTime = dragStartTime - dt;
        viewport.endTime = viewport.startTime + (canvas.clientWidth - LABEL_WIDTH) / viewport.pxPerTime;
        render();
      }
    });
    canvas.addEventListener('mouseup', () => { isDragging = false; });

    document.getElementById('btn-zoom-in').addEventListener('click', () => {
      const center = (viewport.startTime + viewport.endTime) / 2;
      viewport.pxPerTime *= 1.5;
      viewport.startTime = center - (canvas.clientWidth - LABEL_WIDTH) / viewport.pxPerTime / 2;
      viewport.endTime = viewport.startTime + (canvas.clientWidth - LABEL_WIDTH) / viewport.pxPerTime;
      render();
    });
    document.getElementById('btn-zoom-out').addEventListener('click', () => {
      const center = (viewport.startTime + viewport.endTime) / 2;
      viewport.pxPerTime /= 1.5;
      viewport.startTime = center - (canvas.clientWidth - LABEL_WIDTH) / viewport.pxPerTime / 2;
      viewport.endTime = viewport.startTime + (canvas.clientWidth - LABEL_WIDTH) / viewport.pxPerTime;
      render();
    });
    document.getElementById('btn-fit').addEventListener('click', () => {
      if (!waveData) return;
      viewport.startTime = 0; viewport.endTime = waveData.endTime;
      viewport.pxPerTime = (canvas.clientWidth - LABEL_WIDTH) / (waveData.endTime || 1);
      viewport.scrollY = 0;
      render();
    });
    document.getElementById('btn-rerun').addEventListener('click', () => {
      vscode.postMessage({ type: 'simulation:run' });
    });

    window.addEventListener('message', (event) => {
      const msg = event.data;
      if (msg.type === 'waveform:load') {
        waveData = msg.data;
        emptyState.style.display = 'none';
        canvas.style.display = 'block';
        infoText.textContent = waveData.signals.length + ' signals | ' + waveData.endTime + ' ' + (waveData.timescale?.unit || 'ns');
        viewport.startTime = 0;
        viewport.endTime = waveData.endTime;
        viewport.pxPerTime = (canvas.clientWidth - LABEL_WIDTH) / (waveData.endTime || 1);
        viewport.scrollY = 0;
        resize();
      }
    });

    window.addEventListener('resize', resize);
    resize();
    vscode.postMessage({ type: 'ready' });
  </script>
</body>
</html>`;
  }
}

function getNonce(): string {
  let text = '';
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return text;
}
