import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // legacy/ is the old prebuilt MagicB bundle kept for reference only; it is
  // not part of the Vite build (see vite.config.js) and is not maintained.
  globalIgnores(['dist', 'legacy']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      // ESLint 9's scope analysis does not count JSX member expressions such as
      // <motion.div> as references, so framer-motion's lowercase `motion`
      // namespace is also exempted (capitalised names cover components).
      'no-unused-vars': ['error', { varsIgnorePattern: '^(?:[A-Z_]|motion$)' }],
    },
  },
])
