import test from 'node:test';
import assert from 'node:assert/strict';
import {melodyLength,phraseDelays} from './web/garden-audio.mjs';

test('a fresh stroke plays a phrase in waltz time, and a mid-phrase stroke continues from the next note',()=>{
  const opening=phraseDelays(0),answer=phraseDelays(opening.length);
  assert.deepEqual(opening,[200,200,200,800,400,400,400,400,1800]);
  assert.deepEqual(phraseDelays(3),[...opening.slice(3),...answer]);
  assert.deepEqual(phraseDelays(melodyLength-1),[1800,...opening]);
  assert.deepEqual(phraseDelays(melodyLength),opening);
});
