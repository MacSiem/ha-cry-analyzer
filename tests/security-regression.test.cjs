const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const hostile = '<img src=x onerror=alert(1)>';
global.localStorage = {
  getItem: () => JSON.stringify([{
    id: 1,
    timestamp: '2026-08-28T00:00:00Z',
    category: hostile,
    intensity: 99,
    duration: -4,
    notes: hostile,
  }]),
  setItem: () => {},
};
global.HTMLElement = class {
  attachShadow() {
    this.shadowRoot = {
      innerHTML: '',
      querySelectorAll: () => [],
    };
  }
};
const registry = new Map();
global.customElements = {
  get: name => registry.get(name),
  define: (name, value) => registry.set(name, value),
};

require('../ha-cry-analyzer.js');
const Card = registry.get('ha-cry-analyzer');
const card = new Card();
card.title = hostile;

assert.equal(card.cryLog[0].category, 'unknown');
assert.equal(card.cryLog[0].intensity, 5);
assert.equal(card.cryLog[0].duration, 1);
const logHtml = card.renderLogTab();
assert.equal(logHtml.includes(hostile), false, logHtml);
assert.match(logHtml, /&lt;img/);

const source = fs.readFileSync(path.join(__dirname, '..', 'ha-cry-analyzer.js'), 'utf8');
assert.equal(source.includes('eval('), false);
assert.equal(source.includes('@click'), false);
assert.equal(source.includes('@change'), false);
assert.match(source, /data-action="delete-entry"/);
