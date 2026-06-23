import babelParser from '@babel/eslint-parser';
// eslint-disable-next-line import/no-unresolved
import { defineConfig } from 'eslint/config';
import {
  jsConfig,
  reactConfig,
} from 'eslint-presets';
import globals from 'globals';


const customConfig = {
  name: 'project-custom-config',
  ignores: ['node_modules/**', 'build/**', 'coverage/**'],
  files: ['**/*.mjs', '**/*.js', '**/*.jsx'],
  languageOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    parser: babelParser,
    parserOptions: {
      ecmaFeatures: {
        jsx: true,
        spread: true,
      },
    },
    globals: {
      ...globals.jest,
      ...globals.serviceworker,
      ...globals.browser,
      ...globals.node,
      ...globals.commonjs,
    },
  },
  settings: {
    react: { version: '19' },
    'import/resolver': {
      node: {
        extensions: ['.js', '.jsx'],
      },
    },
  },
  linterOptions: {
    reportUnusedDisableDirectives: true,
  },
};

export default defineConfig([
  customConfig,
  jsConfig,
  reactConfig,
  {
    rules: {
      eqeqeq: 0,
    },
  },
]);
