import { describe, it, expect, vi } from 'vitest';
import { search } from './search.js';

describe('search command', () => {
  it('prints ranked matches for a query', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    search(['button'], {});
    const out = spy.mock.calls.map(c => String(c[0])).join('\n');
    expect(out).toContain('button');
    spy.mockRestore();
  });

  it('emits raw JSON with --json', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    search(['date'], { json: true });
    const out = spy.mock.calls.map(c => String(c[0])).join('\n');
    const parsed = JSON.parse(out) as Array<{ name: string }>;
    expect(parsed.some(h => h.name === 'date-picker')).toBe(true);
    spy.mockRestore();
  });

  it('prints a usage message for an empty query', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    search([], {});
    expect(spy.mock.calls.map(c => String(c[0])).join('\n')).toContain('Usage');
    spy.mockRestore();
  });
});
