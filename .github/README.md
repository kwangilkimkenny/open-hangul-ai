# GitHub Actions Workflows

This directory contains CI/CD workflows for the HAN-View React App project.

## Available Workflows

### 1. CI/CD Pipeline (`ci.yml`)

**Triggers:** Push/PR to `main` or `develop` branches

**Jobs:**
- **lint-and-typecheck**: Runs TypeScript compiler and ESLint
- **build-and-test**: Builds production bundle and runs tests
- **security-audit**: Performs npm security audit
- **bundle-analysis**: Analyzes bundle size and performance metrics (main branch only)

**What it checks:**
- ✅ TypeScript compilation (no errors)
- ✅ ESLint rules (warnings allowed)
- ✅ Unit tests execution
- ✅ Production build success
- ✅ Security vulnerabilities (critical = fail)
- ✅ Bundle size analysis

### 2. GitHub Pages Deployment (`deploy.yml`)

**Triggers:** Push to `main` branch, manual workflow dispatch

**What it does:**
- Builds production bundle
- Deploys to GitHub Pages
- Provides deployment URL

**Requirements:**
- GitHub Pages must be enabled in repository settings
- Pages source should be set to "GitHub Actions"

### 3. Pull Request Checks (`pr-check.yml`)

**Triggers:** PR opened/updated

**What it does:**
- Runs comprehensive validation checks
- Posts detailed status comment on PR
- Reports bundle size and warnings
- Provides quick feedback to contributors

**Status Comment Includes:**
- TypeScript status
- ESLint status
- Test results
- Build status
- Bundle size metrics

## Setup Instructions

### 1. Enable Workflows

Workflows are automatically enabled when pushed to GitHub. No additional configuration needed.

### 2. Enable GitHub Pages (Optional)

For the deployment workflow to work:

1. Go to repository **Settings** → **Pages**
2. Under "Build and deployment":
   - Source: **GitHub Actions**
3. Save changes

### 3. Configure Secrets (If Needed)

For custom deployments or integrations:

1. Go to repository **Settings** → **Secrets and variables** → **Actions**
2. Add required secrets:
   - `DEPLOY_TOKEN` (if deploying to external service)
   - `SLACK_WEBHOOK` (if using Slack notifications)

## Workflow Status Badges

Add these badges to your README.md:

```markdown
![CI/CD](https://github.com/YOUR_USERNAME/hanview-react-app-v3/workflows/CI%2FCD%20Pipeline/badge.svg)
![Deploy](https://github.com/YOUR_USERNAME/hanview-react-app-v3/workflows/Deploy%20to%20GitHub%20Pages/badge.svg)
```

## Local Testing

Test workflows locally using [act](https://github.com/nektos/act):

```bash
# Install act
brew install act

# Run CI workflow
act push -W .github/workflows/ci.yml

# Run PR check
act pull_request -W .github/workflows/pr-check.yml
```

## Maintenance

### Updating Node.js Version

All workflows use Node.js 20. To update:

1. Edit all workflow files
2. Change `node-version: '20'` to desired version
3. Test locally before pushing

### Adding New Jobs

1. Edit the appropriate workflow file
2. Add new job under `jobs:`
3. Use `needs: [previous-job]` for dependencies
4. Test with `act` before pushing

## Troubleshooting

### Workflow Fails on npm ci

**Solution:** Delete `package-lock.json` and run `npm install` locally, then commit the new lock file.

### TypeScript Errors in CI

**Solution:** Run `npx tsc --noEmit` locally to see errors. Fix them before pushing.

### Deploy Workflow Not Running

**Solution:** Check that GitHub Pages is enabled and source is set to "GitHub Actions".

### Bundle Size Warnings

**Solution:** Review bundle analysis output and optimize:
- Use lazy loading for large features
- Check for duplicate dependencies
- Use production build optimizations

## Performance Targets

- **Initial Load:** < 500 KB (gzipped)
- **Total Bundle:** < 1.5 MB
- **Build Time:** < 2 minutes
- **Test Time:** < 1 minute

## Contact

For issues with workflows, open an issue in the repository or contact the maintainers.
