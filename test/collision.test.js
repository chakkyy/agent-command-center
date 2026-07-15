'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { tmpHome, rm, ccmd, listJSON } = require('./helpers');

// #2: `feat/foo` and `feat_foo` are DIFFERENT branches and must not overwrite
// each other (slug() collapsed them to the same file).
test('feat/foo and feat_foo are distinct rows', () => {
  const home = tmpHome();
  try {
    ccmd(['report', '--project', 'web', '--branch', 'feat/foo', '--status', 'IN_PROGRESS', '--summary', 'slash branch'], { home });
    ccmd(['report', '--project', 'web', '--branch', 'feat_foo', '--status', 'DONE', '--summary', 'underscore branch'], { home });
    assert.equal(listJSON(path.join(home, 'entries', 'web')).length, 2, 'two distinct entry files');
    ccmd(['render'], { home });
    const html = fs.readFileSync(path.join(home, 'dashboard.html'), 'utf8');
    assert.ok(html.includes('slash branch'), 'first report survived');
    assert.ok(html.includes('underscore branch'), 'second report survived');
  } finally { rm(home); }
});

// #2: marking one of two slug-colliding items read must not hide the other.
test('seen markers do not collide across slug-equal keys', () => {
  const home = tmpHome();
  try {
    ccmd(['report', '--project', 'web', '--branch', 'feat/foo', '--status', 'IN_PROGRESS', '--summary', 'A'], { home });
    ccmd(['report', '--project', 'web', '--branch', 'feat_foo', '--status', 'IN_PROGRESS', '--summary', 'B'], { home });
    // read the slash one
    const key = 'entry:web/' + 'feat~2ffoo';
    ccmd(['seen', key], { home });
    ccmd(['render'], { home });
    const html = fs.readFileSync(path.join(home, 'dashboard.html'), 'utf8');
    assert.ok(!html.includes('>A<') && !html.includes('summary">A'), 'read row hidden');
    assert.ok(html.includes('B'), 'the other (underscore) row is still visible');
  } finally { rm(home); }
});

// #2: a branch that would slug to a path-traversal segment can't escape the store.
test('a "../evil" branch cannot traverse out of the entries dir', () => {
  const home = tmpHome();
  try {
    ccmd(['report', '--project', 'web', '--branch', '../../evil', '--status', 'DONE', '--summary', 'x'], { home });
    // nothing written outside entries/web
    assert.ok(!fs.existsSync(path.join(home, 'evil.json')));
    assert.ok(!fs.existsSync(path.join(path.dirname(home), 'evil.json')));
    const dir = path.join(home, 'entries', 'web');
    const files = listJSON(dir);
    assert.equal(files.length, 1, 'written safely inside entries/web');
    assert.ok(!files[0].includes('/') && !files[0].includes(path.sep), 'filename has no path separator');
    // the encoded filename resolves to stay inside the entries/web dir
    const resolved = path.resolve(dir, files[0]);
    assert.ok(resolved.startsWith(path.resolve(dir) + path.sep), 'stays inside entries/web');
  } finally { rm(home); }
});
