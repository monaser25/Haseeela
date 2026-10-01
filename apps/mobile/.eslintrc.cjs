module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
  },
  plugins: ['@typescript-eslint', 'react-hooks'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  rules: {
    // TypeScript handles undefined and typing checks
    'no-undef': 'off',
    // Unused variables and exhaustive-deps findings treated as warnings to avoid breaking parallel auth worker
    'no-unused-vars': 'off',
    '@typescript-eslint/no-unused-vars': [
      'warn',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-require-imports': 'off',
    'prefer-const': 'warn',
    'no-empty': ['warn', { allowEmptyCatch: true }],
    // React Hooks rules
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',
    // Core hygiene
    'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
    'eqeqeq': ['warn', 'smart'],
  },
  ignorePatterns: [
    'node_modules/',
    '.expo/',
    '.export-*/',
    'dist/',
    'build/',
    'coverage/',
    '*.config.js',
    '*.config.cjs',
  ],
};
