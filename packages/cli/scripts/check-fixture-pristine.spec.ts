import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { commitAll, createRepo, git, gitInitCommit, removeRepo, runScript, write } from './repo-fixtures.js';
import { fixtureViolations } from './check-fixture-pristine-lib.js';

const PRISTINE = {
    'src/app/app.routes.ts': "import { Routes } from '@angular/router';\n\nexport const routes: Routes = [];\n",
    'src/styles.scss': '/* You can add global styles to this file */\n',
    'tsconfig.json': '{\n  "compilerOptions": { "module": "preserve" }\n}\n',
    'package.json': '{\n  "dependencies": { "@angular/core": "^20.3.0" }\n}\n',
};

describe('fixtureViolations', () => {
    it('accepts the pristine scaffold', () => {
        expect(fixtureViolations({ files: PRISTINE, tracked: Object.keys(PRISTINE) })).toEqual([]);
    });

    it('names each kind of committed install output', () => {
        const dirty = {
            'src/app/app.routes.ts': "import { Routes } from '@angular/router';\nimport { X } from './test-pages/x-demo.component';\nexport const routes: Routes = [{ path: '', component: X }];\n",
            'src/styles.scss': '@import "./tailwind.css";\n',
            'tsconfig.json': '{ "compilerOptions": { "paths": { "@/*": ["./src/*"] } } }',
            'package.json': '{ "dependencies": { "tailwindcss": "^4" } }',
        };
        const out = fixtureViolations({ files: dirty, tracked: [...Object.keys(dirty), 'src/components/ui/button.component.ts', 'components.json'] });
        expect(out).toHaveLength(7);
        expect(out.join('\n')).toContain('routes a page');
        expect(out.join('\n')).toContain('harness test page');
        expect(out.join('\n')).toContain('tailwind.css');
        expect(out.join('\n')).toContain('@/*');
        expect(out.join('\n')).toContain('tailwindcss');
        expect(out.join('\n')).toContain('src/components/ui/button.component.ts is install output');
        expect(out.join('\n')).toContain('components.json is install output');
    });
});

// The test runs several git subprocesses in a fresh repo; under the parallel
// browser coverage leg each takes 5-8s, past the 5s default.
describe('check-fixture-pristine entry', { timeout: 60_000 }, () => {
    let root = '';
    const routes = 'e2e/fixture-app/src/app/app.routes.ts';

    beforeEach(() => {
        root = createRepo('fixture-pristine');
        for (const [rel, content] of Object.entries(PRISTINE)) write(root, `e2e/fixture-app/${rel}`, content);
        gitInitCommit(root);
    });

    afterEach(() => removeRepo(root));

    // One repo walked through the whole lifecycle: each `npx tsx` start-up costs
    // more than the git work, and the steps only add to what the last one left.
    // (The child is used, not an in-process call, so `runScript` can scrub the
    // ambient GIT_* variables a pre-push hook would otherwise point at the real repo.)
    it('passes a pristine index, refuses a staged harness route before it is committed and HEAD after, and refuses tracked install output', () => {
        const check = (...flags: string[]) =>
            runScript('packages/cli/scripts/check-fixture-pristine.ts', ['--root', root, ...flags]);

        expect(check('--staged').status).toBe(0);

        write(root, routes, "import { Routes } from '@angular/router';\nimport { D } from './test-pages/d';\nexport const routes: Routes = [{ path: '', component: D }];\n");
        git(root, 'add', '-A');
        const staged = check('--staged');
        expect(staged.status).toBe(1);
        expect(staged.output).toContain('harness test page');
        // Not yet committed, so HEAD is still pristine — the gate reads git, not the working tree.
        expect(check().status).toBe(0);

        commitAll(root, 'oops: committed a run');
        const head = check();
        expect(head.status).toBe(1);
        expect(head.output).toContain('e2e:reset');

        write(root, 'e2e/fixture-app/src/components/ui/button.component.ts', 'export const x = 1;\n');
        commitAll(root, 'oops: committed components');
        expect(check().output).toContain('src/components/ui/button.component.ts is install output');
    });
});
