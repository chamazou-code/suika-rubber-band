/** An original eight-bar loop. PCM is made once, then AudioBufferSource loops it without timers. */
export function makeMusic(sampleRate = 22050) {
  const beat = 60 / 108, length = Math.round(32 * beat * sampleRate);
  const samples = new Float32Array(length);
  let seed = 714;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  function note(midi: number, at: number, duration: number, volume: number, bass = false) {
    const frequency = 440 * 2 ** ((midi - 69) / 12), start = Math.round(at * sampleRate);
    for (let i = 0; i < duration * sampleRate; i++) {
      const t = i / sampleRate, phase = 2 * Math.PI * frequency * t;
      const envelope = Math.min(1, t / .008) * Math.exp(-t * (bass ? 5 : 6));
      const tail = Math.min(1, (duration - t) / .04);
      const voice = bass ? Math.sin(phase) + .16 * Math.sin(phase * 2) : Math.sin(phase) + .25 * Math.sin(phase * 3.99) * Math.exp(-t * 15);
      samples[(start + i) % length] += voice * envelope * tail * volume;
    }
  }
  // Dmaj7 / Bm7 / Gmaj7 / A6. Sparse syncopation leaves room for the rubber-band snap.
  const melody = [
    [74, -1, 78, 81, -1, 78, 76, -1], [73, -1, 74, -1, 78, -1, 74, -1],
    [71, -1, 74, 78, -1, 74, 73, -1], [73, -1, 76, -1, 78, 76, -1, 73],
    [74, -1, 78, 81, -1, 83, 81, -1], [78, -1, 74, -1, 73, -1, 74, -1],
    [71, -1, 74, 78, -1, 76, 74, -1], [73, -1, 69, -1, 73, -1, 76, -1],
  ];
  const roots = [38, 35, 31, 33];
  for (let bar = 0; bar < 8; bar++) {
    const at = bar * 4 * beat, root = roots[bar % 4];
    note(root, at, 1, .26, true); note(root + 7, at + 2.5 * beat, .75, .17, true);
    for (let step = 0; step < 8; step++) {
      const midi = melody[bar][step], time = at + step * beat / 2;
      if (midi >= 0) { note(midi, time, .9, step === 0 ? .24 : .19); note(midi, time + beat * .75, .7, .035); }
      // A small shaker, with deterministic noise independent of game randomness.
      const start = Math.round(time * sampleRate);
      for (let i = 0; i < sampleRate * .035; i++) {
        const t = i / sampleRate;
        samples[(start + i) % length] += (random() - .5) * Math.exp(-t * 130) * Math.min(1, t / .002) * (step % 2 ? .07 : .035);
      }
    }
  }
  return samples;
}
