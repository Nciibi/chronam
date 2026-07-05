// ============================================================================
// Chronam — Wave Viewer Webview Panel
// ============================================================================
import * as vscode from 'vscode';
import type { WaveformData, Entity, SimulationConfig, ExtensionToWebviewMessage, WebviewToExtensionMessage } from '@chronam/shared-types';

export class WaveViewerPanel {
  public static readonly viewType = 'chronam.waveViewer';
  private static instance: WaveViewerPanel | undefined;

  private readonly panel: vscode.WebviewPanel;
  private readonly extensionUri: vscode.Uri;
  private disposables: vscode.Disposable[] = [];
  private waveformData: WaveformData | null = null;

  public static get isOpen(): boolean {
    return !!WaveViewerPanel.instance;
  }

  public static createOrShow(
    context: vscode.ExtensionContext,
    waveformData?: WaveformData,
    _entity?: Entity,
    _config?: SimulationConfig
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
      'Chronam Viewer',
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
        vscode.commands.executeCommand('chronam.runSimulation');
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
    
    // Path to the React build (bundled inside the extension)
    const scriptUri = this.panel.webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'wave-viewer-dist', 'assets', 'index.js')
    );
    const styleUri = this.panel.webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'wave-viewer-dist', 'assets', 'index.css')
    );

    return /*html*/ `<!DOCTYPE html>
<html lang="en" style="height:100%;margin:0;padding:0;overflow:hidden;">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline' ${this.panel.webview.cspSource}; script-src 'nonce-${nonce}';">
  <link rel="stylesheet" type="text/css" href="${styleUri}">
  <title>Chronam Viewer</title>
  <style>
    html, body { height:100%; margin:0; padding:0; overflow:hidden; }
    body { background:var(--vscode-editor-background,#1e1e1e); }
    #root { height:100%; display:flex; flex-direction:column; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
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
