import { registry, type ComponentName } from '../registry/index.js';

/**
 * A `--preset` could not be resolved: the name is unknown on every base that
 * declares presets, or no requested component declares any. Carries the exact
 * user-facing message; callers print it and exit 1.
 */
export class PresetError extends Error {}

export interface PresetResolution {
    /** The addon keys the preset selects, deduped, in declaration order. */
    readonly addons: ComponentName[];
    /** The requested bases that declared the preset (for diagnostics). */
    readonly declaredBy: ComponentName[];
}

const WHY = 'npx @gilav21/shadcn-angular why';

/** The error for requested bases none of which declare any presets at all. */
function noPresetsError(requested: readonly string[]): PresetError {
    if (requested.length === 1) {
        const name = requested[0];
        return new PresetError(`${name} declares no presets — see: ${WHY} ${name}`);
    }
    return new PresetError(`None of ${requested.join(', ')} declare presets.`);
}

/** The error for a name missing from every base that does declare presets. */
function unknownPresetError(
    preset: string, declaring: readonly { name: string; names: readonly string[] }[],
): PresetError {
    const lines = declaring.map(d => `Unknown preset "${preset}" for ${d.name}. Available: ${d.names.join(', ')}`);
    return new PresetError(lines.join('\n'));
}

/**
 * Resolve `--preset <name>` against the requested components: the union of that
 * preset's addon keys across every requested base that declares it.
 *
 * Throws `PresetError` when no requested component declares presets at all, or
 * when the name is missing from every one that does. A base that declares
 * presets but not *this* name is simply skipped when another base supplies it.
 */
export function resolvePreset(
    requested: readonly string[], preset: string,
): PresetResolution {
    const declaring: { name: string; presets: Readonly<Record<string, readonly string[]>>; names: string[] }[] = [];
    for (const name of requested) {
        const presets = registry[name as ComponentName]?.presets;
        if (presets) declaring.push({ name, presets, names: Object.keys(presets) });
    }

    if (declaring.length === 0) throw noPresetsError(requested);

    const matching = declaring.filter(d => preset in d.presets);
    if (matching.length === 0) throw unknownPresetError(preset, declaring);

    const addons = new Set<string>();
    for (const d of matching) {
        for (const key of d.presets[preset]) addons.add(key);
    }

    return {
        addons: [...addons] as ComponentName[],
        declaredBy: matching.map(d => d.name) as ComponentName[],
    };
}
