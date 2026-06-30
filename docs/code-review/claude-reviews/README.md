# Claude Review Artifacts

Files in this directory are generated review artifacts from current review runs.
They are working notes, not architecture source of truth.

Before acting on any review finding, read:

```text
docs/architecture/module-federation.md
docs/architecture/frontend-package-layout.md
docs/code-review/claude-review-guide.md
docs/code-review/package-and-review-standards.md
```

If a review finding conflicts with the current architecture documents, the
current architecture documents win. In particular, review artifacts must not be
used to reintroduce core-as-root routing, unprefixed core URLs, compatibility
redirects, shell-owned remote route maps, or shared route-map packages.

Review artifacts must also not be used to preserve historic internal code for
legacy reasons. This repository is in active development; old routes, old
package exports, old import paths, aliases, wrappers, redirects, and fallback
code should be deleted when they no longer match the best current architecture,
unless Richard explicitly names a temporary compatibility window.
