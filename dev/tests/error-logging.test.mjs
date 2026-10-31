import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const shippedFiles = (await readFile(new URL('../../tools/release-files.txt', import.meta.url), 'utf8'))
  .split(/\r?\n/).filter((file) => file.startsWith('js/') && file.endsWith('.js'));

test('shipped error and warning calls do not pass sensitive records or messages', async () => {
  const sensitiveArgument = /(?:\b(?:settings|rawLocalSettings|localSettings|syncedSettings|mergedSettings|localData|remoteSettings|errorMsg|lastError|exception)\b|request\.tab(?!\.id)|focusedTab(?!\.id)|tabProperties\.(?:url|title)|tab\.(?:url|title)|gsWhitelist)/;
  for (const file of shippedFiles) {
    const source = await readFile(new URL(`../../${file}`, import.meta.url), 'utf8');
    const callStart = /gsUtils\.(?:error|warning)\(/g;
    let match;
    while ((match = callStart.exec(source))) {
      let depth = 1;
      let end = callStart.lastIndex;
      while (end < source.length && depth > 0) {
        if (source[end] === '(') depth++;
        if (source[end] === ')') depth--;
        end++;
      }
      const args = source.slice(callStart.lastIndex, end - 1);
      const expressions = args.replace(/'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|`(?:\\.|[^`\\])*`/gs, '');
      assert.doesNotMatch(expressions, sensitiveArgument, `${file}:${source.slice(0, match.index).split('\n').length} may pass sensitive data to an error/warning logger`);
      callStart.lastIndex = end;
    }
  }
});
