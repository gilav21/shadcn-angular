/**
 * `npm run docs:components` — regenerate `demo/public/component-docs.json`,
 * the payload the demo app's docs surfaces fetch.
 *
 * Reads `registry.json`, the committed compodoc extract `api-docs.json`, and
 * the demo app's own routes/sources. All committed, so `--check` is a real
 * drift gate.
 *
 * Flags:
 *   --check          exit 1 if the committed payload differs from a fresh one
 *   --docs <path>    api-docs.json location
 *   --out <path>     output location (default: demo/public/component-docs.json)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    buildComponentDocs,
    parseDemoRoutes,
    parseImportedClasses,
    serializeComponentDocs,
    type DemoRouteSource,
} from './gen-component-docs-lib.js';
import type { RegistryJson } from './gen-llms-lib.js';
import type { ApiDocs } from './gen-api-docs-lib.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const DEFAULT_DOCS = path.join(REPO_ROOT, 'packages/components/api-docs.json');
const DEFAULT_OUT = path.join(REPO_ROOT, 'demo/public/component-docs.json');
const REGISTRY = path.join(REPO_ROOT, 'packages/components/registry.json');
const DEMO_APP_DIR = 'demo/src/app';
const ROUTES_FILE = path.join(REPO_ROOT, DEMO_APP_DIR, 'demo.routes.ts');

export interface GenComponentDocsArgs {
    readonly check: boolean;
    readonly docs: string;
    readonly out: string;
}

/** Parse argv. Exported so the contract is unit-testable without a subprocess. */
export function parseArgs(argv: readonly string[]): GenComponentDocsArgs {
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

/**
 * Resolve each lazy route's module specifier to a real file and read the
 * library classes it imports. A route whose module has vanished is skipped —
 * the demo app would already fail to build, and that is its gate, not this one.
 */
export function loadRouteSources(repoRoot: string): DemoRouteSource[] {
    const routesSource = fs.readFileSync(path.join(repoRoot, DEMO_APP_DIR, 'demo.routes.ts'), 'utf-8');
    const sources: DemoRouteSource[] = [];
    for (const route of parseDemoRoutes(routesSource)) {
        // `docs/:name` is the generated documentation page itself, not a demo —
        // it must never be offered as a component's live preview.
        if (route.path.includes(':')) continue;
        const relative = `${DEMO_APP_DIR}/${route.module.replace(/^\.\//, '')}.ts`;
        const absolute = path.join(repoRoot, relative);
        if (!fs.existsSync(absolute)) continue;
        sources.push({
            ...route,
            file: relative,
            importedClasses: parseImportedClasses(fs.readFileSync(absolute, 'utf-8')),
        });
    }
    return sources;
}

export function run(argv: readonly string[]): number {
    const args = parseArgs(argv);
    const docs = JSON.parse(fs.readFileSync(args.docs, 'utf-8')) as ApiDocs;
    if (docs.version !== 1) {
        throw new Error(`${args.docs} has extract version ${docs.version}; this script expects 1.`);
    }
    const registry = JSON.parse(fs.readFileSync(REGISTRY, 'utf-8')) as RegistryJson;
    const routes = loadRouteSources(REPO_ROOT);
    if (routes.length === 0) {
        throw new Error(`No demo routes resolved from ${ROUTES_FILE}; refusing to write a payload.`);
    }
    const payload = buildComponentDocs(registry, docs, routes);
    const serialized = serializeComponentDocs(payload);

    if (args.check) {
        const current = fs.existsSync(args.out) ? fs.readFileSync(args.out, 'utf-8') : '';
        if (current === serialized) {
            console.log(`component-docs.json is up to date (${payload.components.length} components).`);
            return 0;
        }
        console.error('component-docs.json is stale. Run `npm run docs:components`.');
        return 1;
    }

    fs.mkdirSync(path.dirname(args.out), { recursive: true });
    fs.writeFileSync(args.out, serialized, 'utf-8');
    const withRoute = payload.components.filter(c => c.demoRoute !== null).length;
    console.log(
        `Wrote ${path.relative(REPO_ROOT, args.out)} — ${payload.components.length} components, ` +
        `${withRoute} with a live demo route, ` +
        `${serialized.length.toLocaleString('en-US')} bytes.`,
    );
    return 0;
}

const invokedDirectly = process.argv[1] !== undefined
    && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
    process.exit(run(process.argv.slice(2)));
}
