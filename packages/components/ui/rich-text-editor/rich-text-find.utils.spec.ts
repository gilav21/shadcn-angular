import { describe, expect, it } from 'vitest';
import { compileFindRegex, FIND_MAX_QUERY_LENGTH } from './index';

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
            for (const safe of ['a+', String.raw`\d{2,4}`, 'c[ao]t+', '^start', 'end$', '(foo|bar)', '(?:foo)', '[a-z]+']) {
                expect(compileFindRegex(safe, opts({ useRegex: true }))).not.toBeNull();
            }
        });

        it('does not police a literal query, which is escaped anyway', () => {
            expect(compileFindRegex('(a+)+$', opts({ useRegex: false }))).not.toBeNull();
        });
    });

    describe('ReDoS guard coverage (round-23 audit)', () => {
        it('rejects the NON-CAPTURING form of a nested quantifier', () => {
            // The guard skipped anything starting "(?", which was meant to pass
            // over lookaheads but also passed over "(?:" -- the idiomatic group.
            // "(?:a+)+$" is the non-capturing spelling of the very pattern the
            // guard's own doc-comment names, and it hung for 81 SECONDS on a
            // 41-character line. Find runs on every keystroke.
            expect(compileFindRegex('(?:a+)+$', opts({ useRegex: true }))).toBeNull();
            expect(compileFindRegex('(?:(?:a+)+)+$', opts({ useRegex: true }))).toBeNull();
        });


        it('rejects a nested quantifier hidden by a redundant paren', () => {
            // scanGroup only recorded a quantifier at depth 1, so one extra pair
            // of parentheses moved it out of view: "((a+))+$" took 12 SECONDS on
            // a 28-character line, and "((?:a+))+$" reintroduced the previous
            // round's non-capturing fix one level out.
            for (const p of ['((a+))+$', '(?:(a+))+$', '((?:a+))+$', '(((a+)))+$']) {
                expect(compileFindRegex(p, opts({ useRegex: true }))).toBeNull();
            }
        });

        it('rejects a brace quantifier nested the same way', () => {
            expect(compileFindRegex('((a{2,})){3,}$', opts({ useRegex: true }))).toBeNull();
        });


        it('rejects a group whose only quantifier is ?', () => {
            // QUANTIFIERS omitted '?', so the group read as unquantified:
            // "(aa?)+$" backtracked exponentially -- 460ms at 37 chars, doubling
            // every two characters -- inside a 256-character query cap.
            for (const p of ['(aa?)+$', '(a?a)+$', '((a)?a)+$', '([ab]?[ab])+$']) {
                expect(compileFindRegex(p, opts({ useRegex: true }))).toBeNull();
            }
        });

        it('still accepts an optional group that is not repeated', () => {
            expect(compileFindRegex('(foo)?bar', opts({ useRegex: true }))).not.toBeNull();
            expect(compileFindRegex('colou?r', opts({ useRegex: true }))).not.toBeNull();
        });

        it('rejects the nested quantifier under a NAMED group (fine-comb review)', () => {
            // "(?<n>" was skipped as if it were a lookaround. It is a plain
            // group that quantifies like any other, so "(?<n>a+)+$" hung the
            // tab exactly like "(a+)+$" did.
            for (const p of ['(?<n>a+)+$', '(?<n>(?<m>a+))+$', '((?<n>a+))+$']) {
                expect(compileFindRegex(p, opts({ useRegex: true }))).toBeNull();
            }
        });

        it('still accepts lookarounds and an unrepeated named group', () => {
            for (const p of ['(?=a+)b', '(?!a+)b', '(?<=a+)b', '(?<!a+)b', '(?<word>a+)b', '(?<n>foo)?bar']) {
                expect(compileFindRegex(p, opts({ useRegex: true }))).not.toBeNull();
            }
        });
    });
});
