import * as vscode from 'vscode';
import type { WaveformData, ExtensionToWebviewMessage, WebviewToExtensionMessage } from '@chronam/shared-types';

export class WaveViewSidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'chronam.waveViewSidebar';

  private view?: vscode.WebviewView;
  private waveformData: WaveformData | null = null;

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [webviewView.webview.cspSource].map(s => vscode.Uri.parse(s)) as any,
    };

    const scriptUri = webviewView.webview.asWebviewUri(
      vscode.Uri.joinPath(vscode.Uri.file(__dirname), '..', '..', '..', '..', 'packages', 'wave-viewer', 'dist', 'assets', 'index.js')
    );
    const styleUri = webviewView.webview.asWebviewUri(
      vscode.Uri.joinPath(vscode.Uri.file(__dirname), '..', '..', '..', '..', 'packages', 'wave-viewer', 'dist', 'assets', 'index.css')
    );

    const nonce = getNonce();
    webviewView.webview.html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline' ${webviewView.webview.cspSource}; script-src 'nonce-${nonce}';">
  <link rel="stylesheet" type="text/css" href="${styleUri}">
  <title>Wave Viewer</title>
  <style>
    body { margin: 0; padding: 0; overflow: hidden; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;

    webviewView.webview.onDidReceiveMessage((msg: WebviewToExtensionMessage) => {
      switch (msg.type) {
        case 'ready':
          if (this.waveformData) {
            this.postMessage({ type: 'waveform:load', data: this.waveformData });
          }
          break;
        case 'simulation:run':
          vscode.commands.executeCommand('chronam.runSimulation');
          break;
      }
    });
  }

  loadWaveform(data: WaveformData): void {
    this.waveformData = data;
    if (this.view) {
      this.postMessage({ type: 'waveform:load', data });
    }
  }

  reveal(): void {
    vscode.commands.executeCommand(`${WaveViewSidebarProvider.viewType}.focus`);
  }

  private postMessage(message: ExtensionToWebviewMessage): void {
    this.view?.webview.postMessage(message);
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
