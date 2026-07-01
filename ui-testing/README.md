# UI Testing

Playwright is used for browser-level UI testing.

```bash
pnpm run test:ui
pnpm run test:ui:headed
pnpm run test:ui:debug
```

Playwright files live under `ui-testing/playwright/`.

- `tests/`: UI test specs
- `helpers/`: shared test helpers
- `setup/`: Playwright global setup and teardown
- `scripts/`: local server startup scripts
- `results/`: Playwright test artifacts
- `report/`: Playwright HTML report
