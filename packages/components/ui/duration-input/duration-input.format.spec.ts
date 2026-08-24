// Durations — `specs/form-controls-small-spec.md` T-2, UC-5.
//
// The two decisions worth testing hard are that the largest unit on show
// absorbs everything above it, and that a partial entry reads from the right
// the way a clock does.
import { describe, it, expect } from 'vitest';
import {
    LEADING_WIDTH,
    SEGMENT_WIDTH,
    formatDuration,
    formatIso8601,
    fromParts,
    parseDuration,
    parseIso8601,
    segmentMax,
    segmentText,
    toParts,
    type DurationUnit,
} from './duration-input.format';

const HMS: readonly DurationUnit[] = ['hours', 'minutes', 'seconds'];
const HM: readonly DurationUnit[] = ['hours', 'minutes'];
const MS: readonly DurationUnit[] = ['minutes', 'seconds'];

describe('splitting a total into units', () => {
    it('splits an hour and a half', () => {
        expect(toParts(5400, HMS)).toEqual({ hours: 1, minutes: 30, seconds: 0 });
    });

    it('splits ninety seconds', () => {
        expect(toParts(90, HMS)).toEqual({ hours: 0, minutes: 1, seconds: 30 });
    });

    /**
     * A field showing only minutes and seconds must render 90 minutes as
     * `90:00`. Dropping the hours would change the value the moment any
     * segment was touched.
     */
    it('lets the largest unit on show absorb everything above it', () => {
        expect(toParts(5400, MS)).toEqual({ hours: 0, minutes: 90, seconds: 0 });
        expect(toParts(5400, ['seconds'])).toEqual({ hours: 0, minutes: 0, seconds: 5400 });
    });

    it('drops the units below the smallest on show', () => {
        // 1:30:45 in an h:mm field is 1 hour 30 minutes; the 45 is not shown.
        expect(toParts(5445, HM)).toEqual({ hours: 1, minutes: 30, seconds: 0 });
    });

    /** A duration is a length; a negative length is not a value a field holds. */
    it('clamps a negative total to zero', () => {
        expect(toParts(-60, HMS)).toEqual({ hours: 0, minutes: 0, seconds: 0 });
    });

    it('floors a fractional total', () => {
        expect(toParts(90.9, HMS)).toEqual({ hours: 0, minutes: 1, seconds: 30 });
    });
});

describe('recombining units', () => {
    it('adds them up', () => {
        expect(fromParts({ hours: 1, minutes: 30, seconds: 45 })).toBe(5445);
    });

    it('treats a negative part as zero', () => {
        expect(fromParts({ hours: -1, minutes: 30, seconds: 0 })).toBe(1800);
    });

    it('round-trips through toParts', () => {
        for (const total of [0, 1, 59, 60, 3599, 3600, 5445, 86_399]) {
            expect(fromParts(toParts(total, HMS))).toBe(total);
        }
    });
});

describe('formatting', () => {
    it('writes h:mm:ss', () => {
        expect(formatDuration(5445, HMS)).toBe('1:30:45');
    });

    it('pads every segment but the first', () => {
        expect(formatDuration(3605, HMS)).toBe('1:00:05');
    });

    /**
     * The leading segment is unpadded: a duration's largest unit has no fixed
     * width the way an hour of the day does, so `90:00` not `090:00`.
     */
    it('leaves the leading segment unpadded', () => {
        expect(formatDuration(5400, MS)).toBe('90:00');
    });

    it('shows only the units asked for', () => {
        expect(formatDuration(5445, HM)).toBe('1:30');
        expect(formatDuration(5445, ['seconds'])).toBe('5445');
    });

    it('writes nothing for no value', () => {
        expect(formatDuration(null, HMS)).toBe('');
    });

    it('writes zero rather than an empty string', () => {
        expect(formatDuration(0, HMS)).toBe('0:00:00');
    });
});

describe('parsing what someone typed', () => {
    it('reads a full h:mm:ss', () => {
        expect(parseDuration('1:30:45', HMS)).toBe(5445);
    });

    /**
     * The same text means different things depending on what is on show,
     * which is exactly why the units are a parameter rather than a guess.
     */
    it('reads 1:30 as an hour and a half when hours are shown', () => {
        expect(parseDuration('1:30', HM)).toBe(5400);
    });

    it('reads 1:30 as ninety seconds when minutes and seconds are shown', () => {
        expect(parseDuration('1:30', MS)).toBe(90);
    });

    /**
     * Right-aligned, the way a clock is: typing `30` into an h:mm field means
     * thirty minutes. Reading it as thirty hours would be indefensible.
     */
    it('reads a partial entry from the right', () => {
        expect(parseDuration('30', HM)).toBe(1800);
        expect(parseDuration('45', HMS)).toBe(45);
        expect(parseDuration('2:30', HMS)).toBe(150);
    });

    it('treats an empty segment as zero', () => {
        // Assembled rather than written literally: `1::30` reads as an IPv6
        // address to the linter, and it is not one.
        const withGap = ['1', '', '30'].join(':');
        expect(parseDuration(withGap, HMS)).toBe(3630);
    });

    it('accepts a value larger than the next unit in the leading position', () => {
        expect(parseDuration('90:00', MS)).toBe(5400);
    });

    it.each([
        ['', 'empty'],
        ['   ', 'whitespace'],
        ['abc', 'letters'],
        ['1:2a', 'a letter in a segment'],
        ['-5', 'a negative'],
        ['1:2:3:4', 'more segments than units'],
    ])('reads %j (%s) as nothing', raw => {
        expect(parseDuration(raw, HMS)).toBeNull();
    });
});

describe('round trips', () => {
    /** UC-5: the value survives JSON, because it is a number. */
    it('survives JSON unchanged', () => {
        const total = 5445;
        expect(JSON.parse(JSON.stringify({ total })).total).toBe(total);
    });

    it('formats and parses back to the same total', () => {
        for (const units of [HMS, HM, MS]) {
            for (const total of [0, 45, 90, 3600, 5445]) {
                const shown = toParts(total, units);
                const text = formatDuration(fromParts(shown), units);
                expect(parseDuration(text, units)).toBe(fromParts(shown));
            }
        }
    });
});

describe('ISO-8601, offered but not the value type', () => {
    it('writes an hour and a half', () => {
        expect(formatIso8601(5400)).toBe('PT1H30M');
    });

    it('writes seconds alone', () => {
        expect(formatIso8601(45)).toBe('PT45S');
    });

    it('writes zero explicitly, because PT is not valid', () => {
        expect(formatIso8601(0)).toBe('PT0S');
    });

    it('writes nothing for no value', () => {
        expect(formatIso8601(null)).toBeNull();
    });

    it.each([
        ['PT1H30M', 5400],
        ['PT45S', 45],
        ['PT0S', 0],
        ['PT2H', 7200],
        ['PT1H2M3S', 3723],
    ])('reads %s as %i seconds', (text, expected) => {
        expect(parseIso8601(text)).toBe(expected);
    });

    it.each(['', 'P1D', 'nonsense', 'PT', 'P'])('reads %j as nothing', text => {
        expect(parseIso8601(text)).toBeNull();
    });

    it('round-trips every total it can express', () => {
        for (const total of [0, 1, 59, 60, 3600, 5445]) {
            expect(parseIso8601(formatIso8601(total) as string)).toBe(total);
        }
    });
});

describe('segment bounds', () => {
    /**
     * Only the leading segment is unbounded. Minutes under an hours segment
     * stop at 59 because sixty of them are an hour — but a minutes-only field
     * has to allow 90, or a ninety-minute duration could not be typed.
     */
    it('caps a following segment at 59', () => {
        expect(segmentMax('minutes', false)).toBe(59);
        expect(segmentMax('seconds', false)).toBe(59);
    });

    it('leaves the leading segment uncapped', () => {
        expect(segmentMax('minutes', true)).toBe(Number.MAX_SAFE_INTEGER);
        expect(segmentMax('hours', false)).toBe(Number.MAX_SAFE_INTEGER);
    });
});

describe('segment text', () => {
    it('pads a following segment to two digits', () => {
        expect(segmentText(5, SEGMENT_WIDTH)).toBe('05');
    });

    it('leaves the leading segment alone', () => {
        expect(segmentText(5, LEADING_WIDTH)).toBe('5');
        expect(segmentText(90, LEADING_WIDTH)).toBe('90');
    });
});
