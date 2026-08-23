# core

App-wide singletons, loaded once. Nothing here renders.

- `services/` — injectable singletons (`providedIn: 'root'`)
- `interceptors/` — functional HTTP interceptors, registered in `app.config.ts`
- `guards/` — functional route guards
- `models/` — API contracts and domain interfaces
- `enums/` — shared enumerations
- `constants/` — endpoints, storage keys, regexes, magic numbers
- `utils/` — pure functions with no Angular dependency

Rule: `core` never imports from `features`.
