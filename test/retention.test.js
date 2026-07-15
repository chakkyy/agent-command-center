'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { tmpHome, rm, ccmd } = require('./helpers');

// #17: the archive stays bounded so a long-lived install can't grow forever.
test('prune caps the archive to ACC_ARCHIVE_MAX (oldest dropped)', () => {
  const home = tmpHome();
  try {
    ccmd(['render'], { home }); // create dirs
    const arc = path.join(home, 'archive');
    fs.mkdirSync(arc, { recursive: true });
    for (let i = 0; i < 12; i++) {
      const f = path.join(arc, `entry-x-${i}.json`);
      fs.writeFileSync(f, '{}');
      const t = new Date(Date.now() - (12 - i) * 60000); // older i = older mtime
      fs.utimesSync(f, t, t);
    }
    ccmd(['prune'], { home, env: { ACC_ARCHIVE_MAX: '5' } });
    const left = fs.readdirSync(arc).filter(f => f.endsWith('.json')).sort();
    assert.equal(left.length, 5, 'archive capped to 5');
    // the 5 newest survive (7..11)
    assert.ok(left.includes('entry-x-11.json') && left.includes('entry-x-7.json'));
    assert.ok(!left.includes('entry-x-0.json'), 'oldest dropped');
  } finally { rm(home); }
});
