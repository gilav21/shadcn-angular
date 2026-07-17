# @gilav21/shadcn-angular

An Angular port of [shadcn/ui](https://ui.shadcn.com/) -
beautifully designed components that you can copy and paste into your apps.

This CLI tool helps you easily add components to your Angular project.

## Prerequisites

- Angular v17+
- Tailwind CSS installed and configured

## Installation

Run the `init` command to set up your project:

```bash
npx @gilav21/shadcn-angular init
```

This will:

1. Configure your `tailwind.config.ts`.
2. Add CSS variables to your global styles.
3. Add a `cn` utility for class merging.
4. Create a `components.json` configuration file.

### `init` Options

| Flag | Description |
| ------ | ------------- |
| `-y, --yes` | Skip confirmation prompt |
| `-d, --defaults` | Use default configuration |
| `-b, --branch <branch>` | GitHub branch to fetch from (default: `master`) |
| `--prefix <prefix>` | Component selector prefix (default: `ui`) |

### Custom component prefix

By default components are installed with the `ui-` selector prefix
(`<ui-button>`, `<ui-accordion>`, …). If your project already uses
`ui-*` for another package, pass `--prefix` during init to rewrite every
installed component to your prefix:

```bash
npx @gilav21/shadcn-angular init --prefix acme
npx @gilav21/shadcn-angular add button accordion
```

The copied files will use `<acme-button>`, `<acme-accordion-item>`, etc.
The prefix is persisted to `components.json` as `"prefix": "acme"` and
applied automatically by subsequent `add` commands. The prefix must be a
lowercase kebab-case token (e.g. `ui`, `myapp`, `acme-ui`). `data-slot`
attribute values are intentionally not rewritten — they remain stable
styling/testing hooks regardless of the prefix.

## Usage

Use the `add` command to add components to your project:

```bash
npx @gilav21/shadcn-angular add [component...]
```

Example:

```bash
npx @gilav21/shadcn-angular add button
```

You can add multiple components at once:

```bash
npx @gilav21/shadcn-angular add button card dialog
```

Or run without arguments to select from a list:

```bash
npx @gilav21/shadcn-angular add
```

### `add` Options

| Flag | Description |
| ------ | ------------- |
| `-y, --yes` | Skip all prompts (skips the addon prompt, overwrites conflicts) |
| `-o, --overwrite` | Overwrite existing files whole-file (`add` never 3-way merges) |
| `-a, --all` | Install every available component |
| `--with <addons>` | Install addon(s) too — `parent/addon` keys, comma-separated, or `all` |
| `--no-addons` | Skip optional addons without prompting |
| `-p, --path <path>` | Custom install directory (overrides `components.json`) |
| `--remote` | Force fetch from GitHub (skip local registry) |
| `--dry-run` | Show what would be installed without making changes |
| `--include-tests` | Also install each component's unit tests (persists `tests.include`) |
| `--no-tests` | Skip test files for this invocation (overrides `tests.include`) |
| `-b, --branch <branch>` | GitHub branch to fetch from (default: `master`) |

## Addons

Some components ship a **lean base** plus **opt-in addons** — extra features that
resolving the base does *not* pull in automatically. For example, `data-table`
exposes a `data-table/context-menu` addon for right-click row, header, and column
menus.

After you `add` a component, the CLI lists the addons available for it:

```bash
npx @gilav21/shadcn-angular add data-table
# Optional addons available (not installed):
#   data-table/context-menu — ...
#   Wire one in with: npx @gilav21/shadcn-angular apply data-table/context-menu
```

Use `apply` to install an addon (if it isn't already present) **and** wire it into
your existing usage:

```bash
npx @gilav21/shadcn-angular apply data-table/context-menu
```

This adds the addon's directive to your `<ui-data-table>` tags (the
`uiDtContextMenu` attribute) and its import to the component, so the feature is
live without hand-editing templates. Pass component class name(s) to target
specific instances, or `--scan` to search the whole app and choose interactively.

Related `add` flags:

- **`add --with <parent/addon>`** — install the addon's files alongside the base
  (comma-separated keys, or `all`) **without** wiring them in.
- **`add --no-addons`** — skip the addon prompt entirely (useful in CI).

## Installing component tests

By default components ship as source only — which can *drop* your project's test
coverage the moment you add them, failing a CI coverage gate on files that have
no tests. `add --include-tests` fixes that: it installs each component's unit
tests alongside its source, so the new files arrive already covered.

```bash
npx @gilav21/shadcn-angular add button --include-tests
```

The first time you pass `--include-tests`, the choice is saved to
`components.json` so every later `add` / `update` includes tests automatically:

```jsonc
{
  "tests": {
    "include": true,      // ship specs on add/update
    "runner": "vitest"    // detected from your project; "vitest" | "jest"
  }
}
```

Pass `--no-tests` to skip specs for a single invocation (it never un-persists the
default).

### vitest and jest

The shipped specs are written for **vitest**. If your project uses **jest**, the
CLI detects it (from your `devDependencies` / config files) and installs a tiny
`vitest-compat` shim into your `lib/` folder, rewriting each spec's
`import … from 'vitest'` to point at it — so the same specs run unchanged on
jest. The shim bridges the portable `vi.*` surface (`vi.fn`, `vi.spyOn`,
`vi.useFakeTimers`, `vi.stubGlobal`, timers, …) to their jest equivalents.

Jest projects need **`@jest/globals`** in their `devDependencies` (the shim
imports it) and their jest config must map the components alias
(`moduleNameMapper`), the same mapping the component source already relies on
for `cn` and other `lib/` imports.

### Switching runners

Migrating a project between runners? One command flips every installed spec and
the shim, in place (your local spec edits are preserved):

```bash
npx @gilav21/shadcn-angular set-test-runner jest     # or: vitest
npx @gilav21/shadcn-angular set-test-runner vitest --dry-run
```

### Which components ship tests

Only components whose specs are **verified portable** — they pass on a plain
vitest (jsdom) setup *and* a jest setup, at full coverage — ship tests today. If
you `add --include-tests` a component that isn't verified yet, its source
installs normally and it simply ships no specs (the verified set grows over
time). Run `npx @gilav21/shadcn-angular why <component>` to see whether a
component carries `testFiles`.

## Updating components

`update` pulls the latest registry version of your installed components:

```bash
npx @gilav21/shadcn-angular update             # all installed components
npx @gilav21/shadcn-angular update data-table  # only the named components
```

By default `update` performs a **3-way merge**, so your local edits survive and
only the upstream changes are layered on top. When an upstream change collides
with one of your edits, the conflict is written into the file as git-style
markers:

```text
<<<<<<< ours
...your version...
=======
...upstream version...
>>>>>>> theirs
```

Resolve the markers, then rebuild. Other flags:

- **`--overwrite`** — take the upstream file whole-file, discarding local edits
  (no merge). Teams that always want this can set it as the default in
  `components.json`: `{ "update": { "overwrite": true } }` (an explicit CLI flag
  still wins).
- **`--dry-run`** — preview what would change without writing, including a
  per-file merge prediction (would merge cleanly / WOULD CONFLICT / would keep).
- **`--yes`** — install any newly-required dependencies without prompting. In CI,
  `update --yes` exits non-zero whenever it writes conflict markers, so a merge
  that needs human attention fails the build instead of passing silently.
- **`--include-tests` / `--no-tests`** — refresh (or skip) each updated
  component's tests. With `tests.include` persisted in `components.json`, updates
  refresh specs automatically; `--no-tests` skips them for one run.

### Refreshing the shared `lib/` files

Components share a small `lib/` layer (`utils.ts`, i18n, parsers, tokens, …) that
belongs to no single component, so an updated component can arrive expecting a
newer `lib/` export. `refresh-lib` reconciles it with the registry:

```bash
npx @gilav21/shadcn-angular refresh-lib             # stale + missing lib files
npx @gilav21/shadcn-angular refresh-lib --dry-run   # preview
npx @gilav21/shadcn-angular refresh-lib --files utils.ts
npx @gilav21/shadcn-angular refresh-lib --force -y  # also overwrite YOUR edits
```

Lib files you customized are protected and listed, never overwritten, unless you
pass `--force` (which confirms first — `-y` skips the prompt). This is the same
routine the MCP `refresh_lib` tool runs.

### `components.lock.json`

`init` and `add` maintain a `components.lock.json` at your project root — commit
it. Version 2 records a per-component `ref` (the commit each component's files
were last brought up to); those refs are the baseline the `update` 3-way merge
diffs against. The file is backward-compatible: an older CLI that rewrites it may
drop the `ref` records, which is harmless — they are simply re-recorded on your
next `update`.

## Available Components

### UI Components

- Accordion
- Alert
- Alert Dialog
- Aspect Ratio
- Autocomplete
- Avatar
- Badge
- Breadcrumb
- Button
- Button Group
- Calendar
- Card
- Carousel
- Chat
- Checkbox
- Chip List
- Code Block
- Collapsible
- Color Picker
- Command
- Confetti
- Context Menu
- Data Table
- Date Picker
- Dialog
- Dock
- Drawer
- Dropdown Menu
- Emoji Picker
- Empty State
- Field
- File Upload
- File Viewer
- Hover Card
- Icon
- Input
- Input Group
- Input Mask
- Input OTP
- Kbd (Keyboard Key)
- Label
- Menubar
- Native Select
- Navigation Menu
- Pagination
- Popover
- Progress
- Radio Group
- Rating
- Resizable
- Rich Text Editor
- Scroll Area
- Select
- Separator
- Sheet
- Sidebar
- Skeleton
- Slider
- Speed Dial
- Spinner
- Split Button
- Stepper
- Streaming Text
- Switch
- Table
- Tabs
- Textarea
- Timeline
- Toast
- Toggle
- Toggle Group
- Tooltip
- Tree
- Tree Select
- Virtual Scroll

### Chart Components

- Bar Chart
- Bar Chart Drilldown
- Bar Race Chart
- Column Range Chart
- Org Chart
- Pie Chart
- Pie Chart Drilldown
- Stacked Bar Chart

### Layout & Page Building

- Bento Grid
- Page Builder

### Animation Components

- Blur Fade
- Flip Text
- Gradient Text
- Magnetic
- Marquee
- Meteors
- Morphing Text
- Number Ticker
- Orbit
- Particles
- Ripple
- Scroll Progress
- Shine Border
- Sparkles
- Stagger Children
- Text Reveal
- Typing Animation
- Wobble Card
- Word Rotate

### Kanban

- Kanban

## Documentation

For full documentation and examples, verify usage in your local development environment
or check the original [shadcn/ui documentation](https://ui.shadcn.com/docs).
