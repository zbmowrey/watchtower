import js from '@eslint/js';
import stylistic from '@stylistic/eslint-plugin';
import prettier from 'eslint-config-prettier/flat';
import importPlugin from 'eslint-plugin-import';
import jestDom from 'eslint-plugin-jest-dom';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import reactX from 'eslint-plugin-react-x';
import testingLibrary from 'eslint-plugin-testing-library';
import globals from 'globals';
import typescript from 'typescript-eslint';

const controlStatements = [
    'if',
    'return',
    'for',
    'while',
    'do',
    'switch',
    'try',
    'throw',
];
const paddingAroundControl = [
    ...controlStatements.flatMap((stmt) => [
        { blankLine: 'always', prev: '*', next: stmt },
        { blankLine: 'always', prev: stmt, next: '*' },
    ]),
];

/** @type {import('eslint').Linter.Config[]} */
export default [
    js.configs.recommended,
    // Spec v1.4 §3 — reactHooks MUST resolve ≥6 so recommended-latest carries the
    // compiler-powered rules (on v5 this preset is only the two classic rules).
    reactHooks.configs.flat['recommended-latest'],
    // Spec v1.4 §6 / frontend-build-traps — a non-component export in a component
    // file silently breaks Fast Refresh; lint it instead of remembering it.
    reactRefresh.configs.vite,
    ...typescript.configs.recommended,
    {
        ...react.configs.flat.recommended,
        ...react.configs.flat['jsx-runtime'],
        languageOptions: {
            globals: {
                ...globals.browser,
            },
        },
        rules: {
            'react/react-in-jsx-scope': 'off',
            'react/prop-types': 'off',
            'react/no-unescaped-entities': 'off',
            // Spec v1.4 §3 — dangerouslySetInnerHTML only via a sanitizer; each
            // disable carries a one-line justification naming why the input is trusted.
            'react/no-danger': 'error',
        },
        settings: {
            react: {
                version: 'detect',
            },
        },
    },
    // Spec v1 §2 — jsx-a11y (accessibility) on first-party React only. Pre-existing
    // a11y debt MAY be parked in scoped `TODO(a11y)` override blocks (tracked debt,
    // not a waiver).
    {
        files: ['resources/js/**/*.{jsx,tsx}'],
        ...jsxA11y.flatConfigs.recommended,
    },
    {
        plugins: {
            import: importPlugin,
        },
        settings: {
            'import/resolver': {
                typescript: {
                    alwaysTryTypes: true,
                    project: './tsconfig.json',
                },
                node: true,
            },
        },
        rules: {
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/consistent-type-imports': [
                'error',
                {
                    prefer: 'type-imports',
                    fixStyle: 'separate-type-imports',
                },
            ],
            'import/order': [
                'error',
                {
                    groups: [
                        'builtin',
                        'external',
                        'internal',
                        'parent',
                        'sibling',
                        'index',
                    ],
                    alphabetize: { order: 'asc', caseInsensitive: true },
                },
            ],
            'import/consistent-type-specifier-style': [
                'error',
                'prefer-top-level',
            ],
        },
    },
    // Spec v1 §2 — TYPE-AWARE rules on first-party TS. projectService gives the
    // parser type info so flow-based rules work; no-explicit-any is error here
    // (globally off above, on for first-party), plus no-floating-promises and a
    // strict ban-ts-comment.
    {
        files: ['resources/js/**/*.{ts,tsx}'],
        languageOptions: {
            parserOptions: {
                projectService: true,
                tsconfigRootDir: import.meta.dirname,
            },
        },
        rules: {
            '@typescript-eslint/no-explicit-any': 'error',
            '@typescript-eslint/no-floating-promises': 'error',
            '@typescript-eslint/ban-ts-comment': 'error',
        },
    },
    // Spec v1.4 §3 — the React-19 idiom rules, machine-enforced: ref-as-prop (no
    // forwardRef) and <Context> (no <Context.Provider>) are MUST; use(Context)
    // over useContext is SHOULD (warn) for new code.
    {
        files: ['resources/js/**/*.{ts,tsx}'],
        plugins: {
            'react-x': reactX,
        },
        rules: {
            'react-x/no-forward-ref': 'error',
            'react-x/no-context-provider': 'error',
            'react-x/no-use-context': 'warn',
        },
    },
    // Spec v1.4 §2 — the size ratchet. Fleet targets: ~250 lines/file, ~80/function
    // (warn; ~400 is the MUST-refactor ceiling, review-enforced). Ratchet policy: an
    // app above target MAY override these upward in a trailing block of its own
    // config, and that number may only fall toward the target — never rise.
    {
        files: ['resources/js/**/*.{ts,tsx}'],
        rules: {
            'max-lines': [
                'warn',
                { max: 250, skipBlankLines: true, skipComments: true },
            ],
            'max-lines-per-function': [
                'warn',
                { max: 80, skipBlankLines: true, skipComments: true, IIFEs: true },
            ],
        },
    },
    // Spec v1.4 §6 — test hygiene, scoped to test files only: Testing Library +
    // jest-dom rules; user-event over fireEvent is enforced, not remembered.
    {
        ...testingLibrary.configs['flat/react'],
        files: [
            'resources/js/**/*.{test,spec}.{ts,tsx}',
            'tests/js/**/*.{ts,tsx}',
        ],
        rules: {
            ...testingLibrary.configs['flat/react'].rules,
            'testing-library/prefer-user-event': 'error',
        },
    },
    {
        ...jestDom.configs['flat/recommended'],
        files: [
            'resources/js/**/*.{test,spec}.{ts,tsx}',
            'tests/js/**/*.{ts,tsx}',
        ],
    },
    {
        plugins: {
            '@stylistic': stylistic,
        },
        rules: {
            '@stylistic/brace-style': ['error', '1tbs', { allowSingleLine: false }],
            '@stylistic/padding-line-between-statements': [
                'error',
                ...paddingAroundControl,
            ],
        },
    },
    {
        ignores: [
            'vendor',
            'node_modules',
            'public',
            'bootstrap/ssr',
            'bin/**',
            'tailwind.config.js',
            'vite.config.ts',
            'resources/js/actions/**',
            'resources/js/routes/**',
            'resources/js/wayfinder/**',
        ],
    },
    prettier,
    {
        plugins: {
            '@stylistic': stylistic,
        },
        rules: {
            curly: ['error', 'all'],
            '@stylistic/brace-style': ['error', '1tbs', { allowSingleLine: false }],
        },
    },
    // Spec v1.4 §2/§9 — components/ui/* ARE linted (a11y + hooks + the React-19
    // idiom rules: that is the M-2 promise; it was fully ignored before v1.4) but
    // exempt from the size ratchet and first-party padding style — structure
    // parity for these primitives is owned by bin/react-drift, not style rules.
    {
        files: ['resources/js/components/ui/**'],
        rules: {
            'max-lines': 'off',
            'max-lines-per-function': 'off',
            '@stylistic/padding-line-between-statements': 'off',
        },
    },
];
