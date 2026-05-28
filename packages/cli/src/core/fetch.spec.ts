import { describe, it, expect } from 'vitest';
import { normalizeContent } from './fetch.js';

describe('normalizeContent', () => {
  it('normalizes CRLF to LF and trims', () => {
    expect(normalizeContent('a\r\nb\r\n  ')).toBe('a\nb');
  });
});
