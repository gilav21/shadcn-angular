// @ts-check
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import angular from 'angular-eslint';

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
