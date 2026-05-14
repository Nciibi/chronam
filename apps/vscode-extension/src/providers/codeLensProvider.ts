// ============================================================================
// WaveForge — CodeLens Provider
// ============================================================================
// Adds "▶ Run Simulation" and "📝 Generate Testbench" inline actions
// above each entity declaration in VHDL files.
// ============================================================================

import * as vscode from 'vscode';

export class VHDLCodeLensProvider implements vscode.CodeLensProvider {
  private _onDidChangeCodeLenses = new vscode.EventEmitter<void>();
  readonly onDidChangeCodeLenses = this._onDidChangeCodeLenses.event;

  provideCodeLenses(
    document: vscode.TextDocument,
    _token: vscode.CancellationToken
  ): vscode.CodeLens[] {
    const codeLenses: vscode.CodeLens[] = [];
    const text = document.getText();

    // Find entity declarations
    const entityRegex = /\bentity\s+(\w+)\s+is\b/gi;
    let match;

    while ((match = entityRegex.exec(text)) !== null) {
      const position = document.positionAt(match.index);
      const range = new vscode.Range(position, position);

      // Run Simulation lens
      codeLenses.push(
        new vscode.CodeLens(range, {
          title: '▶ Run Simulation',
          command: 'waveforge.runSimulation',
          tooltip: `Simulate entity '${match[1]}'`,
        })
      );

      // Generate Testbench lens
      codeLenses.push(
        new vscode.CodeLens(range, {
          title: '📝 Generate Testbench',
          command: 'waveforge.generateTestbench',
          tooltip: `Generate testbench for entity '${match[1]}'`,
        })
      );
    }

    return codeLenses;
  }
}
