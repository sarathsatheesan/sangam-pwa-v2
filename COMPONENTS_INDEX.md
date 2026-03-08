# Sangam PWA Component Library Index

## Documentation Overview

This document serves as a central index for all component library documentation and files.

## Quick Navigation

### For Getting Started
1. **[QUICK_START.md](./QUICK_START.md)** - Start here for basic usage examples
2. **[COMPONENT_BUILD_SUMMARY.md](./COMPONENT_BUILD_SUMMARY.md)** - Overview of what was built

### For Detailed Information
3. **[src/components/COMPONENT_LIBRARY.md](./src/components/COMPONENT_LIBRARY.md)** - Complete component documentation
4. **[src/components/INTEGRATION_GUIDE.md](./src/components/INTEGRATION_GUIDE.md)** - Advanced integration patterns

### For Verification
5. **[COMPONENT_CHECKLIST.md](./COMPONENT_CHECKLIST.md)** - Full verification checklist

---

## Component List

### Shared Components (6 components)

| Component | Path | Purpose | Key Features |
|-----------|------|---------|--------------|
| **Button** | `src/components/shared/Button.tsx` | Reusable action button | 4 variants, 3 sizes, loading state, icon support |
| **Card** | `src/components/shared/Card.tsx` | Content container | Hover effect, customizable padding, shadow |
| **Modal** | `src/components/shared/Modal.tsx` | Dialog window | Animations, click-outside close, Escape key |
| **Toast** | `src/components/shared/Toast.tsx` | Notifications | 4 types, auto-dismiss, animations |
| **SkeletonLoader** | `src/components/shared/SkeletonLoader.tsx` | Loading state | 4 variants, animated pulse |
| **EmptyState** | `src/components/shared/EmptyState.tsx` | No content view | Icon, title, description, CTA button |

### Form Components (1 component)

| Component | Path | Purpose | Key Features |
|-----------|------|---------|--------------|
| **SearchInput** | `src/components/forms/SearchInput.tsx` | Search field | Icons, clear button, focus ring |

### Layout Components (3 components)

| Component | Path | Purpose | Key Features |
|-----------|------|---------|--------------|
| **AppHeader** | `src/components/layout/AppHeader.tsx` | Top navigation | Sticky, mobile menu, location, user profile |
| **ModuleSelector** | `src/components/layout/ModuleSelector.tsx` | Module tabs | 8 modules, horizontal scroll, feature flags |
| **AppFooter** | `src/components/layout/AppFooter.tsx` | Bottom actions | 4 action buttons (feedback, contact, share, phone) |

### Main Layout

| Component | Path | Purpose | Key Features |
|-----------|------|---------|--------------|
| **MainLayout** | `src/layouts/MainLayout.tsx` | Root layout | Combines all layout components, toast container |

---

## File Structure

```
sangam-pwa/
├── src/
│   ├── components/
│   │   ├── shared/
│   │   │   ├── Button.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── Toast.tsx
│   │   │   ├── SkeletonLoader.tsx
│   │   │   ├── EmptyState.tsx
│   │   │   ├── PrivateRoute.tsx (existing)
│   │   │   └── index.ts
│   │   ├── forms/
│   │   │   ├── SearchInput.tsx
│   │   │   └── index.ts
│   │   ├── layout/
│   │   │   ├── AppHeader.tsx
│   │   │   ├── ModuleSelector.tsx
│   │   │   ├── AppFooter.tsx
│   │   │   └── index.ts
│   │   ├── COMPONENT_LIBRARY.md (500+ lines)
│   │   └── INTEGRATION_GUIDE.md (600+ lines)
│   └── layouts/
│       └── MainLayout.tsx (updated)
├── QUICK_START.md (Quick reference)
├── COMPONENT_BUILD_SUMMARY.md (Build overview)
├── COMPONENT_CHECKLIST.md (Verification)
└── COMPONENTS_INDEX.md (this file)
```

---

## Usage Examples by Feature

### Authentication & Authorization
- See: **AppHeader.tsx** for admin panel conditional rendering
- Context: `useAuth()` for user profile, isAdmin checks
- See: **INTEGRATION_GUIDE.md** section "Using Auth Context"

### Location Display
- See: **AppHeader.tsx** for location button display
- Context: `useLocation()` for selected location
- See: **INTEGRATION_GUIDE.md** section "Using Location Context"

### Toast Notifications
- See: **Toast.tsx** and **ToastContainer**
- Context: `useToast()` for adding notifications
- See: **QUICK_START.md** section "Using Toast Notifications"

### Feature Flags
- See: **ModuleSelector.tsx** for module visibility
- Context: `useFeatureSettings()` for feature checks
- See: **COMPONENT_LIBRARY.md** section "ModuleSelector"

### Responsive Design
- See: **AppHeader.tsx** for mobile menu implementation
- See: **ModuleSelector.tsx** for horizontal scrolling
- See: **AppFooter.tsx** for responsive button layout
- Reference: **COMPONENT_LIBRARY.md** section "Responsive Design"

### Loading States
- Use: **SkeletonLoader** for data loading
- Use: **Button** with `loading` prop
- See: **INTEGRATION_GUIDE.md** section "Loading States"

### Forms & Inputs
- Use: **SearchInput** for search functionality
- See: **INTEGRATION_GUIDE.md** section "Form Submission with Modal"

### Dialogs & Modals
- Use: **Modal** for user confirmations
- See: **QUICK_START.md** section "Modal Dialog"

---

## Key Features Summary

### Color Scheme (Delta Airlines Theme)
- **Primary**: `#0032A0` (Delta Navy)
- **Accent**: `#C8102E` (Delta Red)
- **Background**: `#F5F7FA` (Sangam Light)
- **Text**: `#1A1A2E` (Sangam Dark)
- **Secondary Text**: `#5A6A7E` (Sangam Gray)

### Responsive Breakpoints
- **Mobile**: 320px (default)
- **Tablet** (sm): 640px
- **Tablet** (md): 768px
- **Desktop** (lg): 1024px
- **Desktop** (xl): 1280px

### Animation Library
- Framer Motion for smooth transitions
- Modal: fade + scale (200ms)
- Toast: slide in/out (300ms)
- SkeletonLoader: pulse animation
- Scroll: smooth behavior (300ms)

### Accessibility Features
- Keyboard navigation (Escape in modals)
- Proper focus states
- ARIA labels where needed
- Semantic HTML
- Touch-friendly sizes (44px+ targets)

---

## Integration Checklist

Before using the components in your application:

- [ ] Read QUICK_START.md
- [ ] Review COMPONENT_LIBRARY.md for all component APIs
- [ ] Check INTEGRATION_GUIDE.md for your use case
- [ ] Verify context providers are set up in App.tsx
- [ ] Test responsive behavior on mobile/tablet/desktop
- [ ] Check browser console for any TypeScript warnings
- [ ] Run build and verify no Tailwind warnings

---

## Common Import Patterns

```typescript
// Import individual components
import Button from '@/components/shared/Button';
import Card from '@/components/shared/Card';
import SearchInput from '@/components/forms/SearchInput';

// Import from barrel exports
import { Button, Card, Modal } from '@/components/shared';
import { SearchInput } from '@/components/forms';
import { AppHeader, ModuleSelector, AppFooter } from '@/components/layout';

// Import contexts
import { useToast } from '@/contexts/ToastContext';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from '@/contexts/LocationContext';
import { useFeatureSettings } from '@/contexts/FeatureSettingsContext';

// Import layouts
import { MainLayout } from '@/layouts/MainLayout';
```

---

## Troubleshooting

### Tailwind Colors Not Working
- Ensure arbitrary color values are in safelist if tree-shaking enabled
- Example: `safelist: ['bg-[#0032A0]', 'text-[#0032A0]']`
- Check `@tailwindcss/vite` is properly configured

### Context Hook Errors
- Verify all providers are in App.tsx root
- Check component is within provider hierarchy
- See: **INTEGRATION_GUIDE.md** for provider setup

### Modal Not Closing
- Check `onClose` prop is correctly connected
- Verify Escape key listener is not being prevented
- Click outside should close modal

### Mobile Menu Issues
- Check z-index layering (AppHeader uses z-40)
- Verify click-outside detection works
- Test on actual mobile device

### Toast Not Showing
- Verify `ToastContainer` is in MainLayout
- Check z-index (fixed top-right, z-50)
- Confirm context provider exists

---

## Performance Tips

1. **Use SkeletonLoader** while fetching data
2. **Lazy load heavy components** with React.lazy
3. **Memoize expensive components** with React.memo
4. **Use useCallback** for event handlers in props
5. **Avoid re-renders** with proper key props
6. **Debounce** SearchInput onChange if needed
7. **Use suspense boundaries** for async components

---

## Best Practices

1. **Always use TypeScript** - Full type safety
2. **Keep components pure** - No side effects in render
3. **Handle loading states** - Use SkeletonLoader or Button loading
4. **Test responsiveness** - Check all breakpoints
5. **Test accessibility** - Keyboard navigation, ARIA labels
6. **Use consistent spacing** - Stick to Tailwind scale
7. **Follow color scheme** - Use delta colors consistently
8. **Error handling** - Always catch and show toasts

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | Feb 22, 2025 | Initial component library release |

---

## Support & Questions

For questions about components:
1. Check the specific component's section in **COMPONENT_LIBRARY.md**
2. Review examples in **INTEGRATION_GUIDE.md**
3. See quick examples in **QUICK_START.md**
4. Check the component's TypeScript types for available props

---

## Next Steps

1. ✅ Component library is built and ready
2. ✅ Documentation is complete
3. Next: Build your features using these components!

---

**Last Updated**: February 22, 2025
**Version**: 1.0.0
**Status**: Production Ready
