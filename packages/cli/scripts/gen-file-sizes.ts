/**
 * `npm run docs:sizes` — regenerate `packages/components/file-sizes.json`, the
 * manifest `why` reads to report what a component costs before it is installed.
 *
 * Flags:
 *   --check          exit 1 if the committed manifest differs from a fresh one
 *   --out <path>     output location (default: packages/components/file-sizes.json)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    buildFileSizes,
    serializeFileSizes,
    type MeasuredFile,
} from './gen-file-sizes-lib.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const UI_ROOT = path.join(REPO_ROOT, 'packages/components/ui');
const LIB_ROOT = path.join(REPO_ROOT, 'packages/components/lib');
const BLOCKS_ROOT = path.join(REPO_ROOT, 'packages/blocks');
const DEFAULT_OUT = path.join(REPO_ROOT, 'packages/components/file-sizes.json');

export interface GenFileSizesArgs {
    readonly check: boolean;
    readonly out: string;
}

/** Parse argv. Exported so the contract is unit-testable without a subprocess. */
export function parseArgs(argv: readonly string[]): GenFileSizesArgs {
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

/**
 * Every file under a namespace root, keyed by its path relative to that root.
 * Paths are forward-slashed so the manifest is identical on Windows and Linux —
 * the registry references them that way too.
 */
export function readNamespace(root: string): MeasuredFile[] {
    if (!fs.existsSync(root)) return [];
    const files: MeasuredFile[] = [];
    const walk = (dir: string): void => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const absolute = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                walk(absolute);
                continue;
            }
            files.push({
                path: path.relative(root, absolute).replaceAll('\\', '/'),
                contents: fs.readFileSync(absolute, 'utf-8'),
            });
        }
    };
    walk(root);
    return files;
}

export function run(argv: readonly string[]): number {
    const args = parseArgs(argv);
    const sizes = buildFileSizes(
        readNamespace(UI_ROOT), readNamespace(LIB_ROOT), readNamespace(BLOCKS_ROOT),
    );
    const uiCount = Object.keys(sizes.ui).length;
    if (uiCount === 0) {
        throw new Error(`No files found under ${UI_ROOT}; refusing to write an empty manifest.`);
    }
    const serialized = serializeFileSizes(sizes);

    if (args.check) {
        const current = fs.existsSync(args.out) ? fs.readFileSync(args.out, 'utf-8') : '';
        if (current === serialized) {
            console.log(`file-sizes.json is up to date (${uiCount} component files).`);
            return 0;
        }
        console.error('file-sizes.json is stale. Run `npm run docs:sizes`.');
        return 1;
    }

    fs.mkdirSync(path.dirname(args.out), { recursive: true });
    fs.writeFileSync(args.out, serialized, 'utf-8');
    console.log(
        `Wrote ${path.relative(REPO_ROOT, args.out)} — ${uiCount} component files, ` +
        `${Object.keys(sizes.lib).length} lib files, ` +
        `${Object.keys(sizes.blocks).length} block files.`,
    );
    return 0;
}

const invokedDirectly = process.argv[1] !== undefined
    && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
    process.exit(run(process.argv.slice(2)));
}
