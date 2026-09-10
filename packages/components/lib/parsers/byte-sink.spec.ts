import { describe, expect, it } from 'vitest';
import { ByteSink } from './byte-sink';

describe('ByteSink', () => {
    it('collects pushed bytes and slices in order, growing past its initial capacity', () => {
        const sink = new ByteSink(undefined, 4);
        sink.push(1);
        sink.pushSlice([2, 3, 4, 5]);
        sink.push(6);
        expect(sink).toHaveLength(6);
        expect([...sink.toUint8Array()]).toEqual([1, 2, 3, 4, 5, 6]);
        expect(sink.at(3)).toBe(4);
    });

    it('copies an overlapping back-reference byte by byte, as DEFLATE requires', () => {
        // length > distance is a run: "ab" repeated. A block copy would read
        // the bytes it is still writing.
        const sink = new ByteSink();
        sink.pushSlice([0x61, 0x62]);
        sink.copyBack(2, 5);
        expect([...sink.toUint8Array()]).toEqual([0x61, 0x62, 0x61, 0x62, 0x61, 0x62, 0x61]);
    });

    it('refuses a back-reference that reaches before the start', () => {
        const sink = new ByteSink();
        sink.push(1);
        expect(() => sink.copyBack(2, 1)).toThrow(/back-reference/i);
    });

    it('throws BEFORE writing the byte that would cross the ceiling', () => {
        const sink = new ByteSink(4);
        sink.pushSlice([1, 2, 3, 4]);
        expect(() => sink.push(5)).toThrow(/exceeds the maximum allowed size of 4 bytes/);
        expect(() => sink.pushSlice([5, 6])).toThrow(/exceeds the maximum allowed size/);
        expect(() => sink.copyBack(1, 1)).toThrow(/exceeds the maximum allowed size/);
        expect(sink).toHaveLength(4);
    });

    it('never allocates beyond the ceiling while growing', () => {
        // The point of the type: a 3-byte ceiling must not reserve a 4096-byte
        // buffer, and a growth step must not overshoot the ceiling either.
        const sink = new ByteSink(3, 4096);
        sink.pushSlice([1, 2, 3]);
        expect(sink.toUint8Array()).toHaveLength(3);
        expect(() => sink.push(4)).toThrow();
    });

    it('returns an exact-length copy that later writes do not alias', () => {
        const sink = new ByteSink();
        sink.pushSlice([9, 8]);
        const snapshot = sink.toUint8Array();
        sink.push(7);
        expect([...snapshot]).toEqual([9, 8]);
    });
});
