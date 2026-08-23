# shared

Reusable presentational building blocks, imported by many features.

- `components/` — dumb/standalone UI components (inputs, tables, modals)
- `directives/` — reusable DOM behaviour
- `pipes/` — display transforms
- `validators/` — reactive-form validators
- `models/` — view models used only by shared components

Rules: no business logic, no direct HTTP calls, no imports from `features`.
