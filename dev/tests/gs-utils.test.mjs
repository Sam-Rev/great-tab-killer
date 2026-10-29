import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import test from 'node:test';

test('htmlEncode works without a document global', async () => {
  let source = await readFile(new URL('../../js/helpers/gsUtils.js', import.meta.url), 'utf8');
  source = source.replace(/^import .*;?\s*$/gm, '').replace('export var gsUtils =', 'var gsUtils =') + '\nglobalThis.utilsForTest = gsUtils;';
  const context = vm.createContext({});
  vm.runInContext(source, context);
  assert.equal(context.utilsForTest.htmlEncode(`<tag a="b"> &`), '&lt;tag a="b"&gt; &amp;');
});
