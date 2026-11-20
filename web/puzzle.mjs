import { FIELDS } from './boards.mjs';

export const SIZE = 4;
export const ROUND_MS = 60_000;

export function boardFor(seed) {
  const [letters, vocabulary] = FIELDS[Math.floor(seed / 8) % FIELDS.length];
  const tiles = Array.from({ length: SIZE * SIZE }, (_, i) => {
    let row = Math.floor(i / SIZE);
    let col = i % SIZE;
    if (seed & 4) col = SIZE - 1 - col;
    for (let turn = 0; turn < (seed & 3); turn++) [row, col] = [col, SIZE - 1 - row];
    const ch = letters[row * SIZE + col];
    return ch === 'Q' ? 'QU' : ch;
  });
  return { tiles, validWords: new Set(vocabulary.split(' ')) };
}

export function seedFromLink(value) {
  if (!value || !/^[0-9a-z]{1,7}$/i.test(value)) return null;
  const seed = Number.parseInt(value, 36);
  return seed <= 0xffffffff ? seed : null;
}

export function boardLink(origin, seed) {
  const url = new URL(origin);
  url.search = '';
  url.hash = '';
  url.searchParams.set('board', seed.toString(36));
  return url.href;
}

export function neighbors(a, b) {
  return a !== b && Math.max(Math.abs(Math.floor(a / SIZE) - Math.floor(b / SIZE)),
    Math.abs(a % SIZE - b % SIZE)) === 1;
}

export function stepPath(path, cell) {
  if (!Number.isInteger(cell) || cell < 0 || cell >= SIZE * SIZE || cell === path.at(-1)) return path;
  if (path.length > 1 && cell === path.at(-2)) return path.slice(0, -1);
  if (path.includes(cell) || (path.length && !neighbors(path.at(-1), cell))) return path;
  return [...path, cell];
}

export function spell(tiles, path) {
  return path.map(cell => tiles[cell]).join('');
}

export function points(word) {
  return [0, 0, 0, 100, 400, 800, 1400, 1800][word.length] ?? 2200;
}

export function judge(field, path, found) {
  const word = spell(field.tiles, path);
  if (word.length < 3) return { message: 'Use at least three letters.' };
  if (new Set(path).size !== path.length || path.some((cell, i) =>
    !Number.isInteger(cell) || !field.tiles[cell] || (i > 0 && !neighbors(path[i - 1], cell)))) {
    return { message: 'Use touching tiles once per word.' };
  }
  if (!field.validWords.has(word)) return { message: word + ' isn’t in the dictionary.' };
  if (found.includes(word)) return { message: word + ' already grew a flower.' };
  return { word, points: points(word) };
}

export const freshRound = seed => ({ seed, startedAt: null, finished: false, words: [], bed: null });
export function msLeft(round, now = Date.now()) {
  if (round.finished) return 0;
  if (round.startedAt === null) return ROUND_MS;
  return Math.max(0, Math.min(ROUND_MS, round.startedAt + ROUND_MS - now));
}

export function restoreRound(data, requestedSeed) {
  if (!data || !Number.isInteger(data.seed) || data.seed < 0 || data.seed > 0xffffffff ||
      (requestedSeed !== null && data.seed !== requestedSeed)) return null;
  const state = freshRound(data.seed);
  if (!Number.isSafeInteger(data.startedAt) || data.startedAt <= 0) return state;
  state.startedAt = data.startedAt;
  state.finished = data.finished === true;
  const field = boardFor(data.seed);
  if (Array.isArray(data.words)) state.words = [...new Set(data.words.filter(word => field.validWords.has(word)))];
  if (state.finished && Array.isArray(data.bed)) state.bed = data.bed;
  if (typeof data.ticket === 'string' && /^[0-9a-f-]{36}$/i.test(data.ticket)) state.ticket = data.ticket;
  state.syncedWords = Number.isInteger(data.syncedWords) ? Math.max(0, Math.min(state.words.length, data.syncedWords)) : 0;
  state.planted = data.planted === true;
  return state;
}
