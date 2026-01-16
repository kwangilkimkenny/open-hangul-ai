/**
 * Commitlint Configuration
 * Enforces Conventional Commits specification
 *
 * @see https://commitlint.js.org
 * @see https://www.conventionalcommits.org
 */

export default {
  extends: ['@commitlint/config-conventional'],

  rules: {
    // Type enum: allowed commit types
    'type-enum': [
      2,
      'always',
      [
        'feat', // New feature
        'fix', // Bug fix
        'docs', // Documentation only
        'style', // Code style (formatting, semicolons, etc)
        'refactor', // Code refactoring
        'perf', // Performance improvement
        'test', // Adding or updating tests
        'build', // Build system or external dependencies
        'ci', // CI/CD configuration
        'chore', // Other changes that don't modify src or test files
        'revert', // Revert previous commit
      ],
    ],

    // Subject case: lowercase
    'subject-case': [2, 'never', ['start-case', 'pascal-case', 'upper-case']],

    // Subject max length
    'subject-max-length': [2, 'always', 100],

    // Subject min length
    'subject-min-length': [2, 'always', 10],

    // Subject empty
    'subject-empty': [2, 'never'],

    // Body max line length
    'body-max-line-length': [2, 'always', 100],

    // Body leading blank (require blank line before body)
    'body-leading-blank': [2, 'always'],

    // Footer leading blank (require blank line before footer)
    'footer-leading-blank': [2, 'always'],
  },
};
