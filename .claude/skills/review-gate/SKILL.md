---
name: review-gate
description: Run a score-based code review loop on work you have just completed. Dispatches a fresh reviewer agent (no prior context), collects a 0–100 score with rationale, iterates (address feedback → redispatch) until the score is ≥91, then records the highest score and the reviewer's rationale into the plan and spec docs. Use this whenever a task instruction says "review gate", "score loop", "iterate until ≥90/91", or when a plan document has a Completion Log that expects reviewer entries.
allowed-tools: Agent, Read, Edit, Bash, Grep, Glob
---

# Review Gate

A reusable score-based review loop.

**Announce at start:** "I'm invoking the review-gate skill to verify this task meets the quality bar."

## Why it exists

In long multi-task plans, it is too easy for the implementer to declare work "done" prematurely — especially after fighting a tricky bug. The review gate hard-stops that by asking an independent reviewer (no shared context) to grade the work. The implementer cannot proceed until an outside party, who does not know how much effort went in or what was tried before, agrees the work meets the bar.

## Core contract

1. **Fresh context.** Every reviewer dispatch is a new `Agent` call with no conversation history. The reviewer must form its opinion solely from (a) the task description, (b) the spec/plan section being addressed, and (c) the diff or changed files.
2. **Numeric score.** Reviewer returns a single integer 0–100 plus 3–5 sentences of rationale. No hedging, no ranges.
3. **Threshold ≥ 91.** Below 91, the implementer must address the reviewer's concerns and redispatch. The bar is ≥ 91 (not ≥ 90) so the reviewer has headroom to be picky without tripping the gate at the exact threshold.
4. **Highest score wins on record.** The final recorded entry is the highest score achieved across all iterations, with that iteration's rationale. (Rationale is usually shortest and most affirming on the passing round; that's fine.)
5. **No self-review.** The implementer never scores their own work. If no independent reviewer is available, the gate fails.
6. **🔴 SonarQube server scan is a hard prerequisite to recording ANY passing score.** Before recording a ≥91 result, the full SonarQube server scan (`npm run coverage` then `npm run sonar` against `http://localhost:9000`) MUST have run and be clean on the changed code — every new issue fixed. A high reviewer score does NOT waive this; eslint is not a substitute. If the token/server/Docker is unavailable, the gate is **blocked, not passed** — say so and ask the human. (See `.claude/CLAUDE.md` Section 4 mandatory DONE gate.)

## Inputs the caller must provide

When invoking the skill, the caller provides:

| Field | Description |
|---|---|
| `task_id` | Stable identifier from the plan (e.g. "Task 3b"). |
| `task_description` | One-paragraph description of what the task was supposed to achieve. |
| `spec_refs` | File paths + section numbers of the spec the task implements (e.g. `docs/superpowers/specs/…md §8.1`). |
| `diff_source` | Either a git commit range (`HEAD~3..HEAD`), a branch name, a worktree path, or an explicit list of changed files. The reviewer must be able to see the exact code change, not just prose. |
| `plan_doc` | Path to the plan doc with a Completion Log table. Required. |
| `spec_log` | Path to the spec's Completion Log section (e.g. `§20 Completion Review`). Required if the project has one. |
| `extra_checks` | Optional: named criteria the reviewer must score against (e.g. "(a) correctness, (b) test depth, (c) no new warnings"). |

## Loop

```
attempt := 1
highest := { score: 0, rationale: "" }

loop:
    dispatch reviewer (see "Reviewer prompt template" below)
    parse score + rationale from reply
    if score > highest.score:
        highest := { score, rationale }
    if score >= 91:
        break
    if attempt >= 5:
        report failure — ask the user whether to lower the bar, refactor, or abandon
        exit
    apply reviewer feedback (edit code)
    attempt += 1

record highest.score + highest.rationale into plan_doc + spec_log
commit changes (implementation + doc updates together)
```

Implementer discretion: if the reviewer scores 91 on iteration 1 but raised substantive concerns, address them anyway before committing — don't ship known bugs just because the score cleared.

## Reviewer prompt template

Dispatch with `subagent_type: "general-purpose"` (or `superpowers:code-reviewer` when the project has it) and the following prompt structure. Do NOT include any hint of prior iterations or scores — keep context fresh.

```
You are a code reviewer. Score this task on a 0–100 scale.

**Task (`<task_id>`):** <task_description>

**Spec references:** <spec_refs — agent should Read these>

**Changes to review:**
<diff_source — either a git diff command to run, or explicit file paths>

**Scoring criteria:**
- (a) Correctness vs the spec sections named above
- (b) Test coverage proportional to risk
- (c) No new compiler warnings or clippy violations
- (d) No placeholder code, TODOs smuggled past review
- (e) Documentation of any intentional deviation from spec
<plus any extra_checks from caller>

**Rubric:**
- 96–100: Ships as-is; exceptionally clean
- 91–95: Ships as-is; minor nits documented
- 81–90: Needs targeted fixes before merge
- 61–80: Significant concerns; partial rework required
- 0–60: Does not meet the task's stated goal

**Output format (strict):**
SCORE: <integer 0–100>
RATIONALE: <3–5 complete sentences. Cite file:line for any concrete concern. No hedging, no bullet points.>

Begin. Read the spec and the diff first; do not skim.
```

## Recording the result

When the loop exits successfully, update **two** documents:

1. **Plan's Completion Log table.** Find the row for `task_id`. Set:
   - `Completed` column → today's date (use `date +%Y-%m-%d`)
   - `Score` column → the highest score
   - `Rationale` column → a ≤3-sentence compression of the reviewer's rationale. If rationale is already ≤3 sentences, copy verbatim.
2. **Spec's Completion Log table.** Append a row with the same data. If the spec's table is currently empty (e.g. starts with `_(empty — no tasks complete yet)_`), delete that placeholder row first.

Then commit both docs alongside the implementation:

```bash
git add <implementation files> <plan_doc> <spec_log>
git commit -m "<feat|fix|refactor>(<scope>): <task subject> (review ≥91)

Review gate: <highest score>/100
<one-line reviewer rationale>"
```

## When the loop fails

If 5 iterations don't reach 91, stop and ask the user whether to:
- (a) Accept a lower score and record it with a ⚠️ flag,
- (b) Refactor more aggressively,
- (c) Split the task into smaller pieces and rerun the gate per piece,
- (d) Abandon the task.

Do not silently lower the bar. Do not mark the task complete with a <91 score without explicit user consent.

## When NOT to use this skill

- For trivial edits (typo fixes, single-line version bumps). Overkill.
- For exploratory work the user expects you to iterate on yourself.
- When the user explicitly says "just implement it and move on".

If in doubt, use the gate. The cost of one reviewer round-trip is small; the cost of declaring a broken task "done" is large.

## Anti-patterns to avoid

- **"The reviewer didn't understand the constraint."** If the reviewer misunderstood, that is information: your diff or docs don't communicate the constraint clearly enough. Add a comment or a commit-message paragraph rather than dismissing the concern.
- **Prompt-gaming.** Do not tell the reviewer the previous iteration's score, or pre-empt objections, or emphasize difficulty. Fresh context means fresh context.
- **Committing before the gate passes.** The implementation commit and the doc-update commit go in together, only after the gate passes.
- **Partial recording.** Always record both plan + spec logs. A passing task that isn't in the log is indistinguishable from unreviewed work next time someone reads the plan.
