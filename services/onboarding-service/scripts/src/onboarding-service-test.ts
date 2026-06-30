import { getOnboardingServiceBaseUrl } from "./lib/ssm";

type Check = {
  name: string;
  method?: string;
  path: string;
  body?: unknown;
  expectedStatus: number;
};

async function main() {
  const baseUrl = await getOnboardingServiceBaseUrl();
  const checks: Check[] = [
    {
      name: "public health allows anonymous access",
      path: "/public/health",
      expectedStatus: 200,
    },
    {
      name: "provider list allows anonymous access",
      path: "/public/providers",
      expectedStatus: 200,
    },
    {
      name: "association applications reject invalid public type",
      method: "POST",
      path: "/public/corporation-applications",
      body: {
        name: "Example Association",
        type: "ASSOCIATION",
        applicant_email: "applicant@example.com",
      },
      expectedStatus: 400,
    },
  ];

  for (const check of checks) {
    const response = await fetch(`${baseUrl}${check.path}`, {
      method: check.method ?? "GET",
      headers: check.body ? { "Content-Type": "application/json" } : undefined,
      body: check.body ? JSON.stringify(check.body) : undefined,
    });

    const passed = response.status === check.expectedStatus;
    console.log(
      `${passed ? "PASS" : "FAIL"} ${check.name} (expected ${check.expectedStatus}, got ${response.status})`,
    );

    if (!passed) {
      throw new Error(`${check.name} failed.`);
    }
  }

  console.log("Onboarding service public checks passed.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
