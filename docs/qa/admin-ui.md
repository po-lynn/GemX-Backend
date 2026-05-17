# QA — Admin UI

> **Feature:** Admin panel pages  
> **Scope:** Navigation, Point Management form, Point Packages, Purchase Requests table

---

## 1. Navigation & Sidebar

| TC# | Test Case | Steps | Expected Result | Priority |
|-----|-----------|-------|-----------------|----------|
| UI-01 | All sidebar links navigate correctly | Click each sidebar item | URL changes to correct page, active item highlights with left border accent | High |
| UI-02 | Settings group shows all items | Look at Settings group in sidebar | Shows: Point Management, Feature Settings, Premium Dealers Settings, Point Packages, Purchase Requests | High |
| UI-03 | Active state is exact for `/admin/credit` | Navigate to `/admin/credit` | Only "Point Management" is highlighted, not sub-items | High |
| UI-04 | Active state persists on sub-pages with query params | Navigate to `/admin/credit/purchase-requests?status=approved` | "Purchase Requests" stays highlighted | Medium |
| UI-05 | Mobile hamburger menu opens sidebar | Resize to < 768px, click hamburger icon | Sheet slides in with full navigation | Medium |

---

## 2. Point Management Form (`/admin/credit`)

| TC# | Test Case | Steps | Expected Result | Priority |
|-----|-----------|-------|-----------------|----------|
| UI-06 | Form loads with saved values | Navigate to page | All fields pre-filled with current DB values | High |
| UI-07 | Save with valid data | Fill all fields, click Save Point Settings | No error shown, page refreshes with saved values | High |
| UI-08 | Reset button reloads page | Change fields without saving, click Reset | All fields revert to last saved state | Medium |
| UI-09 | Add payment method | Click "Add payment method" | New card appears with empty name, accountName, phoneNumber, instructions fields | High |
| UI-10 | Remove payment method | Click trash icon on a method card | Card disappears immediately from UI | High |
| UI-11 | Payment methods persist after save | Add "KBZ Pay" method, save, reload page | KBZ Pay method card still shown with saved values | High |
| UI-12 | Registration bonus checkbox toggle | Uncheck "Enable Registration Bonus", save | `registrationBonusEnabled = false` stored in DB | Medium |
| UI-13 | Currency conversion inputs reject decimals | Enter 1.5 in MMK amount field | Browser rejects non-integer (input type=number step=1) | Low |

---

## 3. Point Packages Form (`/admin/credit/point-packages`)

| TC# | Test Case | Steps | Expected Result | Priority |
|-----|-----------|-------|-----------------|----------|
| UI-14 | Page shows title and description | Navigate to page | "Point Packages" heading, description text, Save button visible | High |
| UI-15 | Add package creates default row | Click "Add Package" | New row with name "New Package", 100 points, empty price fields | High |
| UI-16 | Optional price fields accept blank | Leave Price USD and Price KRW blank, save | Package saves without `priceUsd` / `priceKrw` fields | High |
| UI-17 | Optional price fields accept zero | Enter 0 in Price MMK, save | Saves as `priceMmk: 0` (valid value) | Medium |
| UI-18 | Remove package | Click trash icon on a package row | Package removed from list instantly | High |
| UI-19 | Empty state message | Remove all packages | "No packages yet. Add one below." placeholder shown | Low |
| UI-20 | Save button at top and bottom | Load page | Two Save buttons present (top-right and bottom-center) | Low |

---

## 4. Purchase Requests Page (`/admin/credit/purchase-requests`)

| TC# | Test Case | Steps | Expected Result | Priority |
|-----|-----------|-------|-----------------|----------|
| UI-21 | Default tab is Pending | Navigate to page with no query params | URL contains `status=pending`, pending requests shown | High |
| UI-22 | Status filter tabs update table | Click "Approved" tab | URL updates to `?status=approved`, table reloads with approved rows | High |
| UI-23 | All table columns present | Check table headers | User, Package, Points, Price, Transferred, Name, Reference, Note, Status, Date, Actions | High |
| UI-24 | Price column shows amount and currency | Have a MMK request in table | Cell shows e.g. `5,000 MMK` | High |
| UI-25 | Approve button credits points | Click Approve on a pending row | Row status badge → "approved", Actions cell → "—" | Critical |
| UI-26 | Reject with reason | Click Reject, enter reason in browser prompt | Row status badge → "rejected", reason shown below status badge | High |
| UI-27 | Reject without reason | Click Reject, leave prompt blank, click OK | Row status badge → "rejected", no note shown | Medium |
| UI-28 | Pagination appears with >20 requests | Create 21+ pending requests | Next / Previous buttons appear below table | Medium |
| UI-29 | Previous button disabled on page 1 | Be on page 1 | Previous button is rendered as disabled | Low |
| UI-30 | Total count displayed | Have 5 requests | "5 requests total" shown in card description | Low |
