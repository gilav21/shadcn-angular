/**
 * Single source of truth for the e2e spec catalogue. Both the
 * orchestrator (`run.ts`) and the impact analyzer (`impact.ts`) read
 * from this module, so a new spec gets included in CI's
 * change-impact computation automatically — no separate mapping to
 * keep in sync.
 */

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

export const ALL_COMPONENTS: readonly ComponentSpec[] = [
    // foundation
    { names: ['button'] }, { names: ['badge'] }, { names: ['input'] },
    { names: ['checkbox'] }, { names: ['label'] },
    // interactive
    { names: ['dialog'] }, { names: ['dropdown-menu'] }, { names: ['popover'] },
    { names: ['tooltip'] }, { names: ['select'] },
    // forms
    { names: ['input-otp'] }, { names: ['date-picker'] }, { names: ['slider'] },
    { names: ['switch'] }, { names: ['radio-group'] },
    // compound
    { names: ['accordion'] }, { names: ['tabs'] }, { names: ['command'] },
    { names: ['data-table'] }, { names: ['tree'] },
    // overlays / lifecycle
    { names: ['sheet'] }, { names: ['drawer'] }, { names: ['toast'] },
    { names: ['sidebar'] }, { names: ['tour'] },
    // more compound + content smokes
    { names: ['carousel'] }, { names: ['navigation-menu'] }, { names: ['menubar'] },
    { names: ['hover-card'] }, { names: ['alert-dialog'] }, { names: ['pagination'] },
    { names: ['avatar'] }, { names: ['progress'] }, { names: ['collapsible'] },
    { names: ['toggle-group'] },
    // charts (libFiles install path)
    { names: ['bar-chart'] }, { names: ['pie-chart'] },
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
    // add-all-smoke is intentionally last — it's the slowest spec
    // (~3-5 min) because it installs every component in the registry
    // and runs `ng build --configuration production`.
    { label: 'add-all-smoke',           module: 'add-all-smoke' },
];
