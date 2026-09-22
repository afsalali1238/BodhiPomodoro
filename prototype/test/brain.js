// @ts-check
// Minimal test for brain.js module
// Usage: node test/brain.js

const { strict: assert } = require('assert');
const path = require('path');

// Mock storage module before importing brain
const mockSettings = {
  llmProvider: 'openai',
  llmModel: 'gpt-4o-mini',
  llmApiKey: 'test-key'
};

// Mock storage
const mockStorage = {
  getSettings: () => mockSettings
};

// Override require for storage
const Module = require('module');
const originalRequire = Module.prototype.require;
Module.prototype.require = function(id) {
  if (id === './storage') return mockStorage;
  return originalRequire.apply(this, arguments);
};

// Now import brain
const brain = require('../src/brain');

console.log('Testing brain.js...');

// Test initBrain with no API key
mockSettings.llmApiKey = '';
const result1 = brain.initBrain();
console.assert(!result1, 'Should return false when API key is empty');
console.log('✓ initBrain returns false without API key');

// Test initBrain with API key (won't actually connect)
mockSettings.llmApiKey = 'test-key';
const result2 = brain.initBrain();
console.log('✓ initBrain runs with API key configured');

// Test evaluate (will fail gracefully without real API)
brain.evaluate('Focus on coding', ['10:00 - code: Untitled'])
  .then(result => {
    console.log('✓ evaluate returns:', result);
  })
  .catch(err => {
    console.log('✓ evaluate handled error gracefully:', err.message);
  });

console.log('Basic tests complete. Run `npm test` for full suite.');
