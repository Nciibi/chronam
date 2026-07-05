import * as path from 'path';
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

export interface OrchestratorDelegate {
  onStatusChange(status: SimulationStatus): void;
  onLogInfo(message: string, ...args: any[]): void;
  onLogError(message: string, ...args: any[]): void;
  promptEntitySelection(entities: Entity[]): Promise<Entity | undefined>;
  getSimulationConfig(): { durationNs: number; clockPeriodNs: number; ghdlPath?: string };
  readFile(path: string): Promise<string>;
}

export class SimulationOrchestrator {
  private engine: SimulationEngine;
  private delegate: OrchestratorDelegate;

  constructor(delegate: OrchestratorDelegate) {
    this.delegate = delegate;
    const config = delegate.getSimulationConfig();
    this.engine = new SimulationEngine('ghdl', config.ghdlPath);
  }

  async detectSimulator() {
    return await this.engine.detectSimulator();
  }

  async runSimulation(
    fileContent: string,
    filePath: string,
    workDir: string,
    onPhase?: (phase: string, detail: string) => void
  ): Promise<{ waveformData?: WaveformData; entity?: Entity; config?: SimulationConfig; error?: any }> {
    
    // Phase 1: Parse VHDL
    this.delegate.onStatusChange({ state: 'preparing', message: 'Parsing VHDL...' });
    this.delegate.onLogInfo('Parsing VHDL file:', filePath);
    onPhase?.('parsing', `Parsing ${path.basename(filePath)}`);

    const parsedFile = parseVHDLFile(fileContent, filePath);

    if (parsedFile.entities.length === 0) {
      throw new Error('No entity found in the active VHDL file.');
    }

    let entity: Entity;
    if (parsedFile.entities.length > 1) {
      const picked = await this.delegate.promptEntitySelection(parsedFile.entities);
      if (!picked) return {}; // user cancelled
      entity = picked;
    } else {
      entity = parsedFile.entities[0];
    }

    this.delegate.onLogInfo(`Entity: ${entity.name}, Ports: ${entity.ports.length}`);

    // Phase 2: Generate testbench
    onPhase?.('generating', `Generating testbench for ${entity.name}...`);
    this.delegate.onStatusChange({ state: 'preparing', message: 'Generating testbench...' });
    const config = this.buildSimConfig(entity);
    const tbResult = generateTestbench(entity, {
      config,
      resetDurationNs: this.delegate.getSimulationConfig().clockPeriodNs * 2,
    });

    this.delegate.onLogInfo(`Testbench generated: ${tbResult.entityName}`);

    // Phase 3: Run simulation
    const result = await this.engine.runSimulation(
      filePath,
      tbResult.source,
      tbResult.entityName,
      config,
      workDir,
      (phase, detail) => {
        this.delegate.onLogInfo(`[${phase}] ${detail}`);
        onPhase?.(phase, detail);
        if (phase === 'compiling') {
          this.delegate.onStatusChange({ state: 'compiling', file: detail, step: 1, totalSteps: 3 });
        } else if (phase === 'elaborating') {
          this.delegate.onStatusChange({ state: 'elaborating', entity: detail });
        } else {
          this.delegate.onStatusChange({ state: 'running' });
        }
      }
    );

    if (result.status.state === 'failed') {
      this.delegate.onStatusChange(result.status);
      this.delegate.onLogError('Simulation failed', result.stderr);
      return { error: result.errors[0]?.translated || 'Unknown error' };
    }

    // Phase 4: Parse waveform
    if (result.waveformPath) {
      onPhase?.('loading', 'Loading waveform data...');
      this.delegate.onStatusChange({ state: 'preparing', message: 'Loading waveform...' });
      
      const vcdContent = await this.delegate.readFile(result.waveformPath);
      const waveformData = parseVCD(vcdContent);

      this.delegate.onStatusChange({
        state: 'completed',
        durationMs: result.wallTimeMs,
        signalCount: waveformData.signals.length,
      });

      return { waveformData, entity, config };
    } else {
      this.delegate.onStatusChange({
        state: 'completed',
        durationMs: result.wallTimeMs,
        signalCount: 0,
      });
      return { entity, config };
    }
  }

  generateTestbenchString(fileContent: string, filePath: string): { tbSource: string; entity: Entity } | null {
    const entity = extractFirstEntity(fileContent, filePath);
    if (!entity) return null;

    const config = this.buildSimConfig(entity);
    const tbResult = generateTestbench(entity, { config });

    return { tbSource: tbResult.source, entity };
  }

  private buildSimConfig(entity: Entity): SimulationConfig {
    const config = createDefaultSimConfig();
    const appConfig = this.delegate.getSimulationConfig();
    
    config.durationNs = appConfig.durationNs;

    const clockPatterns = ['clk', 'clock', 'clk_i', 'i_clk', 'sys_clk'];
    const clockPeriod = appConfig.clockPeriodNs;

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
}
