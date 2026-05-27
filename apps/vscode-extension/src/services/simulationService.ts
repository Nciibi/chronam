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
import type { Logger } from '../utils/logger';

type StatusListener = (status: SimulationStatus) => void;

export class SimulationService implements OrchestratorDelegate {
  private context: vscode.ExtensionContext;
  private logger: Logger;
  private orchestrator: SimulationOrchestrator;
  private diagnostics: vscode.DiagnosticCollection | null = null;
  private statusListeners: StatusListener[] = [];
  private currentStatus: SimulationStatus = { state: 'idle' };
  private lastWaveformData: WaveformData | null = null;

  constructor(context: vscode.ExtensionContext, logger: Logger) {
    this.context = context;
    this.logger = logger;
    this.orchestrator = new SimulationOrchestrator(this);
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
    this.currentStatus = status;
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
      clockPeriodNs: config.get<number>('testbench.defaultClockPeriodNs', 10),
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

    // Clear previous diagnostics
    this.diagnostics?.clear();

    const filePath = document.uri.fsPath;
    const fileContent = document.getText();
    const workDir = path.join(path.dirname(filePath), '.chronam');

    try {
      const result = await this.orchestrator.runSimulation(
        fileContent,
        filePath,
        workDir
      );

      if (result.error) {
        vscode.window.showErrorMessage(
          `Simulation failed: ${result.error}`,
          'Show Output'
        ).then((action) => {
          if (action === 'Show Output') this.logger.show();
        });
        return;
      }

      if (result.waveformData) {
        this.lastWaveformData = result.waveformData;
        const autoOpen = vscode.workspace.getConfiguration('chronam')
          .get<boolean>('general.autoOpenWaveViewer', true);

        if (autoOpen) {
          WaveViewerPanel.createOrShow(this.context, result.waveformData, result.entity, result.config);
        }
        
        vscode.window.showInformationMessage(
          `Simulation complete: ${result.waveformData.signals.length} signals`
        );
      } else {
        vscode.window.showWarningMessage('Simulation completed but no waveform file was generated.');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error('Simulation error:', message);
      this.setStatus({
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



  private reportErrors(
    errors: Array<{ translated: string; location?: { file: string; startLine: number; startColumn: number; endLine: number; endColumn: number }; severity: 'error' | 'warning' }>,
    fallbackUri: vscode.Uri
  ): void {
    if (!this.diagnostics) return;

    const diagMap = new Map<string, vscode.Diagnostic[]>();

    for (const err of errors) {
      const uri = err.location?.file
        ? vscode.Uri.file(err.location.file)
        : fallbackUri;

      const range = err.location
        ? new vscode.Range(
            Math.max(0, err.location.startLine - 1),
            err.location.startColumn,
            Math.max(0, err.location.endLine - 1),
            err.location.endColumn || 1000
          )
        : new vscode.Range(0, 0, 0, 0);

      const severity = err.severity === 'error'
        ? vscode.DiagnosticSeverity.Error
        : vscode.DiagnosticSeverity.Warning;

      const diag = new vscode.Diagnostic(range, err.translated, severity);
      diag.source = 'Chronam';

      const key = uri.toString();
      if (!diagMap.has(key)) diagMap.set(key, []);
      diagMap.get(key)!.push(diag);
    }

    for (const [uriStr, diags] of diagMap) {
      this.diagnostics.set(vscode.Uri.parse(uriStr), diags);
    }
  }
}
