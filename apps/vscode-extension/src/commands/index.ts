import * as vscode from 'vscode';
import type { SimulationService } from '../services/simulationService';
import type { Logger } from '../utils/logger';

export function registerCommands(
  context: vscode.ExtensionContext,
  simulationService: SimulationService,
  logger: Logger
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('chronam.runSimulation', async () => {
      logger.info('Command: Run Simulation');
      await simulationService.runSimulation();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('chronam.generateTestbench', async () => {
      logger.info('Command: Generate Testbench');
      await simulationService.generateTestbenchFile();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('chronam.openWaveViewer', () => {
      logger.info('Command: Open Wave Viewer');
      simulationService.openWaveViewer();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('chronam.detectSimulator', async () => {
      logger.info('Command: Detect Simulator');
      await simulationService.detectSimulator();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('chronam.stopSimulation', () => {
      logger.info('Command: Stop Simulation');
      vscode.window.showInformationMessage('Simulation stop requested.');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('chronam.showOutput', () => {
      logger.info('Command: Show Output');
      simulationService.showTerminal();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('chronam.openDashboard', () => {
      logger.info('Command: Open Dashboard');
      vscode.commands.executeCommand('chronam.waveViewSidebar.focus');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('chronam.openBuildPanel', () => {
      logger.info('Command: Open Build Panel');
      vscode.commands.executeCommand('chronam.waveViewSidebar.focus');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('chronam.openSimulationPanel', () => {
      logger.info('Command: Open Simulation Panel');
      vscode.commands.executeCommand('chronam.waveViewSidebar.focus');
    })
  );
}
