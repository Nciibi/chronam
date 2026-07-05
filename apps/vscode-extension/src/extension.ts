// ============================================================================
// Chronam — VS Code Extension Entry Point
// ============================================================================
// Activates the extension, registers all commands, providers, and services.
// This is the main lifecycle manager for the extension.
// ============================================================================

import * as vscode from 'vscode';
import { SimulationService } from './services/simulationService';
import { WaveViewerPanel } from './webview/waveViewerPanel';
import { WaveViewSidebarProvider } from './providers/waveViewSidebar';
import { registerCommands } from './commands/index';
import { VHDLCodeLensProvider } from './providers/codeLensProvider';
import { Logger } from './utils/logger';

let logger: Logger;

export function activate(context: vscode.ExtensionContext) {
  logger = new Logger('Chronam');
  logger.info('Chronam extension activating...');

  // Initialize core services
  const simulationService = new SimulationService(context, logger);

  // Register sidebar wave viewer provider
  const sidebarProvider = new WaveViewSidebarProvider();
  simulationService.setSidebarProvider(sidebarProvider);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      WaveViewSidebarProvider.viewType,
      sidebarProvider,
      { webviewOptions: { retainContextWhenHidden: true } }
    )
  );

  // Register commands
  registerCommands(context, simulationService, logger);

  // Register CodeLens provider for VHDL files
  const codeLensProvider = new VHDLCodeLensProvider();
  context.subscriptions.push(
    vscode.languages.registerCodeLensProvider(
      { language: 'vhdl', scheme: 'file' },
      codeLensProvider
    )
  );

  // Register diagnostics collection
  const diagnostics = vscode.languages.createDiagnosticCollection('chronam');
  context.subscriptions.push(diagnostics);
  simulationService.setDiagnostics(diagnostics);

  // Status bar item
  const statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    100
  );
  statusBarItem.text = '$(circuit-board) Chronam';
  statusBarItem.tooltip = 'Chronam VHDL Simulation';
  statusBarItem.command = 'chronam.runSimulation';
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  // Update status bar based on simulation state
  simulationService.addStatusListener((status) => {
    switch (status.state) {
      case 'idle':
        statusBarItem.text = '$(circuit-board) Chronam';
        statusBarItem.tooltip = 'Click to run simulation';
        break;
      case 'preparing':
        statusBarItem.text = '$(loading~spin) Preparing...';
        break;
      case 'compiling':
        statusBarItem.text = '$(loading~spin) Compiling...';
        break;
      case 'elaborating':
        statusBarItem.text = '$(loading~spin) Elaborating...';
        break;
      case 'running':
        statusBarItem.text = '$(loading~spin) Simulating...';
        break;
      case 'completed':
        statusBarItem.text = '$(check) Simulation Complete';
        setTimeout(() => {
          statusBarItem.text = '$(circuit-board) Chronam';
        }, 3000);
        break;
      case 'failed':
        statusBarItem.text = '$(error) Simulation Failed';
        setTimeout(() => {
          statusBarItem.text = '$(circuit-board) Chronam';
        }, 5000);
        break;
    }
  });

  // Live Preview: Auto-run simulation on file save if the wave viewer is open
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(async (document) => {
      if (document.languageId === 'vhdl') {
        const viewerOpen = WaveViewerPanel.isOpen;
        const config = vscode.workspace.getConfiguration('chronam');
        const livePreview = config.get<boolean>('general.livePreview', true);
        if (viewerOpen || livePreview) {
          logger.info('Live Preview: Re-running simulation on save');
          await simulationService.runSimulation();
        }
      }
    })
  );

  logger.info('Chronam extension activated');
}

export function deactivate() {
  logger?.info('Chronam extension deactivated');
}
