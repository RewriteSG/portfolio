import assert from 'node:assert/strict';
import test from 'node:test';
import { JourneySettingsError, validateJourneySettings } from '../../assets/journey-v2/settings.js';

test('accepts zero, subset, and full orbit counts', () => {
  assert.deepEqual(validateJourneySettings({orbitCount:0}, 3), {orbitCount:0});
  assert.deepEqual(validateJourneySettings({orbitCount:2}, 3), {orbitCount:2});
  assert.deepEqual(validateJourneySettings({orbitCount:3}, 3), {orbitCount:3});
});

test('rejects settings without an object orbitCount', () => {
  const invalidSettings = [
    undefined,
    null,
    [],
    'settings',
    {},
    {orbitCount:'1'},
    {orbitCount:-1},
    {orbitCount:1.5},
    {orbitCount:Number.MAX_SAFE_INTEGER + 1},
    {orbitCount:4},
  ];

  for (const input of invalidSettings) {
    assert.throws(() => validateJourneySettings(input, 3), error => {
      assert.ok(error instanceof JourneySettingsError);
      assert.equal(error.path, 'assets/journey-v2/settings.json');
      assert.equal(error.range, '0..3');
      assert.equal(error.min, 0);
      assert.equal(error.max, 3);
      assert.match(error.message, /assets\/journey-v2\/settings\.json/);
      assert.match(error.message, /0\.\.3/);
      return true;
    }, `expected rejection for ${String(input)}`);
  }
});

test('reports the configured value in settings errors', () => {
  for (const [input, expected] of [[{}, undefined], [{orbitCount:'two'}, 'two'], [{orbitCount:4}, 4]]) {
    assert.throws(() => validateJourneySettings(input, 3), error => {
      assert.equal(error.configuredValue, expected);
      return true;
    });
  }
});
