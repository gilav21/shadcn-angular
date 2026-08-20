/**
 * T-11 from `specs/dx-distribution-spec.md` §2.1 and §2.2.
 *
 * A playground that emits CSS differing from what `set-density` / `set-radius`
 * / `set-motion` / `change-theme` produce is worse than no playground, because
 * the developer's pasted block then fights the CLI. So this does not compare
 * the playground against a copy of the CLI's constants — it RUNS the real CLI
 * cores against a throwaway project on disk and reads the resulting CSS back
 * with the CLI's own parser, then requires the playground to have said the
 * same thing.
 *
 * Runs in the node leg because it touches the filesystem and the CLI commands
 * pull in `ora`/`chalk`; the playground module it imports is deliberately free
 * of Angular so it can be exercised here.
 */
import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { setDensityCore, DENSITY_MULTIPLIERS } from '../src/commands/set-density.js';
import { setRadiusCore, RADIUS_NAMED } from '../src/commands/set-radius.js';
import { setMotionCore, MOTION_MULTIPLIERS, MOTION_LABELS } from '../src/commands/set-motion.js';
import { changeThemeCore, VALID_THEMES } from '../src/commands/change-theme.js';
import { readBlockVar } from '../src/utils/styles-vars.js';
import {
    BASE_COLORS,
    buildThemeCss,
    colorVars,
    DEFAULT_THEME_SETTINGS,
    DENSITY_SCALE,
    equivalentCommands,
    isRawRadius,
    MOTION_LABELS as PLAYGROUND_MOTION_LABELS,
    MOTION_SCALE,
    RADIUS_SCALE,
    resolveRadius,
    scalarVars,
    THEME_NAMES,
    type ThemeSettings,
} from '../../../demo/src/app/docs/theme-tokens.js';

const temps: string[] = [];

/**
 * A minimal initialised project: `components.json` plus a `tailwind.css` whose
 * `:root` / `.dark` blocks hold the tokens the CLI edits in place.
 */
function project(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'theme-parity-'));
    temps.push(dir);
    fs.writeFileSync(path.join(dir, 'components.json'), JSON.stringify({
        style: 'default',
        tailwind: { css: 'src/styles.css', baseColor: 'neutral', cssVariables: true },
        aliases: { components: '@/components', utils: '@/lib/utils', ui: '@/components/ui' },
    }));
    const src = path.join(dir, 'src');
    fs.mkdirSync(src, { recursive: true });
    fs.writeFileSync(path.join(src, 'styles.css'), TOKEN_CSS);
    return dir;
}

/** Enough of the real token file for the CLI's in-place edits to land. */
const TOKEN_CSS = `:root {
  --background: oklch(0 0 0);
  --foreground: oklch(0 0 0);
  --card: oklch(0 0 0);
  --card-foreground: oklch(0 0 0);
  --popover: oklch(0 0 0);
  --popover-foreground: oklch(0 0 0);
  --primary: oklch(0 0 0);
  --primary-foreground: oklch(0 0 0);
  --secondary: oklch(0 0 0);
  --secondary-foreground: oklch(0 0 0);
  --muted: oklch(0 0 0);
  --muted-foreground: oklch(0 0 0);
  --accent: oklch(0 0 0);
  --accent-foreground: oklch(0 0 0);
  --destructive: oklch(0 0 0);
  --border: oklch(0 0 0);
  --input: oklch(0 0 0);
  --ring: oklch(0 0 0);
  --radius: 0.625rem;
  --density: 1;
  --motion: 1;
}

.dark {
  --background: oklch(0 0 0);
  --foreground: oklch(0 0 0);
  --card: oklch(0 0 0);
  --card-foreground: oklch(0 0 0);
  --popover: oklch(0 0 0);
  --popover-foreground: oklch(0 0 0);
  --primary: oklch(0 0 0);
  --primary-foreground: oklch(0 0 0);
  --secondary: oklch(0 0 0);
  --secondary-foreground: oklch(0 0 0);
  --muted: oklch(0 0 0);
  --muted-foreground: oklch(0 0 0);
  --accent: oklch(0 0 0);
  --accent-foreground: oklch(0 0 0);
  --destructive: oklch(0 0 0);
  --border: oklch(0 0 0);
  --input: oklch(0 0 0);
  --ring: oklch(0 0 0);
}
`;

function cssOf(dir: string): string {
    return fs.readFileSync(path.join(dir, 'src/styles.css'), 'utf-8');
}

/** Parse the playground's emitted CSS back into `{selector: {var: value}}`. */
function parseEmitted(css: string, selector: string): Record<string, string> {
    const block = new RegExp(String.raw`${selector.replace('.', '\\.')}\s*\{([^}]*)}`).exec(css);
    if (!block) throw new Error(`playground CSS has no ${selector} block`);
    const vars: Record<string, string> = {};
    for (const line of block[1].split('\n')) {
        const declaration = /^(--[\w-]+):([^;]*);$/.exec(line.trim());
        if (declaration) vars[declaration[1]] = declaration[2].trim();
    }
    return vars;
}

/** Run every CLI command the playground claims to mirror, for one setting set. */
async function runCli(dir: string, settings: ThemeSettings): Promise<void> {
    await changeThemeCore(settings.theme, dir);
    await setRadiusCore(settings.radius, dir);
    await setDensityCore(settings.density, undefined, dir);
    await setMotionCore(settings.motion, dir);
}

afterEach(() => {
    while (temps.length > 0) {
        fs.rmSync(temps.pop() as string, { recursive: true, force: true });
    }
});

describe('T-11: the playground emits the CSS the CLI writes', () => {
    const cases: ThemeSettings[] = [
        DEFAULT_THEME_SETTINGS,
        { density: 1, radius: 'none', motion: 0, theme: 'blue', baseColor: 'neutral' },
        { density: 5, radius: 'full', motion: 2, theme: 'slate', baseColor: 'neutral' },
        { density: 4, radius: '0.5rem', motion: 1, theme: 'rose', baseColor: 'neutral' },
        { density: 2, radius: '8px', motion: 2, theme: 'stone', baseColor: 'neutral' },
    ];

    it.each(cases)('matches the CLI for %j', async settings => {
        const dir = project();
        await runCli(dir, settings);
        const written = cssOf(dir);
        const emitted = buildThemeCss(settings);

        const emittedRoot = parseEmitted(emitted, ':root');
        for (const [name, value] of Object.entries(emittedRoot)) {
            expect(readBlockVar(written, ':root', name)).toBe(value);
        }

        const emittedDark = parseEmitted(emitted, '.dark');
        for (const [name, value] of Object.entries(emittedDark)) {
            expect(readBlockVar(written, '.dark', name)).toBe(value);
        }
    });

    it('covers every colour var the CLI touches, not a convenient subset', async () => {
        const settings: ThemeSettings = { ...DEFAULT_THEME_SETTINGS, theme: 'slate' };
        const dir = project();
        const before = cssOf(dir);
        await runCli(dir, settings);
        const after = cssOf(dir);

        const changed = [...new Set([...before.matchAll(/--[\w-]+/g)].map(m => m[0]))]
            .filter(name => readBlockVar(before, ':root', name) !== readBlockVar(after, ':root', name));

        expect(changed.length).toBeGreaterThan(5);
        const emitted = parseEmitted(buildThemeCss(settings), ':root');
        for (const name of changed) expect(Object.hasOwn(emitted, name)).toBe(true);
    });

    it('emits the three scalars for every level the CLI accepts', async () => {
        for (const density of Object.keys(DENSITY_MULTIPLIERS).map(Number)) {
            for (const motion of Object.keys(MOTION_MULTIPLIERS).map(Number)) {
                const settings: ThemeSettings = { ...DEFAULT_THEME_SETTINGS, density, motion };
                const dir = project();
                await runCli(dir, settings);
                const written = cssOf(dir);
                const vars = scalarVars(settings);
                expect(readBlockVar(written, ':root', '--density')).toBe(vars['--density']);
                expect(readBlockVar(written, ':root', '--motion')).toBe(vars['--motion']);
            }
        }
    });
});

describe('the playground offers exactly what the CLI accepts', () => {
    it('lists the same themes', () => {
        expect([...THEME_NAMES]).toEqual([...VALID_THEMES]);
    });

    it('lists the same named radii, with the same values', () => {
        expect(RADIUS_SCALE).toEqual(RADIUS_NAMED);
    });

    it('uses the same density multipliers', () => {
        expect(DENSITY_SCALE).toEqual(DENSITY_MULTIPLIERS);
    });

    it('uses the same motion multipliers and labels', () => {
        expect(MOTION_SCALE).toEqual(MOTION_MULTIPLIERS);
        expect(PLAYGROUND_MOTION_LABELS).toEqual(MOTION_LABELS);
    });

    it('lists only base colours the CLI knows', () => {
        expect(BASE_COLORS.every(color => VALID_THEMES.includes(color))).toBe(true);
    });

    it('accepts a raw radius exactly where the CLI does', () => {
        expect(isRawRadius('0.5rem')).toBe(true);
        expect(isRawRadius('8px')).toBe(true);
        expect(isRawRadius('8em')).toBe(false);
        expect(isRawRadius('8px; } body {')).toBe(false);
        expect(resolveRadius('lg')).toBe(RADIUS_NAMED['lg']);
        expect(resolveRadius('nonsense')).toBeNull();
    });

    it('omits --radius rather than emitting an invalid one', () => {
        const settings: ThemeSettings = { ...DEFAULT_THEME_SETTINGS, radius: 'nonsense' };
        expect(Object.hasOwn(scalarVars(settings), '--radius')).toBe(false);
    });

    it('falls back to the CLI defaults for an out-of-range level', () => {
        const settings: ThemeSettings = { ...DEFAULT_THEME_SETTINGS, density: 9, motion: 9 };
        expect(scalarVars(settings)['--density']).toBe(String(DENSITY_MULTIPLIERS[3]));
        expect(scalarVars(settings)['--motion']).toBe(String(MOTION_MULTIPLIERS[1]));
    });

    it('inherits the configured base colour for an accent-only theme', () => {
        const asSlate = colorVars({ ...DEFAULT_THEME_SETTINGS, theme: 'red', baseColor: 'slate' }, 'light');
        const asNeutral = colorVars({ ...DEFAULT_THEME_SETTINGS, theme: 'red', baseColor: 'neutral' }, 'light');
        // The two base palettes are not identical (slate is cooler), but they
        // do agree on some vars, so compare the whole block rather than one.
        expect(asSlate).not.toEqual(asNeutral);
        expect(asSlate['--primary']).toBe(asNeutral['--primary']);
    });

    it('ignores the configured base colour when the theme is itself a base colour', () => {
        const a = colorVars({ ...DEFAULT_THEME_SETTINGS, theme: 'slate', baseColor: 'neutral' }, 'light');
        const b = colorVars({ ...DEFAULT_THEME_SETTINGS, theme: 'slate', baseColor: 'gray' }, 'light');
        expect(a).toEqual(b);
    });

    it('prints the commands that reproduce the same settings', () => {
        const commands = equivalentCommands({
            density: 4, radius: 'sm', motion: 0, theme: 'blue', baseColor: 'neutral',
        });
        expect(commands).toEqual([
            'npx @gilav21/shadcn-angular change-theme blue',
            'npx @gilav21/shadcn-angular set-radius sm',
            'npx @gilav21/shadcn-angular set-density 4',
            'npx @gilav21/shadcn-angular set-motion 0',
        ]);
    });
});
