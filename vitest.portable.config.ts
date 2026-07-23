import { defineConfig } from 'vitest/config';
import angular from '@analogjs/vite-plugin-angular';

/**
 * Portable-spec vitest config: the jsdom, no-browser, globals-off leg of the
 * `add --include-tests` verification gate. It runs the specs a plain vitest
 * consumer would run — no Playwright browser, no `globals: true` — so a spec
 * that passes here is safe to ship. `verify-portable.ts` drives it per
 * component, passing the target spec files and coverage scope on the CLI;
 * `*.browser.spec.ts` (internal, real-browser only) is always excluded.
 */
export default defineConfig({
    plugins: [angular({ tsconfig: 'tsconfig.json' })],
    optimizeDeps: {
        exclude: ['npm-run-path'],
    },
    test: {
        globals: false,
        setupFiles: ['packages/test-setup.portable.ts'],
        environment: 'jsdom',
        include: ['packages/components/ui/**/*.spec.ts'],
        exclude: ['**/node_modules/**', '**/dist/**', '**/*.browser.spec.ts'],
        reporters: ['default'],
        coverage: {
            provider: 'v8',
            reporter: ['text-summary', 'json-summary'],
            reportsDirectory: './coverage-portable',
            include: ['packages/components/ui/**/*.ts'],
            exclude: [
                '**/*.spec.ts',
                '**/*.stories.ts',
                '**/*-demo.component.ts',
                '**/*-fixtures.ts',
                '**/index.ts',
                '**/*.types.ts',
                '**/*-locales.ts',
            ],
        },
    },
});
