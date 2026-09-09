import { readBest, saveBest } from './game';

/** The old static site passes only its BEST in the fragment (never sent to the server). */
export function restoreBestFromLink(fragment: string, storage?: Pick<Storage, 'getItem' | 'setItem'>): number {
  const current = readBest(storage);
  const match = /^#best=(\d{1,2})$/.exec(fragment);
  if (!match) return current;
  const incoming = Number(match[1]);
  if (incoming <= current || incoming > 70) return current;
  saveBest(incoming, storage);
  return incoming;
}
