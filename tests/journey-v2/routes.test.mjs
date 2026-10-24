import test from 'node:test';
import assert from 'node:assert/strict';
import { projectHash, readProjectHash, legacyProjectDestination, nextLocationAction } from '../../assets/journey-v2/routes.js';

test('project hashes encode IDs and match valid IDs with their original case', () => {
  assert.equal(projectHash('Mixed_Case-2'), '#project=Mixed_Case-2');
  assert.equal(projectHash('a b'), '#project=a%20b');
  assert.equal(readProjectHash('#project=Mixed%5FCase-2', ['Mixed_Case-2']), 'Mixed_Case-2');
  for (const hash of ['#project=%E0%A4%A', '#project=', '#project=unknown', '#projects', '#project=mixed_case-2']) {
    assert.equal(readProjectHash(hash, ['Mixed_Case-2']), null);
  }
});

test('legacy search converts only safe IDs using the shared data validator', () => {
  assert.equal(legacyProjectDestination('?id=Driftwake'), './#project=Driftwake');
  for (const search of ['', '?id=', '?id=../bad', '?id=%3Cscript%3E']) assert.equal(legacyProjectDestination(search), './#projects');
});

test('history actions distinguish app opening, browser synchronization, and direct-entry close', () => {
  assert.deepEqual(nextLocationAction({id:null, appOpened:false}, {type:'open', id:'One'}), {method:'push', hash:'#project=One', id:'One'});
  assert.deepEqual(nextLocationAction({id:'One', appOpened:true}, {type:'open', id:'Two'}), {method:'replace', hash:'#project=Two', id:'Two'});
  assert.deepEqual(nextLocationAction({id:'One', appOpened:true}, {type:'sync', id:'Two'}), {method:'none', id:'Two'});
  assert.deepEqual(nextLocationAction({id:'One', appOpened:true}, {type:'close'}), {method:'back', id:null});
  assert.deepEqual(nextLocationAction({id:'One', appOpened:false}, {type:'close'}), {method:'replace', hash:'#projects', id:null});
});
