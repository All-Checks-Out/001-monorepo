# UI Testing

Playwright is used for browser-level UI testing.

```bash
pnpm run e2e-test:frontend
pnpm run e2e-test:frontend:verbose
pnpm run e2e-test:frontend:headed
pnpm run e2e-test:frontend:debug
```

Use `e2e-test:frontend:verbose` when you want to watch the browser test progress in the terminal.

Playwright files live under `ui-testing/playwright/`.

- `tests/`: UI test specs
- `helpers/`: shared test helpers
- `setup/`: Playwright global setup and teardown
- `scripts/`: local server startup scripts
- `results/`: Playwright test artifacts
- `report/`: Playwright HTML report
