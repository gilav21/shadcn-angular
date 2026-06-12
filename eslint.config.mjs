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
      '.storybook/**',
      'e2e/fixture-app/**',
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
      '@typescript-eslint/prefer-nullish-coalescing': 'error',
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

  // --- Test / story / demo scaffolding: relax non-shipped-code rules ---
  {
    files: ['**/*.spec.ts', '**/*.stories.ts', '**/*-demo.component.ts'],
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
