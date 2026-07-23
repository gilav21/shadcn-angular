/**
 * `npm run e2e:reset:jest` / `npm run e2e:reset:vitest`
 *
 * Resets the fixture-app to its pristine state (same as `e2e:reset`) and then
 * drops in a real test-runner setup — jest (jest-preset-angular, zone) or vitest
 * (@analogjs, jsdom, zoneless) — so a subsequent
 *
 *     add <component> --include-tests
 *
 * install can immediately run the shipped specs, exactly as a consumer on that
 * runner would. `npm test` inside the fixture-app runs them.
 *
 * The base reset does `git clean -fd`, which removes the runner config files
 * (they are untracked), so this script re-writes them after every reset. The
 * runner devDeps land in the gitignored `node_modules`, which survives the
 * clean, so the (slow) install only runs the first time.
 */
import { writeFileSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { run } from './spawn.js';
import { resetFixtureApp } from './reset-app.js';
import { FIXTURE_APP } from './paths.js';

type Runner = 'jest' | 'vitest';

interface RunnerSetup {
    /** Marker package under node_modules whose presence means "already installed". */
    readonly marker: string;
    /** devDeps to install (versions floored to what the fixture's Angular supports). */
    readonly deps: readonly string[];
    /** The `test` script written into the fixture-app package.json. */
    readonly testScript: string;
    /** Config files to write into the fixture-app (path relative to it → content). */
    readonly files: Readonly<Record<string, string>>;
}

const JEST_CONFIG = `// Real-jest consumer setup (jest-preset-angular, zone-based TestBed).
// Runs the specs shipped by \`add <component> --include-tests\` in jest mode —
// their \`vi\` imports resolve to the installed vitest-compat shim via @/*.
const { createCjsPreset } = require('jest-preset-angular/presets');

module.exports = {
    ...createCjsPreset(),
    rootDir: __dirname,
    setupFilesAfterEnv: ['<rootDir>/setup-jest.cjs'],
    testMatch: ['<rootDir>/src/components/**/*.spec.ts'],
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
    },
    transform: {
        '^.+\\\\.(ts|js|mjs|html|svg)$': [
            'jest-preset-angular',
            { tsconfig: '<rootDir>/tsconfig.spec.json', stringifyContentPathRegex: '\\\\.(html|svg)$' },
        ],
    },
};
`;

const JEST_SETUP = `// Initializes the zone-based Angular TestBed for jest, as a jest-preset-angular
// consumer's setup file does.
const { setupZoneTestEnv } = require('jest-preset-angular/setup-env/zone');

setupZoneTestEnv();
`;

const TSCONFIG_SPEC = `{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "types": ["jest", "node"]
  },
  "include": ["src/**/*.spec.ts", "src/**/*.ts"]
}
`;

const VITEST_CONFIG = `import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import angular from '@analogjs/vite-plugin-angular';

// Real-vitest consumer setup (jsdom, zoneless) — mirrors the portable
// verification leg. Runs the specs shipped by \`add <component> --include-tests\`
// in vitest mode (their \`vi\` imports stay 'vitest').
export default defineConfig({
    plugins: [angular({ tsconfig: 'tsconfig.spec.json' })],
    resolve: {
        // Mirror the app's tsconfig \`@/* -> src/*\` path so component/spec
        // imports of '@/components/...' resolve (jest does this via moduleNameMapper).
        alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    test: {
        globals: false,
        setupFiles: ['src/test-setup.ts'],
        environment: 'jsdom',
        include: ['src/components/**/*.spec.ts'],
        reporters: ['default'],
    },
});
`;

const VITEST_SETUP = `import '@angular/compiler';
import '@analogjs/vitest-angular/setup-snapshots';
import { setupTestBed } from '@analogjs/vitest-angular/setup-testbed';
import { afterEach, vi } from 'vitest';

setupTestBed({ zoneless: true, providers: [], browserMode: false });

afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
});
`;

const SETUPS: Readonly<Record<Runner, RunnerSetup>> = {
    jest: {
        marker: 'jest-preset-angular',
        deps: ['jest@^30', 'jest-preset-angular@^17', '@jest/globals@^30', 'jest-environment-jsdom@^30', 'jsdom@^26'],
        testScript: 'jest --config jest.config.cjs',
        files: {
            'jest.config.cjs': JEST_CONFIG,
            'setup-jest.cjs': JEST_SETUP,
            'tsconfig.spec.json': TSCONFIG_SPEC,
        },
    },
    vitest: {
        marker: '@analogjs/vitest-angular',
        deps: ['vitest@^4', '@analogjs/vite-plugin-angular@^2', '@analogjs/vitest-angular@^2', 'jsdom@^27'],
        testScript: 'vitest run',
        files: {
            'vitest.config.ts': VITEST_CONFIG,
            'src/test-setup.ts': VITEST_SETUP,
            'tsconfig.spec.json': TSCONFIG_SPEC,
        },
    },
};

function writeFiles(setup: RunnerSetup): void {
    for (const [rel, content] of Object.entries(setup.files)) {
        writeFileSync(path.join(FIXTURE_APP, rel), content, 'utf-8');
    }
}

/** Add a `test` script to the fixture-app package.json (reset reverted it). */
function writeTestScript(setup: RunnerSetup): void {
    const pkgPath = path.join(FIXTURE_APP, 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    pkg.scripts = { ...pkg.scripts, test: setup.testScript };
    writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');
}

async function main(): Promise<void> {
    const runner = process.argv[2] as Runner;
    if (runner !== 'jest' && runner !== 'vitest') {
        console.error('[e2e] usage: reset-with-runner.ts <jest|vitest>');
        process.exit(1);
    }
    const setup = SETUPS[runner];

    await resetFixtureApp();
    writeFiles(setup);
    writeTestScript(setup);

    // Always install: the base reset reverts package.json/lock and can leave the
    // runner's node_modules subtree incomplete (so it resolves up to the repo
    // root's Angular, which mismatches the fixture-app's). `npm install -D` is
    // idempotent — near-instant when everything is already present.
    // --legacy-peer-deps: @analogjs declares a peerOptional on
    // @angular-devkit/build-angular whose latest satisfies the app's Angular
    // major loosely, so npm otherwise tries to pull a mismatched build-angular.
    console.log(`[e2e] ensuring ${runner} deps are installed in the fixture-app…`);
    await run(
        'npm',
        ['install', '-D', ...setup.deps, '--legacy-peer-deps', '--no-audit', '--no-fund'],
        { cwd: FIXTURE_APP },
    );

    console.log(`\n[e2e] fixture-app reset with ${runner} installed.`);
    console.log('  Next:');
    console.log('    cd e2e/fixture-app');
    console.log('    node ../../packages/cli/dist/index.js init --yes');
    console.log(`    node ../../packages/cli/dist/index.js add <component> --include-tests --yes`);
    console.log('    npm test');
}

main().catch(err => {
    console.error('[e2e] reset-with-runner failed:', err);
    process.exit(1);
});
