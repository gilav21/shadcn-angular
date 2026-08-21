/**
 * `npm run docs:llms` — regenerate `demo/public/llms.txt`.
 *
 * The demo app's `public/` folder is served at the site root, so the corpus
 * lands at a stable, fetchable `/llms.txt` on the deployed site.
 *
 * Both inputs are committed — `packages/components/registry.json` and the
 * compodoc extract `packages/components/api-docs.json` (`npm run docs:api`) —
 * so a fresh generation is reproducible from git alone and `--check` is a
 * meaningful drift gate. All formatting logic lives in `gen-llms-lib.ts` so it
 * is unit-testable without touching disk.
 *
 * Flags:
 *   --check          exit 1 if the file on disk differs from a fresh generation
 *   --docs <path>    api-docs.json location (default: packages/components/api-docs.json)
 *   --out <path>     output location (default: demo/public/llms.txt)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildLlmsTxt, type RegistryJson } from './gen-llms-lib.js';
import type { ApiDocs } from './gen-api-docs-lib.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const DEFAULT_DOCS = path.join(REPO_ROOT, 'packages/components/api-docs.json');
const DEFAULT_OUT = path.join(REPO_ROOT, 'demo/public/llms.txt');
const REGISTRY = path.join(REPO_ROOT, 'packages/components/registry.json');

export interface GenLlmsArgs {
    readonly check: boolean;
    readonly docs: string;
    readonly out: string;
}

/** Parse argv. Exported so the contract is unit-testable without a subprocess. */
export function parseArgs(argv: readonly string[]): GenLlmsArgs {
    let check = false;
    let docs = DEFAULT_DOCS;
    let out = DEFAULT_OUT;
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === '--check') check = true;
        else if (arg === '--docs') docs = path.resolve(argv[++i] ?? '');
        else if (arg === '--out') out = path.resolve(argv[++i] ?? '');
        else throw new Error(`Unknown argument: ${arg}`);
    }
    return { check, docs, out };
}

function readJson<T>(file: string): T {
    return JSON.parse(fs.readFileSync(file, 'utf-8')) as T;
}

function assertDocsUsable(docs: ApiDocs, file: string): void {
    if (docs.version !== 1) {
        throw new Error(`${file} has extract version ${docs.version}; this script expects 1.`);
    }
    if (docs.classes.length === 0) {
        throw new Error(
            `${file} lists no classes — regenerate it with ` +
            `\`npm run docs:json && npm run docs:api\` before \`docs:llms\`.`,
        );
    }
}

export function run(argv: readonly string[]): number {
    const args = parseArgs(argv);
    const docs = readJson<ApiDocs>(args.docs);
    assertDocsUsable(docs, args.docs);
    const registry = readJson<RegistryJson>(REGISTRY);
    const corpus = buildLlmsTxt(registry, docs);

    if (args.check) {
        const current = fs.existsSync(args.out) ? fs.readFileSync(args.out, 'utf-8') : '';
        if (current === corpus) {
            console.log(`llms.txt is up to date (${path.relative(REPO_ROOT, args.out)}).`);
            return 0;
        }
        console.error('llms.txt is stale. Run `npm run docs:llms` and commit the result.');
        return 1;
    }

    fs.mkdirSync(path.dirname(args.out), { recursive: true });
    fs.writeFileSync(args.out, corpus, 'utf-8');
    console.log(
        `Wrote ${path.relative(REPO_ROOT, args.out)} ` +
        `(${corpus.length.toLocaleString('en-US')} bytes).`,
    );
    return 0;
}

const invokedDirectly = process.argv[1] !== undefined
    && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
    process.exit(run(process.argv.slice(2)));
}
