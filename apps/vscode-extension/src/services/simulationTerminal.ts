import * as vscode from 'vscode';

export class SimulationTerminal {
  private channel: vscode.OutputChannel;
  private startTime: number = 0;
  private phaseOrder: Array<{ label: string; prefix: string }> = [
    { label: 'Analyzing design', prefix: '[1/4]' },
    { label: 'Analyzing testbench', prefix: '[2/4]' },
    { label: 'Elaborating', prefix: '[3/4]' },
    { label: 'Simulating', prefix: '[4/4]' },
  ];
  private currentPhase: number = 0;

  constructor() {
    this.channel = vscode.window.createOutputChannel('Chronam Simulation', { log: false });
  }

  begin(): void {
    this.startTime = Date.now();
    this.currentPhase = 0;
    this.channel.clear();
    this.channel.appendLine('╔══════════════════════════════════════════╗');
    this.channel.appendLine('║       Chronam Simulation Pipeline       ║');
    this.channel.appendLine('╚══════════════════════════════════════════╝');
    this.channel.appendLine('');
    this.channel.show(true);
  }

  nextPhase(): void {
    if (this.currentPhase < this.phaseOrder.length) {
      const phase = this.phaseOrder[this.currentPhase];
      this.channel.appendLine('');
      this.channel.appendLine(`  ${phase.prefix} ${phase.label}...`);
      this.channel.appendLine(`  ${'─'.repeat(40)}`);
    }
    this.currentPhase++;
  }

  appendLine(line: string): void {
    this.channel.appendLine(`  ${line}`);
  }

  appendOutput(text: string): void {
    for (const line of text.split('\n')) {
      if (line.trim()) {
        this.channel.appendLine(`  │ ${line}`);
      }
    }
  }

  complete(signalCount?: number): void {
    const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(1);
    this.channel.appendLine('');
    this.channel.appendLine(`  ${'─'.repeat(40)}`);
    this.channel.appendLine(`  Done in ${elapsed}s ${signalCount !== undefined ? `| ${signalCount} signals` : ''}`);
    this.channel.appendLine('');
  }

  fail(errorMsg?: string): void {
    const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(1);
    this.channel.appendLine('');
    this.channel.appendLine(`  ${'─'.repeat(40)}`);
    this.channel.appendLine(`  Failed after ${elapsed}s`);
    if (errorMsg) {
      this.channel.appendLine(`  Error: ${errorMsg}`);
    }
    this.channel.appendLine('');
  }

  show(): void {
    this.channel.show(true);
  }

  dispose(): void {
    this.channel.dispose();
  }
}
