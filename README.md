# shadcn-angular

Beautifully designed components built with Angular and Tailwind CSS.
This is an unofficial community-led port of [shadcn/ui](https://ui.shadcn.com/)
for Angular.

[**Storybook**](https://shadcn-angular-storybook.netlify.app/) | [**Demo**](https://shadcn-angular-demo.netlify.app/)

> **NOTE:** This library is a collection of re-usable components that you can
> copy and paste into your apps.

<!-- BEGIN GENERATED: facts (npm run docs:readme) -->

## 0 runtime dependencies

All **178** components and addons install as source you own. **0** of them pull an npm package: the CLI copies TypeScript, HTML and CSS into your project and adds nothing to your `package.json`. There is no `@shadcn-angular/*` runtime to depend on, to keep in version lockstep, or to wait on for a fix — you edit the component in place.

Registry today: 152 components, 26 opt-in addons, 10 composed blocks.

## Tested versions

| | Developed against | Verified in a consumer install |
|---|---|---|
| Angular | 21.2.17 | 20.3.0 |
| TypeScript | 5.9.2 | 5.9.2 |

"Verified in a consumer install" is not a compatibility promise on paper: every release runs the e2e suite, which `init`s a pristine Angular app, `add`s components into it exactly as a user would, and builds it with `strictTemplates`. Angular 20 and 21 are both covered.

<!-- END GENERATED: facts -->

## Features

- **Customizable**: Built with Tailwind CSS.
- **Accessible**: Uses standard HTML elements and accessibility best practices.
- **Lightweight**: Copy/paste components give you full control over the code.
- **Dark Mode**: Built-in dark mode support.
- **Rich Text Editor**: Includes a full-featured rich text editor component.

## Quick Start

The easiest way to get started is by using our CLI tool.

```bash
# Initialize the project
npx @gilav21/shadcn-angular init

# Add a component
npx @gilav21/shadcn-angular add button

# Install an addon and wire it into your component (e.g. data-table's context menu)
npx @gilav21/shadcn-angular apply data-table/context-menu

# Pull the latest upstream version, 3-way merging into your local edits
npx @gilav21/shadcn-angular update
```

See [`packages/cli/README.md`](./packages/cli/README.md) for the full CLI
reference, including addons and the update merge flow.

## Local Development

If you want to contribute or experiment with the components locally:

1. **Clone the repository**

    ```bash
    git clone https://github.com/gilav21/shadcn-angular.git
    cd shadcn-angular
    ```

2. **Install dependencies**

    ```bash
    npm install
    ```

3. **Run the demo application**
    The `demo` folder contains a documentation site/showcase of all components.

    ```bash
    npm run dev
    ```

    Access the demo at `http://localhost:4200`.

## Project Structure

- `packages/cli`: Source code for the `@gilav21/shadcn-angular` CLI tool.
- `packages/components`: The "source of truth" for all components (template
  files used by the CLI).
- `demo`: An Angular application showcasing usages of all components.
- `e2e`: End-to-end test suite — fixture Angular app + per-component
  harnesses + orchestrator. See [`e2e/README.md`](./e2e/README.md).

## Adding e2e coverage for a new component

The e2e suite installs each component into a pristine Angular project the
same way a consumer would, then drives Playwright at the result. CI runs
the subset of specs each PR's diff actually touches (registry-driven
impact analysis); pushes to master run everything.

**Adding coverage is one command** — no edits to spec lists, no
mapping tables:

```bash
# Author drops a new <ui-tag-input> component on disk, then:
npm run e2e:scaffold -- tag-input

# ✓ created e2e/harness/tag-input/tag-input-demo.component.ts
# ✓ created e2e/harness/tag-input/tag-input.spec.ts

# Run it locally:
npm run e2e -- tag-input

# Commit. CI picks it up automatically.
```

The scaffolder reads the CLI registry for `<name>`, parses
`packages/components/ui/<name>/index.ts` to find every exported class,
and writes a working harness + a passing smoke spec. The orchestrator's
auto-discovery layer picks the new spec up without any other file
edits; CI's impact analyzer maps any future change under
`packages/components/ui/tag-input/**` to this spec via the registry.

Then extend `<name>.spec.ts` with the real behavioral assertions you
want — the sub-component `data-testid`s are already wired up in the
generated demo.

If the component isn't yet registered when you run the scaffolder, it
runs `sync-registry --fix` for you. Typos suggest the nearest registry
key:

```text
$ npm run e2e:scaffold -- radoi-group
Unknown component: radoi-group  — did you mean radio-group?
```

### Inspecting the registry

`npx shadcn-angular why <component>` prints a component's files, direct
dependencies, and reverse-dependents (everything that would re-test if
you changed it). Useful when picking dependencies or sizing a refactor:

```bash
npx @gilav21/shadcn-angular why button
#   Files (3): button/button.component.html, …
#   Direct dependencies: ripple
#   Reverse dependents (18): bento-grid, calendar, chat, …
```

### Multi-component / special-`initArgs` specs

Single-component specs are auto-discovered from `e2e/harness/<name>/`.
Multi-component specs (a single harness rendering several components)
or specs needing a non-default `init` invocation (e.g. `init --prefix
acme`) still register in `e2e/orchestrator/specs.ts`:

```ts
const EXPLICIT_SPECS: readonly ComponentSpec[] = [
    {
        names: ['input', 'label', 'button', 'dialog'],
        label: 'form-flow',
    },
    // …
];
```

The `names` list is read by both the runner (for `add a b c --yes`)
and the impact analyzer (so changes to any of those components
schedule the spec automatically).

See [`e2e/README.md`](./e2e/README.md) for the full pipeline (reset
→ init → add → npm install → ng serve → Playwright), interactive
modes (`e2e:headed`, `e2e:ui`, `e2e:debug`), and troubleshooting.

## License

MIT
