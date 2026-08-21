# StackBlitz Playground — spec

> # 🔴 STOP — READ BEFORE STARTING
>
> **Prerequisite: none.** This bundle is self-contained and can start now.
>
> It **replaces** a shipped feature that does not work. Do not treat the
> existing `stackblitz` field as a working baseline to preserve — it is the
> defect. If you find yourself keeping the current URL shape, re-read §1.2.
>
> **Do not begin by writing the generator.** The riskiest assumption has
> already been tested (§3.1) — read that first, then follow the task order.

---

## 1. Product manager section

### 1.1 What this is

Every component's docs block carries an **Open in StackBlitz** button. It is
supposed to drop the reader into a running, editable example of that component.

### 1.2 Why it exists, and why the current one is worthless

A copy-paste component library lives or dies on "can I see it work before I
commit". The install command answers *how do I get it*; the playground answers
*what am I getting*. It is the single highest-intent click on the page: the
reader has already decided they are interested.

**Today that click leads to a page that hangs forever.** The link points at
the monorepo root:

```
https://stackblitz.com/github/gilav21/shadcn-angular/tree/master?file=<demo file>
```

StackBlitz tries to clone the whole repository — 2,635 tracked files, an 18 MB
pack, npm workspaces, 2,245 packages — and sits on **"Cloning repo from
GitHub"**. Reproduced independently in a clean browser: still cloning after 37
seconds, and the user reports the same. Even if the clone completed, the demo
app resolves the library through workspace-relative deep imports
(`../../../../../packages/components/ui`) and would not build standalone.

This is worse than having no button. A dead link on the highest-intent control
teaches the reader that the docs are unmaintained.

**It shipped unverified.** `T-8` in `dx-distribution-spec.md` asserts only that
the URL is *well-formed* — origin, path, `?file=` — never that it loads
anything. A gate that checks the shape of a link instead of the behaviour of a
link. See §2.4.

### 1.3 Definition of done — the exact use cases

| # | Use case | Done when |
|---|---|---|
| UC-1 | A reader clicks **Open in StackBlitz** on any component's docs block | A StackBlitz project opens and **boots to a running preview** of that component — no clone step, no hang |
| UC-2 | The reader edits the component source in StackBlitz | The preview hot-reloads, because the real component source is in the project, not a screenshot of it |
| UC-3 | The component depends on others (`button` → `ripple`) | Every transitive dependency and lib file is present; the project compiles |
| UC-4 | The component needs npm packages (`cva`, `clsx`) | They are in the generated `package.json`; install succeeds |
| UC-5 | A component has no usable snippet (`snippetSkipReason` set) | The button is **absent**, not present-and-broken |
| UC-6 | The reader is on a slow connection | The button reports progress and, on failure, says what failed — it never silently does nothing |
| UC-7 | A new component is added to the registry | Its playground works with **no per-component authoring** — the project is generated from the registry |
| UC-8 | The reader opens the playground in RTL or dark mode | Not required to match the docs site; the playground is a neutral, light, LTR shell |

### 1.4 Explicitly out of scope

- Preserving the current GitHub-import URL for anything.
- A playground for **blocks** (they compose many components; revisit after).
- Persisting or sharing the reader's edits — StackBlitz owns that.
- Matching the demo site's theme switcher inside the playground.

---

## 2. QA section — write these BEFORE implementing

> Tests first. Each must be observed **red** before the code exists, and the
> red must be for the stated reason, not a missing import.

### 2.1 Generator unit tests (browser leg)

> ⚠️ **Corrected 2026-08-21** — originally written as "node leg". The
> generator runs **client-side in the demo app**: it fetches component source
> at click time, so it lives under `demo/src/app/docs/playground/` and is
> tested by the browser suite, not `vitest.config.cli.ts`.

| ID | Test | Use case |
|---|---|---|
| T-1 | `builds a project whose files[] covers the component and every transitive dependency` | UC-3 |
| T-2 | `includes libFiles for the whole closure, de-duplicated` | UC-3 |
| T-3 | `package.json carries clsx, tailwind-merge, class-variance-authority and the component's own npmDependencies` | UC-4 |
| T-4 | `the generated app imports the component through the same path the CLI writes (@/components/ui/<name>)` | UC-2 |
| T-5 | `a component with snippetSkipReason produces no project and no button` | UC-5 |
| T-6 | `the closure is acyclic and terminates on a component that depends on itself transitively` | UC-3 |
| T-7 | `every registry component either yields a project or a recorded skip reason` | UC-7 |

### 2.2 Payload tests

| ID | Test | Use case |
|---|---|---|
| T-8 | `the POST body uses project[files][<path>] keys and template=node` | UC-1 |
| T-9 | `no generated file path escapes the project root (no ../)` | UC-1 |
| T-10 | `total payload stays under the documented POST limit; oversized closures are reported, not truncated` | UC-6 |

### 2.3 UI tests

| ID | Test | Use case |
|---|---|---|
| T-11 | `the button shows a pending state while sources are fetched` | UC-6 |
| T-12 | `a failed source fetch surfaces an error message naming the file` | UC-6 |
| T-13 | `the button is absent for a component with no snippet` | UC-5 |
| T-14 | `the button is a real <button>, keyboard operable, with an accessible name` | UC-1 |

### 2.4 🔴 The one test that would have caught the current bug

| ID | Test | Use case |
|---|---|---|
| **T-15** | **`a generated project actually boots`** — submit one component's payload to StackBlitz in a real browser and assert the WebContainer reaches a running dev server | UC-1 |

**This is the point of the whole spec.** T-8 today asserts a URL's *shape* and
passes while the feature is dead. T-15 must assert **behaviour**: the terminal
reaches `Application bundle generation complete` and a preview origin exists.

It is slow (~2–3 minutes) and depends on a third party, so it does **not**
belong in the unit suite. Put it in the e2e suite, tagged so it can be run on
demand, and **run it whenever the generator changes**. A skipped T-15 must fail
loudly rather than pass quietly — assert the skip is deliberate.

Reference numbers from the §3.1 probe: install + build completed in **23.4 s of
build time**, ~2 min wall clock including WebContainer boot and npm install.

---

## 3. Architecture

### 3.1 ✅ The core mechanism is already proven — 2026-08-21

**Do not re-litigate this.** A hand-built minimal project was POSTed to
`https://stackblitz.com/run` in a real browser:

- The project opened **immediately in the editor** — no clone step at all.
- WebContainer booted and ran `npm install && npm start`.
- Angular 21 compiled: `Application bundle generation complete. [23.397 seconds]`.
- A dev server came up on `localhost:4200` inside the container.

The probe project was: `package.json`, `angular.json`, `tsconfig.json`,
`src/index.html`, `src/main.ts` (a standalone component with
`provideZonelessChangeDetection`), submitted as
`project[files][<path>]` form fields with `project[template]=node`.

**Conclusion: POST-a-generated-project works; clone-the-repo does not.** The
remaining work is generating the right files, not proving the transport.

### 3.2 Usability — what the reader experiences

The click must feel instant even though it is not. Fetching a closure of source
files takes a moment, so the button:

1. switches to a pending state on click (UC-6),
2. opens StackBlitz in a **new tab** on success,
3. on failure, restores itself and shows what broke — never a dead click.

The playground shell is deliberately plain: white background, LTR, one heading,
the component. The reader came to see the component, not a reproduction of the
docs site.

### 3.3 Where the inputs come from — all of it already exists

`demo/public/component-docs.json` already carries, per component:

**`registry.json` is also needed** and is *not* in the docs payload: the
closure walk needs `files[]` and `libFiles[]`, which only the registry has.
Fetch it from the same raw URL the CLI uses
(`…/{branch}/packages/components/registry.json`) and cache it per session.

| Field | Use |
|---|---|
| `snippet` | the usage code — becomes the playground's `App` template |
| `snippetSkipReason` | when set, no button (UC-5) |
| `importStatement` | the import line the App file needs |
| `dependencies` | transitive closure roots (UC-3) |
| `npmDependencies` | extra packages for `package.json` (UC-4) |
| `selector` | sanity-check the snippet renders the right element |

and `packages/components/registry.json` carries `files[]` and `libFiles[]` per
component. **No new generated artifact is required** — which is the point:
UC-7 falls out for free.

### 3.4 Implementation options — where the component source comes from

The generated project needs the actual `.ts`/`.html`/`.css` of the component
and its closure. Three ways to get them:

**Option A — Fetch from raw.githubusercontent at click time.**
Reuse the CLI's URL shape:
`https://raw.githubusercontent.com/{owner}/{repo}/{branch}/packages/components/{ui|lib}/<file>`.
- ✅ Zero payload growth; the docs JSON stays as-is.
- ✅ Always matches the branch, so a new component works the moment it lands.
- ✅ Identical source of truth to what `npx shadcn-angular add` installs — the
  playground cannot drift from the install.
- ❌ N requests per click (a large closure is ~30 files); needs a pending state.
- ❌ Depends on GitHub being reachable from the reader's browser.

**Option B — Embed every component's source in `component-docs.json`.**
- ✅ One request, instant.
- ❌ The payload is already 928 KB; embedding source would push it into
  multiple MB **for every visitor**, to serve a button most never click.
- ❌ Staleness: another generated artifact to keep in step.

**Option C — Pre-generate one static project JSON per component at build time.**
- ✅ One request, instant, no runtime assembly.
- ❌ ~165 new generated files to keep in step, and the closure logic still has
  to exist — it just moves to build time.
- ❌ Every component source edit restages 165 artifacts.

**Choose Option A.** The deciding argument is not performance, it is
**correctness**: the playground fetches from the same URLs the CLI installs
from, so "what I tried" and "what I installed" cannot diverge. B taxes every
visitor for a minority action. C adds a large generated surface for a saving
the reader will not notice behind a 2-minute WebContainer boot.

Mitigate A's cost with a per-session cache: a closure is fetched once, and the
lib files (shared by everything) are fetched once for the whole session.

### 3.5 Implementation options — the project shell

**Option 1 — `@angular/build` + `ng serve`** (what the probe used). Real Angular
CLI, matches how a consumer's app actually builds. Boots in ~2 min. **Chosen.**

**Option 2 — Vite + `@analogjs/vite-plugin-angular`.** Faster boot, but it is
not how a consumer builds, so a build-level problem in the playground would not
reproduce for them and vice versa. Rejected: the playground's job is to be
representative.

### 3.6 Tailwind

Components are Tailwind-class-driven and read theme tokens (`--primary`,
`--radius`, …). The generated project therefore needs a real Tailwind pipeline:
`tailwindcss`, `postcss`, `@tailwindcss/postcss`, plus a `styles.css` carrying
the `@theme` block. Take that block from `demo/src/styles.css` so the
playground renders with the library's default theme.

Do **not** reach for the Tailwind Play CDN: it is v3-oriented and would not
apply the v4 `@theme` tokens the components depend on.

### 3.7 Risks

#### Measured closure sizes — 2026-08-21

Resolved for all 165 components against the committed registry:

| | |
|---|---|
| Median closure | **34 KB** |
| Smallest | 1 KB |
| Over 1 MB | **2** components |
| Over 2 MB | **1** component |
| Largest | `rich-text-editor/full` — **2.26 MB across 271 files**, 35 components |

So the payload concern is **not** general: the typical playground is tiny and
will POST instantly. Size handling only has to be right for a handful of
addon-heavy entries, and `rich-text-editor/full` is the one to test against.

| Risk | Handling |
|---|---|
| POST body size limits on large closures | T-10 measures and reports; never silently truncate. Only ~2 closures are near any plausible limit (see above) |
| GitHub rate-limiting a reader's browser | Cache per session; surface the failure (UC-6) |
| StackBlitz changes its POST contract | T-15 is the canary — it fails behaviourally, not on shape |
| A component's snippet does not compile standalone | T-7 forces every component to yield a project or a recorded reason |

---

## 4. Definition of done (per task)

A task is done only when: tests written first and observed red → implemented →
full unit suite green → `npm run lint` clean → **SonarQube server scan clean on
the changed files** → review-gate ≥ 90. Record completion date, review score
and a retrospective line in §6.

---

## 5. Tasks — table order is implementation order

| # | Task | UC | Status | Date | Review | Retro |
|---|---|---|---|---|---|---|
| 1 | Delete the dead feature: drop the `stackblitz` field from the generator, the button, and **T-8** (it is the misleading gate). Land this first so no one ships a hanging link for another day | UC-1 | ✅ Done | 2026-08-21 | n/a (removal) | Removed `stackblitzUrl`, the `stackblitz` field, the button and all four shape-asserting tests. Kept the half of T-8 that was about reality — that every component resolves to a demo file that **exists** — since that check was never the broken part. Payload dropped 928 KB → 902 KB. Verified in the browser: zero StackBlitz links, install block intact. The `openInStackblitz` locale key is deliberately left in all 11 locales for Task 6 to reuse rather than churn them twice. |
| 2 | Write T-1, T-2, T-6: the closure resolver over registry `dependencies`/`files[]`/`libFiles[]` | UC-3 | ✅ Done | 2026-08-21 | n/a (tests) | Observed red for the right reason (no `closure.ts`), not a missing import. Added a guard beyond the spec: the fixture is hand-written and can drift, so the suite also resolves against the **real** `registry.json`. |
| 3 | Implement the closure resolver | UC-3 | ✅ Done | 2026-08-21 | n/a | Breadth-first with a visited set, so a cycle terminates. Missing dependencies are **reported, not dropped** — a dangling dep means the project cannot compile and the caller must say so rather than ship a playground that looks like a StackBlitz fault. The real-registry test confirms all 165 components resolve with nothing missing. |
| 4 | Write T-3, T-4, T-5, T-7; implement the project generator | UC-2, UC-4, UC-5, UC-7 | ✅ Done | 2026-08-21 | n/a | Pure — fetching is a separate concern, so the generator is testable without a network. Two decisions worth keeping: Angular versions are **pinned**, since a floating `^` would let an upstream release break every generated playground at once with nothing here changing; and the theme is **fetched and rewritten** (only its `@source` lines) rather than re-declared, so it cannot drift from `demo/src/styles.css`. T-7 moves to Task 8, where the real registry sweep happens. |
| 5 | Write T-8, T-9, T-10; implement the POST payload builder | UC-1 | ✅ Done | 2026-08-21 | n/a | `buildPayload` returns the fields rather than submitting, so the contract is testable without a navigation. Limit set to 8 MB against measured reality (median 34 KB, largest 2.26 MB) — large enough never to fire on a real closure, and it **throws with the measured size** rather than truncating, because a silently smaller project boots and then fails to compile, which reads as a StackBlitz fault. |
| 6 | Write T-11…T-14; implement the button | UC-1, UC-6 | ✅ Done | 2026-08-21 | n/a | A plain `<button>` rather than `ui-button`: it needs its own `aria-busy` and disabled state, and this file should not depend on the library it documents. Errors are surfaced **by name** — "something went wrong" would leave a reader unable to tell a flaky network from a broken component. |
| 7 | **Write and run T-15 — prove a generated project boots** | UC-1 | ✅ Done | 2026-08-21 | n/a | **Ran against `button` end to end. It boots and renders a correctly styled component** — build complete in **26.6 s**, `styles.css` 22.7 kB, zero unresolved imports. It took three rounds to get there, and both failures were invisible to every other gate — see §6. |
| 8 | Run the generator across **every** registry component | UC-7 | ✅ Done | 2026-08-21 | n/a | **158 of 165 build; 7 record a reason; 0 files missing on disk.** All seven skips are genuine rather than fixable: five need application data or attach to another component whose required inputs decide the usage, and `rich-text-editor/full` exports no single primary class. `sweep.spec.ts` now asserts every component falls in one bucket or the other, with a positive control so a query matching nothing cannot pass. |
| 9 | Session cache for lib files and resolved closures | UC-6 | ✅ Done | 2026-08-21 | n/a | Folded into the service when it was written. **Promises** are cached rather than results, so two clicks in flight share one request instead of racing; a rejected fetch is evicted so a momentary offline does not poison the cache for the session. |
| 10 | Docs: how the playground is generated, and the T-15 run instruction | — | ✅ Done | 2026-08-21 | n/a | `demo/src/app/docs/playground/README.md`. Leads with the two traps that cost a round each (baseline lib files, `.postcssrc.json`) and makes the T-15 checklist assert the **stylesheet size and the rendered preview**, not just a green terminal. |

---

## 6. Completion log

### T-15 found two defects that every other gate passed — 2026-08-21

The boot test needed three rounds against `button`. Both failures matter more
than the fix, because of *how* they hid.

**Round 1 — `Could not resolve "../../../lib/utils"`.** `button`'s closure
reaches `spinner`, which declares **no `libFiles` at all** yet imports `cn`.
Not a playground bug: `shadcn-angular init` writes `lib/utils.ts` from a
bundled template, so the registry legitimately omits it from per-component
`libFiles` — every consumer already has it. A playground has no `init` step,
so it must supply that baseline itself. Fixed with `BASELINE_LIB_FILES`.

**Round 2 — it built, ran, and was completely unstyled.** The generated project
had no `.postcssrc.json`, so Tailwind's plugin never ran. The build still
**succeeded**, still emitted a `styles.css`, and the app still rendered — just
with no utilities. *A green build was not evidence the playground was right.*
Only looking at the rendered preview caught it. `init` writes the same file
into a consumer's project, for exactly this reason.

**Round 3 — correct.** Build complete in 26.6 s, `styles.css` 22.7 kB, zero
unresolved imports, and the preview shows a properly styled button with the
library's theme.

### Verified on heavy compound components too — 2026-08-21

`button` is a small closure, so it is weak evidence on its own. Re-run against
the two heaviest things a reader is likely to click:

| Component | Components | Files | Payload | Build | Bundle | Result |
|---|---|---|---|---|---|---|
| `button` | 5 | 34 | 65 KB | 26.6 s | 168 kB | ✅ styled button |
| `rich-text-editor` | 2 | 22 | 427 KB | 34.6 s | 412 kB | ✅ full toolbar + editable area |
| `data-table` | **18** | **147** | **889 KB** | **52.8 s** | 724 kB | ✅ filter, table chrome, pagination |

Zero unresolved imports and zero TS errors in all three, and each preview was
**looked at**, not inferred from a green terminal. `data-table` is 13.7× the
button payload and still only **11 % of the 8 MB limit**, so the limit is not
close to binding on anything real.

Build time scales with closure size roughly as expected (26 s → 53 s for 4×
the files); the WebContainer boot and npm install dominate either way.

The lesson is the same one this repo keeps relearning, now in a new place:
*a gate must assert the outcome, not a proxy for it.* "The build passed" was
the proxy; "the component renders styled" was the outcome.

---

## 7. Status — complete

All ten tasks done. 158 of 165 components have a working playground; the other
7 correctly show no button.

**Gates:** lint clean · 449 test files / 9245 tests / 0 failures · boot test
verified by hand against `button` (26.6 s build, 22.7 kB stylesheet, styled
preview).

**No npm publish needed:** everything here is demo-app code and generated docs
data, all served live from master.

## 8. Carried findings

### Components with required inputs get a thin demo

`data-table`'s generated snippet is `[columns]="[]" [data]="[]"`, so its
playground boots into an **empty table** — correct, styled, and functioning,
but it shows "No results found" rather than the component doing anything
interesting. The same applies to any component whose required inputs are data.

This is a *snippet* limitation, not a playground one: `gen-component-docs`
emits minimal valid usage, which is the right default for a docs code block
but a weak demo. Worth a follow-up that lets a component supply sample data
for its playground — out of scope here, and the playground is strictly better
than the dead link it replaced either way.



**`snippet` is the whole feature's dependency.** If a component's snippet does
not compile standalone, its playground cannot work no matter how good the
generator is. Task 8 is therefore not a formality — it is where the real
per-component work will surface, and it should be sized generously.
