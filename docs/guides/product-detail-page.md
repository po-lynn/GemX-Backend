# Product Detail / Edit Page

## What this is

The admin product edit/create form at `/admin/products/[id]/edit` and `/admin/products/new`. Uses the `pd-*` design system — a two-column grid with a sticky save bar, hero card, section cards, and a sidebar.

## How to extend

### Add a new field to the form

1. Add the field's `name` attribute to the `<input>` in `ProductForm.tsx`
2. Parse it in `features/products/actions/products.ts` from `formData.get("fieldName")`
3. Update the Drizzle schema in `drizzle/schema/product-schema.ts` if it's a new DB column
4. Run `npm run db:generate && npm run db:migrate`

### Add a new flag toggle

Flag toggles (Featured, Collector Piece, etc.) follow this pattern:

```tsx
// 1. Add controlled state
const [isMyFlag, setIsMyFlag] = useState(product?.myFlag ?? false)

// 2. Render the toggle in the visibility section
<label htmlFor="ft-myflag" className={`pd-toggle${isMyFlag ? " on" : ""}`}>
  <input
    id="ft-myflag"
    type="checkbox"
    name="isMyFlag"
    checked={isMyFlag}
    onChange={(e) => setIsMyFlag(e.target.checked)}
    className="sr-only"
  />
  <span className="pd-toggle-chk"><Check size={10} /></span>
  <div className="pd-toggle-text">
    <span className="pd-toggle-label">My flag label</span>
    <span className="pd-toggle-sub">Short description</span>
  </div>
</label>
```

### Add a new form section

```tsx
<div className="pd-card">
  <div className="pd-card-head">
    <MyIcon size={15} className="pd-card-ico" />
    <span className="pd-card-title">Section Title</span>
  </div>
  <div className="pd-card-body">
    {/* fields */}
  </div>
</div>
```

### Change the gem-hue color mapping

Edit `getGemHue()` near the top of `ProductForm.tsx`. Returns an HSL hue (0–360). The CSS uses it as `hsl(var(--gem-hue, 260) 80% 60%)`.

### Change the platform fee display

The `PriceBreakdown` component uses a hardcoded 8% rate. Change the `0.08` multiplier in that component. This is display-only — the actual fee logic lives elsewhere.

## Sticky save bar

The save bar uses `position: sticky; top: 56px` to sit directly below the 56px admin header. If the header height changes, update the `style={{ top: 56 }}` prop on `.pd-savebar` in `ProductForm.tsx`.

The "dirty" indicator fires from `onInput` on the `<form>` element — any field change (including the sidebar status select) sets `dirty = true`.

## CSS classes reference

All `pd-*` classes are defined at the bottom of `app/admin-list-view.css`. Key ones:

| Class | Purpose |
|---|---|
| `pd-grid` | Two-column layout grid |
| `pd-headcard` | Hero card with gem-hue gradient |
| `pd-savebar` | Sticky save bar |
| `pd-card` | Form section card |
| `pd-toggle` | Flag toggle row (add `on` class when active) |
| `pd-price-breakdown` | 3-cell price breakdown grid |
| `pd-media-strip` | Image/video thumbnail row |
| `pd-side-card` | Sidebar card |

## Common errors

**"Unsaved changes" never clears** — The dirty state is only reset on successful submit (redirect) or on Discard. It does not reset automatically on save failure.

**Hero card not showing** — It only renders in `mode="edit"` when `product` is defined.

**Gem hue not applying** — Make sure `--gem-hue` is set as an inline style on `.pd-headcard`. The CSS custom property must be set on the element itself or an ancestor.
