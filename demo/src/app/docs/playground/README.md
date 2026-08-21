# The StackBlitz playground

**Open in StackBlitz** on a component's docs block opens a runnable, editable
project containing that component's real source.

It replaces a link that pointed StackBlitz at this repository and hung forever
on *"Cloning repo from GitHub"* — 2,635 files, 18 MB, 2,245 packages. Nothing
is cloned now: a project is **generated in the browser and POSTed**.

## How a click becomes a running app

| Step | Where |
|---|---|
| 1. Resolve the component's dependency closure | `closure.ts` |
| 2. Fetch each file from the branch the CLI installs from | `playground.service.ts` |
| 3. Generate a minimal Angular project around it | `project.ts` |
| 4. POST it to `stackblitz.com/run` | `payload.ts` |

Sources are fetched from
`raw.githubusercontent.com/<owner>/<repo>/<branch>/packages/components/...` —
**the same URLs `npx shadcn-angular add` installs from**. That is the point of
fetching rather than embedding: what the reader tries in the playground cannot
drift from what they would install.

## Things that are easy to get wrong

**The baseline lib files.** `shadcn-angular init` writes `lib/utils.ts` (the
`cn` helper) into a consumer's project, so the registry deliberately omits it
from every component's `libFiles`. A playground has no `init` step, so
`BASELINE_LIB_FILES` supplies it. Without this, any closure reaching a file
that imports `../../../lib/utils` fails to resolve — `spinner` is one, and it
declares no `libFiles` at all.

**`.postcssrc.json`.** Without it Tailwind's plugin never runs. The build still
succeeds, still emits a `styles.css`, and the app still renders — completely
unstyled. **A green build does not prove the playground is right.**

**The theme is fetched, not copied.** `playgroundStyles()` takes
`demo/src/styles.css` and rewrites only its `@source` lines. Re-declaring the
tokens here would drift from the docs site silently, and the components read
those tokens.

**Angular versions are pinned.** A floating `^` range would let an upstream
release break every generated playground at once, with nothing in this repo
having changed.

## Running the boot test (T-15)

The unit suite covers generation. It cannot tell you the project **boots** —
that needs a real browser, a real POST, and ~2–3 minutes in a WebContainer, so
it is a manual check. **Run it whenever `project.ts`, `payload.ts` or
`closure.ts` changes.**

1. `npm run dev` and open any component page.
2. Click **Open in StackBlitz**.
3. In the StackBlitz tab, wait for the terminal and assert **all three**:
   - `Application bundle generation complete` (~26 s for `button`)
   - no `Could not resolve` lines
   - `styles.css` is **tens of kB**, not near-zero — a near-zero stylesheet
     means Tailwind did not run
4. **Look at the preview.** It must render a *styled* component. This is the
   step that caught the missing postcss config; the terminal was green.

Reference numbers, all verified by hand:

| Component | Components | Files | Payload | Build | Bundle |
|---|---|---|---|---|---|
| `button` | 5 | 34 | 65 KB | 26.6 s | 168 kB |
| `rich-text-editor` | 2 | 22 | 427 KB | 34.6 s | 412 kB |
| `data-table` | 18 | 147 | 889 KB | 52.8 s | 724 kB |

`data-table` is the useful stress case — 13.7× the button payload, and still
only 11 % of the 8 MB limit. If you only have time for one, run that.

## Coverage

158 of 165 registry components generate a playground. The other 7 record a
reason — they need application data (`page-renderer`, `component-outlet`), or
attach to another component whose own required inputs decide the usage
(`tree-context-menu`, `table-context-menu`, `data-table-context-menu`). Those
show **no button at all**, rather than one that opens an empty page.

`sweep.spec.ts` asserts every component falls into one bucket or the other, so
a new component cannot silently end up with neither.
