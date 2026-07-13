import chalk from 'chalk';
import prompts from 'prompts';
import { getConfig } from '../utils/config.js';
import { type AddOptions } from '../core/plan.js';
import { refreshLibCore, type RefreshLibResult } from './doctor.js';

export interface RefreshLibOptions extends AddOptions {
    /** Comma-separated lib file paths to refresh (e.g. `utils.ts,i18n/i18n.token.ts`). */
    files?: string;
    /** Also overwrite lib files you customized (normally protected). */
    force?: boolean;
}

/** Split `--files a.ts, b/c.ts` into the paths refreshLibCore expects. */
export function parseFileList(files: string | undefined): string[] | undefined {
    if (!files) return undefined;
    const parsed = files.split(',').map(f => f.trim()).filter(Boolean);
    return parsed.length > 0 ? parsed : undefined;
}

function printResult(result: RefreshLibResult, dryRun: boolean): void {
    if (result.targets.length === 0) {
        console.log(chalk.green('\nShared lib files are up to date — nothing to refresh.'));
    } else if (dryRun) {
        console.log(chalk.bold('\nWould refresh:'));
        for (const f of result.targets) console.log(chalk.cyan('  • ') + f);
        console.log(chalk.dim('\n[Dry Run] No changes written.'));
    } else {
        console.log(chalk.green(`\n✓ Refreshed ${result.refreshed.length} shared lib file(s).`));
        for (const f of result.refreshed) console.log(chalk.dim('  • ') + f);
    }

    if (result.protectedFiles.length > 0) {
        console.log(chalk.yellow('\nProtected (your edits — pass --force to overwrite):'));
        for (const f of result.protectedFiles) console.log(chalk.yellow('  • ') + f);
    }
    for (const w of result.warnings) console.log(chalk.yellow('  ' + w));
}

/** `--force` destroys local edits to lib files — confirm unless `-y`. */
async function confirmForce(): Promise<boolean> {
    const { ok } = await prompts({
        type: 'confirm',
        name: 'ok',
        message: 'Overwrite shared lib files you customized? Your edits will be lost.',
        initial: false,
    });
    return ok === true;
}

/**
 * `refresh-lib` — reconcile the shared `lib/` files (utils.ts, i18n, parsers,
 * tokens, …) with the registry. Same core routine the MCP `refresh_lib` tool
 * calls: by default only pristine-but-stale and missing files are written, and
 * files you customized are protected unless `--force` is passed.
 */
export async function refreshLib(options: RefreshLibOptions): Promise<void> {
    const cwd = process.cwd();
    const config = await getConfig(cwd);
    if (!config) {
        console.log(chalk.red('Error: components.json not found.'));
        console.log(chalk.dim('Run `npx @gilav21/shadcn-angular init` first.'));
        process.exit(1);
    }
    if (!options.registry && config.registry) options.registry = config.registry;

    if (options.force && !options.yes && !options.dryRun && !await confirmForce()) {
        console.log(chalk.dim('Aborted — nothing was written.'));
        return;
    }

    const result = await refreshLibCore(cwd, config, options, {
        files: parseFileList(options.files),
        force: options.force,
        dryRun: options.dryRun,
    });
    printResult(result, options.dryRun === true);
}
