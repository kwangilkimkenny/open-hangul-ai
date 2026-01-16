/**
 * Lint-Staged Configuration
 * Run linters and formatters on staged files
 *
 * @see https://github.com/lint-staged/lint-staged
 */

export default {
  // TypeScript and JavaScript files
  '*.{ts,tsx,js,jsx}': ['prettier --write', 'eslint --fix --max-warnings=0'],

  // JSON files
  '*.json': ['prettier --write'],

  // Markdown files
  '*.md': ['prettier --write'],

  // CSS files
  '*.css': ['prettier --write'],

  // YAML files
  '*.{yml,yaml}': ['prettier --write'],
};
