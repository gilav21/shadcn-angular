/**
 * `npm run docs:readme` — refresh the generated facts block in `README.md`.
 *
 * Flags:
 *   --check          exit 1 if the committed README differs from a fresh build
 *   --out <path>     README location (default: README.md)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyFacts, buildFacts, mergePins, type PackageJson } from './gen-readme-lib.js';
import type { RegistryJson } from './gen-llms-lib.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const DEFAULT_OUT = path.join(REPO_ROOT, 'README.md');
const REGISTRY = path.join(REPO_ROOT, 'packages/components/registry.json');
const DEMO_PKG = path.join(REPO_ROOT, 'demo/package.json');
const ROOT_PKG = path.join(REPO_ROOT, 'package.json');
const FIXTURE_PKG = path.join(REPO_ROOT, 'e2e/fixture-app/package.json');

export interface GenReadmeArgs {
    readonly check: boolean;
    readonly out: string;
}

/** Parse argv. Exported so the contract is unit-testable without a subprocess. */
export function parseArgs(argv: readonly string[]): GenReadmeArgs {
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

function readJson<T>(file: string): T {
    return JSON.parse(fs.readFileSync(file, 'utf-8')) as T;
}

export function run(argv: readonly string[]): number {
    const args = parseArgs(argv);
    const facts = buildFacts(
        readJson<RegistryJson>(REGISTRY),
        mergePins(readJson<PackageJson>(DEMO_PKG), readJson<PackageJson>(ROOT_PKG)),
        readJson<PackageJson>(FIXTURE_PKG),
    );
    if (facts.versions.length === 0) {
        throw new Error('No version pins resolved; refusing to write an empty matrix.');
    }
    const current = fs.readFileSync(args.out, 'utf-8');
    const updated = applyFacts(current, facts);

    if (args.check) {
        if (current === updated) {
            console.log('README facts are up to date.');
            return 0;
        }
        console.error('README facts are stale. Run `npm run docs:readme`.');
        return 1;
    }

    fs.writeFileSync(args.out, updated, 'utf-8');
    console.log(
        `Updated ${path.relative(REPO_ROOT, args.out)} — ` +
        `${facts.components} components, ${facts.addons} addons, ` +
        `${facts.withNpmDependencies} with npm dependencies.`,
    );
    return 0;
}

const invokedDirectly = process.argv[1] !== undefined
    && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
    process.exit(run(process.argv.slice(2)));
}
