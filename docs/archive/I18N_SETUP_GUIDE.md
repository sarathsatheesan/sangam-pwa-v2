# i18n (Internationalization) Setup Guide - Catering Module

This document describes the i18n implementation for the catering module using i18next and react-i18next.

## Overview

The catering module now supports internationalization (i18n), enabling multi-language support for all hardcoded UI strings. This implementation provides:

- English translations for all catering module strings
- Type-safe translation key access via custom hooks
- Locale-aware formatting utilities for currency, dates, and numbers
- Extensible architecture for adding additional languages

## Files Created

### Configuration Files
- **`src/i18n.ts`** - i18next configuration with English translations embedded
- **`src/locales/en/catering.json`** - English translation resource (separate JSON file for future locale switching)

### Utility Files
- **`src/utils/formatLocale.ts`** - Locale-aware formatting functions:
  - `formatCurrency(cents, locale, currency)` - Format currency values
  - `formatDate(date, locale, options)` - Format dates
  - `formatDateTime(date, locale)` - Format date+time
  - `formatNumber(value, locale)` - Format numbers

### Hook Files
- **`src/hooks/useI18nCatering.ts`** - Custom hook for accessing translations
  - `useI18nCatering()` - Main hook for component use
  - `cateringKeys` - Type-safe key constants

### Configuration Updates
- **`src/main.tsx`** - Added `import './i18n'` initialization
- **`tsconfig.app.json`** - Added `"resolveJsonModule": true` for JSON imports
- **`package.json`** - Added dependencies:
  - `i18next@^26.0.8`
  - `react-i18next@^17.0.6`

## Translation Structure

All catering translations are organized in the following namespace structure:

```typescript
{
  status: {
    pending, confirmed, preparing, ready, out_for_delivery, delivered, cancelled
  },
  errors: {
    orderNotFound, invalidTransition, unauthorized, invalidETA, etaAfterEvent,
    headcountMin, headcountMax, failedToAccept, failedToDecline, failedToSubmit
  },
  toast: {
    orderAccepted, ordersAccepted, ordersAlreadyCreated, quoteDeclined,
    repriceRequested, orderCancelled
  },
  labels: {
    notifications, markAllRead, noNotifications, orderTimeline,
    specialInstructions, deliveryAddress, headcount, eventDate,
    subtotal, tax, total, loadMore, noOrders
  },
  actions: {
    acceptAndFinalize, decline, cancel, requestReprice, submitQuote,
    viewOrders, retry, goBack
  },
  currency: {
    symbol, code
  }
}
```

## Usage Guide

### Basic Usage in Components

```typescript
import { useI18nCatering } from '@/hooks/useI18nCatering';

function OrderStatus() {
  const t = useI18nCatering();
  
  return (
    <div>
      <h2>{t('labels.orderTimeline')}</h2>
      <p>{t('status.confirmed')}</p>
    </div>
  );
}
```

### Interpolation (Dynamic Values)

```typescript
const t = useI18nCatering();

// With single variable
const message = t('errors.invalidTransition', {
  from: 'pending',
  to: 'ready'
});
// Output: "Invalid status transition: pending → ready"

// With count (plural support - requires i18next-plural plugin)
const message = t('toast.ordersAccepted', { count: 5 });
// Output: "5 orders accepted and created. Track them in your orders tab."
```

### Type-Safe Key Access

```typescript
import { cateringKeys } from '@/hooks/useI18nCatering';

const t = useI18nCatering();

// Type-safe access prevents runtime errors
const status = t(cateringKeys.status.confirmed);
const error = t(cateringKeys.errors.headcountMax);
const action = t(cateringKeys.actions.acceptAndFinalize);
```

### Locale-Aware Formatting

```typescript
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatNumber
} from '@/utils/formatLocale';

// Currency formatting (input is cents)
const price = formatCurrency(14999, 'en-US', 'USD');
// Output: "$149.99"

// Date formatting
const date = formatDate(new Date(), 'en-US');
// Output: "Apr 27, 2026"

// Date+time formatting
const dateTime = formatDateTime(new Date(), 'en-US');
// Output: "Apr 27, 2:30 PM PDT"

// Number formatting
const count = formatNumber(1234, 'en-US');
// Output: "1,234"
```

## Adding New Translations

To add new translations to the catering module:

1. **Add the translation key to `src/locales/en/catering.json`**:
   ```json
   {
     "newSection": {
       "newKey": "New translation text"
     }
   }
   ```

2. **Update `src/i18n.ts`** with the new key in the embedded translations object

3. **Update `src/hooks/useI18nCatering.ts`** to add the key to the `cateringKeys` constant:
   ```typescript
   newSection: {
     newKey: 'newSection.newKey'
   }
   ```

4. **Use in components**:
   ```typescript
   const t = useI18nCatering();
   <p>{t('newSection.newKey')}</p>
   ```

## Adding New Languages

To add support for additional languages (e.g., Spanish, Hindi):

1. **Create a new language file**:
   ```bash
   mkdir -p src/locales/es
   # Create src/locales/es/catering.json with Spanish translations
   ```

2. **Update `src/i18n.ts`** to register the new language:
   ```typescript
   import es from './locales/es/catering.json' assert { type: 'json' };
   
   i18n.init({
     resources: {
       en: { catering: en },
       es: { catering: es },  // Add new language
     },
     // ...
   });
   ```

3. **Switch languages at runtime**:
   ```typescript
   import i18n from '@/i18n';
   
   // Change language
   i18n.changeLanguage('es');
   ```

## Interpolation Variables

Some translations use variables that are substituted at runtime:

- `{{from}}` and `{{to}}` - Status transition error message
- `{{count}}` - Plural forms in toast messages

Example:
```typescript
t('errors.invalidTransition', { from: 'pending', to: 'ready' })
// Output: "Invalid status transition: pending → ready"
```

## Formatting Conventions

### Currency
- Input: Integer cents (e.g., 14999 for $149.99)
- Output: Locale-formatted currency string (e.g., "$149.99")
- Usage: `formatCurrency(cents, 'en-US', 'USD')`

### Dates
- Format: 3-letter month, numeric day, 4-digit year
- Example: "Apr 27, 2026"
- Custom options supported via `Intl.DateTimeFormatOptions`

### Numbers
- Uses locale-specific formatting (e.g., thousands separators)
- Example: "1,234" for 1234 in English, "1.234" in German

## Migration Path

To migrate existing hardcoded strings in catering components to use i18n:

1. Identify all hardcoded user-facing strings
2. Add translations to `src/locales/en/catering.json`
3. Replace hardcoded strings with `t('key')`
4. Update `useI18nCatering.ts` keys if new sections are needed

Example migration:
```typescript
// Before
<button>{translate('Order Confirmed')}</button>

// After
const t = useI18nCatering();
<button>{t('status.confirmed')}</button>
```

## Testing

To test i18n functionality:

1. **Verify translations load**:
   ```typescript
   import i18n from '@/i18n';
   console.log(i18n.t('status.pending')); // Should output: "Order Placed"
   ```

2. **Test interpolation**:
   ```typescript
   const msg = i18n.t('errors.invalidTransition', {
     from: 'pending',
     to: 'ready'
   });
   console.log(msg); // Should output: "Invalid status transition: pending → ready"
   ```

3. **Test locale formatting**:
   ```typescript
   import { formatCurrency } from '@/utils/formatLocale';
   console.log(formatCurrency(14999)); // Should output: "$149.99"
   ```

## Performance Considerations

- Translations are loaded once at app initialization
- The `useI18nCatering()` hook uses memoization to prevent unnecessary re-renders
- Locale formatting uses native `Intl` API (no additional libraries needed)
- JSON translation files can be split per language for code-splitting in future

## Future Enhancements

- **i18next-pluralr**: For proper plural form support across languages
- **Language detection**: Auto-detect user language from browser settings
- **Language switcher**: UI component for runtime language switching
- **RTL support**: Right-to-left language support (Arabic, Hebrew, etc.)
- **Namespace splitting**: Separate translation files per feature/page
- **Translation management**: Integration with cloud translation services

## References

- [i18next Documentation](https://www.i18next.com/)
- [react-i18next Documentation](https://react.i18next.com/)
- [MDN Intl API](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl)
