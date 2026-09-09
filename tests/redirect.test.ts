import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const script = readFileSync(new URL('../scripts/legacy-site/redirect.js', import.meta.url), 'utf8');
const target = 'https://suika-rubber-band.pages.dev/';

test('legacy redirect transfers only a valid BEST to its fixed destination', () => {
  for (const [value, suffix] of [['53', '#best=53'], ['70', '#best=70'], ['0', ''], ['71', ''], ['NaN', ''], ['-1', ''], ['53.5', '']]) {
    const link = { href: target }; let redirected = '';
    runInNewContext(script, {
      URL, document: { getElementById: () => link },
      localStorage: { getItem: () => value },
      location: { search: '?next=https://example.com', hash: '#next=https://example.com', replace: (url: string) => { redirected = url; } }
    });
    assert.equal(redirected, target + suffix);
    assert.equal(link.href, redirected);
  }
});

test('legacy redirect still opens the game when storage is unavailable', () => {
  let redirected = '';
  runInNewContext(script, {
    URL, document: { getElementById: () => ({ href: target }) },
    localStorage: { getItem: () => { throw new Error('denied'); } },
    location: { replace: (url: string) => { redirected = url; } }
  });
  assert.equal(redirected, target);
});
