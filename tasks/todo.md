# Task List: Admin Premium Dealer Subscription Management

## Phase 1: Data Layer

- [x] **Task 1** — DB query: `getPremiumDealerSubscriptionsPaginated()` in `features/points/db/points.ts`
- [x] **Task 2** — DB mutations: `deactivatePremiumDealerSubscription()` + `updatePremiumDealerSubscriptionExpiry()` in `features/points/db/points.ts` + unit tests
- [x] **Checkpoint 1** — `npm run test:unit` passes, `npm run build` clean

## Phase 2: Server Actions + Table Component

- [x] **Task 3** — Server actions: `deactivatePremiumDealerAction` + `updateSubscriptionExpiryAction` in `features/points/actions/points.ts`
- [x] **Task 4** — Component: `features/points/components/PremiumDealerSubscriptionsTable.tsx`
- [x] **Checkpoint 2** — `npm run test` passes, `npm run build` clean

## Phase 3: Admin Page + Navigation

- [x] **Task 5** — Admin page: `app/admin/credit/premium-dealer-subscriptions/page.tsx` + sidebar nav link in `components/admin/AdminSidebar.tsx`
- [ ] **Checkpoint 3** — Full manual walkthrough: list, filter, deactivate, set expiry
