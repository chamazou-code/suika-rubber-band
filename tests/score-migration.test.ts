import { test } from 'node:test';
import assert from 'node:assert/strict';
import { restoreBestFromLink } from '../src/score-migration';

function storage(initial = '0') {
  let value = initial;
  return { getItem: () => value, setItem: (_key: string, next: string) => { value = next; } };
}

test('migration preserves the highest BEST and is safe to repeat', () => {
  const store = storage('20');
  assert.equal(restoreBestFromLink('#best=53', store), 53);
  assert.equal(store.getItem(), '53');
  assert.equal(restoreBestFromLink('#best=53', store), 53);
  assert.equal(restoreBestFromLink('#best=17', store), 53);
});

test('only an integer score in the game range can be imported', () => {
  const store = storage('8');
  for (const fragment of ['', '#best=-1', '#best=71', '#best=Infinity', '#best=NaN', '#best=5.3', '#best=53&next=https://example.com', '#other=53']) {
    assert.equal(restoreBestFromLink(fragment, store), 8);
    assert.equal(store.getItem(), '8');
  }
  assert.equal(restoreBestFromLink('#best=70', store), 70);
});

test('unavailable storage does not block import or playing', () => {
  const denied = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); } };
  assert.equal(restoreBestFromLink('#best=53', denied), 53);
  assert.equal(restoreBestFromLink('#best=53'), 53);
});
