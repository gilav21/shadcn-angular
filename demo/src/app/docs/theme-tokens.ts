import {
    baseColors,
    themeColors,
    type BaseColor,
    type ColorBlock,
    type ThemeColor,
} from '../../../../packages/cli/src/templates/styles';

/**
 * The token maths behind the theme playground.
 *
 * The playground is only useful if the CSS it hands a developer is the SAME
 * CSS `set-density` / `set-radius` / `set-motion` / `change-theme` would write.
 * If it diverges, a pasted block silently fights the CLI — worse than having no
 * playground at all. `theme-parity.spec.ts` pins that down: it runs the real
 * CLI cores against a temp project and compares the result var for var.
 *
 * The colour tables are imported from the CLI's own template module rather than
 * copied, so a new preset appears here automatically. The three numeric scales
 * are duplicated deliberately: importing `set-density.ts` would drag `chalk`
 * and `ora` into the demo bundle, so parity is enforced by the test instead of
 * by the import graph.
 */

/** Density level (1-5) → multiplier, mirroring the CLI's `DENSITY_MULTIPLIERS`. */
export const DENSITY_SCALE: Readonly<Record<number, number>> = {
    1: 0.75,
    2: 0.875,
    3: 1,
    4: 1.125,
    5: 1.25,
};

/** Named radius → CSS length, mirroring the CLI's `RADIUS_NAMED`. */
export const RADIUS_SCALE: Readonly<Record<string, string>> = {
    none: '0rem',
    sm: '0.25rem',
    md: '0.375rem',
    lg: '0.625rem',
    xl: '0.75rem',
    full: '9999px',
};

/** Motion level (0-2) → multiplier, mirroring the CLI's `MOTION_MULTIPLIERS`. */
export const MOTION_SCALE: Readonly<Record<number, number>> = {
    0: 0,
    1: 1,
    2: 1.5,
};

/** Human labels for the motion levels, mirroring the CLI's `MOTION_LABELS`. */
export const MOTION_LABELS: Readonly<Record<number, string>> = {
    0: 'no motion',
    1: 'default',
    2: 'expressive',
};

/** Themes `change-theme` accepts, in the CLI's own order. */
export const THEME_NAMES: readonly ThemeColor[] = [
    'zinc', 'slate', 'stone', 'gray', 'neutral',
    'red', 'rose', 'orange', 'green', 'blue', 'yellow', 'violet', 'amber',
];

/** Base colours a project can be initialised with. */
export const BASE_COLORS: readonly BaseColor[] = ['neutral', 'slate', 'stone', 'gray', 'zinc'];

export const DENSITY_LEVELS: readonly number[] = [1, 2, 3, 4, 5];
export const MOTION_LEVELS: readonly number[] = [0, 1, 2];
export const RADIUS_NAMES: readonly string[] = Object.keys(RADIUS_SCALE);

/** Everything the playground lets a developer choose. */
export interface ThemeSettings {
    readonly density: number;
    readonly radius: string;
    readonly motion: number;
    readonly theme: ThemeColor;
    readonly baseColor: BaseColor;
}

export const DEFAULT_THEME_SETTINGS: ThemeSettings = {
    density: 3,
    radius: 'lg',
    motion: 1,
    theme: 'neutral',
    baseColor: 'neutral',
};

/** A radius value the CLI would accept as raw: a rem or px length. */
export function isRawRadius(value: string): boolean {
    return /^[\d.]+(?:rem|px)$/.test(value) && !value.includes(';') && !value.includes('}');
}

/**
 * Resolve a radius the way `set-radius` does: a preset name maps to its length,
 * anything else must already be a valid raw length. Returns null when the CLI
 * would have rejected the input, so the playground can refuse it too.
 */
export function resolveRadius(input: string): string | null {
    if (Object.hasOwn(RADIUS_SCALE, input)) return RADIUS_SCALE[input];
    return isRawRadius(input) ? input : null;
}

/**
 * The scalar `:root` variables, exactly as the CLI writes them: `--density`,
 * `--radius` and `--motion`, with the same resolved values.
 */
export function scalarVars(settings: ThemeSettings): Record<string, string> {
    const radius = resolveRadius(settings.radius);
    const vars: Record<string, string> = {
        '--density': String(DENSITY_SCALE[settings.density] ?? DENSITY_SCALE[3]),
        '--motion': String(MOTION_SCALE[settings.motion] ?? MOTION_SCALE[1]),
    };
    if (radius !== null) vars['--radius'] = radius;
    return vars;
}

/**
 * The colour variables `change-theme` writes, for one scheme.
 *
 * Mirrors the CLI's rule exactly: a theme that is also a base colour replaces
 * the whole base block plus the accent triplet; an accent-only theme replaces
 * just the triplet and inherits the project's configured base colour.
 */
export function colorVars(
    settings: ThemeSettings, scheme: 'light' | 'dark',
): Record<string, string> {
    const isBaseTheme = Object.hasOwn(baseColors, settings.theme);
    const key = isBaseTheme ? (settings.theme as BaseColor) : settings.baseColor;
    const base: ColorBlock = baseColors[key];
    return { ...base[scheme], ...themeColors[settings.theme][scheme] };
}

function renderBlock(selector: string, vars: Record<string, string>): string {
    const body = Object.entries(vars)
        .map(([name, value]) => `  ${name}: ${value};`)
        .join('\n');
    return `${selector} {\n${body}\n}`;
}

/**
 * The copy-paste CSS for a set of playground choices: one `:root` block with
 * the light colours and the three scalars, and one `.dark` block with the dark
 * colours. Pasting it produces the same tokens as running the four CLI commands
 * with the equivalent arguments.
 */
export function buildThemeCss(settings: ThemeSettings): string {
    const root = { ...colorVars(settings, 'light'), ...scalarVars(settings) };
    return `${renderBlock(':root', root)}\n\n${renderBlock('.dark', colorVars(settings, 'dark'))}\n`;
}

/** The equivalent CLI commands, so the playground teaches them rather than replacing them. */
export function equivalentCommands(settings: ThemeSettings): string[] {
    return [
        `npx @gilav21/shadcn-angular change-theme ${settings.theme}`,
        `npx @gilav21/shadcn-angular set-radius ${settings.radius}`,
        `npx @gilav21/shadcn-angular set-density ${settings.density}`,
        `npx @gilav21/shadcn-angular set-motion ${settings.motion}`,
    ];
}
