#!/usr/bin/env tsx
/**
 * Print every component (non-addon, non-block) that owns at least one portable
 * (`*.spec.ts`, not `*.browser.spec.ts`) spec on disk — the candidate set for
 * the `--include-tests` portability campaign. One name per line.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { registry } from '../src/registry/index.js';
import { collectPortableSpecs } from './sync-registry-lib';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const UI_ROOT = path.resolve(SCRIPT_DIR, '../../components/ui');

const names = Object.values(registry)
    .filter(c => c.type !== 'addon' && c.type !== 'block')
    .filter(c => collectPortableSpecs(c.files, UI_ROOT).length > 0)
    .map(c => c.name)
    .sort((a, b) => a.localeCompare(b));

for (const name of names) console.log(name);
console.error(`\n${names.length} candidate component(s) with portable specs.`);
