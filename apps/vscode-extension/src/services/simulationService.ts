// ============================================================================
// Chronam — Simulation Service
// ============================================================================
// Central orchestrator for the simulation pipeline within the extension.
// Manages: parsing → testbench generation → compilation → simulation →
// waveform loading → webview display.
// ============================================================================

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import { parseVHDLFile, extractFirstEntity } from '@chronam/vhdl-parser';
import { generateTestbench } from '@chronam/testbench-generator';
import { SimulationEngine } from '@chronam/simulation-engine';
import { parseVCD } from '@chronam/vcd-parser';
import type {
  Entity,
  SimulationConfig,
  SimulationStatus,
  WaveformData,
} from '@chronam/shared-types';
import { createDefaultSimConfig, createDefaultClock } from '@chronam/shared-types';
import { WaveViewerPanel } from '../webview/waveViewerPanel';
import type { Logger } from '../utils/logger';

type StatusListener = (status: SimulationStatus) => void;

export class SimulationService {
  private context: vscode.ExtensionContext;
  private logger: Logger;
  private engine: SimulationEngine;
  private diagnostics: vscode.DiagnosticCollection | null = null;
  private statusListeners: StatusListener[] = [];
  private currentStatus: SimulationStatus = { state: 'idle' };
  private lastWaveformData: WaveformData | null = null;
  private abortController: AbortController | null = null;

  constructor(context: vscode.ExtensionContext, logger: Logger) {
    this.context = context;
    this.logger = logger;

    // Read custom GHDL path from settings
    const config = vscode.workspace.getConfiguration('chronam');
    const ghdlPath = config.get<string>('simulator.ghdlPath', '');
    this.engine = new SimulationEngine('ghdl', ghdlPath || undefined);
  }

  setDiagnostics(diagnostics: vscode.DiagnosticCollection): void {
    this.diagnostics = diagnostics;
  }

  onStatusChange(listener: StatusListener): void {
    this.statusListeners.push(listener);
  }

  private setStatus(status: SimulationStatus): void {
    this.currentStatus = status;
    for (const listener of this.statusListeners) {
      listener(status);
    }
  }

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
    const simInfo = await this.engine.detectSimulator();
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
      // Phase 1: Parse VHDL
      this.setStatus({ state: 'preparing', message: 'Parsing VHDL...' });
      this.logger.info('Parsing VHDL file:', filePath);

      const parsedFile = parseVHDLFile(fileContent, filePath);

      if (parsedFile.entities.length === 0) {
        vscode.window.showErrorMessage('No entity found in the active VHDL file.');
        this.setStatus({ state: 'idle' });
        return;
      }

      // Let user pick entity if multiple
      let entity: Entity;
      if (parsedFile.entities.length > 1) {
        const picked = await vscode.window.showQuickPick(
          parsedFile.entities.map((e) => ({
            label: e.name,
            description: `${e.ports.length} ports`,
            entity: e,
          })),
          { placeHolder: 'Select entity to simulate' }
        );
        if (!picked) {
          this.setStatus({ state: 'idle' });
          return;
        }
        entity = picked.entity;
      } else {
        entity = parsedFile.entities[0];
      }

      this.logger.info(`Entity: ${entity.name}, Ports: ${entity.ports.length}`);

      // Phase 2: Generate testbench
      this.setStatus({ state: 'preparing', message: 'Generating testbench...' });
      const config = this.buildSimConfig(entity);

      const tbResult = generateTestbench(entity, {
        config,
        resetDurationNs: vscode.workspace.getConfiguration('chronam')
          .get<number>('testbench.defaultClockPeriodNs', 10) * 2,
      });

      this.logger.info(`Testbench generated: ${tbResult.entityName}`);
      this.logger.info(`Detected clocks: ${tbResult.detectedClocks.join(', ') || 'none'}`);
      this.logger.info(`Detected resets: ${tbResult.detectedResets.join(', ') || 'none'}`);

      // Phase 3: Run simulation
      const result = await this.engine.runSimulation(
        filePath,
        tbResult.source,
        tbResult.entityName,
        config,
        workDir,
        (phase, detail) => {
          this.logger.info(`[${phase}] ${detail}`);
          if (phase === 'compiling') {
            this.setStatus({ state: 'compiling', file: detail, step: 1, totalSteps: 3 });
          } else if (phase === 'elaborating') {
            this.setStatus({ state: 'elaborating', entity: detail });
          } else {
            this.setStatus({ state: 'running' });
          }
        }
      );

      // Handle errors
      if (result.status.state === 'failed') {
        this.setStatus(result.status);
        this.reportErrors(result.errors, document.uri);
        this.logger.error('Simulation failed', result.stderr);
        vscode.window.showErrorMessage(
          `Simulation failed: ${result.errors[0]?.translated || 'Unknown error'}`,
          'Show Output'
        ).then((action) => {
          if (action === 'Show Output') this.logger.show();
        });
        return;
      }

      // Phase 4: Parse waveform
      if (result.waveformPath) {
        this.setStatus({ state: 'preparing', message: 'Loading waveform...' });
        this.logger.info('Parsing VCD:', result.waveformPath);

        const vcdContent = await fs.readFile(result.waveformPath, 'utf-8');
        const waveformData = parseVCD(vcdContent);

        this.lastWaveformData = waveformData;
        this.logger.info(`Loaded ${waveformData.signals.length} signals, end time: ${waveformData.endTime}`);

        // Phase 5: Open waveform viewer
        const autoOpen = vscode.workspace.getConfiguration('chronam')
          .get<boolean>('general.autoOpenWaveViewer', true);

        if (autoOpen) {
          WaveViewerPanel.createOrShow(this.context, waveformData, entity, config);
        }

        this.setStatus({
          state: 'completed',
          durationMs: result.wallTimeMs,
          signalCount: waveformData.signals.length,
        });

        vscode.window.showInformationMessage(
          `Simulation complete: ${waveformData.signals.length} signals, ${result.wallTimeMs}ms`
        );
      } else {
        this.setStatus({
          state: 'completed',
          durationMs: result.wallTimeMs,
          signalCount: 0,
        });
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
    const entity = extractFirstEntity(content, editor.document.uri.fsPath);

    if (!entity) {
      vscode.window.showErrorMessage('No entity found in active file.');
      return;
    }

    const config = this.buildSimConfig(entity);
    const tbResult = generateTestbench(entity, { config });

    // Open testbench in new editor
    const doc = await vscode.workspace.openTextDocument({
      content: tbResult.source,
      language: 'vhdl',
    });
    await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);

    vscode.window.showInformationMessage(
      `Testbench generated for entity '${entity.name}'`
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

  /**
   * Detect and display simulator info.
   */
  async detectSimulator(): Promise<void> {
    const info = await this.engine.detectSimulator();
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

  // ─── Private Helpers ──────────────────────────────────────────────────

  private buildSimConfig(entity: Entity): SimulationConfig {
    const vsConfig = vscode.workspace.getConfiguration('chronam');
    const config = createDefaultSimConfig();

    config.durationNs = vsConfig.get<number>('simulator.defaultDurationNs', 1000);

    // Auto-detect clocks and add default configs
    const clockPatterns = ['clk', 'clock', 'clk_i', 'i_clk', 'sys_clk'];
    const clockPeriod = vsConfig.get<number>('testbench.defaultClockPeriodNs', 10);

    for (const port of entity.ports) {
      if (port.direction !== 'in') continue;
      if (port.type.kind !== 'std_logic' && port.type.kind !== 'bit') continue;

      const isClk = clockPatterns.some(p => port.name.toLowerCase() === p);
      if (isClk) {
        config.clocks.push(createDefaultClock(port.name));
        config.clocks[config.clocks.length - 1].periodNs = clockPeriod;
      }
    }

    return config;
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
