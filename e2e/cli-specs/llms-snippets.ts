import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CliSpec } from './_types.js';
import { npmInstall, buildClean } from './_build.js';
import { parseEntry, sampleCorpusNames } from '../../packages/cli/scripts/gen-llms-lib.js';

/**
 * T-3 from `specs/dx-distribution-spec.md` §2.2 — the test that decides whether
 * `llms.txt` is worth shipping at all.
 *
 * A usage corpus that teaches non-compiling code is worse than no corpus: an
 * assistant will reproduce the mistake confidently, at scale, and the developer
 * will blame the library. So this spec takes three components sampled from the
 * corpus, and builds a consumer using ONLY what the corpus states about them —
 * the `- Import:` line and the fenced ```html snippet. Nothing is read from the
 * registry, the component sources, or this repo's own demos. If the build
 * fails, the corpus is wrong, not the test.
 *
 * The sample is deterministic (so a failure is reproducible) but not
 * hand-picked (so it cannot be gamed): `LLMS_SEED` rotates it, and rotating it
 * on a green tree is the cheapest way to widen coverage of the corpus.
 */

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const CORPUS = path.join(REPO_ROOT, 'demo/public/llms.txt');
const SAMPLE_SIZE = 3;

interface SampledUsage {
    readonly name: string;
    readonly importStatement: string;
    readonly className: string;
    readonly snippet: string;
}

/** The class an `import { X } from '…'` statement brings in. */
function classNameOf(importStatement: string): string {
    const match = /import\s*\{\s*([\w$]+)/.exec(importStatement);
    if (!match) throw new Error(`llms.txt import statement is unparseable: ${importStatement}`);
    return match[1];
}

function sample(corpus: string, seed: string): SampledUsage[] {
    const names = sampleCorpusNames(corpus, SAMPLE_SIZE, seed);
    if (names.length < SAMPLE_SIZE) {
        throw new Error(
            `llms.txt offers only ${names.length} usable entries; expected at least ${SAMPLE_SIZE}. ` +
            `Either the corpus is truncated or snippet generation has regressed.`,
        );
    }
    return names.map(name => {
        const parsed = parseEntry(corpus, name);
        if (!parsed?.importStatement || !parsed.snippet) {
            throw new Error(`llms.txt entry "${name}" lost its import or snippet between passes.`);
        }
        return {
            name,
            importStatement: parsed.importStatement,
            className: classNameOf(parsed.importStatement),
            snippet: parsed.snippet,
        };
    });
}

/**
 * A standalone consumer assembled purely from corpus facts. The `data-testid`
 * per snippet keeps a failure message pointing at the component that broke.
 */
function consumerSource(usages: readonly SampledUsage[]): string {
    const imports = usages.map(u => u.importStatement).join('\n');
    const classes = usages.map(u => u.className).join(', ');
    const markup = usages.map(u => `      ${u.snippet}`).join('\n');
    return `import { Component } from '@angular/core';
${imports}

@Component({
  selector: 'app-llms-corpus',
  standalone: true,
  imports: [${classes}],
  template: \`
    <main>
${markup}
    </main>
  \`,
})
export class LlmsCorpusComponent {}
`;
}

const ROUTES = `import { Routes } from '@angular/router';
import { LlmsCorpusComponent } from './test-pages/llms-corpus.component';

export const routes: Routes = [
  { path: '', component: LlmsCorpusComponent },
];
`;

const spec: CliSpec = async ({ runCli, fixtureApp }) => {
    const corpus = fs.readFileSync(CORPUS, 'utf-8');
    const seed = process.env['LLMS_SEED'] ?? 'wave-0';
    const usages = sample(corpus, seed);
    console.log(
        `[llms-snippets] seed "${seed}" sampled: ${usages.map(u => u.name).join(', ')}`,
    );

    await runCli(['init', '--yes']);
    await runCli(['add', ...usages.map(u => u.name), '--yes']);

    const pagesDir = path.join(fixtureApp, 'src/app/test-pages');
    fs.mkdirSync(pagesDir, { recursive: true });
    fs.writeFileSync(path.join(pagesDir, 'llms-corpus.component.ts'), consumerSource(usages));
    fs.writeFileSync(path.join(fixtureApp, 'src/app/app.routes.ts'), ROUTES);

    await npmInstall(fixtureApp);
    // strictTemplates is on in the fixture app, so an unbound required input, a
    // wrong selector, or a bad import path all fail here rather than at runtime.
    await buildClean(fixtureApp);
};

export default spec;
