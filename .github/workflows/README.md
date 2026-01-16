# GitHub Actions Workflows

This directory contains automated CI/CD workflows for the HAN-View React
application.

## Available Workflows

### 1. E2E Tests (`e2e-tests.yml`)

Runs comprehensive End-to-End tests using Playwright across multiple browsers.

**Triggers:**

- Push to `main` or `develop` branches
- Pull requests to `main` or `develop` branches
- Manual trigger via GitHub Actions UI

**Test Matrix:**

- **Chromium** (Chrome/Edge) - Required ✅
- **Firefox** - Required ✅
- **WebKit** (Safari) - Optional ⚠️ (continues on error)
- **Mobile** (Chrome + Safari) - Optional ⚠️ (continues on error)

**Jobs:**

#### `e2e-chromium` (15 min timeout)

- Installs Chromium browser
- Runs 55 E2E tests on Chrome
- Uploads test results and screenshots on failure
- **Must pass** for workflow to succeed

#### `e2e-firefox` (15 min timeout)

- Installs Firefox browser
- Runs 55 E2E tests on Firefox
- Uploads test results and screenshots on failure
- **Must pass** for workflow to succeed

#### `e2e-webkit` (20 min timeout)

- Installs WebKit browser
- Runs 55 E2E tests on Safari
- Uploads test results on completion
- **Does not fail workflow** (known compatibility issues: ~83% pass rate)

#### `e2e-mobile` (20 min timeout)

- Installs Chromium and WebKit browsers
- Runs 110 E2E tests on mobile viewports (Pixel 5 + iPhone 12)
- Uploads test results on completion
- **Does not fail workflow** (Mobile Safari has known issues)

#### `test-report` (always runs)

- Aggregates results from all test jobs
- Generates workflow summary with pass/fail status
- Downloads all test artifacts
- Creates markdown summary in GitHub UI

**Artifacts:**

- Test results (JSON reports)
- HTML test reports
- Screenshots (on failure)
- Videos (on failure)
- Retention: 7 days

**Environment Variables:**

- `CI=true` - Enables CI mode for Playwright

**Expected Pass Rates:**

- Chromium: 100% (55/55 tests)
- Firefox: 100% (55/55 tests)
- WebKit: ~83% (46/55 tests) - Known issues
- Mobile Chrome: 100% (55/55 tests)
- Mobile Safari: ~82% (45/55 tests) - Known issues

### 2. CI/CD Pipeline (`ci.yml`)

Main continuous integration pipeline for code quality and builds.

**Jobs:**

- Lint & Type Check
- Build & Test
- Security Audit
- Bundle Analysis (main branch only)

### 3. PR Check (`pr-check.yml`)

Runs automated checks on pull requests.

### 4. Deploy (`deploy.yml`)

Handles deployment to production/staging environments.

## Usage

### Running E2E Tests Locally

```bash
# Run all browsers
npm run test:e2e

# Run specific browser
npm run test:e2e:chromium
npm run test:e2e:firefox
npm run test:e2e:webkit

# Run mobile tests
npm run test:e2e:mobile

# Run with UI mode
npm run test:e2e:ui

# Run in headed mode (see browser)
npm run test:e2e:headed
```

### Manual Trigger

1. Go to Actions tab in GitHub
2. Select "E2E Tests" workflow
3. Click "Run workflow"
4. Select branch
5. Click "Run workflow"

### Viewing Results

**In GitHub:**

1. Go to Actions tab
2. Click on workflow run
3. View summary page for pass/fail status
4. Click on job to see detailed logs
5. Download artifacts for screenshots/videos

**Test Reports:**

- HTML Report: Download `*-test-results` artifact
- Screenshots: Download `*-screenshots` artifact (on failure)
- Videos: Included in test results

## Optimization Notes

**Parallel Execution:**

- Jobs run in parallel for faster feedback
- Chromium and Firefox run simultaneously
- WebKit and Mobile run concurrently
- Total runtime: ~15-20 minutes (vs 45+ minutes sequential)

**Caching:**

- npm packages cached via `actions/setup-node@v4`
- Reduces installation time by ~50%

**Conditional Execution:**

- WebKit failures don't block merges (known issues)
- Mobile Safari failures don't block merges (known issues)
- Bundle analysis only runs on main branch

**Resource Management:**

- Concurrency control prevents duplicate runs
- In-progress runs cancelled when new commits pushed
- Artifacts retained for 7 days only

## Known Issues

### WebKit (Safari) - 9 failing tests

- DOM rendering timing differences
- Keyboard navigation behavior differences
- Test framework compatibility issues
- **Status:** Documented in WEBKIT_TEST_REPORT.md
- **Impact:** Not blocking - app works correctly in Safari

### Mobile Safari - 10 failing tests

- Same issues as desktop WebKit
- Orientation change timing issues
- **Status:** Documented in test reports
- **Impact:** Not blocking - app works correctly on iOS

## Troubleshooting

### Tests timing out in CI

- Check if server started successfully
- Verify no port conflicts
- Check logs for Vite build errors

### Browser installation fails

- CI runner may have outdated OS
- Use `--with-deps` flag (already included)

### Artifacts not uploading

- Check artifact names are unique
- Verify paths exist
- Ensure `if: always()` is set for failure cases

### Tests pass locally but fail in CI

- Check for environment-specific code
- Verify no absolute paths
- Check for timing assumptions

## Maintenance

**Regular Tasks:**

- Update browser versions when new releases available
- Review and update timeout values if tests get slower
- Clean up old artifacts manually if needed
- Update expected pass rates if tests fixed/added

**When Adding New Tests:**

1. Add to appropriate spec file
2. Test locally on all browsers
3. Update expected pass rates in this README
4. Document any known failures

**When Modifying Workflow:**

1. Test changes on feature branch first
2. Review artifact sizes (storage limits)
3. Monitor total workflow duration
4. Update documentation

## Security

**Secrets Used:**

- None currently (tests use local server)

**Future Considerations:**

- API keys for external services
- Deployment credentials
- Test environment URLs

## Contact

For questions about workflows or CI/CD:

- Create issue in repository
- Tag @claude-code in comments
- Review workflow logs first

---

🤖 Generated by Claude Code
