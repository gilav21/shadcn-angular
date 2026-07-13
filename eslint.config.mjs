// @ts-check
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import angular from 'angular-eslint';
import sonarjs from 'eslint-plugin-sonarjs';

/**
 * Flat ESLint config for the shadcn-angular monorepo.
 *
 * Mirrors the previous `.eslintrc.json`: typescript-eslint + angular-eslint with
 * a strict "client" ruleset enforced on shipped components and lib utils, scoped
 * off for test/story/demo scaffolding and CLI/e2e/scripts tooling.
 */
export default tseslint.config(
  {
    // Generated / vendored / non-source.
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/.angular/**',
      '**/storybook-static/**',
      'documentation/**',
      'coverage/**',
      'coverage-cli/**',
      '.storybook/**',
      'e2e/fixture-app/**',
      // Nested git worktrees (`.claude/worktrees/<branch>/`) are separate
      // checkouts of this repo — they are linted by their own runs, and their
      // files aren't in this checkout's tsconfig, so parserOptions.project
      // rejects every one of them.
      '**/.claude/worktrees/**',
      '**/*.config.js',
      '**/*.config.mjs',
    ],
  },

  // --- TypeScript (all source) ---
  {
    files: ['**/*.ts'],
    extends: [
      eslint.configs.recommended,
      ...tseslint.configs.recommended,
      ...angular.configs.tsRecommended,
    ],
    processor: angular.processInlineTemplates,
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.eslint.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      'max-lines-per-function': [
        'warn',
        { max: 50, skipComments: true, skipBlankLines: true },
      ],
      complexity: ['warn', 15],
      'max-depth': ['warn', 3],
      'max-params': ['warn', 7],
      'no-console': ['warn', { allow: ['error'] }],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      // Still flags `someObject || default` (should be `??`), but allows
      // intentional falsy fallbacks on primitives (e.g. `count || 50`,
      // `name || 'file'`) without per-line disables.
      '@typescript-eslint/prefer-nullish-coalescing': [
        'error',
        { ignorePrimitives: { string: true, number: true, boolean: true } },
      ],
      '@typescript-eslint/explicit-function-return-type': [
        'warn',
        { allowExpressions: true, allowTypedFunctionExpressions: true },
      ],
    },
  },

  // --- SonarQube "Sonar way" wide base (via eslint-plugin-sonarjs) ---
  sonarjs.configs.recommended,
  {
    // No `files` key — applies to every linted file (incl. .mjs tooling).
    rules: {
      // Security Hotspots — manual-review items in SonarQube (not gate-failing
      // bugs) and predominantly false-positives in a UI component library +
      // build CLI, so they are not enforced in CI:
      //  - pseudo-random: Math.random() drives visual effects (colors,
      //    particles, confetti, animations) — never security/crypto.
      //  - slow-regex: regexes run over build-time tooling / bounded parser input.
      //  - os-command / no-os-command-from-path: the CLI + e2e runner invoke
      //    npm/git/node by name intentionally.
      //  - no-clear-text-protocols: only example URLs in test fixtures.
      //  - no-hardcoded-passwords: matches UI locale labels ("Password"), not secrets.
      'sonarjs/pseudo-random': 'off',
      'sonarjs/slow-regex': 'off',
      'sonarjs/os-command': 'off',
      'sonarjs/no-os-command-from-path': 'off',
      'sonarjs/no-clear-text-protocols': 'off',
      'sonarjs/no-hardcoded-passwords': 'off',
      // False positive: angular.processInlineTemplates extracts inline test-host
      // templates from *.spec.ts, breaking sonarjs's test-case detection — these
      // specs DO contain tests (3475 pass).
      'sonarjs/no-empty-test-file': 'off',
      // Defer to @typescript-eslint/no-unused-vars (already enforced).
      'sonarjs/no-unused-vars': 'off',
    },
  },

  // --- Component library (shipped): enforce the "ui" selector prefix ---
  {
    files: ['packages/components/**/*.ts'],
    rules: {
      '@angular-eslint/directive-selector': [
        'error',
        { type: 'attribute', prefix: 'ui', style: 'camelCase' },
      ],
      '@angular-eslint/component-selector': [
        'error',
        { type: 'element', prefix: 'ui', style: 'kebab-case' },
      ],
    },
  },

  // --- Accepted sonarjs findings on shipped source (file-scoped) ---
  // These suppressions used to live as inline `// eslint-disable sonarjs/*`
  // comments in the source, but that shipped the disables into consumers'
  // projects (where sonarjs isn't installed), surfacing as lint errors. They
  // are kept here, out of the shipped files, with the original rationale.
  {
    // typeof null === 'object' / Record index returns undefined / CVA writes
    // undefined on reset — the runtime-vs-type mismatch checks are intentional
    // defensive guards and DOM-identity sentinels.
    files: [
      'packages/components/ui/autocomplete/autocomplete.component.ts',
      'packages/components/ui/calendar/calendar.component.ts',
      'packages/components/ui/radio-group/radio-group.component.ts',
      'packages/components/ui/rich-text-editor/rich-text-editor.component.ts',
      'packages/components/ui/slider/slider.component.ts',
      'packages/components/ui/sortable/sortable.component.ts',
      'packages/components/lib/parsers/pdf-pixel-perfect.ts',
    ],
    rules: {
      'sonarjs/different-types-comparison': 'off',
    },
  },
  {
    // The syntax-highlighter keyword lists are intrinsically long regexes.
    files: ['packages/components/ui/code-block/code-block.component.ts'],
    rules: {
      'sonarjs/regex-complexity': 'off',
    },
  },
  {
    // bypassSecurityTrust* is only ever called on trusted internally-produced
    // content (blob: URLs, our own parser HTML, static SVG icon constants),
    // never on raw user input.
    files: [
      'packages/components/ui/file-viewer/file-viewer.component.ts',
      'packages/components/ui/icon/icon.component.ts',
      'packages/components/ui/rich-text-editor/sub/rich-text-image-resizer.component.ts',
      'packages/components/ui/rich-text-editor/sub/rich-text-toolbar.component.ts',
    ],
    rules: {
      'sonarjs/no-angular-bypass-sanitization': 'off',
    },
  },
  {
    // AcceptResult is intentionally `boolean | { ok; reason }`; the bare boolean
    // is the documented shorthand.
    files: ['packages/components/ui/sortable/sortable.component.ts'],
    rules: {
      'sonarjs/function-return-type': 'off',
    },
  },

  // --- Test / story / demo scaffolding: relax non-shipped-code rules ---
  {
    files: [
      '**/*.spec.ts',
      '**/*.stories.ts',
      '**/*-demo.component.ts',
      '**/*-fixtures.ts',
    ],
    rules: {
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      'max-lines-per-function': 'off',
      '@angular-eslint/component-selector': 'off',
      '@angular-eslint/directive-selector': 'off',
    },
  },

  // --- CLI / e2e / scripts tooling: stdout is intended ---
  {
    files: ['packages/cli/**/*.ts', 'e2e/**/*.ts', 'scripts/**/*.ts'],
    rules: {
      'no-console': 'off',
    },
  },

  // --- Angular HTML templates ---
  {
    files: ['**/*.html'],
    extends: [
      ...angular.configs.templateRecommended,
      ...angular.configs.templateAccessibility,
    ],
    rules: {
      '@angular-eslint/template/use-track-by-function': 'error',
    },
  },
);
