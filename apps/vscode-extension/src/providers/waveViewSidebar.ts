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
      localResourceRoots: [vscode.Uri.joinPath(vscode.Uri.file(__dirname), '..')],
    };

    const scriptUri = webviewView.webview.asWebviewUri(
      vscode.Uri.joinPath(vscode.Uri.file(__dirname), '..', 'wave-viewer-dist', 'assets', 'index.js')
    );
    const styleUri = webviewView.webview.asWebviewUri(
      vscode.Uri.joinPath(vscode.Uri.file(__dirname), '..', 'wave-viewer-dist', 'assets', 'index.css')
    );

    const nonce = getNonce();
    webviewView.webview.html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline' ${webviewView.webview.cspSource}; script-src 'nonce-${nonce}';">
  <link rel="stylesheet" type="text/css" href="${styleUri}">
  <title>Chronam</title>
  <style>
    html, body, #root { height:100%; margin:0; padding:0; overflow:hidden; }
    body { background:var(--vscode-editor-background,#1e1e1e); }
  </style>
</head>
<body>
  <div id="root"></div>
    <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
    <script nonce="${nonce}">
      window.addEventListener('error', function(e) {
        acquireVsCodeApi().postMessage({ type: 'webview:error', message: 'error: ' + e.message + ' @ ' + (e.filename||'') + ':' + e.lineno + ':' + e.colno });
        document.getElementById('root').innerHTML = '<div style="padding:16px;color:red;font-family:monospace">JS Error: ' + e.message + '</div>';
      });
      window.addEventListener('unhandledrejection', function(e) {
        acquireVsCodeApi().postMessage({ type: 'webview:error', message: 'rejection: ' + e.reason });
      });
      setTimeout(function() {
        var root = document.getElementById('root');
        if (root && root.children.length === 0) {
          root.innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;opacity:0.6;padding:32px;text-align:center"><div style="font-size:24px;margin-bottom:8px">&#9888;</div><p>Chronam IDE failed to load</p><p style="font-size:12px;font-family:monospace;margin-top:4px">Check DevTools (Help &rarr; Toggle Developer Tools) for details</p></div>';
        }
      }, 3000);
    </script>
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
        case 'webview:error':
          console.error('[Chronam]', msg.message);
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
