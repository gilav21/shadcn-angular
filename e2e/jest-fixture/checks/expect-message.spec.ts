import { describe, it, expect } from '@/components/lib/testing/vitest-compat';

/**
 * The vitest-compat shim's `expect(actual, message)`. Vitest takes the message as a second argument and the shipped
 * specs rely on it to say which loop iteration failed; Jest's `expect` does not. Every shipped spec that passes a
 * message exercises only the passing path, so the failing path is checked here, against the real Jest.
 */
const failureOf = (run: () => unknown): string => {
    try {
        run();
    } catch (error) {
        return (error as Error).message;
    }
    return 'DID NOT THROW';
};

describe('the shim expect(actual, message)', () => {
    const one = [0].length;

    it('puts the message in front of a failing matcher and keeps Jest\'s own text', () => {
        const text = failureOf(() => expect(one, 'case "one"').toBe(2));

        expect(text.startsWith('case "one": ')).toBe(true);
        expect(text).toContain('Expected: 2');
    });

    it('does so through .not', () => {
        expect(failureOf(() => expect(one, 'negated').not.toBe(one)).startsWith('negated: ')).toBe(true);
    });

    it('does so through .resolves', async () => {
        await expect(Promise.resolve(one), 'resolves case').resolves.toBe(one);

        let text = 'DID NOT THROW';
        try {
            await expect(Promise.resolve(one), 'async case').resolves.toBe(2);
        } catch (error) {
            text = (error as Error).message;
        }

        expect(text.startsWith('async case: ')).toBe(true);
    });

    it('leaves a passing assertion, and one without a message, as Jest has them', () => {
        expect(failureOf(() => expect(one, 'fine').toBe(one))).toBe('DID NOT THROW');
        expect(failureOf(() => expect(one).toBe(2)).startsWith('expect(')).toBe(true);
    });

    it('keeps the statics', () => {
        expect({ a: 1, b: 2 }).toEqual(expect.objectContaining({ a: 1 }));
        expect([1, 2]).toEqual(expect.arrayContaining([2]));
        expect(5).toEqual(expect.any(Number));
        expect(typeof expect.extend).toBe('function');
    });
});
