// ============================================================================
// Chronam — Command Registration
// ============================================================================

import * as vscode from 'vscode';
import type { SimulationService } from '../services/simulationService';
import type { Logger } from '../utils/logger';

export function registerCommands(
  context: vscode.ExtensionContext,
  simulationService: SimulationService,
  logger: Logger
): void {
  // Run Simulation
  context.subscriptions.push(
    vscode.commands.registerCommand('chronam.runSimulation', async () => {
      logger.info('Command: Run Simulation');
      await simulationService.runSimulation();
    })
  );

  // Generate Testbench
  context.subscriptions.push(
    vscode.commands.registerCommand('chronam.generateTestbench', async () => {
      logger.info('Command: Generate Testbench');
      await simulationService.generateTestbenchFile();
    })
  );

  // Open Wave Viewer
  context.subscriptions.push(
    vscode.commands.registerCommand('chronam.openWaveViewer', () => {
      logger.info('Command: Open Wave Viewer');
      simulationService.openWaveViewer();
    })
  );

  // Detect Simulator
  context.subscriptions.push(
    vscode.commands.registerCommand('chronam.detectSimulator', async () => {
      logger.info('Command: Detect Simulator');
      await simulationService.detectSimulator();
    })
  );

  // Stop Simulation (placeholder for future use)
  context.subscriptions.push(
    vscode.commands.registerCommand('chronam.stopSimulation', () => {
      logger.info('Command: Stop Simulation');
      vscode.window.showInformationMessage('Simulation stop requested.');
    })
  );

  // Show Simulation Output
  context.subscriptions.push(
    vscode.commands.registerCommand('chronam.showOutput', () => {
      logger.info('Command: Show Output');
      simulationService.showTerminal();
    })
  );
}
