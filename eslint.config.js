import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  { ignores: ['dist', 'dist-shots', 'shots', 'node_modules'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    files: ['src/sim/**/*.ts'],
    rules: {
      // The simulation must stay deterministic and independent of rendering and UI.
      'no-restricted-imports': ['error', { patterns: ['**/render/*', '**/ui/*', 'pixi.js'] }],
      'no-restricted-properties': ['error', { object: 'Math', property: 'random', message: 'Sim must be deterministic.' }],
    },
  },
);
