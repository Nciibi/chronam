// ============================================================================
// Chronam — Logger Utility
// ============================================================================

import * as vscode from 'vscode';

export class Logger {
  private channel: vscode.OutputChannel;
  private prefix: string;

  constructor(name: string) {
    this.prefix = name;
    this.channel = vscode.window.createOutputChannel(name);
  }

  info(message: string, ...args: unknown[]): void {
    this.log('INFO', message, ...args);
  }

  warn(message: string, ...args: unknown[]): void {
    this.log('WARN', message, ...args);
  }

  error(message: string, ...args: unknown[]): void {
    this.log('ERROR', message, ...args);
  }

  debug(message: string, ...args: unknown[]): void {
    this.log('DEBUG', message, ...args);
  }

  show(): void {
    this.channel.show();
  }

  private log(level: string, message: string, ...args: unknown[]): void {
    const timestamp = new Date().toISOString();
    const formatted = args.length > 0
      ? `[${timestamp}] [${level}] ${message} ${args.map(a => JSON.stringify(a)).join(' ')}`
      : `[${timestamp}] [${level}] ${message}`;

    this.channel.appendLine(formatted);

    if (level === 'ERROR') {
      console.error(`[${this.prefix}] ${message}`, ...args);
    }
  }

  dispose(): void {
    this.channel.dispose();
  }
}
