// ============================================================================
// Chronam — Process Runner
// ============================================================================
// Cross-platform utility for spawning simulator CLI processes.
// Wraps Node.js child_process with timeout, cancellation, and output capture.
// ============================================================================

import { spawn } from 'child_process';
import type { ChildProcess } from 'child_process';

/** Result from a process execution */
export interface ProcessResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  killed: boolean;
}

/** Options for process execution */
export interface ProcessOptions {
  /** Working directory */
  cwd: string;
  /** Timeout in milliseconds (default: 60000) */
  timeoutMs?: number;
  /** Environment variable overrides */
  env?: Record<string, string>;
  /** Abort signal for cancellation */
  signal?: AbortSignal;
  /** Callback for stdout lines as they arrive */
  onStdout?: (line: string) => void;
  /** Callback for stderr lines as they arrive */
  onStderr?: (line: string) => void;
}

/**
 * Execute a command and capture its output.
 * Supports timeout, cancellation, and streaming output callbacks.
 */
export function runProcess(
  command: string,
  args: string[],
  options: ProcessOptions
): Promise<ProcessResult> {
  return new Promise((resolve, reject) => {
    const {
      cwd,
      timeoutMs = 60000,
      env,
      signal,
      onStdout,
      onStderr,
    } = options;

    let child: ChildProcess;
    let timedOut = false;
    let killed = false;

    try {
      console.log(`[DEBUG] RUNNING: ${command} ${args.join(' ')} (cwd: ${cwd})`);
      child = spawn(command, args, {
        cwd,
        env: env ? { ...process.env, ...env } : process.env,
        shell: false,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch (err) {
      reject(new Error(`Failed to spawn process "${command}": ${err}`));
      return;
    }

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (data: Buffer) => {
      const text = data.toString();
      stdout += text;
      if (onStdout) {
        const lines = text.split('\n');
        for (const line of lines) {
          if (line.trim()) onStdout(line);
        }
      }
    });

    child.stderr?.on('data', (data: Buffer) => {
      const text = data.toString();
      stderr += text;
      if (onStderr) {
        const lines = text.split('\n');
        for (const line of lines) {
          if (line.trim()) onStderr(line);
        }
      }
    });

    // Timeout handling
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
      setTimeout(() => {
        if (!child.killed) {
          child.kill('SIGKILL');
        }
      }, 2000);
    }, timeoutMs);

    // Cancellation via AbortSignal
    if (signal) {
      const onAbort = () => {
        killed = true;
        child.kill('SIGTERM');
      };
      signal.addEventListener('abort', onAbort, { once: true });
      child.on('exit', () => signal.removeEventListener('abort', onAbort));
    }

    child.on('error', (err: Error) => {
      clearTimeout(timer);
      reject(new Error(`Process "${command}" error: ${err.message}`));
    });

    child.on('exit', (code: number | null) => {
      clearTimeout(timer);
      resolve({
        exitCode: code ?? 1,
        stdout,
        stderr,
        timedOut,
        killed,
      });
    });
  });
}

/**
 * Check if a command exists on the system PATH.
 */
export async function commandExists(command: string): Promise<boolean> {
  try {
    const checkCmd = process.platform === 'win32' ? 'where' : 'which';
    const result = await runProcess(checkCmd, [command], {
      cwd: process.cwd(),
      timeoutMs: 5000,
    });
    return result.exitCode === 0;
  } catch {
    return false;
  }
}
