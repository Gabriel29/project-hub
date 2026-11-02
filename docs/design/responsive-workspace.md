# Responsive workspace

The authenticated workspace uses the full available width beside the 240px desktop rail. The main scroll container has no maximum width or automatic margins: its right edge is always the viewport's right edge. Previously a 1480px maximum on that same container centered both the content and its scrollbar on large displays.

Horizontal content padding scales with the viewport from 20px to 64px. `scrollbar-gutter: stable` avoids width changes when classic scrollbars appear; overlay scrollbars retain the operating system's behavior. The top bar stays visible while main content scrolls. The sidebar scrolls independently and its children cannot shrink, keeping navigation accessible in short viewports.

The existing mobile drawer takes over at 760px. Dashboard summary cards use three columns above 1100px, with the description spanning two columns between 751px and 1100px, then one column at 750px and below. Long location text wraps without enlarging the workspace.

## Research

- [MDN: responsive web design](https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/CSS_layout/Responsive_Design) recommends fluid layout and breakpoints based on available viewport space.
- [MDN: scrollbar-gutter](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/scrollbar-gutter) explains stable scrollbar space and the distinction between classic and overlay scrollbars.

## Verification

Playwright covers Client and Owner sessions in Chromium, WebKit, and the mobile Chromium configuration at CSS viewport widths 320, 480, 650, 750, 760, 761, 900, 1100, 1440, 1920, 2560, and 3440px. Narrow cases also use a short 360px viewport to stress navigation accessibility. Tests verify full-width scrolling, no horizontal workspace overflow, a stationary header, and access to the last rail item. Screenshots are saved at 480, 1920, and 3440px for visual review.

Browser zoom changes the effective CSS viewport, so these smaller viewport cases exercise zoom reflow (for example, 1920px at 400% has 480px available). They do not automate the browser's native zoom controls; changing device pixel ratio alone would not test reflow.
