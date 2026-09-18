import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { THEME_NAMES } from '../../components/lib/theme-presets';
import { themeColors, type ThemeColor } from '../src/templates/styles.js';
import {
    END_MARKER,
    START_MARKER,
    THEMED_STYLESHEETS,
    renderThemePresetCss,
    spliceThemePresets,
} from './gen-theme-presets-lib.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

describe('theme presets', () => {
    it('offers exactly the names change-theme accepts', () => {
        expect([...THEME_NAMES].sort((a, b) => a.localeCompare(b)))
            .toEqual(Object.keys(themeColors).sort((a, b) => a.localeCompare(b)));
    });

    it('renders a light rule and an ancestor-aware dark rule per preset, with the CLI values', () => {
        const css = renderThemePresetCss();
        for (const name of Object.keys(themeColors) as ThemeColor[]) {
            const light = `:host([data-ui-theme='${name}']) {`;
            const dark = `:host-context(.dark)[data-ui-theme='${name}'] {`;
            expect(css).toContain(light);
            expect(css).toContain(dark);
            const darkBody = css.slice(css.indexOf(dark), css.indexOf('}', css.indexOf(dark)));
            for (const [token, value] of Object.entries(themeColors[name].dark)) {
                expect(darkBody).toContain(`${token}: ${value};`);
            }
        }
    });

    it('appends the block to a stylesheet that has none, keeping its content', () => {
        const out = spliceThemePresets('@media print { :host { display: block; } }\n', 'BLOCK');
        expect(out).toBe('@media print { :host { display: block; } }\n\nBLOCK\n');
    });

    it('replaces an existing block in place instead of stacking a second one', () => {
        const stale = `before\n${START_MARKER}\nold\n${END_MARKER}\nafter\n`;
        const out = spliceThemePresets(stale, `${START_MARKER}\nnew\n${END_MARKER}`);
        expect(out).toBe(`before\n${START_MARKER}\nnew\n${END_MARKER}\nafter\n`);
        expect(spliceThemePresets(out, `${START_MARKER}\nnew\n${END_MARKER}`)).toBe(out);
    });

    it.each(THEMED_STYLESHEETS)('%s is in sync with the CLI colour table (npm run themes:sync)', (file) => {
        const css = readFileSync(path.join(REPO_ROOT, file), 'utf-8');
        expect(css).toContain(renderThemePresetCss());
    });
});
