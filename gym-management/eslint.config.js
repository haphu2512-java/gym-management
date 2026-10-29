import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      // Các trang tải dữ liệu bằng useEffect(() => { loadData() }, [...]): mẫu hợp lệ cho
      // dự án không dùng thư viện data-fetching, nên tắt luật của React Compiler này.
      'react-hooks/set-state-in-effect': 'off',
    },
  },
])
