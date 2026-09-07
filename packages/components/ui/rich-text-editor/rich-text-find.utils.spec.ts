import { describe, expect, it } from 'vitest';
import { compileFindRegex, FIND_MAX_QUERY_LENGTH } from './rich-text-find.utils';

const opts = (over: Partial<{ useRegex: boolean; wholeWord: boolean; caseSensitive: boolean }> = {}) => ({
    useRegex: false,
    wholeWord: false,
    caseSensitive: false,
    ...over,
});

describe('compileFindRegex', () => {
    it('compiles a literal query, escaping regex metacharacters', () => {
        const re = compileFindRegex('a.b', opts());
        expect(re).not.toBeNull();
        expect(re!.test('a.b')).toBe(true);
        expect(re!.test('axb')).toBe(false);
    });

    it('compiles a user regex when regex mode is on', () => {
        const re = compileFindRegex('c[ao]t', opts({ useRegex: true }));
        expect(re!.test('cot')).toBe(true);
    });

    it('rejects a query longer than the cap', () => {
        expect(compileFindRegex('a'.repeat(FIND_MAX_QUERY_LENGTH + 1), opts())).toBeNull();
    });

    it('rejects a syntactically invalid regex rather than throwing', () => {
        expect(compileFindRegex('(unclosed', opts({ useRegex: true }))).toBeNull();
    });

    describe('catastrophic backtracking', () => {
        // A nested quantifier makes the engine try exponentially many splits.
        // The length cap does not help: "(a+)+$" is six characters and hangs the
        // tab outright on a 30-character line. Typing it into the find box with
        // regex mode on is ordinary use, so the pattern has to be refused.
        const evil = ['(a+)+$', '(a*)*b', String.raw`(\w+\s?)*$`, '(x+x+)+y'];

        for (const pattern of evil) {
            it(`refuses ${pattern}`, () => {
                expect(compileFindRegex(pattern, opts({ useRegex: true }))).toBeNull();
            });
        }

        it('still accepts ordinary quantified patterns', () => {
            for (const safe of ['a+', String.raw`\d{2,4}`, 'c[ao]t+', '^start', 'end$', '(foo|bar)']) {
                expect(compileFindRegex(safe, opts({ useRegex: true }))).not.toBeNull();
            }
        });

        it('does not police a literal query, which is escaped anyway', () => {
            expect(compileFindRegex('(a+)+$', opts({ useRegex: false }))).not.toBeNull();
        });
    });
});
