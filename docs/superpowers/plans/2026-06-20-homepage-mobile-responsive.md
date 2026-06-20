# Plan: Homepage Mobile Responsive

**Spec:** `docs/superpowers/specs/2026-06-20-homepage-mobile-responsive-design.md`  
**Date:** 2026-06-20

---

## Phase 0: Established Patterns (pre-read — no action needed)

All patterns confirmed from reading the codebase before planning:

- **CSS home classes** live at the bottom of `app/globals.css` starting at line 331, under the comment `/* Home page design hover utilities */`. New media-query classes follow the same block.
- **Class application** uses `className="..."` alongside existing `style={{...}}` inline styles. No inline style removal is needed.
- **Breakpoints**: `max-width: 640px` (mobile), `max-width: 900px` (tablet). The file already has one `@media (min-width: 768px)` rule at line 313 as a reference for syntax.
- **`!important`** is used on existing home classes (e.g. `.home-nav-link:hover { color: #191525 !important }`). Use it to override inline styles from media queries.

---

## Phase 1: Add Responsive CSS Classes to `globals.css`

**File:** `app/globals.css`  
**Where:** Append after line 340 (after `.home-contact-input:focus` rule), inside the existing home utilities block.

Add one media query block per breakpoint. Copy these exactly:

```css
/* Home page responsive — tablet (≤900px) */
@media (max-width: 900px) {
  .home-featured-grid {
    grid-template-columns: repeat(2, 1fr) !important;
  }
}

/* Home page responsive — mobile (≤640px) */
@media (max-width: 640px) {
  .home-navbar-nav    { display: none !important; }
  .home-navbar-signin { display: none !important; }

  .home-hero-section  { padding: 56px 5vw 48px !important; }
  .home-hero-title    { font-size: 36px !important; }

  .home-featured-grid { grid-template-columns: 1fr !important; }

  .home-why-grid      { grid-template-columns: repeat(2, 1fr) !important; }

  .home-app-inner     { padding: 28px !important; }
  .home-app-grid      { grid-template-columns: 1fr !important; }

  .home-contact-grid  { grid-template-columns: 1fr !important; }

  .home-cta-inner     { padding: 32px 24px !important; }
  .home-cta-title     { font-size: 26px !important; }

  .home-footer        {
    flex-direction: column !important;
    align-items: center !important;
    text-align: center !important;
  }
}
```

**Verify:** `grep -n "home-featured-grid\|home-navbar-nav\|home-app-grid" app/globals.css` returns all 8 class names.

---

## Phase 2: Apply `className` to Components

Apply exactly one `className` per targeted element. Do **not** remove or change any `style={{...}}` prop.

### 2a — `components/home/HomeNavbar.tsx`

- `<nav style={{ display: "flex", alignItems: "center", gap: 34 }}>` → add `className="home-navbar-nav"`
- `<Link href="/login" style={{ ... }}>Sign in</Link>` → add `className="home-navbar-signin"`

### 2b — `components/home/HeroSection.tsx`

- `<section style={{ display: "flex", flexDirection: "column", ... }}>` → add `className="home-hero-section"`
- `<h1 style={{ margin: "24px 0 0", fontSize: 68, ... }}>` → add `className="home-hero-title"`

### 2c — `components/home/FeaturedSection.tsx`

- `<div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 24 }}>` → add `className="home-featured-grid"`

### 2d — `components/home/TrustSection.tsx`

- `<div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 20 }}>` → add `className="home-why-grid"`

### 2e — `components/home/MobileAppSection.tsx`

- Outer `<div style={{ borderRadius: 24, background: "#f6f4fc", ..., padding: 52, display: "grid", gridTemplateColumns: "1.1fr 1fr", ... }}>` → add `className="home-app-inner home-app-grid"`  
  (Both classes on the same element — it is both the padded container and the grid.)

### 2f — `components/home/ContactSection.tsx`

- `<div style={{ ..., display: "grid", gridTemplateColumns: "1fr 1fr", gap: 44, ... }}>` → add `className="home-contact-grid"`

### 2g — `components/home/CTASection.tsx`

- Inner `<div style={{ borderRadius: 24, ..., padding: 64, textAlign: "center", ... }}>` → add `className="home-cta-inner"`
- `<h2 style={{ margin: 0, fontSize: 38, ... }}>` → add `className="home-cta-title"`

### 2h — `components/home/HomeFooter.tsx`

- `<footer style={{ padding: "36px 7vw", ..., display: "flex", ... }}>` → add `className="home-footer"`

**Verify each file:** after editing, `grep className components/home/<Name>.tsx` returns the expected class name(s).

---

## Phase 3: Verification

1. Run `npm run dev` and open `http://localhost:3000` in the browser.
2. Open DevTools → toggle device toolbar. Test at:
   - 375px wide (iPhone SE — smallest common phone)
   - 768px wide (tablet)
   - 1280px wide (desktop — must be unchanged)
3. Check each section:
   - [ ] Navbar: only logo + "Get the app" visible at 375px
   - [ ] Hero: title readable (≈36px), no horizontal overflow
   - [ ] Featured: 1 column at 375px, 2 columns at 768px, 3 columns at 1280px
   - [ ] Why GemX: 2×2 grid at 375px, 4 columns at 1280px
   - [ ] App section: stacked (copy above, phone below) at 375px
   - [ ] Contact: stacked (info above, form below) at 375px
   - [ ] CTA: no overflow, comfortable padding at 375px
   - [ ] Footer: centered column at 375px
4. Run `npm run lint` — must pass with 0 errors.
5. Run `npm run build` — must complete successfully.
