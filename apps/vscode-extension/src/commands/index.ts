// ============================================================================
// WaveForge — Command Registration
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
    vscode.commands.registerCommand('waveforge.runSimulation', async () => {
      logger.info('Command: Run Simulation');
      await simulationService.runSimulation();
    })
  );

  // Generate Testbench
  context.subscriptions.push(
    vscode.commands.registerCommand('waveforge.generateTestbench', async () => {
      logger.info('Command: Generate Testbench');
      await simulationService.generateTestbenchFile();
    })
  );

  // Open Wave Viewer
  context.subscriptions.push(
    vscode.commands.registerCommand('waveforge.openWaveViewer', () => {
      logger.info('Command: Open Wave Viewer');
      simulationService.openWaveViewer();
    })
  );

  // Detect Simulator
  context.subscriptions.push(
    vscode.commands.registerCommand('waveforge.detectSimulator', async () => {
      logger.info('Command: Detect Simulator');
      await simulationService.detectSimulator();
    })
  );

  // Stop Simulation (placeholder for future use)
  context.subscriptions.push(
    vscode.commands.registerCommand('waveforge.stopSimulation', () => {
      logger.info('Command: Stop Simulation');
      vscode.window.showInformationMessage('Simulation stop requested.');
    })
  );
}
