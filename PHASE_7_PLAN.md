# Phase 7 Implementation Plan — ethniCity Catering Module

**Date:** March 29, 2026 · Session 25
**Status:** Planning · Pre-implementation
**Base:** All Phases 1–6 complete, 4 critical UX audit fixes applied (uncommitted)

---

## Triage: What's Already Done vs What Remains

### ✅ Completed in Sessions 23–24 (UX Audit Critical Fixes)

| Item | Status | Where |
|------|--------|-------|
| Vendor switch confirmation dialog | Done | `cateringReducer.ts` + `catering.tsx` |
| Firestore undefined field filtering (all `addDoc` calls) | Done | `cateringService.ts` (8 calls) + component-level conditional spreads |
| Min date constraint on checkout event date | Done | `CateringCheckout.tsx` — `getTomorrow()` + `min` attr |
| ARIA labels on buttons, inputs, interactive elements | Done | `CateringCart`, `CateringItemCard`, `CateringCategoryGrid`, `CateringItemList`, `CateringCheckout` |
| Real-time checkout form validation with inline errors | Done | `CateringCheckout.tsx` — full rewrite with `validateForm()`, touched state, `aria-invalid` |
| Special instructions character count (checkout) | Done | `CateringCheckout.tsx` — 500 char cap with counter |

### 🔲 Remaining Phase 7 Items (This Plan)

Organized into 3 sprints by complexity and dependency order.

---

## Sprint 1: Quick Wins (1–2 days each)

### 1.1 Skeleton Loaders for Category Grid & Item List

**Why:** Currently shows a plain spinner (`Loader2`) during data fetch. Skeleton loaders provide spatial continuity and feel faster.

**Scope:**
- Create `CateringCategorySkeleton` — 4-cell grid of shimmer rectangles matching `CateringCategoryGrid` layout (emoji placeholder, text bar, count bar)
- Create `CateringItemListSkeleton` — 3-column card grid with image placeholder + 2 text bars matching `CateringItemCard` layout
- Wire into `catering.tsx`: show skeleton while `loading` is true for category/item views

**Files to modify:**
- `src/components/catering/CateringCategoryGrid.tsx` — add skeleton export or inline
- `src/components/catering/CateringItemList.tsx` — add skeleton export or inline
- `src/pages/catering.tsx` — swap `Loader2` spinner for skeletons in category + item views

**Implementation notes:**
- Reuse existing `shimmer` CSS class from `SkeletonLoader.tsx` (already in the app)
- Match exact grid dimensions: categories = `grid-cols-2 md:grid-cols-3 lg:grid-cols-4`, items = `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`
- Use `contentVisibility: auto` on skeleton containers for paint performance

**Estimated effort:** ~1 hour

---

### 1.2 Persist Cart to localStorage

**Why:** Cart is lost on page refresh — managed only in `useReducer` state. This is the #1 user-facing friction point.

**Scope:**
- On every cart change, serialize `{ items, businessId, businessName }` to `localStorage` key `ethniCity_catering_cart`
- On mount (`createInitialState` or `useEffect` in `catering.tsx`), hydrate cart from localStorage
- Include a version key for future schema migrations
- Clear localStorage entry on `CLEAR_CART` action and after successful order placement

**Files to modify:**
- `src/reducers/cateringReducer.ts` — add `HYDRATE_CART` action type
- `src/pages/catering.tsx` — add `useEffect` to persist on cart changes + hydrate on mount

**Implementation notes:**
- Use `try/catch` around `JSON.parse` for corrupted data safety
- Store format: `{ version: 1, cart: { items, businessId, businessName }, updatedAt: ISO string }`
- Expire after 24 hours (stale cart guard): check `updatedAt` on hydrate
- Do NOT store the full reducer state — only the cart slice

**Estimated effort:** ~1.5 hours

---

### 1.3 Character Count on Review Textarea

**Why:** `CateringReviewForm.tsx` has `maxLength={1000}` but no visible counter. Users can't see how much space remains.

**Scope:**
- Add `{text.length}/1000` counter below the review textarea
- Style: muted text, right-aligned, turns amber at 900+, red at 980+

**Files to modify:**
- `src/components/catering/CateringReviewForm.tsx` — add counter div below textarea

**Estimated effort:** ~20 minutes

---

### 1.4 Cost Breakdown on Checkout Review Step

**Why:** Checkout shows only a subtotal. Users want to see tax estimate + delivery fee before confirming.

**Scope:**
- Add estimated tax row (configurable rate, default 8.25%)
- Add delivery fee row (flat $0 for now — placeholder for vendor-specific fee)
- Show subtotal + tax + delivery = total in the review step
- Add a note: "Final amount may vary based on vendor confirmation"

**Files to modify:**
- `src/components/catering/CateringCheckout.tsx` — add cost breakdown section in review step
- `src/services/cateringService.ts` — add `calculateOrderBreakdown()` helper

**Estimated effort:** ~1 hour

---

## Sprint 2: Short-Term Improvements (3–5 days each)

### 2.1 Sort & Filter Controls on Item List

**Why:** Items within each business group have no sort options. Users browsing 10+ items per vendor need price/popularity sorting.

**Scope:**
- Add sort dropdown: "Default", "Price: Low to High", "Price: High to Low", "Most Popular" (if review count exists), "Newest"
- Add to reducer: `SET_SORT_ORDER` action with `sortOrder` state field
- Apply sort within each business group in `CateringItemList.tsx` `groupedByBusiness` memo

**Files to modify:**
- `src/reducers/cateringReducer.ts` — add `sortOrder` to state + `SET_SORT_ORDER` action
- `src/components/catering/CateringItemList.tsx` — add sort dropdown UI + sort logic in `useMemo`
- `src/pages/catering.tsx` — wire sort dispatch

**Implementation details:**
- Sort options: `'default' | 'price_asc' | 'price_desc' | 'popular' | 'newest'`
- "Popular" sorts by a `popularity` or `orderCount` field if available on `CateringMenuItem`, else falls back to default
- Sort is per-business-group (not cross-business)
- Dropdown uses Aurora design tokens for styling

**Estimated effort:** ~3 hours

---

### 2.2 Order Cancellation Flow

**Why:** Neither customers nor vendors can cancel orders. Currently the only workflow is forward-only status progression.

**Scope:**

**Customer side:**
- Add "Cancel Order" button on orders with status `pending` or `confirmed` (not `preparing` or later)
- Show confirmation dialog with reason selection: "Changed plans", "Found another caterer", "Ordered by mistake", "Other" (free text)
- Call `cancelOrder(orderId, reason, cancelledBy)` service function
- Update status to `cancelled` with reason in `statusHistory`

**Vendor side:**
- Add "Cancel Order" button on `VendorCateringDashboard` for any pre-delivery status
- Vendor reasons: "Item unavailable", "Cannot fulfill timeline", "Customer no-show", "Other"
- Auto-notify customer (future: push notification)

**Files to modify:**
- `src/services/cateringService.ts` — add `cancelOrder()` function
- `src/components/catering/CateringOrderStatus.tsx` — add cancel button + dialog for customer
- `src/components/catering/VendorCateringDashboard.tsx` — add cancel button + dialog for vendor
- `firestore.rules` — ensure cancellation writes are authorized

**Data model addition:**
```typescript
// On CateringOrder document:
cancellationReason?: string;
cancelledBy?: 'customer' | 'vendor';
cancelledAt?: Timestamp;
```

**Estimated effort:** ~4 hours

---

### 2.3 Address Autocomplete (Google Places API)

**Why:** Manual address entry is error-prone and slow. Autocomplete improves accuracy and reduces checkout friction.

**Scope:**
- Integrate Google Places Autocomplete on the street address field in `CateringCheckout.tsx`
- On selection, auto-populate: street, city, state, zip, lat, lng
- Optionally also add to `RequestForPriceForm.tsx` (delivery city field)
- Wrap in a reusable `<AddressAutocomplete>` component

**Files to create:**
- `src/components/shared/AddressAutocomplete.tsx` — reusable component wrapping Google Places

**Files to modify:**
- `src/components/catering/CateringCheckout.tsx` — replace street input with `<AddressAutocomplete>`
- `index.html` or env config — add Google Maps JS API script with Places library
- `.env` — add `VITE_GOOGLE_MAPS_API_KEY`

**Implementation notes:**
- Use `@googlemaps/js-api-loader` package (or direct script tag)
- Restrict to US addresses (or configurable country)
- Debounce input by 300ms
- Fallback to manual entry if API fails or key not configured
- The component should work without the API key for dev/testing

**Estimated effort:** ~5 hours (including API key setup and testing)

---

### 2.4 Multi-Date Picker for Recurring Order Skip Dates

**Why:** Currently skip dates are entered as comma-separated strings — fragile and error-prone.

**Scope:**
- Build or integrate a multi-date calendar picker component
- Replace the comma-separated text input in `RecurringOrderManager.tsx`
- Store skip dates as `string[]` (ISO date format) — already the Firestore format
- Show selected dates as removable chips below the calendar

**Files to create:**
- `src/components/shared/MultiDatePicker.tsx` — calendar with multi-select

**Files to modify:**
- `src/components/catering/RecurringOrderManager.tsx` — swap text input for `<MultiDatePicker>`

**Implementation notes:**
- Build from scratch using a simple month-grid (no heavy date library dependency)
- Highlight today, disable past dates
- Navigation: prev/next month arrows
- Selected dates shown as filled circles on calendar + chip list below
- Aurora design tokens for colors

**Estimated effort:** ~6 hours

---

### 2.5 Push/Email Notifications for Order Status Changes

**Why:** Users have no way to know when their order status changes without manually checking.

**Scope:**
- **Cloud Function trigger:** `onDocumentUpdated` for `cateringOrders` collection — detect status field changes
- **FCM push notification:** Send to customer's device token when status changes (confirmed → preparing → ready → delivered)
- **Vendor notification:** Notify vendor when new order is placed
- Leverage existing `sendNewMessageNotification` Cloud Function pattern

**Files to modify:**
- `functions/src/index.ts` — add `onCateringOrderStatusChange` Cloud Function
- `src/services/cateringService.ts` — store user FCM token on order placement (or reference from user profile)

**Implementation notes:**
- Use Firebase Cloud Messaging (FCM) — already in the project for messaging notifications
- Notification payload: `{ title: "Order Update", body: "Your order from [vendor] is now [status]" }`
- Email notifications are a Phase 7.5 item (requires email service like SendGrid/Mailgun)
- For now, focus on FCM push only

**Estimated effort:** ~4 hours

---

### 2.6 RFQ Expiration Dates with Vendor Notification

**Why:** Quote requests currently live forever. Vendors need urgency; customers need closure.

**Scope:**
- Add `expiresAt: Timestamp` field to `CateringQuoteRequest`
- Default: 7 days from creation (configurable in form)
- Show countdown on `QuoteComparison` view
- Cloud Function: daily check for expired RFQs → auto-close + notify customer
- Badge on vendor dashboard for expiring-soon quotes (< 24h)

**Files to modify:**
- `src/services/cateringService.ts` — add `expiresAt` to `CateringQuoteRequest` interface + `createQuoteRequest()`
- `src/components/catering/RequestForPriceForm.tsx` — add expiration date field
- `src/components/catering/QuoteComparison.tsx` — show expiration countdown
- `src/components/catering/VendorCateringDashboard.tsx` — add urgency badge
- `functions/src/index.ts` — add `expireStaleQuoteRequests` scheduled Cloud Function

**Estimated effort:** ~5 hours

---

## Sprint 3: Long-Term Enhancements (1–2 weeks each)

### 3.1 Payment Integration (Stripe)

**Why:** No payment processing — orders are placed without financial commitment. This is the biggest gap for production readiness.

**Scope:**
- Stripe Checkout Session for direct orders
- Escrow pattern for RFQ orders (hold payment until vendor confirms quote)
- Webhook handler for payment confirmation
- Refund flow tied to order cancellation

**Architecture:**
```
Customer → Checkout → Stripe Checkout Session → Webhook → Update order status to 'paid'
                                                         → Vendor notified
```

**Files to create:**
- `functions/src/stripe.ts` — Stripe webhook handler + checkout session creation
- `src/components/catering/PaymentStep.tsx` — payment UI in checkout flow

**Files to modify:**
- `src/components/catering/CateringCheckout.tsx` — add payment step between review and confirm
- `src/services/cateringService.ts` — add payment-related fields to `CateringOrder`
- `functions/package.json` — add `stripe` dependency
- `firestore.rules` — add payment-related document rules

**Prerequisites:** Stripe account setup, API keys in Firebase config

**Estimated effort:** ~2 weeks

---

### 3.2 Multi-Vendor Cart Support

**Why:** Currently cart is locked to one vendor. Power users ordering for large events need items from multiple caterers.

**Scope:**
- Cart becomes `Map<businessId, { items, businessName }>`
- Checkout splits into per-vendor sub-orders
- Each sub-order gets its own status tracking
- Coordinated delivery scheduling (same date/time for all sub-orders)

**Files to modify:**
- `src/reducers/cateringReducer.ts` — major refactor of cart state shape
- `src/components/catering/CateringCart.tsx` — grouped display by vendor
- `src/components/catering/CateringCheckout.tsx` — split checkout flow
- `src/services/cateringService.ts` — batch order creation

**Risk:** Breaking change to cart structure — needs migration path from single-vendor cart (localStorage hydration)

**Estimated effort:** ~1.5 weeks

---

### 3.3 In-App Messaging (Customer ↔ Vendor)

**Why:** No way to communicate about order details, changes, or questions without external channels.

**Scope:**
- Order-scoped chat thread (not general messaging)
- Real-time via Firestore `onSnapshot`
- Accessible from order detail (customer) and order card (vendor dashboard)
- Leverage existing messaging infrastructure in the app

**Files to create:**
- `src/components/catering/OrderChat.tsx` — chat UI component
- Firestore collection: `cateringOrderMessages/{messageId}`

**Files to modify:**
- `src/components/catering/CateringOrderStatus.tsx` — add "Message Vendor" button
- `src/components/catering/VendorCateringDashboard.tsx` — add "Message Customer" button
- `firestore.rules` — add rules for `cateringOrderMessages`

**Estimated effort:** ~1 week

---

### 3.4 Vendor Inventory / Availability Scheduling

**Why:** Menu items are always shown as available. Vendors need to manage item availability by date/time.

**Scope:**
- `availableFrom` / `availableTo` date fields on `CateringMenuItem`
- Daily availability toggle (e.g., "only weekdays", "weekends only")
- Blackout dates (vendor holidays)
- Filter unavailable items from customer view based on selected event date

**Estimated effort:** ~1 week

---

### 3.5 Public Template Marketplace

**Why:** `OrderTemplates` are currently private to the creator. A marketplace lets users discover popular orders.

**Scope:**
- `isPublic` flag on templates
- Browse/search public templates by cuisine, event type, headcount range
- "Use This Template" action → pre-fills cart
- Rating system for public templates

**Estimated effort:** ~1.5 weeks

---

## Implementation Priority Matrix

```
                    HIGH IMPACT
                        │
  Sprint 1.2            │         Sprint 2.2
  (Cart Persist)        │         (Cancellation)
                        │
  Sprint 2.1            │         Sprint 3.1
  (Sort/Filter)         │         (Payments)
                        │
LOW EFFORT ─────────────┼───────────────── HIGH EFFORT
                        │
  Sprint 1.1            │         Sprint 3.2
  (Skeletons)           │         (Multi-Vendor Cart)
                        │
  Sprint 1.3            │         Sprint 3.3
  (Review Counter)      │         (In-App Messaging)
                        │
                    LOW IMPACT
```

## Recommended Execution Order

**Week 1:** Sprint 1 (all quick wins) + Sprint 2.1 (sort/filter)
- Ship: Skeleton loaders, cart persistence, review char count, cost breakdown, sort controls
- These are all independent — can be developed in parallel

**Week 2:** Sprint 2.2 (cancellation) + Sprint 2.4 (multi-date picker)
- Ship: Order cancellation flow, improved recurring order UX

**Week 3:** Sprint 2.3 (address autocomplete) + Sprint 2.5 (push notifications)
- Ship: Address autocomplete, FCM push for status changes

**Week 4:** Sprint 2.6 (RFQ expiration) + start Sprint 3.1 (Stripe)
- Ship: Quote expiration, begin payment integration

**Weeks 5–6:** Sprint 3.1 (Stripe) + Sprint 3.3 (in-app messaging)

**Weeks 7–8:** Sprint 3.2 (multi-vendor cart) + Sprint 3.4 (inventory)

**Week 9+:** Sprint 3.5 (template marketplace) + polish

---

## Technical Debt to Address During Phase 7

1. **Split `cateringService.ts`** (1,427 lines) into sub-modules:
   - `cateringMenuService.ts` — menu CRUD
   - `cateringOrderService.ts` — order CRUD + status
   - `cateringQuoteService.ts` — RFP/quote operations
   - `cateringFavoriteService.ts` — favorites, recurring, templates

2. **Add unit tests** for:
   - `cateringReducer.ts` — all action types
   - `cateringService.ts` — Firestore write functions (with mocks)
   - `CateringCheckout.tsx` — validation logic

3. **Optimistic updates** — write to local state first, then Firestore. Rollback on error. Applies to: add to cart, place order, update status.

4. **Error boundary** — wrap lazy-loaded catering components in `<ErrorBoundary>` with retry UI.

---

## Dependencies & Prerequisites

| Item | Dependency | Blocker? |
|------|-----------|----------|
| Address autocomplete | Google Maps API key | Yes — needs billing-enabled GCP project |
| Payment integration | Stripe account + API keys | Yes — needs Stripe setup |
| Push notifications | FCM already configured | No — existing infra |
| Email notifications | SendGrid/Mailgun account | Yes — not yet set up |
| Multi-vendor cart | Cart persistence (1.2) | Soft — should do 1.2 first |

---

*This plan is a living document. Update as items are completed or priorities shift.*
