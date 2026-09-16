/**
 * `tsx packages/cli/scripts/package-styles.ts <rte|data-table>` — compile the
 * staged package's `styles.css`. Run by the package build between staging and
 * `ng build` (ng-packagr copies the result as an asset). Wiring only: every
 * decision about the stylesheet's content lives in `package-styles-lib.ts`.
 */
import tailwind from '@tailwindcss/postcss';
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import postcss from 'postcss';

import { getStylesTemplate } from '../src/templates/styles.js';
import { readNamespace } from './gen-file-sizes.js';
import { STYLES_FILE, elementSelectors, renderStylesInput, zeroSpecificityThemeRoot } from './package-styles-lib.js';
import { isPackageId, packageDir } from './stage-package-lib.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

const id = process.argv[2] ?? '';
if (!isPackageId(id)) {
    console.error('Usage: package-styles.ts <rte|data-table>');
    process.exit(1);
}

const pkgRoot = path.join(REPO_ROOT, packageDir(id));
const require = createRequire(import.meta.url);

const input = renderStylesInput({
    template: getStylesTemplate(),
    preflight: readFileSync(require.resolve('tailwindcss/preflight.css'), 'utf-8'),
    tags: elementSelectors(readNamespace(path.join(pkgRoot, 'src')).map((file) => file.contents)),
});

const result = await postcss([
    tailwind({ base: pkgRoot, optimize: { minify: true } }),
    zeroSpecificityThemeRoot(),
]).process(input, { from: path.join(pkgRoot, 'styles.input.css'), to: path.join(pkgRoot, STYLES_FILE) });

writeFileSync(path.join(pkgRoot, STYLES_FILE), result.css);
console.log(`[package-styles] ${id}: ${packageDir(id)}/${STYLES_FILE} (${(result.css.length / 1024).toFixed(1)} KB)`);
