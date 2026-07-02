/**
 * Locate where a consumer's own code actually uses the inputs/outputs a breaking
 * change removed or renamed. `update`/`doctor` print a component's breaking notes
 * generically; this narrows that to "your <file>:<line> binds [rowActions]" so an
 * affected consumer sees the exact call sites instead of hunting after an NG8002
 * build failure — and an unaffected consumer gets a reassurance instead of noise.
 */
import path from 'node:path';
import fs from 'fs-extra';
import chalk from 'chalk';
import { type BreakingChange, type ComponentName } from '../registry/index.js';
import { collectBreakingChanges } from './plan.js';
import { collectComponentFiles, toTarget, readTemplate } from './apply-core.js';

/** A single template-binding use of a removed/renamed token in the consumer's code. */
export interface TokenUsage {
    readonly path: string;
    readonly line: number;
    readonly token: string;
}

const BRACKETED = /\[([a-zA-Z_$][\w$]*)\]/g;
const IDENTIFIER = /^[a-zA-Z_$][\w$-]*$/;

/**
 * The public-API tokens a breaking change concerns, for scanning consumer code.
 *
 * Matching rule: every bracketed input name `[name]` in `change.from` is a token
 * (so `[rowActions] / [showRowActionsColumn] on <ui-data-table>` yields both). A
 * `kind: 'selector'` change carries a bare attribute-directive selector (e.g.
 * `virtualItem`) as its raw `from`, so that raw token is used when it has no
 * brackets. Kinds without bracketed tokens (a renamed output, a type change) yield
 * nothing — there is no reliable single token to grep for.
 */
export function extractBreakingTokens(change: BreakingChange): string[] {
    const tokens = new Set<string>();
    for (const m of change.from.matchAll(BRACKETED)) tokens.add(m[1]);
    if (tokens.size === 0 && change.kind === 'selector') {
        const raw = change.from.trim();
        if (IDENTIFIER.test(raw)) tokens.add(raw);
    }
    return [...tokens];
}

/**
 * Whether a line uses `token` as an Angular template binding. Matches the three
 * binding forms via plain substring test: `[token]` (property), `(token)` (event),
 * and `[(token)]` (banana box — which contains `(token)`). The enclosing brackets
 * bound the match, so `[row]` never matches inside `[rowActions]`. Tokens are
 * always safe identifiers (see {@link extractBreakingTokens}), so no escaping is
 * needed.
 */
function lineBindsToken(line: string, token: string): boolean {
    return line.includes(`[${token}]`) || line.includes(`(${token})`);
}

/**
 * Line-accurate scan for template-binding uses of any token across the given
 * files. Line numbers are 1-based; at most one usage is reported per
 * (file, line, token).
 */
function scanLine(file: string, line: string, lineNo: number, tokens: readonly string[], out: TokenUsage[]): void {
    for (const token of tokens) {
        if (lineBindsToken(line, token)) out.push({ path: file, line: lineNo, token });
    }
}

export function scanFilesForTokens(
    files: readonly { path: string; content: string }[], tokens: readonly string[],
): TokenUsage[] {
    const usages: TokenUsage[] = [];
    for (const file of files) {
        const lines = file.content.split('\n');
        for (let i = 0; i < lines.length; i++) {
            scanLine(file.path, lines[i], i + 1, tokens, usages);
        }
    }
    return usages;
}

/**
 * Read every app-code component's resolved template (inline template → the `.ts`
 * body, external → the sibling `.html`), reusing {@link toTarget}/
 * {@link readTemplate} so a match's `path`+`line` point at the exact file the user
 * edits. {@link collectComponentFiles} already skips `node_modules` and the managed
 * UI/blocks dirs, so this only ever scans the consumer's own code.
 */
async function collectAppTemplates(root: string, managed: string[]): Promise<{ path: string; content: string }[]> {
    const files = await collectComponentFiles(root, managed);
    const out: { path: string; content: string }[] = [];
    for (const file of files) {
        const target = await toTarget(file);
        if (!target) continue;
        const tsSource = await fs.readFile(target.tsPath, 'utf-8');
        out.push({ path: target.templatePath, content: await readTemplate(target, tsSource) });
    }
    return out;
}

const MAX_USAGE_LINES = 10;

function printComponentUsages(component: string, usages: TokenUsage[], root: string): void {
    if (usages.length === 0) {
        console.log(chalk.dim(`  ${component}: (no usages found in your app code)`));
        return;
    }
    console.log(chalk.yellow(`  ${component} — your code uses these:`));
    for (const u of usages.slice(0, MAX_USAGE_LINES)) {
        console.log(chalk.yellow(`    ${path.relative(root, u.path)}:${u.line} ([${u.token}])`));
    }
    if (usages.length > MAX_USAGE_LINES) {
        console.log(chalk.yellow(`    +${usages.length - MAX_USAGE_LINES} more`));
    }
}

/**
 * After the generic breaking-change notes, tell affected consumers WHICH of their
 * files/lines bind the removed/renamed inputs (capped, with a `+N more`), and
 * reassure the rest that nothing in their code uses them. No-op when the touched
 * components carry no scannable breaking tokens.
 */
export async function printBreakingUsages(
    components: Iterable<ComponentName>, root: string, managed: string[],
): Promise<void> {
    const breaking = collectBreakingChanges(components).filter(cb =>
        cb.changes.some(c => extractBreakingTokens(c).length > 0),
    );
    if (breaking.length === 0) return;
    const templates = await collectAppTemplates(root, managed);
    for (const cb of breaking) {
        const tokens = [...new Set(cb.changes.flatMap(extractBreakingTokens))];
        printComponentUsages(cb.component, scanFilesForTokens(templates, tokens), root);
    }
}
