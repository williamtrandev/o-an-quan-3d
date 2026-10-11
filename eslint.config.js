import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['.next/**', 'coverage/**', 'public/**', 'next-env.d.ts'] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  prettier,
  {
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  { files: ['tools/**'], languageOptions: { globals: { console: 'readonly', process: 'readonly' } } },
  reactHooks.configs.flat['recommended-latest'],
  {
    // react-three-fiber mutates three.js objects inside the frame loop by design.
    files: ['src/components/{scene,characters}/**/*.tsx'],
    rules: { 'react-hooks/immutability': 'off' },
  },
);
