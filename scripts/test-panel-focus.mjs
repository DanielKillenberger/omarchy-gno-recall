import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Execute the actual QML handlers against both generations of the bar API.
const source = readFileSync(new URL('../Panel.qml', import.meta.url), 'utf8');
const handlers = ['close', 'setCenterHoverRevealSuppressed'].map(name => {
  const match = source.match(new RegExp(`  function ${name}\\([^]*?\\n  }`));
  assert.ok(match, `Missing ${name} handler`);
  return match[0];
}).join('\n');

function panel(bar) {
  const state = { bar, opened: true };
  state.controller = { hide() { state.opened = false; } };
  const context = vm.createContext({ root: state, cursorActive: true });
  vm.runInContext(handlers, context);
  return { state, context };
}

let suppressed = false;
const current = panel({
  get centerHoverRevealSuppressed() { return suppressed; },
  set centerHoverRevealSuppressed(value) { throw Error('read-only property'); },
  setCenterHoverRevealSuppressed(value) { suppressed = value; },
});
vm.runInContext('setCenterHoverRevealSuppressed(true)', current.context);
assert.equal(suppressed, true);
vm.runInContext('close()', current.context);
assert.equal(suppressed, false);
assert.equal(current.state.opened, false);
assert.equal(current.context.cursorActive, false);

const legacy = panel({ centerHoverRevealSuppressed: true });
vm.runInContext('close()', legacy.context);
assert.equal(legacy.state.bar.centerHoverRevealSuppressed, false);
assert.equal(legacy.state.opened, false);

const failing = panel({ setCenterHoverRevealSuppressed() { throw Error('bar failure'); } });
assert.throws(() => vm.runInContext('close()', failing.context), /bar failure/);
assert.equal(failing.state.opened, false, 'Optional bar failure must not prevent dismissal');

const missing = panel(null);
vm.runInContext('close()', missing.context);
assert.equal(missing.state.opened, false);
console.log('Panel focus regression checks passed');
