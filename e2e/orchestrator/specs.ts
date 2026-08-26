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
    // addon system: install the lean data-table base AND its opt-in
    // `context-menu` addon together, then prove they auto-wire via DI
    // (the ⋮ row button + right-click menu) with `uiDtContextMenu`.
    {
        names: ['data-table', 'data-table/context-menu'],
        label: 'data-table-context-menu',
    },
    // addon system: install the lean data-table base AND its opt-in `export`
    // addon together, then prove export runs in a real consumer install (the
    // xlsx dependency ships with the addon, not the base) via `uiDtExport`.
    {
        names: ['data-table', 'data-table/export'],
        label: 'data-table-export',
    },
    // addon system: install the lean data-table base AND its opt-in `pivot`
    // addon together, then prove getPivot runs through the host DI contract in
    // a real consumer install via `uiDtPivot`.
    {
        names: ['data-table', 'data-table/pivot'],
        label: 'data-table-pivot',
    },
    // addon system (rich-text): install the editor + its `actions` addon +
    // dialog together; prove the addon wires the "Attach action" toolbar
    // button via the host slot, and the framework-free render runtime fires
    // the dev callback (opening a real ui-dialog) on the published HTML.
    {
        names: ['rich-text-editor', 'rich-text-editor/actions', 'dialog', 'color-picker'],
        label: 'rte-actions',
    },
    // addon system (rich-text): install the editor + its `emoji` addon; prove
    // the addon contributes the emoji picker toolbar button as a component
    // slot and a pick lands in the content (the emoji-picker dependency ships
    // with the addon, not the base).
    {
        names: ['rich-text-editor', 'rich-text-editor/emoji'],
        label: 'rte-emoji',
    },
    // addon system (rich-text): install the editor + its `slash-commands` addon;
    // prove typing `/` opens the command menu, a block transform runs through the
    // base engine seam, and a custom command from the input runs (the base ships
    // no slash-command code).
    {
        names: ['rich-text-editor', 'rich-text-editor/slash-commands'],
        label: 'rte-slash-commands',
    },
    // addon system (rich-text): install the editor + its `history` addon; prove
    // the "Revisions" corner button + panel appear only on the addon editor,
    // restoring an earlier revision reverts the content, and the preview dialog
    // renders a snapshot (the base sheds the `dialog` dependency entirely).
    {
        names: ['rich-text-editor', 'rich-text-editor/history'],
        label: 'rte-history',
    },
    // addon system (rich-text): install the editor + its `colors` addon; prove
    // the text- and highlight-colour buttons appear only on the addon editor and
    // a pick applies an inline colour style to the selection (the base sheds the
    // `color-picker` dependency entirely).
    {
        names: ['rich-text-editor', 'rich-text-editor/colors'],
        label: 'rte-colors',
    },
    // addon system (rich-text): install the editor + its `typography` addon; prove
    // the font-size and font-family buttons appear only on the addon editor and a
    // pick applies an inline font style to the selection (the base sheds the
    // `autocomplete` dependency entirely).
    {
        names: ['rich-text-editor', 'rich-text-editor/typography'],
        label: 'rte-typography',
    },
    // addon system (rich-text): install the editor + its `links` addon; prove the
    // link button appears only on the addon editor, that inserting through the
    // toolbar popover wraps the selection in an anchor, and that an existing link
    // can be edited/removed — the base ships no link UI (showLinkDialog is inert).
    {
        names: ['rich-text-editor', 'rich-text-editor/links'],
        label: 'rte-links',
    },
    // addon system (rich-text): install the editor + its `tables` addon; prove the
    // table button + 8×8 grid picker appear only on the addon editor and that
    // picking a size inserts a table into the content — the base ships no
    // table-insert UI (editing an existing table stays in the base).
    {
        names: ['rich-text-editor', 'rich-text-editor/tables'],
        label: 'rte-tables',
    },
    // addon system (rich-text): install the editor + its `images` addon; prove the
    // image button + insert popover appear only on the addon editor, that inserting
    // a URL adds an <img> to the content, and that selecting an image reveals the
    // resize/align overlay — the base ships no image UI (content-level <img>
    // rendering + markdown serialization stay in the base). Installs `button` +
    // `popover` transitively via the addon's dependencies.
    {
        names: ['rich-text-editor', 'rich-text-editor/images'],
        label: 'rte-images',
    },
    // addon system (rich-text): install the editor + its `mentions` addon; prove
    // typing `@` opens the candidate popover only on the addon editor and that
    // picking a candidate inserts a [data-mention] chip — the base ships no @/#
    // authoring UI (content-level data-mention/data-tag rendering stays in the
    // base). Installs `scroll-area` transitively via the addon's dependencies.
    {
        names: ['rich-text-editor', 'rich-text-editor/mentions'],
        label: 'rte-mentions',
    },
    // addon system (rich-text): install the editor + its `file-import` addon;
    // prove the import toolbar button + hidden .pdf/.docx picker exist only on the
    // addon editor — the base ships no import UI or parser code (the docx/pdf
    // parser lib files leave the base install with this addon). No extra component
    // dependency; the addon rides the editor's own `button`/`separator`.
    {
        names: ['rich-text-editor', 'rich-text-editor/file-import'],
        label: 'rte-file-import',
    },
    // addon system (rich-text): install the editor + its `ai` addon; prove the
    // Ask-AI selection chip + task panel exist only on the addon editor — the
    // base ships no AI UI (the `ai.ts` lib file leaves the base install with this
    // addon). No extra component dependency; the addon rides the editor's own
    // `button`/`separator`.
    {
        names: ['rich-text-editor', 'rich-text-editor/ai'],
        label: 'rte-ai',
    },
    // addon system (rich-text): install the editor + its `outline` addon; prove
    // the outline toolbar button + docked panel exist only on the addon editor —
    // the base ships no outline UI (the `scroll-area` dependency, and the base's
    // last `button` usage, leave the base install with this addon). The addon
    // pulls `scroll-area` + `button` as its own dependencies.
    {
        names: ['rich-text-editor', 'rich-text-editor/outline'],
        label: 'rte-outline',
    },
    // composition: the slim base + the `full` bundle applied to ONE editor via
    // the single `uiRteFull` attribute — proves toolbar slots, the aggregated
    // slash menu, and the shared overlay anchor compose in a real consumer
    // install, AND that the bundle itself pulls every addon.
    {
        names: ['rich-text-editor', 'rich-text-editor/full'],
        // No explicit transitive deps (the thirteen addons, dialog,
        // color-picker, ...): they must ALL arrive via `rich-text-editor/full`'s
        // registry dependencies, so this spec doubles as a missing-dep
        // regression check for the bundle and every addon entry it composes.
        label: 'rte-all',
    },
    // The `tree-context-menu` DIRECTIVE only matches `ui-tree[uiTreeContextMenu]`,
    // but its registry entry lists only `context-menu` as a dependency — so the
    // harness has to install `tree` alongside it explicitly.
    {
        names: ['tree', 'tree-context-menu'],
        label: 'tree-context-menu',
    },
    // The `data-table-context-menu` DIRECTIVE (`ui-data-table[uiDataTableContextMenu]`)
    // is a different component from the `data-table/context-menu` ADDON above,
    // which already owns the `data-table-context-menu` harness folder. Hence the
    // distinct label.
    {
        names: ['data-table', 'data-table-context-menu'],
        label: 'data-table-ctx-directive',
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
    // The node editor is an addon of infinite-canvas, so its registry key
    // contains a slash and cannot be a harness folder name. Auto-discovery
    // maps folder → component name 1:1, so this is the one way to point the
    // existing `node-editor` harness at the `infinite-canvas/node-editor` key.
    {
        names: ['infinite-canvas/node-editor'],
        label: 'node-editor',
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
    { label: 'merge-update',            module: 'merge-update' },
    { label: 'stale-selector-build',    module: 'stale-selector-build' },
    { label: 'doctor-lib-drift',        module: 'doctor-lib-drift' },
    { label: 'rte-image-seam-upgrade',  module: 'rte-image-seam-upgrade' },
    { label: 'cross-component-typecheck', module: 'cross-component-typecheck' },
    // Compiles three components' usage taken verbatim from `demo/public/llms.txt`.
    // The corpus is only worth publishing if the code it teaches builds.
    { label: 'llms-snippets',           module: 'llms-snippets' },
    // Compiles every recipe under e2e/recipes/ verbatim. A pattern people copy
    // wholesale has to build, or the copier has nothing of their own to blame.
    { label: 'recipes',                 module: 'recipes' },
    { label: 'page-builder-layout',     module: 'page-builder-layout' },
    { label: 'clean-reinstall',         module: 'clean-reinstall' },
    { label: 'migrate',                 module: 'migrate' },
    { label: 'migrate-build',           module: 'migrate-build' },
    // add-all-smoke is intentionally last — it's the slowest spec
    // (~3-5 min) because it installs every component in the registry
    // and runs `ng build --configuration production`.
    { label: 'add-all-smoke',           module: 'add-all-smoke' },
];
