# English and Romanian

The React SPA uses i18next and react-i18next, with bundled English and Romanian JSON catalogs in `client/src/i18n/locales`. One small namespace loads synchronously so login and account pages do not flash translation keys or fetch translations after deployment. Components subscribe using `useTranslation`; presentation utilities and event handlers share the same initialized `t` function. Complete messages use interpolation; counts use i18next's CLDR plural rules, including Romanian one/few/other. React escapes interpolated content. Project descriptions, stages, notes, contact names and filenames remain user content.

The database stores `PortalUser.Language` as a string (`en` or `ro`). New and existing accounts default to `en`. Owner setup, activation and authenticated profile updates accept `language`; managers do not set language when creating users. Omitted profile/activation values preserve the existing preference. Explicit unsupported API values are rejected. `/auth/me`, the users list and activation metadata expose the preference. The frontend accepts only exact `ro`; every missing, null, empty or unsupported preference resolves to `en`, regardless of browser language. English is also the translation fallback.

Access pages always open in English. Anonymous visitors can switch the page language with English/Romanian flag buttons. This display choice never changes account preferences or enters the sign-in request. Setup and activation have a separate preferred-language form field, defaulting to English; only that field saves the account preference. Activation metadata does not change the display language. Signed-in users choose their language in account settings and save it with the existing password-confirmed profile form. Language changes retain form state, update `html[lang]`, and rerender components. Logout restores English. `Intl` formats displayed dates and sorts folder/file labels with the active locale; date inputs retain ISO values.

Folder identity and labels are independent of language. Schema and data upgrades must use explicit PostgreSQL SQL migrations through .NET; preserve folder IDs, permissions, descendants and file references. Storage/API names are exactly `.progress`, `.contracts`, `.warranty`, `.maintanance`, `.technicaldocs`. New projects and recovered section folders use the same names. Ordinary folders cannot use dot-prefixed reserved names. File Manager tiles, breadcrumbs, search and move/upload destinations translate labels by `sectionKey`, never by filename. Section keys remain `progress`, `contracts`, `warranty`, `maintenance`, `technical`.

Backend business exceptions use `new PortalException(status, code)` with no user-facing sentence. ASP.NET Core resolves Problem Details `detail` through `IStringLocalizer<PortalErrorMessages>` using `Resources/PortalErrorMessages.resx` (English fallback) and `Resources/PortalErrorMessages.ro.resx`. Keep both resource catalogs complete when adding an error code. The frontend sends the active display language in `Accept-Language`; the API supports English and Romanian (including regional variants) and defaults unsupported/missing languages to English. Query parameters and cookies do not override that header. Identity errors map to stable codes, validation errors retain their field names with localized values, and unexpected failures return a localized generic message while full details remain in server logs.

API errors expose stable Problem Details `code` values, translated through `client/src/services/api/errorMessages.ts`. Server wording can change without changing a code. Keep the Romanian-message fallback during mixed-version rollout; new codes should map to both catalogs. Validation arrays are translated per message before they are joined. Unknown server messages are preserved. When adding a UI message, add it to both catalogs and call `t` at render/action time (avoid evaluating it in module-level constants). Translation catalog parity/interpolation tests, preference fallback/component tests, database migration/API tests and desktop/mobile/Safari browser tests cover the behavior.

## Research

- [React integration and reactive translations](https://react.i18next.com/latest/usetranslation-hook)
- [Fallback language resolution](https://www.i18next.com/principles/fallback)
- [Complete messages and interpolation guidance](https://www.i18next.com/principles/best-practices)
- [Namespace organization](https://www.i18next.com/principles/namespaces)

For this small two-language SPA, bundled catalogs in one namespace are simpler than remote loading. Split catalogs into feature namespaces when their size or ownership warrants it.

## Message keys and interpolation

Use stable, descriptive English identifiers in code: `t("auth.signIn")`, `t("projects.create")`, `t("shell.welcomeUser", { name: user.displayName })`. Keep complete translated sentences in both JSON catalogs. Romanian sentences are translation values, not identifiers. A wording edit changes catalog values without renaming component references. The shared `TranslationKey` type is derived from the English catalog and includes the base names of plural keys; unknown literal keys fail TypeScript compilation.

Keys use a feature prefix (`auth`, `projects`, `files`, `account`) and a camelCase message name. Catalogs remain flat with literal dots (`keySeparator: false`); these prefixes organize ownership without adding remote namespace requests. Shared actions use `common`. Keep distinct keys for different meanings even when the English wording happens to match.

Interpolation placeholders are for runtime data, not replacement identifiers. Translate a complete message such as `"Welcome, {{name}}"`, not separately translated fragments joined in JSX. Counts use `{ count }` and matching `_one`, `_few`, `_other` forms for Romanian grammar. Photo gallery counts and accessibility labels follow the same rule. Keep placeholder names identical across locales. Language names intentionally use their native names; project names, filenames, notes, descriptions, and other user content are not translation keys.

The Romanian-message adapter remains a compatibility fallback. Prefer stable API codes mapped to `errors.*` keys; unknown codes fall back to validation details or server detail text.
