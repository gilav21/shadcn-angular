/**
 * `npm run docs:api` — regenerate `packages/components/api-docs.json` from
 * compodoc's `documentation.json`.
 *
 * Run `npm run docs:json` first: the copy committed at the repo root is a stub,
 * and this script refuses to write an empty extract over the real one.
 *
 * Flags:
 *   --check          exit 1 if the committed extract differs from a fresh one
 *   --docs <path>    documentation.json location (default: ./documentation.json)
 *   --out <path>     output location (default: packages/components/api-docs.json)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    extractApiDocs,
    serializeApiDocs,
    type RawDocumentation,
} from './gen-api-docs-lib.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const DEFAULT_DOCS = path.join(REPO_ROOT, 'documentation.json');
const DEFAULT_OUT = path.join(REPO_ROOT, 'packages/components/api-docs.json');

export interface GenApiDocsArgs {
    readonly check: boolean;
    readonly docs: string;
    readonly out: string;
}

/** Parse argv. Exported so the contract is unit-testable without a subprocess. */
export function parseArgs(argv: readonly string[]): GenApiDocsArgs {
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

export function run(argv: readonly string[]): number {
    const args = parseArgs(argv);
    const raw = JSON.parse(fs.readFileSync(args.docs, 'utf-8')) as RawDocumentation;
    const extract = extractApiDocs(raw);
    if (extract.classes.length === 0) {
        throw new Error(
            `${args.docs} yielded no library classes. The committed documentation.json is a ` +
            `stub — run \`npm run docs:json\` before \`npm run docs:api\`.`,
        );
    }
    const serialized = serializeApiDocs(extract);

    if (args.check) {
        const current = fs.existsSync(args.out) ? fs.readFileSync(args.out, 'utf-8') : '';
        if (current === serialized) {
            console.log(`api-docs.json is up to date (${extract.classes.length} classes).`);
            return 0;
        }
        console.error('api-docs.json is stale. Run `npm run docs:json && npm run docs:api`.');
        return 1;
    }

    fs.mkdirSync(path.dirname(args.out), { recursive: true });
    fs.writeFileSync(args.out, serialized, 'utf-8');
    console.log(
        `Wrote ${path.relative(REPO_ROOT, args.out)} (${extract.classes.length} classes, ` +
        `${serialized.length.toLocaleString('en-US')} bytes).`,
    );
    return 0;
}

const invokedDirectly = process.argv[1] !== undefined
    && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
    process.exit(run(process.argv.slice(2)));
}
