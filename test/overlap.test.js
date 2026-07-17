'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const { tmpHome, rm, ccmd, listJSON, readJSON } = require('./helpers');

// Shared-state hardening: last-write-wins must never silently drop data.

test('a second session reporting on the same project/branch archives the fresh row it overwrites', () => {
  const home = tmpHome();
  const cwdA = fs.mkdtempSync(path.join(home, 'a-'));
  const cwdB = fs.mkdtempSync(path.join(home, 'b-'));
  try {
    ccmd(['report', '--project', 'p', '--branch', 'main', '--summary', 'session A'], { home, cwd: cwdA });
    ccmd(['report', '--project', 'p', '--branch', 'main', '--summary', 'session B'], { home, cwd: cwdB });
    const overlap = listJSON(path.join(home, 'archive')).filter(f => f.includes('overlap'));
    assert.equal(overlap.length, 1, 'clobbered row was archived');
    assert.equal(readJSON(path.join(home, 'archive', overlap[0])).summary, 'session A');
    // same cwd re-reporting is NOT an overlap — no extra archive noise
    ccmd(['report', '--project', 'p', '--branch', 'main', '--summary', 'session B again'], { home, cwd: cwdB });
    assert.equal(listJSON(path.join(home, 'archive')).filter(f => f.includes('overlap')).length, 1);
  } finally { rm(home); }
});

test('prune --presence writes .presence and never touches config.json', () => {
  const home = tmpHome();
  try {
    fs.writeFileSync(path.join(home, 'config.json'), JSON.stringify({ accent: '#123456' }, null, 2));
    const before = fs.readFileSync(path.join(home, 'config.json'), 'utf8');
    ccmd(['prune', '--presence', '--quiet'], { home, cwd: home });
    assert.ok(fs.existsSync(path.join(home, '.presence')), '.presence written');
    assert.equal(fs.readFileSync(path.join(home, 'config.json'), 'utf8'), before,
      'config.json byte-identical (no read-modify-write race surface)');
  } finally { rm(home); }
});
