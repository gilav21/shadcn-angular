/**
 * `npm run docs:recipes` — regenerate `demo/public/recipes.json` from the
 * compiling recipe sources under `e2e/recipes/`.
 *
 * Flags:
 *   --check          exit 1 if the committed payload differs from a fresh one
 *   --out <path>     output location (default: demo/public/recipes.json)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    buildRecipes,
    serializeRecipes,
    type RecipeSource,
} from './gen-recipes-lib.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const RECIPES_DIR = 'e2e/recipes';
const DEFAULT_OUT = path.join(REPO_ROOT, 'demo/public/recipes.json');
const SUFFIX = '.recipe.ts';

export interface GenRecipesArgs {
    readonly check: boolean;
    readonly out: string;
}

/** Parse argv. Exported so the contract is unit-testable without a subprocess. */
export function parseArgs(argv: readonly string[]): GenRecipesArgs {
    let check = false;
    let out = DEFAULT_OUT;
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === '--check') check = true;
        else if (arg === '--out') out = path.resolve(argv[++i] ?? '');
        else throw new Error(`Unknown argument: ${arg}`);
    }
    return { check, out };
}

/** Every `<id>.recipe.ts` under `e2e/recipes/`, in name order. */
export function loadRecipeSources(repoRoot: string): RecipeSource[] {
    const dir = path.join(repoRoot, RECIPES_DIR);
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir)
        .filter(name => name.endsWith(SUFFIX))
        .sort((a, b) => a.localeCompare(b))
        .map(name => ({
            id: name.slice(0, -SUFFIX.length),
            file: `${RECIPES_DIR}/${name}`,
            contents: fs.readFileSync(path.join(dir, name), 'utf-8'),
        }));
}

export function run(argv: readonly string[]): number {
    const args = parseArgs(argv);
    const sources = loadRecipeSources(REPO_ROOT);
    if (sources.length === 0) {
        throw new Error(`No ${SUFFIX} files under ${RECIPES_DIR}; refusing to write an empty payload.`);
    }
    const serialized = serializeRecipes(buildRecipes(sources));

    if (args.check) {
        const current = fs.existsSync(args.out) ? fs.readFileSync(args.out, 'utf-8') : '';
        if (current === serialized) {
            console.log(`recipes.json is up to date (${sources.length} recipes).`);
            return 0;
        }
        console.error('recipes.json is stale. Run `npm run docs:recipes`.');
        return 1;
    }

    fs.mkdirSync(path.dirname(args.out), { recursive: true });
    fs.writeFileSync(args.out, serialized, 'utf-8');
    console.log(
        `Wrote ${path.relative(REPO_ROOT, args.out)} — ${sources.length} recipes, ` +
        `${serialized.length.toLocaleString('en-US')} bytes.`,
    );
    return 0;
}

const invokedDirectly = process.argv[1] !== undefined
    && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
    process.exit(run(process.argv.slice(2)));
}
