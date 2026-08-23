// @ts-check
const eslint = require('eslint/config');
const js = require('@eslint/js');
const tseslint = require('typescript-eslint');
const angular = require('angular-eslint');
const prettier = require('eslint-config-prettier');

const { defineConfig } = eslint;

module.exports = defineConfig([
  {
    ignores: ['dist/**', '.angular/**', 'coverage/**', 'node_modules/**'],
  },
  {
    files: ['**/*.ts'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      tseslint.configs.stylistic,
      angular.configs.tsRecommended,
      prettier,
    ],
    processor: angular.processInlineTemplates,
    rules: {
      '@angular-eslint/directive-selector': [
        'error',
        { type: 'attribute', prefix: 'app', style: 'camelCase' },
      ],
      '@angular-eslint/component-selector': [
        'error',
        { type: 'element', prefix: 'app', style: 'kebab-case' },
      ],

      // Standalone-first, signal-first conventions.
      '@angular-eslint/prefer-standalone': 'error',
      '@angular-eslint/prefer-on-push-component-change-detection': 'warn',
      '@angular-eslint/use-lifecycle-interface': 'error',
      '@angular-eslint/no-empty-lifecycle-method': 'error',
      '@angular-eslint/component-class-suffix': 'off',

      // Type safety.
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'separate-type-imports' },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],

      // Keep the architecture honest: core and shared never depend on features.
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/features/*'],
              message: 'core/ and shared/ must not import from features/.',
            },
          ],
        },
      ],

      eqeqeq: ['error', 'smart'],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    // Features are allowed to import from each other's public entry points only
    // via shared/core, so the restriction above is lifted here deliberately.
    files: ['src/app/features/**/*.ts', 'src/app/layout/**/*.ts'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
  {
    // Components that enhance a native element rather than wrapping it — e.g.
    // `button[appUiButton]`, which keeps the button's semantics, form
    // participation and keyboard behaviour that an element selector would
    // discard. Same prefix rule, attribute form.
    files: ['src/app/shared/components/ui-button/ui-button.ts'],
    rules: {
      '@angular-eslint/component-selector': [
        'error',
        { type: 'attribute', prefix: 'app', style: 'camelCase' },
      ],
    },
  },
  {
    // The logger is the one place allowed to touch the console directly.
    files: ['src/app/core/services/logger.service.ts'],
    rules: {
      'no-console': 'off',
    },
  },
  {
    files: ['**/*.spec.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'no-console': 'off',
    },
  },
  {
    files: ['**/*.html'],
    extends: [angular.configs.templateRecommended, angular.configs.templateAccessibility],
    rules: {},
  },
]);
