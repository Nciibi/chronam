// ============================================================================
// WaveForge — VCD Tokenizer
// ============================================================================
// Low-level tokenizer for IEEE 1364 Value Change Dump files.
// Produces a stream of typed tokens consumed by the parser.
// ============================================================================

export type VCDTokenType =
  | 'keyword'      // $date, $version, $timescale, $scope, $upscope, $var, $enddefinitions, $end, $dumpvars, $dumpall, $dumpoff, $dumpon, $comment
  | 'timestamp'    // #<number>
  | 'scalar_value' // 0/1/x/z/X/Z + id_code
  | 'vector_value' // b<binary> <id_code> or B<binary> <id_code>
  | 'real_value'   // r<real> <id_code> or R<real> <id_code>
  | 'word'         // any other whitespace-delimited token
  | 'eof';

export interface VCDToken {
  type: VCDTokenType;
  value: string;
  line: number;
  column: number;
}

/**
 * Tokenize a VCD file content string into an array of tokens.
 * This is a line-oriented tokenizer since VCD is whitespace-delimited.
 */
export function tokenizeVCD(content: string): VCDToken[] {
  const tokens: VCDToken[] = [];
  const lines = content.split('\n');

  const VCD_KEYWORDS = new Set([
    '$date', '$version', '$timescale', '$scope', '$upscope',
    '$var', '$enddefinitions', '$end', '$dumpvars', '$dumpall',
    '$dumpoff', '$dumpon', '$comment',
  ]);

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx].trim();
    if (line.length === 0) continue;

    // Split line into whitespace-delimited words
    const words = line.split(/\s+/);
    let col = 0;

    for (const word of words) {
      if (word.length === 0) continue;

      const token: VCDToken = {
        type: 'word',
        value: word,
        line: lineIdx + 1,
        column: col,
      };

      if (VCD_KEYWORDS.has(word)) {
        token.type = 'keyword';
      } else if (word.startsWith('#')) {
        token.type = 'timestamp';
        token.value = word.substring(1);
      } else if (/^[01xzXZuUwWhHlL-][^\s]*$/.test(word) && word.length >= 2 && !word.startsWith('b') && !word.startsWith('B') && !word.startsWith('r') && !word.startsWith('R')) {
        // Scalar value change: value_char + id_code (e.g., "1!" or "0#")
        token.type = 'scalar_value';
      } else if (word.startsWith('b') || word.startsWith('B')) {
        token.type = 'vector_value';
      } else if (word.startsWith('r') || word.startsWith('R')) {
        token.type = 'real_value';
      }

      tokens.push(token);
      col += word.length + 1;
    }
  }

  tokens.push({ type: 'eof', value: '', line: lines.length, column: 0 });
  return tokens;
}
