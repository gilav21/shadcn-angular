import { describe, it, expect } from 'vitest';
import {
    rewriteVitestToShim,
    rewriteShimToVitest,
    transformSpecForRunner,
    vitestCompatSpecifier,
    VITEST_COMPAT_SUBPATH,
    VITEST_COMPAT_LIB_FILE,
} from './test-transform.js';

const ALIAS = '@/components/lib';
const SHIM = `${ALIAS}/${VITEST_COMPAT_SUBPATH}`;

describe('vitestCompatSpecifier', () => {
    it('joins the utils alias with the shim subpath', () => {
        expect(vitestCompatSpecifier(ALIAS)).toBe('@/components/lib/testing/vitest-compat');
    });

    it('keeps the lib-file path and specifier subpath in lock-step', () => {
        expect(VITEST_COMPAT_LIB_FILE).toBe(`${VITEST_COMPAT_SUBPATH}.ts`);
    });
});

describe('rewriteVitestToShim', () => {
    it('rewrites a single-quoted vitest import to the shim', () => {
        const src = "import { describe, it, vi } from 'vitest';";
        expect(rewriteVitestToShim(src, ALIAS)).toBe(`import { describe, it, vi } from '${SHIM}';`);
    });

    it('rewrites a double-quoted import too', () => {
        const src = 'import { expect } from "vitest";';
        expect(rewriteVitestToShim(src, ALIAS)).toBe(`import { expect } from "${SHIM}";`);
    });

    it('rewrites a type-only import', () => {
        const src = "import type { Mock } from 'vitest';";
        expect(rewriteVitestToShim(src, ALIAS)).toBe(`import type { Mock } from '${SHIM}';`);
    });

    it('rewrites every vitest import in a file', () => {
        const src = "import { vi } from 'vitest';\nimport type { Mock } from 'vitest';";
        const out = rewriteVitestToShim(src, ALIAS);
        expect(out).not.toContain("'vitest'");
        expect(out.match(/vitest-compat/g)).toHaveLength(2);
    });

    it('does not touch a substring like "vitest-environment"', () => {
        const src = "import x from 'vitest-environment-foo';";
        expect(rewriteVitestToShim(src, ALIAS)).toBe(src);
    });

    it('is idempotent — an already-rewritten file is unchanged', () => {
        const once = rewriteVitestToShim("import { vi } from 'vitest';", ALIAS);
        expect(rewriteVitestToShim(once, ALIAS)).toBe(once);
    });
});

describe('rewriteShimToVitest', () => {
    it('rewrites the shim specifier back to vitest', () => {
        const src = `import { vi } from '${SHIM}';`;
        expect(rewriteShimToVitest(src, ALIAS)).toBe("import { vi } from 'vitest';");
    });

    it('round-trips with rewriteVitestToShim', () => {
        const original = "import { describe, it, expect, vi } from 'vitest';\nconst x = 1;\n";
        const jest = rewriteVitestToShim(original, ALIAS);
        expect(jest).not.toBe(original);
        expect(rewriteShimToVitest(jest, ALIAS)).toBe(original);
    });

    it('is idempotent — a vitest file is unchanged', () => {
        const src = "import { vi } from 'vitest';";
        expect(rewriteShimToVitest(src, ALIAS)).toBe(src);
    });

    it('respects a custom utils alias', () => {
        const alias = '~/ui/lib';
        const jest = rewriteVitestToShim("import { vi } from 'vitest';", alias);
        expect(jest).toContain('~/ui/lib/testing/vitest-compat');
        expect(rewriteShimToVitest(jest, alias)).toBe("import { vi } from 'vitest';");
    });
});

describe('transformSpecForRunner', () => {
    const src = "import { vi } from 'vitest';";

    it('is a no-op for vitest', () => {
        expect(transformSpecForRunner(src, 'vitest', ALIAS)).toBe(src);
    });

    it('rewrites to the shim for jest', () => {
        expect(transformSpecForRunner(src, 'jest', ALIAS)).toBe(`import { vi } from '${SHIM}';`);
    });
});
