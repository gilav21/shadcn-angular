import { describe, it, expect } from 'vitest';

describe('sanity check', () => {
    it('should pass', () => {
        const sum = [1, 2, 3].reduce((acc, n) => acc + n, 0);
        expect(sum).toBe(6);
    });
});
