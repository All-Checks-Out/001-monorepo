class VerboseReporter {
  onBegin(_config, suite) {
    const tests = suite.allTests();
    this.total = tests.length;
    this.current = 0;
    this.stdout(`Running ${this.total} Playwright UI tests\n`);

    if (process.argv.includes("--list")) {
      for (const test of tests) {
        this.stdout(`  ${test.titlePath().slice(1).join(" > ")}\n`);
      }
    }
  }

  onTestBegin(test) {
    this.current += 1;
    this.stdout(`\n[${this.current}/${this.total}] ${test.title}\n`);
  }

  onStepBegin(_test, _result, step) {
    if (step.category !== "test.step") return;

    const depth = Math.max(step.titlePath().length - 1, 0);
    this.stdout(`${"  ".repeat(depth + 1)}- ${step.title}\n`);
  }

  onTestEnd(test, result) {
    const status = result.status === test.expectedStatus ? "passed" : result.status;
    this.stdout(`  ${status}: ${test.title} (${result.duration}ms)\n`);

    if (status !== "passed") {
      for (const error of result.errors) {
        const location = error.location
          ? `${error.location.file}:${error.location.line}:${error.location.column}`
          : "";
        this.stdout(`    ${location}\n`);
        this.stdout(`    ${error.message ?? String(error)}\n`);
      }
    }
  }

  onEnd(result) {
    this.stdout(`\nPlaywright UI tests ${result.status}\n`);
  }

  stdout(message) {
    process.stdout.write(message);
  }
}

module.exports = VerboseReporter;
