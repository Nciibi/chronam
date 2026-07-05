// ============================================================================
// Chronam — Simulation Service
// ============================================================================
// Central orchestrator for the simulation pipeline within the extension.
// Manages: parsing → testbench generation → compilation → simulation →
// waveform loading → webview display.
// ============================================================================

import * as vscode from 'vscode';
import * as path from 'path';
import { SimulationOrchestrator } from '@chronam/core';
import type { OrchestratorDelegate } from '@chronam/core';
import type {
  Entity,
  SimulationStatus,
  WaveformData,
} from '@chronam/shared-types';
import { WaveViewerPanel } from '../webview/waveViewerPanel';
import { WaveViewSidebarProvider } from '../providers/waveViewSidebar';
import { SimulationTerminal } from './simulationTerminal';
import type { Logger } from '../utils/logger';

type StatusListener = (status: SimulationStatus) => void;

export class SimulationService implements OrchestratorDelegate {
  private context: vscode.ExtensionContext;
  private logger: Logger;
  private orchestrator: SimulationOrchestrator;
  private diagnostics: vscode.DiagnosticCollection | null = null;
  private statusListeners: StatusListener[] = [];
  private lastWaveformData: WaveformData | null = null;
  private terminal: SimulationTerminal;
  private sidebarProvider?: WaveViewSidebarProvider;
  private userClockPeriodNs: number | null = null;

  constructor(context: vscode.ExtensionContext, logger: Logger) {
    this.context = context;
    this.logger = logger;
    this.orchestrator = new SimulationOrchestrator(this);
    this.terminal = new SimulationTerminal();
  }

  setSidebarProvider(provider: WaveViewSidebarProvider): void {
    this.sidebarProvider = provider;
  }

  setDiagnostics(diagnostics: vscode.DiagnosticCollection): void {
    this.diagnostics = diagnostics;
  }

  addStatusListener(listener: StatusListener): void {
    this.statusListeners.push(listener);
  }

  async detectSimulator(): Promise<void> {
    const info = await this.orchestrator.detectSimulator();
    if (info) {
      vscode.window.showInformationMessage(
        `Found ${info.name} v${info.version} at ${info.path}`
      );
    } else {
      vscode.window.showWarningMessage(
        'No VHDL simulator found. Install GHDL and ensure it is on your PATH.'
      );
    }
  }

  // --- Orchestrator Delegate Implementation ---
  onStatusChange = (status: SimulationStatus): void => {
    for (const listener of this.statusListeners) {
      listener(status);
    }
  };

  onLogInfo = (message: string, ...args: any[]): void => {
    this.logger.info(message, ...args);
  };

  onLogError = (message: string, ...args: any[]): void => {
    this.logger.error(message, ...args);
  };

  async promptEntitySelection(entities: Entity[]): Promise<Entity | undefined> {
    const picked = await vscode.window.showQuickPick(
      entities.map((e) => ({
        label: e.name,
        description: `${e.ports.length} ports`,
        entity: e,
      })),
      { placeHolder: 'Select entity to simulate' }
    );
    return picked?.entity;
  }

  getSimulationConfig(): { durationNs: number; clockPeriodNs: number; ghdlPath?: string } {
    const config = vscode.workspace.getConfiguration('chronam');
    return {
      durationNs: config.get<number>('simulator.defaultDurationNs', 1000),
      clockPeriodNs: this.userClockPeriodNs ?? config.get<number>('testbench.defaultClockPeriodNs', 10),
      ghdlPath: config.get<string>('simulator.ghdlPath', '') || undefined
    };
  }

  async readFile(filePath: string): Promise<string> {
    const fs = await import('fs/promises');
    return fs.readFile(filePath, 'utf-8');
  }
  // --------------------------------------------

  /**
   * Run the full simulation pipeline for the active VHDL file.
   */
  async runSimulation(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage('No active VHDL file.');
      return;
    }

    const document = editor.document;
    if (document.languageId !== 'vhdl') {
      vscode.window.showErrorMessage('Active file is not a VHDL file.');
      return;
    }

    // Check simulator availability
    const simInfo = await this.orchestrator.detectSimulator();
    if (!simInfo) {
      const action = await vscode.window.showErrorMessage(
        'GHDL simulator not found. Please install GHDL and ensure it is on your PATH.',
        'Install GHDL',
        'Set Custom Path'
      );
      if (action === 'Set Custom Path') {
        vscode.commands.executeCommand('workbench.action.openSettings', 'chronam.simulator.ghdlPath');
      }
      return;
    }

    this.logger.info(`Using ${simInfo.name} v${simInfo.version}`);
    this.terminal.begin();
    this.terminal.appendLine(`Simulator: ${simInfo.name} v${simInfo.version}`);

    // Prompt for clock period (interactive input)
    const periodStr = await vscode.window.showInputBox({
      prompt: 'Enter clock period in ns',
      value: String(this.getSimulationConfig().clockPeriodNs),
      placeHolder: 'e.g. 10',
      validateInput: (v) => isNaN(Number(v)) || Number(v) <= 0 ? 'Must be a positive number' : null,
    });
    if (!periodStr) return; // user cancelled
    this.userClockPeriodNs = parseInt(periodStr, 10);
    this.terminal.appendLine(`Clock period: ${this.userClockPeriodNs}ns`);

    // Clear previous diagnostics
    this.diagnostics?.clear();

    const filePath = document.uri.fsPath;
    const fileContent = document.getText();
    const workDir = path.join(path.dirname(filePath), '.chronam');

    // Show progress & terminal
    vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: 'Chronam Simulation',
      cancellable: true,
    }, async (progress, token) => {
      token.onCancellationRequested(() => {
        this.terminal.appendLine('Simulation cancelled by user.');
        this.onStatusChange({ state: 'idle' });
      });

      try {
        const result = await this.orchestrator.runSimulation(
          fileContent,
          filePath,
          workDir,
          (phase, detail) => {
            if (phase === 'compiling') {
              this.terminal.nextPhase();
            } else if (phase === 'elaborating') {
              this.terminal.nextPhase();
            } else if (phase === 'running') {
              this.terminal.nextPhase();
            }
            this.terminal.appendLine(detail);
            progress.report({ message: detail });
          },
          (line) => {
            this.terminal.appendOutput(line);
          }
        );

        if (result.error) {
          this.terminal.fail(result.error);
          vscode.window.showErrorMessage(
            `Simulation failed: ${result.error}`,
            'Show Output'
          ).then((action) => {
            if (action === 'Show Output') this.terminal.show();
          });
          return;
        }

        if (result.waveformData) {
          this.lastWaveformData = result.waveformData;
          this.terminal.complete(result.waveformData.signals.length);

          const autoOpen = vscode.workspace.getConfiguration('chronam')
            .get<boolean>('general.autoOpenWaveViewer', true);

          if (autoOpen) {
            const openIn = vscode.workspace.getConfiguration('chronam')
              .get<string>('general.waveViewerLocation', 'editor');

            if (openIn === 'sidebar') {
              this.sidebarProvider?.loadWaveform(result.waveformData);
              this.sidebarProvider?.reveal();
            } else {
              WaveViewerPanel.createOrShow(this.context, result.waveformData, result.entity, result.config);
            }
          }

          const elapsed = result.config ? `${result.config.durationNs}ns simulated` : '';
          vscode.window.showInformationMessage(
            `Simulation complete: ${result.waveformData.signals.length} signals${elapsed ? ` (${elapsed})` : ''}`
          );
        } else {
          this.terminal.complete();
          vscode.window.showWarningMessage('Simulation completed but no waveform file was generated.');
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.terminal.fail(message);
        this.logger.error('Simulation error:', message);
        this.onStatusChange({
          state: 'failed',
          errors: [{
            phase: 'runtime',
            raw: message,
            translated: message,
            severity: 'error',
          }],
        });
        vscode.window.showErrorMessage(`Simulation error: ${message}`);
      }
    });
  }

  /**
   * Show the simulation output channel.
   */
  showTerminal(): void {
    this.terminal.show();
  }

  /**
   * Generate a testbench file for the active VHDL entity.
   */
  async generateTestbenchFile(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'vhdl') {
      vscode.window.showErrorMessage('No active VHDL file.');
      return;
    }

    const content = editor.document.getText();
    const result = this.orchestrator.generateTestbenchString(content, editor.document.uri.fsPath);

    if (!result) {
      vscode.window.showErrorMessage('No entity found in active file.');
      return;
    }

    // Open testbench in new editor
    const doc = await vscode.workspace.openTextDocument({
      content: result.tbSource,
      language: 'vhdl',
    });
    await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);

    vscode.window.showInformationMessage(
      `Testbench generated for entity '${result.entity.name}'`
    );
  }

  /**
   * Open the wave viewer with last simulation data.
   */
  openWaveViewer(): void {
    if (!this.lastWaveformData) {
      vscode.window.showInformationMessage('No waveform data available. Run a simulation first.');
      return;
    }

    WaveViewerPanel.createOrShow(this.context, this.lastWaveformData);
  }



}
