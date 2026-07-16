import assert from 'node:assert/strict';
import { test } from 'node:test';

import { FilmCardInterface } from 'Type/FilmCard.interface';
import { LocalBookmarksBlob, LocalHistoryItemInterface } from 'Type/LocalLibrary.interface';
import { FilmType } from 'Type/FilmType.type';
import {
  addCategory,
  bookmarksForFilm,
  emptyBookmarksBlob,
  filmsForCategory,
  MAX_LOCAL_HISTORY_ITEMS,
  parseBookmarksBlob,
  parseHistoryList,
  parseScheduleMarks,
  removeCategory,
  removeHistoryItem,
  setHistoryWatched,
  setScheduleMark,
  toggleBookmark,
  upsertHistoryItem,
  validateNewCategoryTitle,
} from 'Util/LocalLibrary/logic';

const filmCard = (id: string): FilmCardInterface => ({
  id,
  link: `/films/${id}`,
  type: FilmType.Film,
  poster: `poster-${id}.jpg`,
  title: `Film ${id}`,
  subtitle: '2026',
});

const historyItem = (id: string, updatedAt = 0): LocalHistoryItemInterface => ({
  id,
  link: `/films/${id}`,
  poster: `poster-${id}.jpg`,
  title: `Film ${id}`,
  updatedAt,
  isWatched: false,
});

const blobWithCategories = (...titles: string[]): LocalBookmarksBlob => titles.reduce(
  (blob, title, index) => addCategory(blob, {
    id: `cat${index + 1}`,
    title,
    filmIds: [],
    createdAt: index,
  }),
  emptyBookmarksBlob()
);

test('parseBookmarksBlob falls back to empty blob on invalid input', () => {
  assert.deepEqual(parseBookmarksBlob(null), { categories: [], films: {} });
  assert.deepEqual(parseBookmarksBlob('not json'), { categories: [], films: {} });
  assert.deepEqual(parseBookmarksBlob('"a string"'), { categories: [], films: {} });
  assert.deepEqual(parseBookmarksBlob('{"categories": {}}'), { categories: [], films: {} });
});

test('parseHistoryList and parseScheduleMarks fall back on invalid input', () => {
  assert.deepEqual(parseHistoryList('{"a":1}'), []);
  assert.deepEqual(parseHistoryList(undefined), []);
  assert.deepEqual(parseScheduleMarks('[1,2]'), {});
  assert.deepEqual(parseScheduleMarks(null), {});
});

test('validateNewCategoryTitle rejects blank and duplicate titles', () => {
  const blob = blobWithCategories('Favorites');

  assert.equal(validateNewCategoryTitle(blob, '   '), 'empty');
  assert.equal(validateNewCategoryTitle(blob, 'Favorites'), 'exists');
  assert.equal(validateNewCategoryTitle(blob, '  Favorites  '), 'exists');
  assert.equal(validateNewCategoryTitle(blob, 'Watch later'), null);
});

test('toggleBookmark adds film to one category without affecting others', () => {
  const blob = blobWithCategories('Favorites', 'Watch later');
  const toggled = toggleBookmark(blob, filmCard('f1'), 'cat1', true);

  assert.deepEqual(toggled.categories[0].filmIds, ['f1']);
  assert.deepEqual(toggled.categories[1].filmIds, []);
  assert.deepEqual(toggled.films.f1, filmCard('f1'));
  assert.deepEqual(bookmarksForFilm(toggled, 'f1'), [
    { id: 'cat1', title: 'Favorites', isBookmarked: true },
    { id: 'cat2', title: 'Watch later', isBookmarked: false },
  ]);
});

test('toggleBookmark keeps the film card while another category still references it', () => {
  let blob = blobWithCategories('Favorites', 'Watch later');

  blob = toggleBookmark(blob, filmCard('f1'), 'cat1', true);
  blob = toggleBookmark(blob, filmCard('f1'), 'cat2', true);
  blob = toggleBookmark(blob, filmCard('f1'), 'cat1', false);

  assert.deepEqual(blob.categories[0].filmIds, []);
  assert.deepEqual(blob.categories[1].filmIds, ['f1']);
  assert.ok(blob.films.f1, 'film card must remain while cat2 references it');

  blob = toggleBookmark(blob, filmCard('f1'), 'cat2', false);
  assert.equal(blob.films.f1, undefined, 'film card must be garbage-collected on last removal');
});

test('toggleBookmark is a no-op for a missing category', () => {
  const blob = blobWithCategories('Favorites');
  const toggled = toggleBookmark(blob, filmCard('f1'), 'ghost', true);

  assert.deepEqual(toggled, blob);
});

test('toggleBookmark puts re-added films first and does not duplicate', () => {
  let blob = blobWithCategories('Favorites');

  blob = toggleBookmark(blob, filmCard('f1'), 'cat1', true);
  blob = toggleBookmark(blob, filmCard('f2'), 'cat1', true);
  blob = toggleBookmark(blob, filmCard('f1'), 'cat1', true);

  assert.deepEqual(blob.categories[0].filmIds, ['f1', 'f2']);
});

test('removeCategory garbage-collects films only it referenced', () => {
  let blob = blobWithCategories('Favorites', 'Watch later');

  blob = toggleBookmark(blob, filmCard('f1'), 'cat1', true);
  blob = toggleBookmark(blob, filmCard('f2'), 'cat1', true);
  blob = toggleBookmark(blob, filmCard('f2'), 'cat2', true);

  blob = removeCategory(blob, 'cat1');

  assert.equal(blob.categories.length, 1);
  assert.equal(blob.films.f1, undefined);
  assert.ok(blob.films.f2, 'film still referenced by remaining category must survive');
  assert.deepEqual(filmsForCategory(blob, 'cat2'), [filmCard('f2')]);
});

test('filmsForCategory skips dangling film ids', () => {
  const blob: LocalBookmarksBlob = {
    categories: [{
      id: 'cat1', title: 'Favorites', filmIds: ['f1', 'ghost'], createdAt: 0,
    }],
    films: { f1: filmCard('f1') },
  };

  assert.deepEqual(filmsForCategory(blob, 'cat1'), [filmCard('f1')]);
});

test('upsertHistoryItem dedupes by film id, keeps newest first and caps the list', () => {
  let items = [historyItem('a', 1), historyItem('b', 2)];

  items = upsertHistoryItem(items, historyItem('a', 3));

  assert.deepEqual(items.map((i) => i.id), ['a', 'b']);
  assert.equal(items[0].updatedAt, 3);

  const full = Array.from(
    { length: MAX_LOCAL_HISTORY_ITEMS },
    (_, i) => historyItem(`f${i}`, i)
  );
  const capped = upsertHistoryItem(full, historyItem('new', 999));

  assert.equal(capped.length, MAX_LOCAL_HISTORY_ITEMS);
  assert.equal(capped[0].id, 'new');
});

test('upsertHistoryItem resets the watched flag of a re-watched item', () => {
  const items = setHistoryWatched([historyItem('a')], 'a', true);
  const updated = upsertHistoryItem(items, historyItem('a', 5));

  assert.equal(updated[0].isWatched, false);
});

test('removeHistoryItem and setHistoryWatched target only the given film', () => {
  const items = [historyItem('a'), historyItem('b')];

  assert.deepEqual(removeHistoryItem(items, 'a').map((i) => i.id), ['b']);

  const watched = setHistoryWatched(items, 'b', true);

  assert.equal(watched[0].isWatched, false);
  assert.equal(watched[1].isWatched, true);
});

test('setScheduleMark stores per-film overrides and supports un-marking', () => {
  let marks = setScheduleMark({}, 'film1', 'ep1', true);

  marks = setScheduleMark(marks, 'film1', 'ep2', false);
  marks = setScheduleMark(marks, 'film2', 'ep1', true);

  assert.deepEqual(marks, {
    film1: { ep1: true, ep2: false },
    film2: { ep1: true },
  });
});
