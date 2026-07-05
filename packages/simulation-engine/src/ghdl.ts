// ============================================================================
// Chronam — GHDL Simulator Adapter
// ============================================================================
// Implements the SimulatorAdapter interface for GHDL.
// Handles analysis (-a), elaboration (-e), and simulation (-r) phases.
// Translates GHDL error messages into structured diagnostics.
// ============================================================================

import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';
import type {
  SimulatorInfo,
  SimulationConfig,
  SimulationResult,
  SimulationStatus,
  CompileResult,
  SimulationError,
  VHDLVersion,
} from '@chronam/shared-types';
import type { SimulatorAdapter } from './adapter.js';
import { runProcess, commandExists } from './runner.js';

/** Map our VHDLVersion to GHDL's --std flag */
const VHDL_STD_MAP: Record<VHDLVersion, string> = {
  '1987': '87',
  '1993': '93',
  '2002': '02',
  '2008': '08',
  '2019': '19',
};

export class GHDLAdapter implements SimulatorAdapter {
  readonly id = 'ghdl' as const;
  readonly name = 'GHDL';

  private ghdlPath: string;

  constructor(customPath?: string) {
    this.ghdlPath = customPath || 'ghdl';
  }

  async detect(customPath?: string): Promise<SimulatorInfo | null> {
    const cmd = customPath || this.ghdlPath;

    if (customPath) {
      this.ghdlPath = customPath;
    }

    const exists = await commandExists(cmd);
    if (!exists) return null;

    try {
      const result = await runProcess(cmd, ['--version'], {
        cwd: process.cwd(),
        timeoutMs: 5000,
      });

      if (result.exitCode !== 0) return null;

      const versionMatch = result.stdout.match(/GHDL\s+([\d.]+)/i);
      const version = versionMatch ? versionMatch[1] : 'unknown';

      return {
        id: 'ghdl',
        name: 'GHDL',
        version,
        path: cmd,
        capabilities: {
          vhdlVersions: ['1987', '1993', '2002', '2008'],
          waveFormats: ['vcd', 'ghw'],
          supportsVerilog: false,
        },
      };
    } catch {
      return null;
    }
  }

  async analyze(
    sources: string[],
    workDir: string,
    vhdlVersion: VHDLVersion = '2008',
    onStderr?: (line: string) => void
  ): Promise<CompileResult> {
    await fs.mkdir(workDir, { recursive: true });

    const errors: SimulationError[] = [];
    let allStdout = '';
    let allStderr = '';

    for (const source of sources) {
      const args = [
        '-a',
        `--std=${VHDL_STD_MAP[vhdlVersion]}`,
        `--workdir=${workDir}`,
        source,
      ];

      const result = await runProcess(this.ghdlPath, args, {
        cwd: workDir,
        timeoutMs: 30000,
        onStdout: onStderr,
        onStderr,
      });

      allStdout += result.stdout;
      allStderr += result.stderr;

      if (result.exitCode !== 0) {
        const parsed = this.parseErrors(result.stderr, 'analysis');
        errors.push(...parsed);

        return {
          success: false,
          errors,
          stdout: allStdout,
          stderr: allStderr,
        };
      }
    }

    return {
      success: true,
      errors,
      stdout: allStdout,
      stderr: allStderr,
    };
  }

  async elaborate(topEntity: string, workDir: string, vhdlVersion: VHDLVersion = '2008', onStderr?: (line: string) => void): Promise<CompileResult> {
    const args = [
      '-e',
      `--std=${VHDL_STD_MAP[vhdlVersion]}`,
      `--workdir=${workDir}`,
      topEntity,
    ];

    const result = await runProcess(this.ghdlPath, args, {
      cwd: workDir,
      timeoutMs: 30000,
      onStderr,
    });

    const errors = result.exitCode !== 0
      ? this.parseErrors(result.stderr, 'elaboration')
      : [];

    return {
      success: result.exitCode === 0,
      errors,
      stdout: result.stdout,
      stderr: result.stderr,
    };
  }

  async run(
    topEntity: string,
    config: SimulationConfig,
    workDir: string,
    vhdlVersion: VHDLVersion = '2008',
    onStderr?: (line: string) => void
  ): Promise<SimulationResult> {
    const startTime = Date.now();
    const waveFile = path.join(workDir, `${topEntity}.vcd`);

    const args = [
      '-r',
      `--std=${VHDL_STD_MAP[vhdlVersion]}`,
      `--workdir=${workDir}`,
      topEntity,
      `--stop-time=${config.durationNs}ns`,
    ];

    // Wave format output
    if (config.waveFormat === 'vcd') {
      args.push(`--vcd=${waveFile}`);
    } else if (config.waveFormat === 'ghw') {
      const ghwFile = path.join(workDir, `${topEntity}.ghw`);
      args.push(`--wave=${ghwFile}`);
    }

    // Extra flags
    args.push(...config.extraFlags);

    const result = await runProcess(this.ghdlPath, args, {
      cwd: workDir,
      timeoutMs: 120000,
      onStderr,
    });

    const wallTimeMs = Date.now() - startTime;

    if (result.timedOut) {
      return {
        status: { state: 'failed', errors: [{
          phase: 'runtime',
          raw: 'Simulation timed out',
          translated: `Simulation exceeded timeout of 120 seconds. Try reducing simulation duration.`,
          severity: 'error',
        }]},
        errors: [],
        stdout: result.stdout,
        stderr: result.stderr,
        wallTimeMs,
      };
    }

    if (result.exitCode !== 0) {
      const errors = this.parseErrors(result.stderr, 'runtime');
      return {
        status: { state: 'failed', errors },
        errors,
        stdout: result.stdout,
        stderr: result.stderr,
        wallTimeMs,
      };
    }

    // Verify wave file was created
    let waveformPath: string | undefined;
    try {
      await fs.access(waveFile);
      waveformPath = waveFile;
    } catch {
      // Wave file might not exist if simulation ended very quickly
    }

    const status: SimulationStatus = {
      state: 'completed',
      durationMs: wallTimeMs,
      signalCount: 0, // Will be filled after VCD parsing
    };

    return {
      status,
      waveformPath,
      errors: [],
      stdout: result.stdout,
      stderr: result.stderr,
      wallTimeMs,
    };
  }

  translateError(raw: string): SimulationError | null {
    const errors = this.parseErrors(raw, 'analysis');
    return errors[0] ?? null;
  }

  async clean(workDir: string): Promise<void> {
    try {
      const files = await fs.readdir(workDir);
      for (const file of files) {
        const ext = path.extname(file).toLowerCase();
        if (['.o', '.cf', '.vcd', '.ghw'].includes(ext)) {
          await fs.unlink(path.join(workDir, file));
        }
      }
    } catch {
      // Directory might not exist
    }
  }

  // ─── Error Parsing ──────────────────────────────────────────────────────

  private parseErrors(stderr: string, phase: SimulationError['phase']): SimulationError[] {
    const errors: SimulationError[] = [];
    const lines = stderr.split('\n').filter((l) => l.trim());

    for (const line of lines) {
      const error = this.parseSingleError(line, phase);
      if (error) {
        errors.push(error);
      }
    }

    return errors;
  }

  private parseSingleError(line: string, phase: SimulationError['phase']): SimulationError | null {
    // GHDL error format: <file>:<line>:<col>: <severity>: <message>
    const match = line.match(
      /^(.+?):(\d+):(\d+):\s*(error|warning|note):\s*(.+)$/i
    );

    if (match) {
      const [, file, lineNum, col, severity, message] = match;
      return {
        phase,
        raw: line,
        translated: this.translateGHDLMessage(message),
        location: {
          file,
          startLine: parseInt(lineNum, 10),
          endLine: parseInt(lineNum, 10),
          startColumn: parseInt(col, 10),
          endColumn: parseInt(col, 10),
        },
        severity: severity.toLowerCase() === 'error' ? 'error' : 'warning',
        suggestion: this.getSuggestion(message),
      };
    }

    // GHDL format without column: <file>:<line>: <severity>: <message>
    const match2 = line.match(
      /^(.+?):(\d+):\s*(error|warning|note):\s*(.+)$/i
    );

    if (match2) {
      const [, file, lineNum, severity, message] = match2;
      return {
        phase,
        raw: line,
        translated: this.translateGHDLMessage(message),
        location: {
          file,
          startLine: parseInt(lineNum, 10),
          endLine: parseInt(lineNum, 10),
          startColumn: 0,
          endColumn: 0,
        },
        severity: severity.toLowerCase() === 'error' ? 'error' : 'warning',
        suggestion: this.getSuggestion(message),
      };
    }

    // Generic GHDL error (no file reference)
    if (line.includes('error:') || line.includes('Error:')) {
      return {
        phase,
        raw: line,
        translated: this.translateGHDLMessage(line),
        severity: 'error',
      };
    }

    return null;
  }

  /**
   * Translate cryptic GHDL error messages into human-readable form.
   */
  private translateGHDLMessage(message: string): string {
    const translations: Array<[RegExp, string | ((m: RegExpMatchArray) => string)]> = [
      [/unknown identifier "(\w+)"/i, (m) => `Signal or variable '${m[1]}' is not declared. Check spelling or add a declaration.`],
      [/no declaration for "(\w+)"/i, (m) => `'${m[1]}' has not been declared in this scope.`],
      [/can't match (\w+) with type (\w+)/i, (m) => `Type mismatch: cannot assign '${m[1]}' to type '${m[2]}'.`],
      [/(\w+) is not a signal name/i, (m) => `'${m[1]}' is not declared as a signal. Use 'signal ${m[1]} : ...' to declare it.`],
      [/missing semicolon/i, 'Missing semicolon at the end of a statement.'],
      [/extra \w+ after end of/i, 'Unexpected tokens after the end of a declaration.'],
      [/no matching "end"/i, 'Missing "end" keyword. Check that all blocks (if, process, entity) are properly closed.'],
      [/port "(\w+)" is not mapped/i, (m) => `Port '${m[1]}' is required but not connected in the port map.`],
      [/bound check failure/i, 'Array index out of bounds during simulation.'],
    ];

    for (const [pattern, replacement] of translations) {
      const match = message.match(pattern);
      if (match) {
        return typeof replacement === 'function' ? replacement(match) : replacement;
      }
    }

    return message;
  }

  private getSuggestion(message: string): string | undefined {
    if (/unknown identifier/i.test(message)) {
      return 'Declare the signal/variable before using it, or check for typos.';
    }
    if (/missing semicolon/i.test(message)) {
      return 'Add a semicolon (;) at the end of the statement.';
    }
    if (/port.*not mapped/i.test(message)) {
      return 'Connect the port in the port map or use "open" for unused output ports.';
    }
    return undefined;
  }
}
