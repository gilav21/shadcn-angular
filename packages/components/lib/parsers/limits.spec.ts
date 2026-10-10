import { describe, expect, it } from 'vitest';
import { DEFAULT_PARSER_LIMITS, DecodeBudget, DrawPath, visitOnce } from './limits';

describe('parser limits', () => {
    it('T-20 production limits are the documented values', () => {
        expect(DEFAULT_PARSER_LIMITS).toEqual({
            maxImagePixels: 50_000_000,
            maxDecodedBytesTotal: 1024 * 1024 * 1024,
            maxNestingDepth: 32,
            maxFormDrawsPerPage: 10_000,
            maxPages: 10_000,
            maxOle2StreamBytes: 256 * 1024 * 1024,
        });
        expect(Object.isFrozen(DEFAULT_PARSER_LIMITS)).toBe(true);
    });

    it('a draw path cuts cycles and depth but redraws shared nodes from other paths', () => {
        // Graph: root → a, root → a (shared twice), a → b → c → d (a chain), d → a (cycle).
        const edges: Record<string, string[]> = { root: ['a', 'a'], a: ['b'], b: ['c'], c: ['d'], d: ['a'] };
        const walk = (maxDepth: number): string[] => {
            const drawn: string[] = [];
            const path = new DrawPath<string>(maxDepth, 100);
            const draw = (node: string): void => {
                path.enter(node, () => {
                    drawn.push(node);
                    for (const next of edges[node] ?? []) draw(next);
                });
            };
            draw('root');
            return drawn;
        };
        // d → a is cut because a is on the path; the second root → a is drawn again.
        expect(walk(10)).toEqual(['root', 'a', 'b', 'c', 'd', 'a', 'b', 'c', 'd']);
        // A depth of 4 admits root, a, b, c; d is past the cap.
        expect(walk(4)).toEqual(['root', 'a', 'b', 'c', 'a', 'b', 'c']);

        const budgeted: string[] = [];
        const twoDraws = new DrawPath<string>(10, 2);
        for (const node of ['x', 'y', 'z']) twoDraws.enter(node, () => budgeted.push(node));
        expect(budgeted).toEqual(['x', 'y']);
    });

    it('a decode budget refuses a charge that does not fit and keeps the remainder', () => {
        const budget = new DecodeBudget(100);
        expect(budget.take(60)).toBe(true);
        expect(budget.take(50)).toBe(false);
        expect(budget.take(40)).toBe(true);
        expect(budget.take(1)).toBe(false);
    });

    it('visitOnce reports only the first visit of each node', () => {
        const seen = new Set<object>();
        const shared = {};
        expect([visitOnce(seen, shared), visitOnce(seen, {}), visitOnce(seen, shared)]).toEqual([true, true, false]);
    });
});
