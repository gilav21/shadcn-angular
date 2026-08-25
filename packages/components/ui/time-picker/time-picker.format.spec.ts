// Times of day — `specs/form-controls-small-spec.md` T-3, UC-1, UC-2, R-2.
//
// The claims worth testing hard are the ones the 82-locale sweep produced:
// h:m:s never reorders, the meridiem does, and the digits may not be ASCII.
import { describe, it, expect } from 'vitest';
import {
    dayPeriodFor,
    displayHour,
    formatTimeValue,
    hoursFromDisplay,
    parseSegmentDigits,
    parseTimeValue,
    segmentBounds,
    segmentDisplay,
    stepSegment,
    timeLayout,
} from './time-picker.format';

describe('reading a stored value', () => {
    it('reads HH:mm', () => {
        expect(parseTimeValue('14:30')).toEqual({ hours: 14, minutes: 30, seconds: 0 });
    });

    it('reads HH:mm:ss', () => {
        expect(parseTimeValue('14:30:09')).toEqual({ hours: 14, minutes: 30, seconds: 9 });
    });

    it('reads midnight', () => {
        expect(parseTimeValue('00:00')).toEqual({ hours: 0, minutes: 0, seconds: 0 });
    });

    /**
     * The value is a wire format, not something a person typed, so anything
     * that is not a real clock reading is null rather than a guess.
     */
    it.each([
        ['25:00', 'an hour that does not exist'],
        ['12:60', 'a minute that does not exist'],
        ['12:30:60', 'a second that does not exist'],
        ['1:30', 'an unpadded hour'],
        ['12:3', 'an unpadded minute'],
        ['12.30', 'the wrong separator'],
        ['2:30 PM', 'a rendering rather than a value'],
        ['', 'empty'],
        ['nonsense', 'not a time at all'],
    ])('reads %j (%s) as nothing', raw => {
        expect(parseTimeValue(raw)).toBeNull();
    });

    it('reads a missing value as nothing', () => {
        expect(parseTimeValue(null)).toBeNull();
        expect(parseTimeValue(undefined)).toBeNull();
    });
});

describe('writing a value', () => {
    it('zero-pads', () => {
        expect(formatTimeValue({ hours: 9, minutes: 5, seconds: 0 }, false)).toBe('09:05');
    });

    it('adds seconds only when asked', () => {
        const parts = { hours: 9, minutes: 5, seconds: 9 };
        expect(formatTimeValue(parts, false)).toBe('09:05');
        expect(formatTimeValue(parts, true)).toBe('09:05:09');
    });

    /** UC-1: the value survives JSON, because it is a string. */
    it('round-trips through JSON and back through the parser', () => {
        for (const time of ['00:00', '09:05', '12:00', '14:30', '23:59']) {
            const revived = JSON.parse(JSON.stringify({ time })).time;
            expect(formatTimeValue(parseTimeValue(revived)!, false)).toBe(time);
        }
    });
});

describe('what the locale decides', () => {
    /**
     * Measured over 82 locales: h > minute > second, every one of them, RTL
     * included. R-2 predicted this would vary. It does not.
     */
    it.each(['en-US', 'en-GB', 'de-DE', 'ja-JP', 'he-IL', 'ar-EG', 'fa-IR', 'ko-KR', 'zh-TW'])(
        'keeps hour before minute in %s',
        locale => {
            const { order } = timeLayout(locale, false);
            expect(order.indexOf('hour')).toBeLessThan(order.indexOf('minute'));
        },
    );

    /** What actually varies. `zh-TW` renders 下午9:05 — meridiem first. */
    it('puts the meridiem where the locale puts it', () => {
        expect(timeLayout('en-US', false).order).toEqual(['hour', 'minute', 'dayPeriod']);
        expect(timeLayout('zh-TW', false).order).toEqual(['dayPeriod', 'hour', 'minute']);
    });

    it('shows no meridiem segment in a 24-hour locale', () => {
        const layout = timeLayout('en-GB', false);
        expect(layout.hour12).toBe(false);
        expect(layout.order).toEqual(['hour', 'minute']);
    });

    it('adds a seconds segment only when asked', () => {
        expect(timeLayout('en-GB', true).order).toEqual(['hour', 'minute', 'second']);
    });

    it('takes the half-day names from the locale rather than a list', () => {
        expect(timeLayout('en-US', false).dayPeriods).toEqual({ am: 'AM', pm: 'PM' });
        expect(timeLayout('ar-EG', false).dayPeriods).toEqual({ am: 'ص', pm: 'م' });
        expect(timeLayout('zh-TW', false).dayPeriods).toEqual({ am: '上午', pm: '下午' });
    });

    it('takes the separator from the locale', () => {
        expect(timeLayout('en-GB', false).separators).toEqual([':']);
    });

    /** ar isolates its time inside an RTL paragraph; the marks are not content. */
    it('strips bidi control characters from separators', () => {
        for (const separator of timeLayout('ar-EG', false).separators) {
            expect(separator).not.toMatch(/[‎‏⁦-⁩]/);
        }
    });

    it('reports the locale’s own digits', () => {
        expect(timeLayout('en-US', false).digits[0]).toBe('0');
        expect(timeLayout('ar-EG', false).digits[3]).toBe('٣');
    });
});

describe('12-hour rendering, 24-hour storage', () => {
    it('leaves a 24-hour clock alone', () => {
        expect(displayHour(0, false)).toBe(0);
        expect(displayHour(13, false)).toBe(13);
    });

    /** Both midnight and noon read 12, never 0 — no locale uses an h11 cycle. */
    it('reads midnight and noon as 12', () => {
        expect(displayHour(0, true)).toBe(12);
        expect(displayHour(12, true)).toBe(12);
    });

    it('folds the afternoon', () => {
        expect(displayHour(13, true)).toBe(1);
        expect(displayHour(23, true)).toBe(11);
    });

    it('names the half of the day', () => {
        expect(dayPeriodFor(0)).toBe('am');
        expect(dayPeriodFor(11)).toBe('am');
        expect(dayPeriodFor(12)).toBe('pm');
        expect(dayPeriodFor(23)).toBe('pm');
    });

    it('turns what is shown back into what is stored', () => {
        expect(hoursFromDisplay(12, 'am', true)).toBe(0);
        expect(hoursFromDisplay(12, 'pm', true)).toBe(12);
        expect(hoursFromDisplay(1, 'pm', true)).toBe(13);
        expect(hoursFromDisplay(11, 'pm', true)).toBe(23);
        expect(hoursFromDisplay(9, 'am', true)).toBe(9);
    });

    /** UC-2: 9:05 PM in en-US and 21:05 in de-DE are the same stored value. */
    it('round-trips every hour of the day through the 12-hour rendering', () => {
        for (let hours = 0; hours < 24; hours++) {
            const shown = displayHour(hours, true);
            expect(hoursFromDisplay(shown, dayPeriodFor(hours), true)).toBe(hours);
        }
    });
});

describe('segment bounds and stepping', () => {
    it('runs a 24-hour hour from 0 to 23 and a 12-hour one from 1 to 12', () => {
        expect(segmentBounds('hour', false)).toEqual({ min: 0, max: 23 });
        expect(segmentBounds('hour', true)).toEqual({ min: 1, max: 12 });
    });

    it('runs minutes and seconds from 0 to 59', () => {
        expect(segmentBounds('minute', true)).toEqual({ min: 0, max: 59 });
        expect(segmentBounds('second', false)).toEqual({ min: 0, max: 59 });
    });

    /** Sticking at the bound looks like the control has stopped responding. */
    it('wraps a minute past the top', () => {
        expect(stepSegment(59, 1, { min: 0, max: 59 })).toBe(0);
        expect(stepSegment(0, -1, { min: 0, max: 59 })).toBe(59);
    });

    /** A 12-hour hour wraps to its own minimum, not to zero. */
    it('wraps a 12-hour hour between 12 and 1', () => {
        const bounds = segmentBounds('hour', true);
        expect(stepSegment(12, 1, bounds)).toBe(1);
        expect(stepSegment(1, -1, bounds)).toBe(12);
    });

    it('wraps a 24-hour hour between 23 and 0', () => {
        const bounds = segmentBounds('hour', false);
        expect(stepSegment(23, 1, bounds)).toBe(0);
        expect(stepSegment(0, -1, bounds)).toBe(23);
    });
});

describe('digits that are not ASCII', () => {
    const arabic = timeLayout('ar-EG', false).digits;
    const latin = timeLayout('en-US', false).digits;

    /**
     * R-1, again. An Arabic keyboard types ٣٠, and a field that answers null
     * to the characters it just rendered is not one an Arabic-speaking user
     * can fill in.
     */
    it('reads Arabic-Indic digits', () => {
        expect(parseSegmentDigits('٣٠', arabic)).toBe(30);
    });

    it('reads ASCII digits', () => {
        expect(parseSegmentDigits('30', latin)).toBe(30);
    });

    /** A phone keyboard can produce ASCII even when the locale renders Arabic. */
    it('still reads ASCII in an Arabic locale', () => {
        expect(parseSegmentDigits('30', arabic)).toBe(30);
    });

    it('ignores anything that is not a digit', () => {
        expect(parseSegmentDigits('3a0', latin)).toBe(30);
        expect(parseSegmentDigits('', latin)).toBeNull();
        expect(parseSegmentDigits('abc', latin)).toBeNull();
    });

    it('renders a segment in the locale’s own digits', () => {
        const arabicLayout = timeLayout('ar-EG', false);
        expect(segmentDisplay(5, 'minute', arabicLayout)).toBe('٠٥');
        expect(segmentDisplay(5, 'minute', timeLayout('en-US', false))).toBe('05');
    });

    /** A 12-hour hour is not padded — no locale writes 09:05 PM. */
    it('pads a minute but not a 12-hour hour', () => {
        expect(segmentDisplay(9, 'hour', timeLayout('en-US', false))).toBe('9');
        expect(segmentDisplay(9, 'hour', timeLayout('en-GB', false))).toBe('09');
    });

    /** What is rendered must parse back, in every locale. */
    it('round-trips a rendered segment back through the parser', () => {
        for (const locale of ['en-US', 'ar-EG', 'fa-IR', 'hi-IN']) {
            const layout = timeLayout(locale, false);
            for (const value of [0, 5, 30, 59]) {
                const shown = segmentDisplay(value, 'minute', layout);
                expect(parseSegmentDigits(shown, layout.digits)).toBe(value);
            }
        }
    });
});
