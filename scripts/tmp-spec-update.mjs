import { readFileSync, writeFileSync } from 'node:fs';

/**
 * Fills the Task table rows of specs/component-features-spec.md.
 * Scores come from argv as `n=score` pairs; rows keep '—' when not supplied.
 * Temporary tooling — deleted once the table is written.
 */
const p = 'specs/component-features-spec.md';
const raw = readFileSync(p, 'utf8');
const eol = raw.includes('\r\n') ? '\r\n' : '\n';
let s = raw.split(/\r?\n/).join('\n');

const scores = Object.fromEntries(
    process.argv.slice(2).map(a => a.split('=')).map(([k, v]) => [k, v]),
);

const retros = {
    2: '`update(id, patch)` is the single mutation primitive and `promise()` is built on it, so the loading toast mutates in place with no flicker (spec §3.4 Option 2). Review round 1 flagged white-on-`amber-500` at ~2.2:1, which would have failed the T-19 axe pass — `info` moved to `blue-600` and `warning` to `amber-950`-on-`amber-500`, and six render-level tests were added for the spinner and the new variants\' politeness.',
    3: 'A boolean-returning guard keeps the whole transition synchronous, so the 44 existing stepper tests never reach the new code path. Round 1 scored 88 on a defect the reviewer proved by probe: only the async branch bumped `guardToken`, so a later sync move left a stale promise free to snap the stepper back and emit `stepChange` twice. Fixed, with a regression test on the exact emission sequence.',
    4: 'Round 1 scored 90 on a genuine trap: `writeTourCompleted` sat unconditionally in `finish()`, but that is also the degenerate exit when no target resolves, so a consumer whose anchors had not yet rendered would permanently burn the flag. Persistence is now gated on `showedAStep`. The reviewer also caught one of my own tests being vacuous; it was replaced with the reachable case.',
    5: 'The chunk/measure machinery was extracted into a reusable `VirtualAxis` instantiated once per axis, so horizontal and 2D reuse it rather than duplicate it (spec §3.2). All 41 existing tests pass untouched, including the two suites that reach into the private `getOffsetForIndex` / `handleResizes` surface.',
    6: 'The staleness token is bumped at SCHEDULE time rather than call time, so a superseded answer can never land, and the superseded call\'s `AbortSignal` is fired as well. Async rows are exposed as `results()` for the consumer to render, which leaves the content-projection item API — filtering, highlight, shortcuts — completely unchanged.',
    7: 'Nesting is layered on the existing group registry: parent/child cross-list drops already worked, so only disambiguation and addressability were missing. Hit-testing now picks the deepest containing peer instead of the first, and `SortableRegistryEntry.path` was made optional so the existing `sortable-registry.spec.ts` factory still satisfies the contract unedited.',
    8: 'Lanes render as a sibling template branch rather than a wrapper, so a board without `swimlaneBy` emits identical DOM. The string-vs-function split is load-bearing: only a property name can be inverted, so only then does a cross-lane drop reassign the field. `initiallyCollapsedSwimlanes` seeds exactly once so it cannot re-collapse a lane the user opened.',
    9: 'Conflict re-check done first: no sibling branch has touched `file-upload`. Stayed transport-agnostic per §1.4. The subtle correctness point is drop-event lifetime — `DataTransferItemList` dies with the event, so every entry is snapshotted before the first await, and `readEntries` is drained in a loop because it answers ~100 at a time.',
    10: 'T-18 verified exactly rather than in aggregate: every original spec file still reports its precise baseline count (452 preserved) with 176 new tests alongside it, and not one existing test was edited.',
};

const lines = s.split('\n').map(line => {
    const m = /^\| (\d+) \| (.*?) \| (.*?) \| ⬜ Not started \| — \| — \| — \|$/.exec(line);
    if (!m) return line;
    const n = m[1];
    if (!retros[n]) return line;
    return `| ${n} | ${m[2]} | ${m[3]} | ✅ Done | 2026-08-20 | ${scores[n] ?? '—'} | ${retros[n]} |`;
});

writeFileSync(p, lines.join(eol), 'utf8');
console.log('rows filled:', lines.filter(l => l.includes('✅ Done')).length);
