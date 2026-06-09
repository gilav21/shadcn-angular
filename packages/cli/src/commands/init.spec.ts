import { describe, it, expect } from 'vitest';
import { parseInitDefaults } from './init.js';

const BASE = { branch: 'master' };

describe('parseInitDefaults', () => {
    it('returns an empty object when no default flags are passed', () => {
        expect(parseInitDefaults(BASE)).toEqual({});
    });

    it('parses all flags into normalized values', () => {
        expect(parseInitDefaults({
            ...BASE, density: '2', radius: 'sm', motion: '0', themeFrom: '#3b82f6', locale: 'he',
        })).toEqual({ density: 2, radius: 'sm', motion: 0, themeFrom: '#3b82f6', locale: 'he' });
    });

    it('accepts a valid --theme without adding it to the defaults (baked into config instead)', () => {
        expect(parseInitDefaults({ ...BASE, theme: 'rose' })).toEqual({});
    });

    it('rejects theme and themeFrom together', () => {
        expect(() => parseInitDefaults({ ...BASE, theme: 'rose', themeFrom: '#3b82f6' }))
            .toThrow(/not both/);
    });

    it('rejects an unknown theme name', () => {
        expect(() => parseInitDefaults({ ...BASE, theme: 'crimson' })).toThrow(/Invalid --theme/);
    });

    it('rejects an invalid hex for themeFrom', () => {
        expect(() => parseInitDefaults({ ...BASE, themeFrom: 'blue' })).toThrow(/Invalid --theme-from/);
    });

    it('rejects out-of-range density', () => {
        expect(() => parseInitDefaults({ ...BASE, density: '6' })).toThrow(/Invalid --density/);
        expect(() => parseInitDefaults({ ...BASE, density: 'abc' })).toThrow(/Invalid --density/);
    });

    it('rejects an invalid radius value', () => {
        expect(() => parseInitDefaults({ ...BASE, radius: 'gigantic' })).toThrow(/Invalid radius/);
    });

    it('rejects out-of-range motion', () => {
        expect(() => parseInitDefaults({ ...BASE, motion: '3' })).toThrow(/Invalid --motion/);
    });

    it('rejects an invalid locale code', () => {
        expect(() => parseInitDefaults({ ...BASE, locale: 'English' })).toThrow(/Invalid --locale/);
    });
});
