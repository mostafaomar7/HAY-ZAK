# docs/design

Drop the exported Claude Design files here. This folder is the handoff point
between UI/UX and the Angular implementation.

## What to put here

| File | Screen | Implementation record |
| --- | --- | --- |
| `lessor-portal-spaces-requests.html` | بوابة المؤجر — المساحات والطلبات | — |
| `lessor-portal-login-account.html` | بوابة المؤجر — الدخول والحساب | — |
| `renter-interactive-prototype.html` | بوابة المستأجر — النموذج التفاعلي | [renter-plan.md](renter-plan.md) |
| `renter-design-system.html` | بوابة المستأجر — نظام التصميم | [renter-plan.md](renter-plan.md) |
| `admin-dashboard.html` | لوحة إدارة حيزك | [admin-plan.md](admin-plan.md) |

Export every page of the design, one file per page, kebab-case names. Keep the
original `<style>` block intact — do not tidy or reformat it. The exact colour,
spacing and radius values are what get lifted into
[_tokens.scss](../../src/styles/themes/_tokens.scss) and the shared components.

## Why the files live in the repo

Claude Code cannot open `claude.ai/design/...` links: it runs as a local process
with no browser session, so the design surface returns 403. Committing the export
also pins the design the code was actually built against, which makes a later
visual regression reviewable in a diff.

## Not for production

Nothing in this folder is bundled — it sits outside `src/`, so the build never
sees it. It is reference material only.
