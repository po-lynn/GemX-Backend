# Homepage Mobile Responsive Design

**Date:** 2026-06-20  
**Scope:** All components under `components/home/`

## Goal

Make the GemX homepage fully usable on mobile phones and tablets without changing the desktop layout or visual design.

## Approach

Add CSS media-query classes to `app/globals.css` and apply them via `className` to targeted elements in each component. This matches the existing pattern (`.home-card-hover`, `.home-nav-link`, etc.) and avoids rewriting all inline styles.

## Breakpoints

| Name | Width |
|------|-------|
| Mobile | `max-width: 640px` |
| Tablet | `max-width: 900px` |

## Per-Component Changes

### HomeNavbar (`components/home/HomeNavbar.tsx`)

**Problem:** Three horizontal groups (logo · nav links · auth buttons) collapse unreadably on narrow screens.

**Fix:** Hide the middle `<nav>` and the "Sign in" link on mobile. Logo + "Get the app" CTA remain visible.

Classes added:
- `home-navbar-nav` → `display: none` at `≤640px`
- `home-navbar-signin` → `display: none` at `≤640px`

### HeroSection (`components/home/HeroSection.tsx`)

**Problem:** `h1` at `68px` overflows; top padding `96px` is excessive on mobile.

**Fix:** Scale title down and reduce vertical padding.

Classes added:
- `home-hero-section` → padding `96px 7vw 80px → 56px 5vw 48px` at `≤640px`
- `home-hero-title` → `font-size: 68px → 36px` at `≤640px`

### FeaturedSection (`components/home/FeaturedSection.tsx`)

**Problem:** `repeat(3, 1fr)` grid produces three very narrow cards on mobile.

**Fix:** Two columns on tablet, one column on mobile.

Classes added:
- `home-featured-grid` → `repeat(2, 1fr)` at `≤900px`; `1fr` at `≤640px`

### TrustSection (`components/home/TrustSection.tsx`)

**Problem:** `repeat(4, 1fr)` grid is unreadable on mobile.

**Fix:** Two columns on mobile.

Classes added:
- `home-why-grid` → `repeat(2, 1fr)` at `≤640px`

### MobileAppSection (`components/home/MobileAppSection.tsx`)

**Problem:** `1.1fr 1fr` two-column grid with phone mockup — both columns are cramped on mobile; phone mockup overflows.

**Fix:** Stack to single column (copy above, phone mockup below) on mobile. Reduce inner padding.

Classes added:
- `home-app-grid` → `1fr` at `≤640px`
- `home-app-inner` → padding `52px → 28px` at `≤640px`

### ContactSection (`components/home/ContactSection.tsx`)

**Problem:** `1fr 1fr` grid (contact info + form side by side) breaks on mobile.

**Fix:** Single column, contact info above form.

Classes added:
- `home-contact-grid` → `1fr` at `≤640px`

### CTASection (`components/home/CTASection.tsx`)

**Problem:** Inner padding `64px` and `h2` at `38px` are excessive on mobile.

**Fix:** Reduce padding and title size.

Classes added:
- `home-cta-inner` → padding `64px → 32px 24px` at `≤640px`
- `home-cta-title` → `font-size: 38px → 26px` at `≤640px`

### HomeFooter (`components/home/HomeFooter.tsx`)

**Problem:** `space-between` row with three items stacks awkwardly on narrow screens.

**Fix:** Switch to centered column layout on mobile.

Classes added:
- `home-footer` → `flex-direction: column; align-items: center; text-align: center` at `≤640px`

### LabLogosSection & HomeNavbarAuthButton

Already responsive — use `flexWrap: wrap` and `justifyContent: center`. No changes needed.

## Files Modified

| File | Change |
|------|--------|
| `app/globals.css` | Add all media-query rules for new classes |
| `components/home/HomeNavbar.tsx` | Add `className` to `<nav>` and sign-in `<Link>` |
| `components/home/HeroSection.tsx` | Add `className` to `<section>` and `<h1>` |
| `components/home/FeaturedSection.tsx` | Add `className` to grid `<div>` |
| `components/home/TrustSection.tsx` | Add `className` to grid `<div>` |
| `components/home/MobileAppSection.tsx` | Add `className` to outer grid and inner wrapper |
| `components/home/ContactSection.tsx` | Add `className` to grid `<div>` |
| `components/home/CTASection.tsx` | Add `className` to inner `<div>` and `<h2>` |
| `components/home/HomeFooter.tsx` | Add `className` to `<footer>` |

## Out of Scope

- Hamburger menu (user selected "simplified — hide nav links")
- Converting inline styles to Tailwind classes
- Any desktop layout changes
- New sections or content changes
