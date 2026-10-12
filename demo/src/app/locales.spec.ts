import { describe, expect, it } from 'vitest';

/**
 * Every demo dictionary is typed `Record<string, Shape>`, so the compiler
 * accepts a locale that is missing entirely and does not stop a translation
 * left as ''. This pins both, for all dictionaries at once, without mounting
 * a page.
 */
const modules = import.meta.glob<Record<string, unknown>>('./**/*.locales.ts', { eager: true });

type Dictionary = Record<string, Record<string, unknown>>;

function isDictionary(value: unknown): value is Dictionary {
  return typeof value === 'object' && value !== null && 'en' in value;
}

const dictionaries = Object.entries(modules).flatMap(([file, mod]) =>
  Object.entries(mod)
    .filter((entry): entry is [string, Dictionary] => isDictionary(entry[1]))
    .map(([name, dictionary]) => ({ file, name, dictionary })),
);

/** `code` and `rtl` describe the locale rather than translate anything, and some dictionaries omit them. */
function translatable(entry: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(entry).filter(([key]) => key !== 'code' && key !== 'rtl'));
}

/** Paths at which `value` is not shaped like `reference`, or is an empty string. */
function problems(reference: unknown, value: unknown, path: string): string[] {
  if (typeof reference === 'string') {
    if (typeof value !== 'string') return [`${path}: expected a string`];
    return value.trim() === '' ? [`${path}: empty`] : [];
  }
  if (Array.isArray(reference)) {
    if (!Array.isArray(value)) return [`${path}: expected an array`];
    if (value.length !== reference.length) return [`${path}: ${value.length} items, en has ${reference.length}`];
    return reference.flatMap((item, i) => problems(item, value[i], `${path}[${i}]`));
  }
  if (typeof reference === 'object' && reference !== null) {
    if (typeof value !== 'object' || value === null) return [`${path}: expected an object`];
    const expected = Object.keys(reference);
    const actual = Object.keys(value);
    const drift = [
      ...expected.filter(key => !actual.includes(key)).map(key => `${path}.${key}: missing`),
      ...actual.filter(key => !expected.includes(key)).map(key => `${path}.${key}: not in en`),
    ];
    return [
      ...drift,
      ...expected
        .filter(key => actual.includes(key))
        .flatMap(key => problems((reference as Record<string, unknown>)[key], (value as Record<string, unknown>)[key], `${path}.${key}`)),
    ];
  }
  return typeof value === typeof reference ? [] : [`${path}: expected ${typeof reference}`];
}

describe('demo locale dictionaries', () => {
  it('finds the dictionaries this check is meant to cover', () => {
    // A moved glob or renamed suffix would otherwise pass with nothing to check.
    expect(dictionaries.length).toBeGreaterThan(100);
  });

  it('gives every dictionary a Hebrew entry', () => {
    const missing = dictionaries.filter(d => !('he' in d.dictionary)).map(d => d.file);
    expect(missing).toEqual([]);
  });

  it('keeps every locale entry the same shape as en and free of empty strings', () => {
    const failures = dictionaries.flatMap(({ file, name, dictionary }) =>
      Object.entries(dictionary).flatMap(([code, entry]) =>
        problems(translatable(dictionary['en']), translatable(entry), `${file} ${name}.${code}`),
      ),
    );
    expect(failures).toEqual([]);
  });
});
