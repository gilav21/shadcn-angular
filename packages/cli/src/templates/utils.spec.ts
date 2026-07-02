import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getUtilsTemplate } from './utils.js';
import { normalizeContent } from '../core/fetch.js';

/**
 * The path to the live shared lib source `utils.ts` that the registry ships and
 * `doctor` fetches at runtime (via `fetchLibContent`). Resolved relative to this
 * spec so it works regardless of the vitest cwd.
 */
const LIVE_UTILS = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../../../components/lib/utils.ts',
);

describe('utils template drift guard', () => {
    it('emits content doctor treats as clean against the live lib file', () => {
        // The exact comparison `classifyLibFile` (core/lib-reconcile.ts) makes:
        // `normalizeContent(local) === normalizeContent(remote)`, where `local`
        // is what init writes (getUtilsTemplate(), verbatim — init applies no
        // transform to utils.ts) and `remote` is the raw live lib file
        // fetchLibContent returns. If this fails, a fresh `init` ships a utils.ts
        // doctor flags as behind the registry (H4).
        const live = fs.readFileSync(LIVE_UTILS, 'utf-8');
        expect(normalizeContent(getUtilsTemplate())).toBe(normalizeContent(live));
    });
});
