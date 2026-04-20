import { defineConfig } from 'vite-plus';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
  },
  lint: {
    options: {
      typeAware: true,
      typeCheck: true,
    },
    ignorePatterns: ['build/**', 'dist/**'],
  },
  fmt: {
    semi: true,
    singleQuote: true,
    ignorePatterns: ['package.json', 'CHANGELOG.md'],
  },
});
