'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const { tmpHome, rm, ccmd } = require('./helpers');

// Journal: rows are overwritten by design; the journal is the append-only history.

function journalFileOf(home) {
  const d = new Date();
  return path.join(home, 'journal', `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}.jsonl`);
}

test('every report appends a journal event; overwriting the row never rewrites history', () => {
  const home = tmpHome();
  try {
    ccmd(['report', '--project', 'p', '--branch', 'main', '--summary', 'first'], { home, cwd: home });
    ccmd(['report', '--project', 'p', '--branch', 'main', '--summary', 'second'], { home, cwd: home });
    const lines = fs.readFileSync(journalFileOf(home), 'utf8').trim().split('\n').map(JSON.parse);
    assert.equal(lines.length, 2, 'one event per report');
    assert.deepEqual(lines.map(l => l.summary), ['first', 'second']);
    assert.ok(lines.every(l => l.ts && l.project === 'p'), 'events carry ts and project');
  } finally { rm(home); }
});

test('catchup prints recent journal, live rows and open signals for the project', () => {
  const home = tmpHome();
  try {
    ccmd(['report', '--project', 'p', '--branch', 'main', '--summary', 'built the thing', '--next', 'ship it'], { home, cwd: home });
    ccmd(['signal', '--project', 'p', '--kind', 'blocker', '--msg', 'waiting on API key'], { home, cwd: home });
    const out = ccmd(['catchup', 'p'], { home, cwd: home }).stdout;
    assert.match(out, /built the thing/);
    assert.match(out, /→ next: ship it/);
    assert.match(out, /Live board rows:/);
    assert.match(out, /waiting on API key/);
  } finally { rm(home); }
});

test('catchup maps unknown (worktree) project names to their repo via the origin URL', () => {
  const home = tmpHome();
  try {
    // simulate an event reported from a worktree: project name differs, repo URL identifies it
    fs.mkdirSync(path.join(home, 'journal'), { recursive: true });
    fs.appendFileSync(journalFileOf(home), JSON.stringify({
      ts: new Date().toISOString(), project: 'feat-x-worktree', branch: 'feat-x',
      status: 'DONE', summary: 'worktree work', repo: 'https://example.com/org/p',
    }) + '\n');
    const out = ccmd(['catchup', 'p'], { home, cwd: home }).stdout;
    assert.match(out, /worktree work/, 'worktree event attributed to its repo');
  } finally { rm(home); }
});
