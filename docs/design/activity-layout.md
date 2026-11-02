# Dashboard updates and progress journal

The Dashboard uses a compact vertical timeline in its existing updates area: a quiet connecting rule, an orange latest-post marker, date/stage metadata, a title, a short expandable description, and photo previews. This preserves the three recent updates and the current dashboard column layout.

Progres și foto uses a single-column photo journal. Each activity has a white bordered surface, consistent date/stage metadata, full text, a larger photo mosaic, a separate document section when attachments exist, and the management action aligned with the title. One shared React component keeps both views consistent. Photos retain the accessible full-gallery viewer and the three-preview limit. Text-only activities do not reserve blank photo space.

These are adaptations to ProjectHub's existing palette, rather than an imported UI framework. They are the chosen fit for this portal; “best” depends on the content and task.

References researched on 14 October 2026:

- [Atlassian activity feeds](https://support.atlassian.com/platform-experiences/docs/view-different-types-of-activity-on-a-goal/): chronological history, recent updates first.
- [Flowbite vertical timeline templates](https://flowbite.com/docs/components/timeline/): vertical timeline as the Dashboard template reference.
- [NN/g: Cards: UI-Component Definition](https://www.nngroup.com/articles/cards-component/): predictable lists support scanning; bounded containers group mixed content; photos work well as a regular grid. This informed the compact timeline and full activity journal.
- [GOV.UK summary cards](https://design-system.service.gov.uk/components/summary-list/): clear titles and associated actions for repeated records. This informed the distinction between post content and management actions.

The dashboard summary order is description, next maintenance (when set), and project manager, on desktop and mobile.


## Attachment editing (15 October 2026)

A single attachment section displays current attachments and newly selected files together. An add-files tile invokes the accessible native file picker; repeated choices append to the draft. Remove buttons detach an item from the draft without deleting its stored file. The 20-file limit applies to the combined total. The general existing-file multiselect is removed.

Reference: [GOV.UK file upload guidance](https://design-system.service.gov.uk/components/file-upload/) for clear file controls and retaining access to previously uploaded files in the same journey. Deleting an activity is an explicit confirmed action in edit mode, separate from saving.
