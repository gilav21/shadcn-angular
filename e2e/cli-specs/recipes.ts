import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CliSpec } from './_types.js';
import { npmInstall, buildClean } from './_build.js';
import { buildRecipes } from '../../packages/cli/scripts/gen-recipes-lib.js';
import { loadRecipeSources } from '../../packages/cli/scripts/gen-recipes.js';

/**
 * T-12 from `specs/dx-distribution-spec.md` §2.1 — every recipe compiles.
 *
 * A recipe is the pattern a developer copies wholesale, so it carries more
 * weight per line than a component snippet: if it does not build, the person
 * copying it has no component of their own to blame and no obvious way back.
 *
 * The gate installs the union of every recipe's `@components`, drops the
 * recipe sources into the fixture app unchanged, forces all of them into the
 * compile graph through the routes file, and builds with `strictTemplates`.
 * Nothing is rewritten on the way in — what ships in `recipes.json` is exactly
 * what is compiled here.
 */

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/** `LoadingToLoadedListComponent` → the route path it is mounted at. */
function exportedClass(code: string, file: string): string {
    const match = /export class (\w+)/.exec(code);
    if (!match) throw new Error(`${file} exports no component class.`);
    return match[1];
}

const spec: CliSpec = async ({ runCli, fixtureApp }) => {
    const { recipes } = buildRecipes(loadRecipeSources(REPO_ROOT));
    if (recipes.length < 4) {
        throw new Error(`Expected at least 4 recipes, found ${recipes.length}.`);
    }

    const components = [...new Set(recipes.flatMap(recipe => recipe.components))]
        .sort((a, b) => a.localeCompare(b));
    console.log(`[recipes] ${recipes.length} recipes need: ${components.join(', ')}`);

    await runCli(['init', '--yes']);
    await runCli(['add', ...components, '--yes']);

    const pagesDir = path.join(fixtureApp, 'src/app/test-pages');
    fs.mkdirSync(pagesDir, { recursive: true });

    const imports: string[] = [];
    const routes: string[] = [];
    for (const recipe of recipes) {
        const fileName = `${recipe.id}.component.ts`;
        fs.writeFileSync(path.join(pagesDir, fileName), recipe.code);
        const className = exportedClass(recipe.code, recipe.file);
        imports.push(`import { ${className} } from './test-pages/${recipe.id}.component';`);
        routes.push(`  { path: '${recipe.id}', component: ${className} },`);
    }

    const routesSource = `import { Routes } from '@angular/router';
${imports.join('\n')}

export const routes: Routes = [
${routes.join('\n')}
  { path: '', redirectTo: '${recipes[0].id}', pathMatch: 'full' },
];
`;
    fs.writeFileSync(path.join(fixtureApp, 'src/app/app.routes.ts'), routesSource);

    await npmInstall(fixtureApp);
    // Every recipe is reachable from the routes file, so a template error in
    // any one of them fails this build rather than hiding behind tree shaking.
    await buildClean(fixtureApp);
};

export default spec;
