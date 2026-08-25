---
name: plan-to-specs
description: Turn an approved plan or ideas backlog into a set of self-contained, agent-executable spec files. Splits the plan into bundles (one spec per bundle), each with a dependency banner, a PM section defining business value and use-case-level definition of done, a QA section listing every test to write BEFORE implementation, an architecture section comparing implementation options, and an ordered task table with a completion log. Use whenever a plan is approved and needs to become specs, or when asked to "write the spec", "break the plan into specs", or "make this implementable".
allowed-tools: Read, Write, Edit, Bash, Grep, Glob
---

# Plan → Specs

Convert an approved plan into spec files that a **single agent can execute
end-to-end without asking questions**.

**Announce at start:** "I'm invoking the plan-to-specs skill to turn this plan
into agent-executable specs."

## Why it exists

A plan says *what* and *why*. An agent needs *exactly what done looks like*,
*what to test*, *in what order*, and *what to do when a prerequisite is
missing*. Every gap in a spec becomes either a stalled agent asking the human a
question, or — worse — an agent inventing an answer. This skill exists to close
those gaps before any agent is dispatched.

---

## Step 0 — Verify the plan against the source. Non-negotiable.

**Before writing a single spec, re-check every claim in the plan against the
actual codebase.** Plans are written from memory and impressions; specs are
contracts. A spec that tells an agent to build something that already exists
wastes a full implementation cycle and erodes trust in every other spec in the
set.

For each proposed item, confirm by reading the source:

- Does it already exist, in whole or in part? Search by **capability**, not by
  name — a "datetime picker" may exist as a `showTime` input on a date picker;
  a "query builder" may live inside a table as a sub-component.
- If it partly exists, the spec is an **extension or extraction**, not a build.
  Say so, and cite the file.
- Are the plan's stated dependencies real? Verify the version, the export, the
  API shape — read `node_modules/<pkg>/**/*.d.ts` rather than trusting recall.

Record what changed in the plan doc itself (mark corrections inline; never
delete the original claim — see "living history" below). Only then write specs.

> This step routinely deletes 30–50% of a plan's proposed work. That is the
> skill doing its job.

---

## Step 1 — Bundle the plan

A **bundle** is the unit of work handed to one agent. One bundle → one spec file.

**Bundling rule:** group by *shared surface area and dependency*, not by
category. Items belong in the same bundle when they touch the same files, share
types, or would conflict if two agents edited them in parallel.

| Signal | Action |
|---|---|
| Items share a component folder, type file, or lib module | Same bundle |
| Item B needs item A's exported types | Same bundle if small; otherwise A is a **prerequisite** of B |
| Items are independent and touch disjoint files | Separate bundles — they can run in parallel |
| A bundle exceeds ~10 tasks or ~2 days of agent work | Split it |
| A bundle has fewer than ~3 tasks | Consider merging into a neighbour |

Prefer **more, smaller bundles** that can run in parallel over one large
sequential spec. Parallelism is the whole point of the split.

Name files `specs/<bundle-name>-spec.md`, kebab-case, describing the outcome
(`stat-card-and-blocks-spec.md`), not the phase (`phase-2-spec.md`).

Write a short **index** at `specs/<plan-name>-index.md` listing every bundle,
its prerequisites, and whether it can start now — so the human can see the
parallel front at a glance.

---

## Step 2 — Write each spec

Every spec file uses **exactly** this structure, in this order.

### A. Dependency banner (mandatory, always present)

Even when there are no prerequisites — then it states that explicitly, so the
agent knows the absence is deliberate and not an omission.

```markdown
> # 🛑 STOP — READ BEFORE ANY WORK
>
> **This spec depends on:** `<spec-a>` · `<spec-b>`
>
> **Before writing any code, verify each prerequisite is complete** by checking
> its Completion Log — every task row must show a review score ≥ 91.
>
> **If any prerequisite is incomplete: STOP IMMEDIATELY. Do not start. Do not
> work around it. Do not implement the prerequisite yourself.** Alert the user
> that this spec is blocked, name the missing prerequisite, and end your turn.
```

For a spec with no prerequisites:

```markdown
> # ✅ NO PREREQUISITES
>
> This spec is self-contained and can start immediately. It depends on no other
> spec in this set.
```

### B. Product Manager section

Answers *why this exists* and *what done means*, in the customer's language.
Remember the customer is **a developer consuming the library**.

Required subsections:

1. **Business logic** — what the feature does, in prose, no implementation.
2. **Why the customer wants this** — the concrete pain today. Name the
   workaround they are currently forced into. If you cannot name the pain, the
   item probably should not be built.
3. **Use cases = definition of done** — a numbered list, `UC-1`, `UC-2`, … Each
   use case must be:
   - written from the consuming developer's point of view,
   - **observable** (someone else can check it without reading the source),
   - **atomic** (one behaviour per use case).

   The spec is done when, and only when, every `UC-n` demonstrably passes.
4. **Explicitly out of scope** — what this spec deliberately does *not* do, so
   the agent does not gold-plate.

### C. QA section — tests are written FIRST

> **The agent must write every test in this section before writing any
> implementation code.** Tests fail first, then implementation makes them pass.
> This is the mechanism that keeps implementation honest against the PM
> section.

Required content:

1. A **traceability table** mapping every test to the use case it proves. Every
   `UC-n` must appear at least once. A `UC-n` with no test is a spec bug.

   | Test ID | Test name | Proves | Type |
   |---|---|---|---|
   | T-1 | `renders the label from input` | UC-1 | unit |
   | T-2 | `announces change to screen readers` | UC-4 | a11y |

2. **Test types to cover**, per the repo's gates: unit (`.spec.ts`),
   Storybook story + axe a11y, e2e harness spec, and — for anything with a
   perf claim — a measured assertion, not a vibe.
3. **Edge cases and failure modes** the tests must cover: empty state, single
   item, very large input, RTL, touch-only, disabled, error state.
4. **Coverage expectation** for the files this spec touches.

### D. Architecture section

Required subsections:

1. **Usability** — the public API shape. Show the *simple mode* and *custom
   mode* usage (per `.claude/CLAUDE.md`), as literal code blocks a developer
   would copy. Design the API before the internals.
2. **Efficiency** — the performance characteristics that matter and the budget
   for each. If there is no meaningful perf concern, say so explicitly.
3. **DX for the consuming developer** — what they must learn, what they can
   ignore, what the error messages say when they hold it wrong. Name the
   exported types they will touch.
4. **Implementation options** — **at least two**, each with honest tradeoffs,
   then a clearly marked recommendation and the reasoning.

   ```markdown
   **Option 1 — <name>**
   Pros: … Cons: …

   **Option 2 — <name>**
   Pros: … Cons: …

   **✅ Chosen: Option N**, because …
   ```

   Never present a single option. If only one is viable, state what was ruled
   out and why — that reasoning is what stops a future agent re-litigating it.
5. **Risks** — table of risk → mitigation.

### E. Task table (ordered = implementation order)

The table's row order **is** the implementation order. An agent works top to
bottom and does not reorder.

```markdown
| # | Task | Proves | Status | Completed | Score | Retrospective |
|---|------|--------|--------|-----------|-------|---------------|
| 1 | Write failing tests T-1…T-6 | UC-1, UC-2 | ⬜ Not started | — | — | — |
| 2 | Implement <thing> | UC-1 | ⬜ Not started | — | — | — |
```

Rules:

- **Task 1 is always "write the failing tests"** for the first slice. Tests
  precede implementation throughout.
- Each task names which `UC-n` / `T-n` it advances.
- Tasks are sized so one is a single coherent commit.
- Status is one of `⬜ Not started` · `🔄 In progress` · `✅ Done`.

---

## Step 3 — The definition of "done" for a task

**A task may be marked `✅ Done` only when ALL of the following hold.** Encode
this verbatim in every spec so the executing agent cannot miss it:

```markdown
## Definition of Done (per task)

A task row may be marked ✅ Done only when **all** of these pass:

1. **Fully tested** — every test named for this task is written and passing.
2. **Fully covered** — no uncovered lines introduced in the files touched.
3. **Zero lint errors** — `npm run lint` clean.
4. **Zero SonarQube issues** — the **full server scan** (`npm run coverage`
   then `npm run sonar` against `http://localhost:9000`) run and clean on the
   changed code. eslint is NOT a substitute. If the token, server, or Docker
   is unavailable, the task is **blocked, not done** — stop and tell the user.
5. **Review gate ≥ 91** — invoke the `review-gate` skill and reach a score of
   at least 91 from a fresh independent reviewer.

Then, and only then, update this spec's task row with:

- **Completed** — the date/time (`date +"%Y-%m-%d %H:%M"`).
- **Score** — the review-gate score.
- **Retrospective** — 1–2 sentences: what went well, and what to improve later.

Marking a row Done without all five is a process violation, not a shortcut.
```

The bar is **≥ 91**, matching the `review-gate` skill — deliberately above 90
so a picky reviewer has headroom without tripping the gate at the exact
threshold.

---

## Step 4 — Living history

Specs are **append-only history**, per project convention:

- **Never delete** a completed task row, a fixed bug, or a superseded decision.
  Mark it superseded and add the new entry below, linking back.
- When a task is redone, add a **new** row rather than editing the old one.
- Corrections to the plan are marked inline (⚠️), never silently rewritten —
  the reader must be able to see what was believed before and why it changed.

---

## Checklist before handing a spec to an agent

- [ ] Every plan claim was verified against the source (Step 0)
- [ ] Dependency banner present — prerequisites named, or explicitly none
- [ ] Every `UC-n` is observable and atomic
- [ ] Every `UC-n` appears in the QA traceability table
- [ ] Task 1 writes failing tests
- [ ] At least two implementation options compared, one chosen with reasoning
- [ ] Task table order is the implementation order
- [ ] Definition of Done block is present verbatim
- [ ] Out-of-scope section prevents gold-plating
- [ ] An agent reading only this file could finish the work without asking a
      single question — **this is the acceptance test for the spec itself**
