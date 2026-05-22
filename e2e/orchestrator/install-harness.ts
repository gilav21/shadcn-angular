import fs from 'node:fs';
import path from 'node:path';
import {
    FIXTURE_APP_ROUTES,
    FIXTURE_TEST_PAGES,
    harnessDir,
} from './paths.js';

/**
 * Copies the harness page(s) for `<name>` into the fixture-app and rewrites
 * its `app.routes.ts` to mount the demo at `/` (the only route).
 *
 * Convention: every harness folder contains a file matching the pattern
 * `<name>-demo.component.ts`. That file's default-exported class is the
 * one we route to. We don't try to be clever about multiple components —
 * one page per test is plenty.
 */
export function installHarness(name: string): void {
    fs.mkdirSync(FIXTURE_TEST_PAGES, { recursive: true });

    const srcDir = harnessDir(name);
    const demoFile = `${name}-demo.component.ts`;
    const demoPath = path.join(srcDir, demoFile);
    if (!fs.existsSync(demoPath)) {
        throw new Error(`Harness page not found: ${demoPath}`);
    }

    // Copy every *.component.ts in the harness folder (covers harness pages
    // that need a few small helper components alongside the main demo).
    for (const file of fs.readdirSync(srcDir)) {
        if (file.endsWith('.component.ts')) {
            fs.copyFileSync(path.join(srcDir, file), path.join(FIXTURE_TEST_PAGES, file));
        }
    }

    const className = toPascalCase(name) + 'DemoComponent';
    const importPath = `./test-pages/${name}-demo.component`;
    const routesContent =
        `import { Routes } from '@angular/router';\n` +
        `import { ${className} } from '${importPath}';\n` +
        `\n` +
        `export const routes: Routes = [\n` +
        `  { path: '', component: ${className} },\n` +
        `];\n`;

    fs.writeFileSync(FIXTURE_APP_ROUTES, routesContent);
}

function toPascalCase(kebab: string): string {
    return kebab
        .split('-')
        .map(s => s.charAt(0).toUpperCase() + s.slice(1))
        .join('');
}
