#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

const root = process.cwd();
const guidePath = path.join(
  root,
  "docs",
  "code-review",
  "claude-review-guide.md",
);
const standardsPath = path.join(
  root,
  "docs",
  "code-review",
  "package-and-review-standards.md",
);
const reviewDir = path.join(root, "docs", "code-review", "claude-reviews");
const claudeBin = process.env.CLAUDE_BIN || "claude";
const maxSourceBytes = Number(
  process.env.CLAUDE_REVIEW_MAX_SOURCE_BYTES || 350000,
);
const timeoutMs = Number(process.env.CLAUDE_REVIEW_TIMEOUT_MS || 600000);
const excludedParts = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  "cdk.out",
  ".env",
]);
const includedExtensions = new Set([
  ".css",
  ".html",
  ".json",
  ".md",
  ".mjs",
  ".sh",
  ".sql",
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".yaml",
  ".yml",
]);

function usage() {
  console.log(`Usage:
  pnpm run claude:review -- <step-id>
  pnpm run claude:review -- --smoke
  pnpm run claude:review -- --list`);
}

function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, encoding: "utf8" });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      result.stderr.trim() || `${command} ${args.join(" ")} failed`,
    );
  }
  return result.stdout.trim();
}

function runClaude(prompt, label) {
  const result = spawnSync(claudeBin, ["-p", "--tools=", prompt], {
    cwd: root,
    encoding: "utf8",
    timeout: timeoutMs,
  });

  if (result.error) {
    if (result.error.code === "ENOENT") {
      throw new Error(
        `Could not find Claude CLI executable "${claudeBin}". Install Claude CLI on PATH, or run with CLAUDE_BIN=/absolute/path/to/claude.`,
      );
    }
    throw result.error;
  }
  if (result.signal) {
    throw new Error(
      `Claude ${label} exited after receiving ${result.signal}. It may have timed out after ${timeoutMs}ms. No output file was written.`,
    );
  }
  if (result.status !== 0) {
    const stderr = result.stderr.trim();
    const stdout = result.stdout.trim();
    const output = [stderr, stdout].filter(Boolean).join("\n");
    throw new Error(
      output ||
        `Claude ${label} failed with exit status ${result.status}. No output file was written.`,
    );
  }

  return result;
}

function readRequired(filePath) {
  if (!existsSync(filePath)) throw new Error(`Missing file: ${filePath}`);
  return readFileSync(filePath, "utf8");
}

function listStepIds(guide) {
  return [...guide.matchAll(/^### (\d{4}) (.+)$/gm)].map((match) => ({
    id: match[1],
    title: match[2],
  }));
}

function stepSection(guide, stepId) {
  const match = guide.match(new RegExp(`^### ${stepId} .*$`, "m"));
  if (!match || match.index === undefined) return "";
  const start = match.index;
  const rest = guide.slice(start + match[0].length);
  const next = rest.search(/^### \d{4} /m);
  return guide
    .slice(start, next === -1 ? undefined : start + match[0].length + next)
    .trim();
}

function extractFileEntries(section) {
  const match = section.match(/\nFiles:\n\n([\s\S]*?)\n\nFocus:/);
  if (!match) return [];
  return match[1]
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2).replaceAll("`", "").trim());
}

function findFilesByName(directory, fileName) {
  const absolute = path.resolve(root, directory);
  if (!existsSync(absolute) || excludedParts.has(path.basename(absolute)))
    return [];
  if (!statSync(absolute).isDirectory()) return [];

  return readdirSync(absolute, { withFileTypes: true })
    .flatMap((entry) => {
      if (excludedParts.has(entry.name)) return [];
      const child = path.join(absolute, entry.name);
      if (entry.isDirectory())
        return findFilesByName(path.relative(root, child), fileName);
      return entry.isFile() && entry.name === fileName ? [child] : [];
    })
    .sort();
}

function expandFileEntries(entries) {
  return entries.flatMap((entry) => {
    if (entry === "whole repo, excluding generated/local-only files")
      return ["."];
    if (entry === "root and package package.json files") {
      return findFilesByName(".", "package.json").map((file) =>
        path.relative(root, file),
      );
    }
    return [entry];
  });
}

function shouldInclude(filePath) {
  return includedExtensions.has(path.extname(filePath));
}

function walk(entryPath) {
  const absolute = path.resolve(root, entryPath);
  if (!existsSync(absolute) || excludedParts.has(path.basename(absolute)))
    return [];
  const stat = statSync(absolute);
  if (stat.isDirectory()) {
    return readdirSync(absolute)
      .flatMap((child) => walk(path.relative(root, path.join(absolute, child))))
      .sort();
  }
  return stat.isFile() && shouldInclude(absolute) ? [absolute] : [];
}

function readSourceExcerpt(entries) {
  let remaining = maxSourceBytes;
  const sections = [];
  const seen = new Set();

  for (const entry of entries) {
    const files = walk(entry);
    if (files.length === 0) {
      sections.push(
        `## ${entry}\n\nNot found or no reviewable source files matched.`,
      );
      continue;
    }

    for (const file of files) {
      const relative = path.relative(root, file);
      if (seen.has(relative)) continue;
      seen.add(relative);

      if (remaining <= 0) {
        sections.push("Source excerpt limit reached; remaining files omitted.");
        return sections.join("\n\n");
      }

      const content = readFileSync(file, "utf8");
      const excerpt = content.slice(0, remaining);
      remaining -= Buffer.byteLength(excerpt, "utf8");
      sections.push(
        `## ${relative}\n\n\`\`\`${path.extname(file).slice(1) || "text"}\n${excerpt}\n\`\`\``,
      );

      if (excerpt.length < content.length) {
        sections.push(`File ${relative} was truncated at the review limit.`);
        remaining = 0;
      }
    }
  }

  return sections.join("\n\n");
}

function nextRunPath(stepId) {
  mkdirSync(reviewDir, { recursive: true });
  const prefix = `step-${stepId}-run-`;
  const runs = readdirSync(reviewDir)
    .map((name) => name.match(new RegExp(`^${prefix}(\\d{2})\\.md$`)))
    .filter(Boolean)
    .map((match) => Number(match[1]));
  const next = Math.max(0, ...runs) + 1;
  return path.join(reviewDir, `${prefix}${String(next).padStart(2, "0")}.md`);
}

const args = process.argv.slice(2).filter((arg) => arg !== "--");
const guide = readRequired(guidePath);
const isSmoke = args.includes("--smoke");

if (args.includes("--help") || args.includes("-h")) {
  usage();
  process.exit(0);
}

if (isSmoke) {
  mkdirSync(reviewDir, { recursive: true });
  const outputPath = path.join(reviewDir, "smoke-test.md");
  const prompt = `Return exactly this single line and nothing else:
Claude review smoke test ok.`;

  console.error(
    `Writing Claude smoke test to ${path.relative(root, outputPath)}`,
  );

  const review = runClaude(prompt, "smoke test");

  const output = review.stdout.trim();
  const errorOutput = review.stderr.trim();
  const smokeText = `# Claude Review Smoke Test

- Reviewed at: ${new Date().toISOString()}
- Command: \`pnpm run claude:review -- --smoke\`

## Smoke Output

${output || "(Claude produced no stdout.)"}
${errorOutput ? `\n## Smoke Stderr\n\n\`\`\`text\n${errorOutput}\n\`\`\`\n` : ""}
`;

  writeFileSync(outputPath, smokeText);

  if (output) console.log(output);
  if (errorOutput) console.error(errorOutput);

  process.exit(review.status ?? 1);
}

if (args.includes("--list")) {
  for (const step of listStepIds(guide))
    console.log(`${step.id} ${step.title}`);
  process.exit(0);
}

const stepId = args[0] || process.env.CLAUDE_REVIEW_STEP;
if (!stepId) {
  usage();
  process.exit(1);
}

const section = stepSection(guide, stepId);
if (!section)
  throw new Error(
    `No review step ${stepId} found in docs/code-review/claude-review-guide.md`,
  );

const fileEntries = expandFileEntries(extractFileEntries(section));
if (fileEntries.length === 0) {
  throw new Error(
    `Review step ${stepId} has no parsed file entries. Check the Files/Focus formatting in docs/code-review/claude-review-guide.md.`,
  );
}

const sourceExcerpt = readSourceExcerpt(fileEntries);
const status = run("git", ["status", "--short"]);
const branchName = run("git", ["rev-parse", "--abbrev-ref", "HEAD"]);
if (branchName !== "main") {
  throw new Error(
    `Claude reviews must run on main. Current branch is ${branchName}.`,
  );
}
const outputPath = nextRunPath(stepId);
const standards = existsSync(standardsPath)
  ? readFileSync(standardsPath, "utf8")
  : "(No package/review standards document found.)";

const prompt = `Review repo using only the context in this prompt.

Do not use tools. Do not inspect memory. Do not ask for permission. Do not describe what you would do next.
All source material needed for this bounded review is included below.
Return the final review now.

This repo is the current module-federation codebase being hardened incrementally. This is not a rebuild review.

Repository root: ${root}
Current git branch: ${branchName}
Review step: ${stepId}

Read and obey the rules, design goals, workflow, and selected review step from this guide:

${guide}

Additional package and review standards:

${standards}

Selected review step:

${section}

Git status:
${status || "(clean)"}

Bounded source excerpts from the files listed for this step:

${sourceExcerpt || "(No source excerpts available.)"}

Return:
- Findings first, ordered by severity. Include only actual defects, risks, or reviewable concerns in Findings.
- For each finding, include classification: blocking, recommended, optional, or probably not worth fixing.
- Include concrete file/line references where possible.
- Prefer specific defect/risk findings over broad style advice.
- For UI review, report user-visible layout, sizing, behaviour, accessibility, and consistency issues against this repository's current UX guidance.
- Do not recommend unused props, compatibility shims, legacy redirects, abstractions, or configurability without a concrete current need in this repository.
- Prefer clean current code over preserving legacy behaviour. Treat unexplained old routes, aliases, shims, fallback paths, or migration leftovers as review concerns unless Richard explicitly asked to keep them.
- Do not turn missing source excerpts or review-context gaps into findings. Put them under review limitations unless the provided source proves a concrete defect.
- Put confirmed-good checks, intentional architecture decisions, and explanatory notes outside Findings.
- Explicitly say if there are no findings.
- Then include test gaps and review limitations.
- Do not recommend reviewing unrelated steps.
- Do not recommend rerunning Claude after fixes unless there is a specific high-risk reason.`;

console.error(`Writing Claude review to ${path.relative(root, outputPath)}`);

const review = runClaude(prompt, "review");

const runNumber =
  path.basename(outputPath).match(/run-(\d{2})\.md$/)?.[1] || "unknown";
const reviewedAt = new Date().toISOString();
const output = review.stdout.trim();
const errorOutput = review.stderr.trim();
const reviewText = `# Claude Review: Step ${stepId}, Run ${runNumber}

- Current git branch: \`${branchName}\`
- Reviewed at: ${reviewedAt}
- Command: \`pnpm run claude:review -- ${stepId}\`

## Review Step

${section}

## Review Output

${output || "(Claude produced no stdout.)"}
${errorOutput ? `\n## Review Stderr\n\n\`\`\`text\n${errorOutput}\n\`\`\`\n` : ""}
`;

writeFileSync(outputPath, reviewText);

if (output) console.log(output);
if (errorOutput) console.error(errorOutput);

process.exit(review.status ?? 1);
