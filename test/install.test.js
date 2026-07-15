'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { tmpHome, rm, ccmd } = require('./helpers');

// #13: link/install must not clobber files that aren't unequivocally ours.

test('install refuses to overwrite a foreign slash command, --force backs it up', () => {
  const home = tmpHome();
  const cmds = path.join(home, 'commands');
  try {
    fs.mkdirSync(cmds, { recursive: true });
    const file = path.join(cmds, 'ccmd.md');
    fs.writeFileSync(file, '# my own /ccmd command, not yours\n');
    const r1 = ccmd(['install', '--dir', cmds], { home });
    assert.match(r1.stdout, /refusing to overwrite/);
    assert.notEqual(r1.status, 0);
    assert.equal(fs.readFileSync(file, 'utf8'), '# my own /ccmd command, not yours\n', 'foreign file untouched');

    const r2 = ccmd(['install', '--dir', cmds, '--force'], { home });
    assert.match(r2.stdout, /wrote \/ccmd/);
    assert.ok(fs.existsSync(file + '.bak'), 'backup kept');
    assert.match(fs.readFileSync(file, 'utf8'), /run the ccmd status-board CLI/);
  } finally { rm(home); }
});

test('install overwrites its own slash command without --force (update path)', () => {
  const home = tmpHome();
  const cmds = path.join(home, 'commands');
  try {
    ccmd(['install', '--dir', cmds], { home });
    const r = ccmd(['install', '--dir', cmds], { home });
    assert.equal(r.status, 0);
    assert.match(r.stdout, /wrote \/ccmd/);
    assert.ok(!fs.existsSync(path.join(cmds, 'ccmd.md.bak')), 'no backup needed for our own file');
  } finally { rm(home); }
});

test('link refuses to overwrite a non-ccmd file at the target', () => {
  const home = tmpHome();
  const bindir = path.join(home, 'bin');
  try {
    fs.mkdirSync(bindir, { recursive: true });
    fs.writeFileSync(path.join(bindir, 'ccmd'), '#!/bin/sh\necho not-yours\n');
    const r = ccmd(['link', '--dir', bindir], { home });
    assert.match(r.stdout, /refusing to overwrite/);
    assert.notEqual(r.status, 0);
    assert.equal(fs.readFileSync(path.join(bindir, 'ccmd'), 'utf8'), '#!/bin/sh\necho not-yours\n');

    const r2 = ccmd(['link', '--dir', bindir, '--force'], { home });
    assert.match(r2.stdout, /linked ccmd/);
    assert.ok(fs.existsSync(path.join(bindir, 'ccmd.bak')), 'foreign binary backed up');
    assert.ok(fs.lstatSync(path.join(bindir, 'ccmd')).isSymbolicLink(), 'now a symlink');
  } finally { rm(home); }
});

test('link replaces its own stale symlink without --force', () => {
  const home = tmpHome();
  const bindir = path.join(home, 'bin');
  try {
    ccmd(['link', '--dir', bindir], { home });
    const r = ccmd(['link', '--dir', bindir], { home });
    assert.equal(r.status, 0);
    assert.match(r.stdout, /linked ccmd/);
    assert.ok(!fs.existsSync(path.join(bindir, 'ccmd.bak')), 'no backup for our own link');
  } finally { rm(home); }
});
