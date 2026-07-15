'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { tmpHome, rm, ccmd } = require('./helpers');

// #12: product ids that shadow reserved tab names (goals/overview/command-center)
// must NOT produce duplicate DOM ids.

test('a product named "goals"/"overview" does not collide with reserved tabs', () => {
  const home = tmpHome();
  try {
    ccmd(['init', '--product', 'goals:Goalsy:globe:goals', '--product', 'overview:Overviewy:page:overview'], { home });
    ccmd(['report', '--project', 'goals', '--branch', 'main', '--status', 'IN_PROGRESS', '--summary', 'x'], { home });
    ccmd(['report', '--project', 'overview', '--branch', 'main', '--status', 'IN_PROGRESS', '--summary', 'y'], { home });
    ccmd(['render'], { home });
    const html = fs.readFileSync(path.join(home, 'dashboard.html'), 'utf8');

    // DOM ids must be globally unique (the real collision vector)
    const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]);
    const unique = new Set(ids);
    assert.equal(ids.length, unique.size, 'no duplicate DOM ids: ' + ids.join(','));

    // reserved + namespaced product tabs coexist as distinct data-tab values
    const tabs = new Set([...html.matchAll(/data-tab="([^"]+)"/g)].map(m => m[1]));
    assert.ok(tabs.has('overview') && tabs.has('goals'), 'reserved tabs present');
    assert.ok(tabs.has('p-goals'), 'product goals → p-goals');
    assert.ok(tabs.has('p-overview'), 'product overview → p-overview');

    // every tab button has a matching panel (aria wiring)
    const tabIds = [...html.matchAll(/role="tab" id="tab-([^"]+)"/g)].map(m => m[1]);
    for (const id of tabIds) {
      assert.ok(html.includes(`id="panel-${id}"`), `panel for ${id} exists`);
      assert.ok(html.includes(`aria-controls="panel-${id}"`), `tab ${id} controls its panel`);
    }
  } finally { rm(home); }
});
