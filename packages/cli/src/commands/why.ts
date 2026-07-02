import chalk from 'chalk';
import {
    registry,
    isComponentName,
    suggestComponentName,
    getReverseDependents,
    type ComponentName,
    type ComponentDefinition,
} from '../registry/index.js';
import { parseAttachSymbol } from '../core/apply-wire.js';

/**
 * `why <component> [<component> …]` — registry introspection.
 *
 * For each name, prints what the component is made of (files,
 * libFiles, peerFiles), what it depends on directly, and what
 * transitively depends on it. Useful for spotting why `add X` pulls
 * a particular companion in, or for sizing the blast radius of
 * renaming/removing a primitive.
 *
 * Unknown names suggest the nearest registry key via Levenshtein and
 * exit non-zero so the command is scriptable.
 */
export function why(names: string[]): void {
    if (names.length === 0) {
        console.log(chalk.red('Usage: shadcn-angular why <component> [<component> …]'));
        process.exit(2);
    }

    let failed = false;
    for (const name of names) {
        if (!isComponentName(name)) {
            failed = true;
            const suggestion = suggestComponentName(name);
            console.log(chalk.red(`Unknown component: ${name}`) +
                (suggestion ? chalk.dim(`  — did you mean `) + chalk.cyan(suggestion) + chalk.dim('?') : ''));
            continue;
        }
        printComponent(name);
    }

    if (failed) process.exit(1);
}

/** One labelled line for `why`'s addon output. */
export interface AddonMetaLine {
    readonly label: string;
    readonly value: string;
}

/**
 * Addon-related lines for `why`, mirroring what MCP `get_component` surfaces: a
 * base lists its opt-in `addons`; an `addon` entry shows the parent it attaches
 * to and how (`Attach: <selector> (import <symbol>)`). Returned uncolored so it
 * is unit-testable independent of the terminal styling.
 */
export function formatAddonMeta(def: ComponentDefinition): AddonMetaLine[] {
    const lines: AddonMetaLine[] = [];
    const addons = def.addons ?? [];
    if (addons.length > 0) lines.push({ label: 'Addons', value: addons.join(', ') });
    if (def.type === 'addon' && def.parent) {
        lines.push({ label: 'Addon of', value: def.parent });
        if (def.attach) {
            const symbol = parseAttachSymbol(def.attach.import);
            lines.push({ label: 'Attach', value: `${def.attach.selector} (import ${symbol})` });
        }
    }
    return lines;
}

function printComponent(name: ComponentName): void {
    const def = registry[name];

    console.log('\n' + chalk.bold.cyan(name));

    console.log('\n  ' + chalk.bold(`Files (${def.files.length}):`));
    for (const f of def.files) {
        console.log('    ' + chalk.dim(f));
    }

    const direct = def.dependencies ?? [];
    if (direct.length > 0) {
        console.log('\n  ' + chalk.bold('Direct dependencies:') + ' ' +
            direct.map(d => chalk.cyan(d)).join(chalk.dim(', ')));
    } else {
        console.log('\n  ' + chalk.bold('Direct dependencies:') + chalk.dim(' none'));
    }

    for (const { label, value } of formatAddonMeta(def)) {
        console.log('\n  ' + chalk.bold(`${label}:`) + ' ' + chalk.cyan(value));
    }

    const reverse = [...getReverseDependents(name)].sort((a, b) => a.localeCompare(b));
    if (reverse.length > 0) {
        console.log('  ' + chalk.bold(`Reverse dependents (${reverse.length}):`));
        printWrappedList(reverse, 4);
    } else {
        console.log('  ' + chalk.bold('Reverse dependents:') + chalk.dim(' none'));
    }

    const libs = def.libFiles ?? [];
    if (libs.length > 0) {
        console.log('\n  ' + chalk.bold(`Lib files (${libs.length}):`));
        for (const f of libs) console.log('    ' + chalk.dim(f));
    }

    const peers = def.peerFiles ?? [];
    if (peers.length > 0) {
        console.log('\n  ' + chalk.bold(`Peer files (${peers.length}):`));
        for (const f of peers) console.log('    ' + chalk.dim(f));
    }

    const npm = def.npmDependencies ?? [];
    if (npm.length > 0) {
        console.log('\n  ' + chalk.bold('npm dependencies:') + ' ' +
            npm.map(n => chalk.yellow(n)).join(chalk.dim(', ')));
    }

    console.log('');
}

/**
 * Print a list of names wrapped to ~72 plain chars per line, indented.
 * Width is computed on the raw (uncolored) strings so chalk escape codes
 * don't bias the wrap.
 */
function printWrappedList(items: readonly string[], indent: number): void {
    const pad = ' '.repeat(indent);
    const max = 72;
    let plain = pad;
    let colored = pad;
    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const sep = i === 0 ? '' : ', ';
        if (plain.length + sep.length + item.length > max && plain !== pad) {
            console.log(colored + chalk.dim(','));
            plain = pad + item;
            colored = pad + chalk.cyan(item);
        } else {
            plain += sep + item;
            colored += chalk.dim(sep) + chalk.cyan(item);
        }
    }
    if (plain !== pad) console.log(colored);
}
