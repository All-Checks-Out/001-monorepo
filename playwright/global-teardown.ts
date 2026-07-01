async function globalTeardown() {
  // Playwright owns the configured webServer process; no extra teardown is needed.
}

export default globalTeardown;
