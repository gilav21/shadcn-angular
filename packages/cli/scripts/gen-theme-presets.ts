/**
 * `npm run themes:sync` — rewrite the generated theme-preset block in every
 * themed component stylesheet. `--check` exits 1 instead of writing when a
 * stylesheet has drifted from the CLI's `themeColors` table.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { THEMED_STYLESHEETS, spliceThemePresets } from './gen-theme-presets-lib.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const check = process.argv.includes('--check');

let drifted = 0;
for (const relative of THEMED_STYLESHEETS) {
    const file = path.join(REPO_ROOT, relative);
    const current = fs.existsSync(file) ? fs.readFileSync(file, 'utf-8') : '';
    const next = spliceThemePresets(current);
    if (next === current) continue;

    drifted++;
    if (check) console.error(`[themes] ${relative} is out of date — run \`npm run themes:sync\`.`);
    else fs.writeFileSync(file, next);
}

process.exit(check && drifted > 0 ? 1 : 0);
