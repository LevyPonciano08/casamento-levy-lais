---
name: Laís & Levy
description: Modern wedding photography with calm guest and administration surfaces.
colors:
  ink: "#293b49"
  paper: "#f4f7fa"
  surface: "#fff"
  mist: "#e0e9f2"
  serenity: "#a7bed3"
  muted: "#435b70"
  line: "#c7d4e1"
  deep: "#5d7f9f"
typography:
  display:
    fontFamily: "Cormorant Garamond, Georgia, serif"
    fontSize: "clamp(100px,13vw,190px)"
    fontWeight: 400
    lineHeight: 0.95
    letterSpacing: "-0.04em"
  headline:
    fontFamily: "Cormorant Garamond, Georgia, serif"
    fontSize: "clamp(42px,5.5vw,76px)"
    fontWeight: 400
    lineHeight: 1.05
    letterSpacing: "-0.035em"
  title:
    fontFamily: "Manrope, Arial, sans-serif"
    fontSize: "19px"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "-0.025em"
  body:
    fontFamily: "Manrope, Arial, sans-serif"
    fontSize: "16px"
    lineHeight: 1.7
  label:
    fontFamily: "Manrope, Arial, sans-serif"
    fontSize: "14px"
rounded:
  field: "8px"
  option: "12px"
  card: "16px"
  dialog: "20px"
  panel: "24px"
  pill: "100px"
spacing:
  control-y: "16px"
  control-x: "24px"
  field-y: "14px"
  field-x: "16px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
    rounded: "{rounded.pill}"
    padding: "16px 24px"
  button-photo:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "16px 24px"
  field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.field}"
    padding: "14px 16px"
  gift-card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.card}"
  filter:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "10px 19px"
---

# Design System: Laís & Levy

## Overview

**Creative North Star: "Cinematic wedding photography"**

The couple's existing photographs carry the emotion. Modern, spacious guest surfaces pair expansive imagery and roman serif titles with restrained sans-serif controls. The same serenity blue palette connects the home, gifts, payment return and administration routes; operational screens adapt the density and typography to their tasks.

**Key Characteristics:**
- Large personal photographs and readable white lettering.
- Deep blue ink, off-white paper and soft serenity blue surfaces.
- Roman display type, rounded controls and visible keyboard focus.
- Fluid motion with a complete reduced-motion alternative.

## Colors

### Primary
- **Deep blue ink:** primary text, solid actions, celebration band, administration sidebar and payment backdrop.
- **Blue accent:** supporting accents, monograms and field focus borders.

### Neutral
- **Off-white paper:** page canvas and compact navigation.
- **White surface:** fields, gift cards and payment panels; white lettering on dark backgrounds.
- **Serenity mist:** RSVP form, countdown, supporting information and selected surface treatments.
- **Soft serenity:** close-control hover and supporting accents.
- **Muted blue:** supporting text.
- **Quiet line:** dividers and control borders.

## Typography

**Display Font:** Cormorant Garamond, with Georgia and serif fallbacks.
**Body Font:** Manrope, with Arial and sans-serif fallbacks.

Roman display lettering gives the photographs their cinematic scale. Manrope carries descriptions, prices, controls and dashboard content. The frontmatter records the home hierarchy and gift title; route-specific sizes remain intentional adaptations.

Home names use the display role; mobile names scale with the viewport. Home section headings use the headline role with section-specific clamps. Gift headings use a larger opening headline and smaller catalog headings. Gift titles use the title role. Body leading is slightly tighter on registry routes (1.65). Administration headings inherit Manrope; the login heading and view heading are large functional titles rather than serif display text.

**The Roman Title Rule.** Display headings stay roman, including emphasized words and the home ampersand.

## Layout

Home content uses generous section spacing (typically 115px vertically, 75px on mobile), percentage gutters (8% desktop, 7% mobile), and paired editorial columns capped around 1600px. Full-width photographic and dark bands interrupt the paper canvas. Paragraph measures vary by task, commonly 38–45ch.

The home stacks columns and replaces navigation with a menu at 740px; tighter adaptations exist at 374px and for short phones. Gift grids move from three columns to two at 900px and one at 600px. Registry content uses centered percentage gutters with a 1280px reference width. Administration adapts its sidebar and navigation for smaller screens; tables retain horizontal scrolling. Payment return centers a panel capped at 680px.

## Elevation & Depth

Tonal bands, photography overlays and subtle borders provide most separation. Gift cards use a faint ambient shadow and rise slightly on hover. Native dialogs have a stronger diffuse shadow and a blurred dark backdrop. Payment and login panels use soft ambient shadows; these are task-specific containers rather than a universal card treatment.

## Shapes

Controls are pill-shaped; fields have gentle corners. Gift cards are softly rounded, dialogs and centered panels more generous. The story carousel uses an arched portrait silhouette (180px upper corners on desktop, 160px on mobile) with small lower corners. Monograms preserve the existing image mask. Photography is clipped where the component requires it, rather than enclosed in decorative frames.

## Components

### Buttons

Solid maritime actions use white labels; the photograph action reverses to paper with ink text. Outline actions appear over photography and paper. Hover darkens solid actions and adds a small lift; pressed buttons move down slightly. Disabled buttons reduce opacity and change the cursor. Keyboard focus remains conspicuous.

### Chips

Gift filters are white pills with quiet borders. Hover and the pressed state invert to deep blue ink with white text. Administration status pills are compact pale blue indicators, not filter controls.

### Cards / Containers

Gift cards place contained product imagery above sans-serif information, price and action. RSVP uses a pale blue form container. Payment uses a white centered panel against deep blue ink; administration uses compact white statistics and scrollable tables.

### Inputs / Fields

White fields use quiet borders and comfortable padding. Shared styles keep text input at 16px, add a blue focus border and a subtle focus halo. Home RSVP options pair native radios with bordered selectable surfaces; selection uses a stronger green border and sage fill.

### Navigation

The home opens with white navigation over the photograph, then switches to a compact paper header. The mobile menu opens below it. Registry navigation is sticky paper with the monogram and a return link. Administration uses a dark sidebar with translucent active and hover treatments. The home keeps its floating gifts shortcut available, becoming an icon-sized control on mobile.

### Photography and motion

Original couple photography and the existing monogram are identity assets. The home opens with a 1.2s name entrance, subtly drifts its photograph with scroll (0.065 multiplier, 1.06 scale), and dissolves story images over 850ms. Shared semantic durations are recorded in the sidecar; actual scenes also have their own timings. Native dialogs animate their panel and backdrop separately. Reduced-motion mode disables transitions, entrances, scroll displacement and carousel autoplay; content remains available.

**The Motion Preference Rule.** Respect reduced motion in both CSS and JavaScript, including preference changes during the session.

## Do's and Don'ts

### Do:
- **Do** preserve the couple's existing photographs and monogram.
- **Do** keep guest actions and form labels readable against their surface.
- **Do** adapt density and heading treatment to operational screens.
- **Do** retain visible focus and the reduced-motion alternative.

### Don't:
- **Don't** replace the couple's identity photography with generated portraits.
- **Don't** introduce italic display emphasis into the established roman headings.
- **Don't** require animation for content to become available.

## Confirmed brand color
Azul serenity (#A7BED3) é a cor principal confirmada pelo usuário. Fundos de destaque usam esse azul, com #293B49 para texto e ações e #E0E9F2 para superfícies claras.
