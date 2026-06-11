# Chapter — Figma User Journey

Compound customer journey map for the Chapter MVP.

## Files

| File | Description |
|------|-------------|
| `chapter-user-journey-flowchart.svg` | **Horizontal flowchart** — left→right happy path, branches, competitive notes |
| `chapter-product-recommendations.svg` | **Recommendations chart** — P0/P1/P2 moves, strategic suggestions, competitive cheat sheet |
| `chapter-user-journey.fig` | Native Figma file (generated) |
| `chapter-user-journey.svg` | Journey map grid (SVG) |
| `generate-journey-fig.mjs` | `.fig` generator script |

## Regenerate the `.fig` file

```bash
npm run figma:journey
```

Output: `design/figma/chapter-user-journey.fig`

Open it in the **Figma desktop app**: **File → Open** and select the file. If the file was already open, **close the tab and re-open** after regenerating.

> The `.fig` format is encoded via [openfig-core](https://github.com/OpenFig-org/openfig-core) (community, not official Figma). TEXT must live inside FRAME nodes (not rectangles) or Figma shows empty cards. If anything still looks wrong, import `chapter-user-journey.svg` instead and **File → Save local copy**.

## Edit the journey

1. Change phase copy, screens, or metrics in `generate-journey-fig.mjs` (`PHASES` array + persona text).
2. Run `npm run figma:journey`.
3. Re-open the `.fig` in Figma.

## What's on the map

| Section | Content |
|---------|---------|
| Persona panel | Alex — motivations, anxieties, success moment, metrics |
| 7 phase columns | Discover → Account → Onboarding → Verify → Discover → Match/Chat → Library/Profile |
| Per phase | Screens, actions, pain points, opportunities, emotion score |
| Happy path | Linear flow + AuthGuard gates + global components |
| Tokens strip | Stone/amber design system quick reference |

## SVG import (alternative)

1. Open Figma → **New design file**
2. Drag `chapter-user-journey.svg` onto the canvas
3. **File → Save local copy…** for a Figma-native `.fig`
