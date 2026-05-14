// ============================================================================
// Chronam — VS Code Extension Entry Point
// ============================================================================
// Activates the extension, registers all commands, providers, and services.
// This is the main lifecycle manager for the extension.
// ============================================================================

import * as vscode from 'vscode';
import { SimulationService } from './services/simulationService';
import { WaveViewerPanel } from './webview/waveViewerPanel';
import { registerCommands } from './commands/index';
import { VHDLCodeLensProvider } from './providers/codeLensProvider';
import { Logger } from './utils/logger';

let logger: Logger;

export function activate(context: vscode.ExtensionContext) {
  logger = new Logger('Chronam');
  logger.info('Chronam extension activating...');

  // Initialize core services
  const simulationService = new SimulationService(context, logger);

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
  simulationService.onStatusChange((status) => {
    switch (status.state) {
      case 'idle':
        statusBarItem.text = '$(circuit-board) Chronam';
        statusBarItem.tooltip = 'Click to run simulation';
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

  logger.info('Chronam extension activated');
}

export function deactivate() {
  logger?.info('Chronam extension deactivated');
}
