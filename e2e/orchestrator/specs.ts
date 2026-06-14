/**
 * Single source of truth for the e2e spec catalogue.
 *
 * `ALL_COMPONENTS` is the merged list consumed by both the runner
 * (`run.ts`) and the impact analyzer (`impact.ts`). It is built once
 * at module load by `loadSpecs()`, which combines:
 *
 *   1. `EXPLICIT_SPECS` — the genuine special cases: multi-component
 *      installs and entries needing custom `initArgs`. About 7 entries.
 *   2. Auto-discovered single-component specs — every folder
 *      `e2e/harness/<X>/` that contains `<X>-demo.component.ts` and
 *      is NOT already claimed by an EXPLICIT_SPECS entry's resolved
 *      harness folder produces `{ names: [X] }` automatically.
 *
 * Every spec's `names[]` is validated against the CLI registry on
 * load; a typo throws with a "did you mean …?" suggestion before any
 * orchestration work is wasted.
 *
 * Adding a new single-component spec requires zero edits to this
 * file — drop the harness folder under `e2e/harness/` and it appears
 * automatically. Multi-component / initArgs cases still register
 * explicitly here.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    isComponentName,
    suggestComponentName,
} from '../../packages/cli/src/registry/index.js';

export interface ComponentSpec {
    /**
     * Components to install via `add`. Single-element list for the simple
     * case; multi-element list runs `add <a> <b> <c> --yes` so the
     * dependency-resolution and parallel-install paths get exercised.
     */
    readonly names: readonly string[];
    /** Optional `init` CLI args. Defaults to `init --yes`. */
    readonly initArgs?: readonly string[];
    /**
     * Display label for logs and spec-file resolution. Required when
     * `names` has more than one component, otherwise defaults to `names[0]`.
     */
    readonly label?: string;
    /**
     * Harness folder under `e2e/harness/`. Defaults to `label` (or
     * `names[0]` when label is omitted). Override when one component is
     * exercised by multiple specs with different demo pages (e.g. the
     * `--prefix` test).
     */
    readonly harnessFolder?: string;
}

/** Resolved label for a spec — falls back to first component name. */
export function specLabel(spec: ComponentSpec): string {
    return spec.label ?? spec.names[0];
}

/** Resolved harness folder name — falls back to the spec label. */
export function specHarness(spec: ComponentSpec): string {
    return spec.harnessFolder ?? specLabel(spec);
}

/**
 * Specs that can't be auto-discovered from a single harness folder:
 * multi-component installs (where `names[]` lists several components)
 * and overrides that need custom `initArgs`. Everything else is
 * picked up by `loadSpecs()` from disk.
 */
const EXPLICIT_SPECS: readonly ComponentSpec[] = [
    // multi-component install — exercises `add a b c` in one call and
    // template-compiles all of them together inside a single harness.
    {
        names: ['input', 'label', 'button', 'dialog'],
        label: 'form-flow',
    },
    // cross-cutting: RTL layout across overlays.
    {
        names: ['dialog', 'dropdown-menu', 'select'],
        label: 'rtl',
    },
    // cross-cutting: dark-mode CSS variable propagation.
    {
        names: ['button'],
        label: 'dark-mode',
    },
    // cross-cutting: axe a11y scan on a representative sign-up form.
    {
        names: ['input', 'label', 'button', 'dialog', 'checkbox'],
        label: 'a11y-form',
    },
    // a11y: dialog focus-trap contract (open → focus inside, ESC →
    // focus restored to trigger).
    {
        names: ['dialog'],
        label: 'dialog-focus',
    },
    // ReactiveForms integration: ui-input + ui-checkbox via Validators.
    {
        names: ['input', 'label', 'button', 'checkbox'],
        label: 'form-validation',
    },
    // CLI feature smoke test — installs button under a custom prefix
    // (orchestrator passes `--prefix acme` to init), then renders it via a
    // dedicated harness that uses `<acme-button>` directly.
    {
        names: ['button'],
        label: 'prefix-button',
        initArgs: ['init', '--yes', '--prefix', 'acme'],
    },
];

const HARNESS_DIR = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../harness',
);

/**
 * Walks `e2e/harness/` and returns every subdirectory whose
 * `<dir>-demo.component.ts` file exists. The convention — folder
 * name equals demo-file prefix equals spec label — is the contract
 * that makes auto-discovery safe.
 */
function discoverHarnessFolders(): string[] {
    if (!fs.existsSync(HARNESS_DIR)) return [];
    const out: string[] = [];
    for (const entry of fs.readdirSync(HARNESS_DIR, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const demo = path.join(HARNESS_DIR, entry.name, `${entry.name}-demo.component.ts`);
        if (fs.existsSync(demo)) out.push(entry.name);
    }
    return out.sort((a, b) => a.localeCompare(b));
}

function validateSpecs(specs: readonly ComponentSpec[]): void {
    for (const spec of specs) {
        for (const name of spec.names) {
            if (isComponentName(name)) continue;
            const suggestion = suggestComponentName(name);
            const hint = suggestion ? ` (did you mean "${suggestion}"?)` : '';
            throw new Error(
                `[e2e:specs] spec "${specLabel(spec)}" references unknown component "${name}"${hint}. ` +
                `Either fix the typo or run sync-registry so the component is registered.`,
            );
        }
    }
}

function loadSpecs(): readonly ComponentSpec[] {
    const explicit = EXPLICIT_SPECS;

    // Build the set of harness folders claimed by an explicit entry so
    // we don't double-add them as single-component auto-entries.
    const claimedHarnesses = new Set(explicit.map(specHarness));

    const discovered: ComponentSpec[] = [];
    for (const folder of discoverHarnessFolders()) {
        if (claimedHarnesses.has(folder)) continue;
        discovered.push({ names: [folder] });
    }

    const merged = [...discovered, ...explicit];
    validateSpecs(merged);
    return merged;
}

/**
 * Merged list of every component-render spec the orchestrator knows
 * about. Cached at module load. `run.ts` and `impact.ts` both import
 * this name unchanged from the previous version of the file.
 */
export const ALL_COMPONENTS: readonly ComponentSpec[] = loadSpecs();

export interface CliSpecEntry {
    readonly label: string;
    readonly module: string;
}

/**
 * CLI-only regression specs (no ng serve / no Playwright). Each entry
 * points at a module under `e2e/cli-specs/` whose default export is an
 * async function receiving { runCli, captureCli, fixtureApp }.
 */
export const CLI_SPECS: readonly CliSpecEntry[] = [
    { label: 're-add-identical',        module: 're-add-identical' },
    { label: 'local-mod-conflict',      module: 'local-modification-conflict' },
    { label: 'prefix-multi-install',    module: 'prefix-multi-install' },
    { label: 'prod-build',              module: 'prod-build' },
    { label: 'unknown-component',       module: 'unknown-component' },
    { label: 'add-without-init',        module: 'add-without-init' },
    { label: 'list-and-diff',           module: 'list-and-diff' },
    { label: 'update-bounded',          module: 'update-bounded' },
    { label: 'update-guards',           module: 'update-guards' },
    { label: 'peerfiles-missing',       module: 'peerfiles-missing' },
    { label: 'migrate',                 module: 'migrate' },
    { label: 'migrate-build',           module: 'migrate-build' },
    // add-all-smoke is intentionally last — it's the slowest spec
    // (~3-5 min) because it installs every component in the registry
    // and runs `ng build --configuration production`.
    { label: 'add-all-smoke',           module: 'add-all-smoke' },
];
