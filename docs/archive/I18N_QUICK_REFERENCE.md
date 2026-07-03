# i18n Quick Reference Card

## Import the Hook

```typescript
import { useI18nCatering } from '@/hooks/useI18nCatering';
import { cateringKeys } from '@/hooks/useI18nCatering';
```

## Basic Usage

```typescript
function MyComponent() {
  const t = useI18nCatering();
  
  return (
    <div>
      {/* Simple key access */}
      <h1>{t('labels.orderTimeline')}</h1>
      <p>{t('status.confirmed')}</p>
      <button>{t('actions.acceptAndFinalize')}</button>
    </div>
  );
}
```

## With Interpolation

```typescript
const t = useI18nCatering();

// Single interpolation
const msg = t('errors.invalidTransition', {
  from: 'pending',
  to: 'ready'
});
// Output: "Invalid status transition: pending → ready"

// Plural interpolation (count variable)
const plural = t('toast.ordersAccepted', { count: 5 });
// Output: "5 orders accepted and created. Track them in your orders tab."
```

## Type-Safe Key Access

```typescript
import { cateringKeys } from '@/hooks/useI18nCatering';

const t = useI18nCatering();

// IDE autocomplete and type safety
const status = t(cateringKeys.status.pending);
const error = t(cateringKeys.errors.headcountMax);
const action = t(cateringKeys.actions.cancel);
```

## Locale-Aware Formatting

```typescript
import { formatCurrency, formatDate, formatDateTime, formatNumber } from '@/utils/formatLocale';

// Currency (input: cents)
const price = formatCurrency(14999);           // "$149.99"
const gbp = formatCurrency(5000, 'en-GB', 'GBP');  // "£50.00"

// Date
const date = formatDate(new Date());           // "Apr 27, 2026"
const custom = formatDate(new Date(), 'en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
});  // "Sunday, April 27"

// Date + Time
const dt = formatDateTime(new Date());         // "Apr 27, 2:30 PM PDT"

// Number
const count = formatNumber(1234);              // "1,234"
const localized = formatNumber(1234, 'de-DE'); // "1.234" (German)
```

## Available Keys

### Order Status
```typescript
cateringKeys.status.pending              // "Order Placed"
cateringKeys.status.confirmed            // "Order Confirmed"
cateringKeys.status.preparing            // "Preparing"
cateringKeys.status.ready                // "Ready for Pickup/Delivery"
cateringKeys.status.out_for_delivery     // "Out for Delivery"
cateringKeys.status.delivered            // "Delivered"
cateringKeys.status.cancelled            // "Cancelled"
```

### Error Messages
```typescript
cateringKeys.errors.orderNotFound        // "Order not found"
cateringKeys.errors.invalidTransition    // "Invalid status transition: {{from}} → {{to}}"
cateringKeys.errors.unauthorized         // "Only the vendor can advance order status"
cateringKeys.errors.invalidETA           // "Delivery ETA must be in the future"
cateringKeys.errors.etaAfterEvent        // "Delivery ETA must be before the event date"
cateringKeys.errors.headcountMin         // "Headcount must be at least 1"
cateringKeys.errors.headcountMax         // "Headcount cannot exceed 10,000"
cateringKeys.errors.failedToAccept       // "Failed to accept and finalize order"
cateringKeys.errors.failedToDecline      // "Failed to decline quote"
cateringKeys.errors.failedToSubmit       // "Failed to submit quote"
```

### Toast Notifications
```typescript
cateringKeys.toast.orderAccepted         // "Order accepted and created! Track it in your orders tab."
cateringKeys.toast.ordersAccepted        // "{{count}} orders accepted and created. Track them in your orders tab."
cateringKeys.toast.ordersAlreadyCreated  // "Orders were already created for this request. Check your orders tab."
cateringKeys.toast.quoteDeclined         // "Quote declined"
cateringKeys.toast.repriceRequested      // "Reprice request sent to vendor"
cateringKeys.toast.orderCancelled        // "Order cancelled successfully"
```

### UI Labels
```typescript
cateringKeys.labels.notifications        // "Notifications"
cateringKeys.labels.markAllRead          // "Mark all read"
cateringKeys.labels.noNotifications      // "No notifications yet"
cateringKeys.labels.orderTimeline        // "Order Timeline"
cateringKeys.labels.specialInstructions  // "Special Instructions"
cateringKeys.labels.deliveryAddress      // "Delivery Address"
cateringKeys.labels.headcount            // "Headcount"
cateringKeys.labels.eventDate            // "Event Date"
cateringKeys.labels.subtotal             // "Subtotal"
cateringKeys.labels.tax                  // "Tax"
cateringKeys.labels.total                // "Total"
cateringKeys.labels.loadMore             // "Load More Orders"
cateringKeys.labels.noOrders             // "No orders yet"
```

### Actions/Buttons
```typescript
cateringKeys.actions.acceptAndFinalize   // "Accept & Finalize"
cateringKeys.actions.decline             // "Decline"
cateringKeys.actions.cancel              // "Cancel Order"
cateringKeys.actions.requestReprice      // "Request Reprice"
cateringKeys.actions.submitQuote         // "Submit Quote"
cateringKeys.actions.viewOrders          // "View Orders"
cateringKeys.actions.retry               // "Try Again"
cateringKeys.actions.goBack              // "Go Back"
```

### Currency
```typescript
cateringKeys.currency.symbol             // "$"
cateringKeys.currency.code               // "USD"
```

## Adding New Translations

1. Add to `src/locales/en/catering.json`:
   ```json
   {
     "newSection": {
       "newKey": "New translation text"
     }
   }
   ```

2. Add to `src/i18n.ts` (in the `en` object):
   ```typescript
   "newSection": {
     "newKey": "New translation text"
   }
   ```

3. Add to `src/hooks/useI18nCatering.ts` (in `cateringKeys`):
   ```typescript
   newSection: {
     newKey: 'newSection.newKey'
   }
   ```

4. Use in components:
   ```typescript
   const t = useI18nCatering();
   t(cateringKeys.newSection.newKey);
   ```

## Interpolation Syntax

Variables in translations use double curly braces:

```typescript
// Translation: "Invalid status transition: {{from}} → {{to}}"
t('errors.invalidTransition', {
  from: 'pending',
  to: 'ready'
});
// Result: "Invalid status transition: pending → ready"
```

## Advanced: Change Language at Runtime

```typescript
import i18n from '@/i18n';

// Switch language
i18n.changeLanguage('es');  // Requires src/locales/es/catering.json
```

## Common Patterns

### In JSX
```typescript
function OrderCard() {
  const t = useI18nCatering();
  
  return (
    <div className="card">
      <h3>{t('labels.orderTimeline')}</h3>
      <p>{t(cateringKeys.status.confirmed)}</p>
      <button>{t(cateringKeys.actions.viewOrders)}</button>
    </div>
  );
}
```

### In Event Handlers
```typescript
function handleError(error: string) {
  const t = useI18nCatering();
  
  const messages: Record<string, string> = {
    'headcount': t(cateringKeys.errors.headcountMax),
    'eta': t(cateringKeys.errors.invalidETA),
  };
  
  showError(messages[error] || 'Unknown error');
}
```

### In Conditional Rendering
```typescript
function OrderStatus({ status }: { status: string }) {
  const t = useI18nCatering();
  
  const statusMap = {
    'pending': t(cateringKeys.status.pending),
    'confirmed': t(cateringKeys.status.confirmed),
    'delivered': t(cateringKeys.status.delivered),
  } as const;
  
  return <span>{statusMap[status as keyof typeof statusMap]}</span>;
}
```

## Testing

```typescript
import i18n from '@/i18n';

// Test translation loads
expect(i18n.t('status.confirmed')).toBe('Order Confirmed');

// Test interpolation
expect(i18n.t('errors.invalidTransition', {
  from: 'pending',
  to: 'ready'
})).toBe('Invalid status transition: pending → ready');
```

## Documentation

Full documentation available in: `I18N_SETUP_GUIDE.md`

For TypeScript support: `src/hooks/useI18nCatering.ts`
For formatting utilities: `src/utils/formatLocale.ts`
