# Frontend coding style

The frontend uses TypeScript, React function components, ESLint, and Prettier. Keep style decisions in the checked-in tools so contributors and CI apply the same rules.

## Everyday commands

Run from `client`:

- `npm run format`: apply import sorting, spacing and lint fixes, then format source, tests, styles, HTML, and configuration.
- `npm run lint`: check TypeScript/JavaScript quality, React Hook call rules, import order, braces, and statement spacing.
- `npm run format:check`: check Prettier formatting without writing files.
- `npm run check`: run lint, formatting, component tests, and the production build.
- `npm run test:e2e`: exercise the browser workflows.

The workspace recommends the ESLint, Prettier, and EditorConfig extensions. Format on save and explicit ESLint save fixes use the `client` configuration. CI checks lint and formatting before building.

## Layout

Use two spaces, double quotes, semicolons, trailing commas, LF endings, and a 100-column print width. Prettier handles line wrapping; do not manually align declarations with spaces. Keep one variable declaration per statement and braces around every conditional and loop body.

Sort imports with ESLint: side effects first, packages next, local imports last, with a blank line between groups and after the import block. Use type-only imports for TypeScript contracts. Separate function declarations and exported declarations with a blank line. Separate a return from preceding logic and leave space after completed control-flow blocks. Preserve small related declarations together rather than inserting blank lines after every line.

Name components and types in PascalCase, hooks with `use`, functions and local values in camelCase. Prefer clear names over abbreviations when adding or substantially changing code. Keep components at module scope. Derive values from current props/server data rather than synchronizing duplicate state through effects. Use effects for external synchronization and event handlers for user actions.

## Responsibilities

`app` composes the shell and screens, `pages` renders individual screens, `components` contains reusable UI/forms, `logic` coordinates workflows and derived project views, and `services/api` owns HTTP and endpoint contracts. Keep backend DTO types in `types`. Preserve authorization and stale-response guards during refactoring. Do not translate user-provided data.

Portal state is grouped by owner: `session`, `projects`, `project`, `people`, `navigation`, and `feedback`. Feature hooks own their records and async response guards. Prefer named actions such as `projects.selectClient(id)` over coordinating setters in a component. Keep `usePortal` limited to composition and cross-feature transitions. `feedback.run` has no automatic data refresh; use the feature action responsible for the changed records. See the state-ownership table in [architecture](architecture.md).

See [localization](localization.md) for typed semantic keys, complete messages, interpolation, plural forms, and the API error compatibility boundary.

## API ownership

Import endpoint services directly from their feature module in `src/services/api`: `auth`, `users`, `projects`, `progress`, `files`, `notes`, or `maintenance`. Authentication owns session and profile calls; users owns `/admin/users` account management; projects owns project metadata and client selection; progress owns stages, milestones, activity, and read status. Files owns folder and document operations.

Keep request serialization, credentials, headers, and error translation in `http.ts` and `errorMessages.ts`. Feature modules describe endpoint paths and payloads without duplicating transport behavior. Keep endpoint-specific types next to their service and shared domain DTOs in `types`. Avoid an API barrel: direct imports make dependencies visible and preserve feature boundaries. Backend controllers already follow these domain boundaries.

## Stylesheet ownership

Import a component or page's stylesheet at the top of its TSX module: `CalendarPage.tsx` imports `./CalendarPage.css`. Keep its layout, responsive rules, and interaction states together in that file. A component without owned styles does not need an empty CSS file. Async pages and dialogs bring their CSS with their Vite chunks.

`src/styles/global.css` is the only app-wide stylesheet entry point. It imports `tokens.css` (theme colors and typography), `base.css` (resets and element defaults), and `shared.css` (reused surfaces, form layouts, status messages, utilities, and animation). Shared controls such as Button, Field, Modal, and Logo own their CSS next to their components. Layout-specific variants belong to the layout/page that applies them.

Co-location provides ownership, not selector isolation: ordinary CSS remains global. Keep selectors rooted in the owning component's class, avoid unqualified element selectors in component files, and scope variants explicitly (for example `.page-heading.maintenance-heading h1`) instead of relying on stylesheet load order. For new components that require generated local class names, Vite also supports `Component.module.css`; use it deliberately rather than mixing global overrides into a module.

When moving rules, preserve responsive conditions, focus states, reduced-motion behavior, and modal variants. Verify computed styles/screenshots at desktop and mobile sizes as well as the production build; a moved rule can change the cascade even when its declarations are unchanged.

## References

- [Prettier configuration](https://prettier.io/docs/configuration)
- [Prettier rationale, including blank-line preservation](https://prettier.io/docs/rationale.html)
- [TypeScript ESLint shared configurations](https://typescript-eslint.io/users/configs/)
- [ESLint Stylistic spacing rules](https://eslint.style/rules/padding-line-between-statements)
- [i18next complete-message guidance](https://www.i18next.com/principles/best-practices)

## Typography

The app uses installed fonts through a native stack headed by `system-ui`, followed by Apple system fonts, Segoe UI, Roboto, Helvetica Neue, Noto Sans, Liberation Sans, Arial, and `sans-serif`. No font files, preloads, external font services, or `@font-face` rules are required. Each device uses its available interface font; exact glyph shapes and metrics can vary across operating systems while the size hierarchy stays consistent.

Use the semantic tokens in `tokens.css`. Keep the root at the browser's preferred size (normally 16px), including on QHD and 4K screens. Layout responds to available space; interface text retains its compact proportions.

| Role | Token | Default size |
| --- | --- | --- |
| Dates and secondary metadata | `--text-caption` | 12px |
| Form labels and helper text | `--text-label` | 12.5px |
| Navigation, buttons, file names | `--text-ui` | 13px |
| Descriptions, note bodies, activity text | `--text-body` | 15px |
| Compact card titles | `--text-heading-sm` | 17px |
| Section and activity titles | `--text-section` | 18px |
| Dialog headings | `--text-heading` | 22px |
| Page titles | `--text-page` | 28px, 24px on mobile |

Use weights 400 for reading text, 500 for labels, and 600 for controls and headings. Reading text uses 1.65 line height and a 68ch maximum line length; headings use 1.25 line height and modest proportional tracking. Form inputs use `--text-input` at 16px to preserve readability and avoid input-focus zoom. Controls retain comfortable touch targets. Notes remain equal-height previews with full content available in their dialogs.

Verify the inherited system stack, absence of font network requests, English and Romanian glyphs, small phones, laptops, QHD, 4K, and 200% text enlargement. Avoid fixed pixel font sizes, CSS zoom, and transforms for text scaling. Preserve normal scrolling when extra content or the on-screen keyboard reduces the available height.

Research: [Bootstrap’s native font stack](https://getbootstrap.com/docs/5.3/content/reboot/#native-font-stack) and [MDN font-family selection](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/font-family), [Carbon's productive and reading type styles](https://www.carbondesignsystem.com/building-blocks/foundations/typography/type-sets), [W3C text resizing](https://www.w3.org/WAI/WCAG21/Understanding/resize-text), and [W3C reflow guidance](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html).
