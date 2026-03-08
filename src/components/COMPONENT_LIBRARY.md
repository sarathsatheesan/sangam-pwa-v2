# Sangam PWA Component Library

A comprehensive reusable component library built with React, TypeScript, Tailwind CSS v4, and Framer Motion for the Sangam PWA application.

## Color Scheme

The components use Delta Airlines theme colors:
- **Primary**: `#0032A0` (Delta Navy) - `bg-[#0032A0]`, `text-[#0032A0]`, `border-[#0032A0]`
- **Accent**: `#C8102E` (Delta Red) - `bg-[#C8102E]`, `text-[#C8102E]`
- **Background**: `#F5F7FA` (Sangam Background) - `bg-[#F5F7FA]`
- **Text**: `#1A1A2E` (Sangam Text) - `text-[#1A1A2E]`
- **Text Secondary**: `#5A6A7E` (Sangam Text Secondary) - `text-[#5A6A7E]`

## Shared Components

### Button
**Location**: `src/components/shared/Button.tsx`

Reusable button component with multiple variants and sizes.

```tsx
import Button from '@/components/shared/Button';

// Primary button
<Button variant="primary" size="md">Click me</Button>

// With icon and loading state
<Button variant="primary" loading={isLoading} icon={<Heart size={20} />}>
  Like
</Button>

// Full width danger button
<Button variant="danger" fullWidth>Delete</Button>

// Ghost button
<Button variant="ghost">Cancel</Button>
```

**Props**:
- `variant`: `'primary' | 'secondary' | 'danger' | 'ghost'` (default: `'primary'`)
- `size`: `'sm' | 'md' | 'lg'` (default: `'md'`)
- `loading`: `boolean` (shows spinner when true)
- `icon`: `React.ReactNode` (optional icon)
- `fullWidth`: `boolean` (stretches to fill container)
- `children`: `React.ReactNode`
- Standard HTML button attributes

### Card
**Location**: `src/components/shared/Card.tsx`

Lightweight container component for content.

```tsx
import Card from '@/components/shared/Card';

<Card hover padding="md">
  <h3>Card Title</h3>
  <p>Card content goes here</p>
</Card>
```

**Props**:
- `children`: `React.ReactNode`
- `hover`: `boolean` (enables hover shadow effect, default: `false`)
- `padding`: `'none' | 'sm' | 'md' | 'lg'` (default: `'md'`)
- `className`: `string` (additional classes)

### Modal
**Location**: `src/components/shared/Modal.tsx`

Full-featured modal dialog with animations.

```tsx
import Modal from '@/components/shared/Modal';
import { useState } from 'react';

const [isOpen, setIsOpen] = useState(false);

<Modal
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  title="Confirm Action"
  size="md"
>
  <p>Are you sure you want to proceed?</p>
  <div className="mt-4 flex gap-2">
    <Button onClick={() => setIsOpen(false)}>Cancel</Button>
    <Button variant="primary">Confirm</Button>
  </div>
</Modal>
```

**Features**:
- Smooth fade + scale animations (Framer Motion)
- Backdrop blur effect
- Click outside to close
- Escape key to close
- Prevents body scroll when open
- Scrollable body for long content

**Props**:
- `isOpen`: `boolean`
- `onClose`: `() => void`
- `title`: `string` (optional)
- `children`: `React.ReactNode`
- `size`: `'sm' | 'md' | 'lg' | 'xl'` (default: `'md'`)

### Toast
**Location**: `src/components/shared/Toast.tsx`

Toast notification system using context.

```tsx
import { useToast } from '@/contexts/ToastContext';

const { addToast } = useToast();

// In your app
addToast('Changes saved!', 'success');
addToast('An error occurred', 'error');
addToast('New message arrived', 'info');
addToast('This is a warning', 'warning');
```

**Features**:
- 4 toast types with distinct colors: success (green), error (red), info (blue), warning (yellow)
- Auto-dismiss after duration (default: 4000ms)
- Slide in from right animation
- Fade out on dismiss
- Fixed top-right position
- Close button on each toast

**ToastContext Methods**:
- `addToast(message: string, type?: ToastType, duration?: number): string` - Returns toast ID
- `removeToast(id: string): void`

### SkeletonLoader
**Location**: `src/components/shared/SkeletonLoader.tsx`

Animated placeholder components for loading states.

```tsx
import SkeletonLoader from '@/components/shared/SkeletonLoader';

// Text skeleton (3 lines)
<SkeletonLoader variant="text" />

// Card skeleton
<SkeletonLoader variant="card" count={3} />

// Avatar with info
<SkeletonLoader variant="avatar" />

// List skeleton
<SkeletonLoader variant="list" count={5} />
```

**Props**:
- `variant`: `'text' | 'card' | 'avatar' | 'list'` (default: `'text'`)
- `count`: `number` (number of items, default: `1`)
- `className`: `string` (additional classes)

### EmptyState
**Location**: `src/components/shared/EmptyState.tsx`

Centered empty state component with icon, text, and optional CTA.

```tsx
import EmptyState from '@/components/shared/EmptyState';

<EmptyState
  icon="📭"
  title="No results found"
  description="Try adjusting your search filters"
  action={{
    label: 'Clear filters',
    onClick: () => handleClearFilters(),
  }}
/>
```

**Props**:
- `icon`: `React.ReactNode` (optional)
- `title`: `string`
- `description`: `string`
- `action`: `{ label: string; onClick: () => void }` (optional)
- `className`: `string` (additional classes)

## Form Components

### SearchInput
**Location**: `src/components/forms/SearchInput.tsx`

Search input with built-in search icon and clear button.

```tsx
import SearchInput from '@/components/forms/SearchInput';
import { useState } from 'react';

const [query, setQuery] = useState('');

<SearchInput
  placeholder="Search businesses..."
  value={query}
  onChange={setQuery}
  onClear={() => setQuery('')}
/>
```

**Features**:
- Search icon on left
- Clear button (X) on right (only shows when input has value)
- Focus ring in delta navy
- Responsive design

**Props**:
- `placeholder`: `string` (default: `'Search...'`)
- `value`: `string`
- `onChange`: `(value: string) => void`
- `onClear`: `() => void` (optional)
- `className`: `string` (additional classes)
- Standard HTML input attributes

## Layout Components

### AppHeader
**Location**: `src/components/layout/AppHeader.tsx`

Sticky application header with navigation and user menu.

**Features**:
- Sticky positioning at top with z-index 40
- Logo with hamburger menu (mobile) and app name
- Location button showing selected city
- User profile button (avatar or user icon)
- Mobile dropdown menu with:
  - Location selector
  - Profile link
  - Admin panel link (if user is admin)
  - Settings link
  - Sign out button
- Responsive design (hamburger on mobile)
- Click outside to close menu
- Uses `useAuth` and `useLocation` contexts
- Sign out via `signOutUser` from auth service

**Integrations**:
- `useAuth()` - For user profile and admin status
- `useLocation()` - For selected location display
- `signOutUser()` - For sign out functionality
- `react-router-dom` - For navigation

### ModuleSelector
**Location**: `src/components/layout/ModuleSelector.tsx`

Horizontal scrollable tab bar for app modules.

**Modules** (with feature flags):
1. Feed (Home) - `modules_feed`
2. Discover (Users) - `modules_discover`
3. Business (Briefcase) - `modules_business`
4. Housing (Building2) - `modules_housing`
5. Events (Calendar) - `modules_events`
6. Travel (Plane) - `modules_travel`
7. Forum (MessageSquare) - `modules_forum`
8. Messages (Mail) - `modules_messages`

**Features**:
- Sticky positioning below header
- Horizontal scrolling with smooth animation
- Left/right scroll indicators (gradient buttons)
- Active module highlighted with delta navy background
- Responsive design
- Hides scrollbar while maintaining functionality
- Uses feature flags from `useFeatureSettings`
- Lucide React icons for each module

**Integrations**:
- `useFeatureSettings()` - For module visibility
- `react-router-dom` - For navigation and active state detection

### AppFooter
**Location**: `src/components/layout/AppFooter.tsx`

Simple footer with action buttons.

**Actions**:
1. **Feedback** (Mail icon) - Opens `mailto:feedback@sangamapp.com`
2. **Contact** (AtSign icon) - Opens `mailto:contact@sangamapp.com`
3. **Share** (Share2 icon) - Uses `navigator.share` or clipboard fallback
4. **Phone** (Phone icon) - Opens `tel:+1-800-SANGAM`

**Features**:
- Light gray background with top border
- Responsive button layout (icon only on mobile, icon + label on desktop)
- Hover effects on buttons
- Uses native share API when available
- Clipboard fallback for sharing

## Main Layout

### MainLayout
**Location**: `src/layouts/MainLayout.tsx`

Root layout component that combines all layout components.

```tsx
import { MainLayout } from '@/layouts/MainLayout';
import { useRoutes } from 'react-router-dom';

const routes = useRoutes([
  {
    path: '/',
    element: <MainLayout />,
    children: [
      { path: 'feed', element: <FeedPage /> },
      // ... other routes
    ],
  },
]);
```

**Structure**:
```
<MainLayout>
  ├─ AppHeader (sticky top)
  ├─ ModuleSelector (sticky below header)
  ├─ Main Content (scrollable, flex-1)
  ├─ AppFooter (sticky bottom)
  └─ ToastContainer (fixed top-right)
</MainLayout>
```

**Features**:
- Full page flex layout with min-h-screen
- Background color: Sangam background (`#F5F7FA`)
- Proper spacing and overflow handling
- Toast notification overlay
- Works with React Router's `<Outlet />`

## Styling Approach

All components use:
- **Tailwind CSS v4** with utility classes
- **clsx** for conditional class merging
- **CSS custom properties** for theme colors
- Standard Tailwind classes for responsive design (sm:, md:, lg:, xl:)
- Consistent spacing scale (4px base unit)
- Smooth transitions and animations

### Color Utilities Used

```tsx
// Primary (Delta Navy)
bg-[#0032A0]
text-[#0032A0]
border-[#0032A0]

// Accent (Delta Red)
bg-[#C8102E]
text-[#C8102E]

// Background
bg-[#F5F7FA]

// Text
text-[#1A1A2E]
text-[#5A6A7E]
```

## Responsive Design

All components follow mobile-first responsive patterns:
- **Mobile**: Default styles optimized for small screens
- **Tablet** (sm: 640px): Minor adjustments
- **Desktop** (md: 768px): Full features visible
- **Large Desktop** (lg: 1024px): Optimal spacing

## Dependencies

- **React** (19.2.0) - UI library
- **React DOM** (19.2.0) - DOM rendering
- **React Router DOM** (7.13.0) - Routing and navigation
- **Tailwind CSS** (4.2.0) - Utility-first CSS
- **Framer Motion** (12.34.3) - Animations
- **Lucide React** (0.575.0) - Icons
- **clsx** (2.1.1) - Class name merging

## Best Practices

1. **Always import from the main export**: Use `import Button from '@/components/shared/Button'`
2. **Use component index files**: Import groups from `index.ts` files
3. **Keep components pure**: Avoid side effects in component bodies
4. **Use TypeScript**: Full type safety with provided interfaces
5. **Test responsiveness**: Check mobile, tablet, and desktop views
6. **Consistent spacing**: Use Tailwind's spacing scale
7. **Accessibility**: Buttons have proper labels, modals trap focus, etc.

## Component Composition Example

```tsx
import { useState } from 'react';
import Button from '@/components/shared/Button';
import Card from '@/components/shared/Card';
import Modal from '@/components/shared/Modal';
import { useToast } from '@/contexts/ToastContext';

export const MyFeature = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { addToast } = useToast();

  const handleSubmit = async () => {
    try {
      // Do something
      addToast('Success!', 'success');
      setIsModalOpen(false);
    } catch (error) {
      addToast('Error occurred', 'error');
    }
  };

  return (
    <Card hover padding="lg">
      <h2 className="text-2xl font-bold mb-4">My Feature</h2>
      <Button onClick={() => setIsModalOpen(true)}>Open Dialog</Button>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Confirm Action"
      >
        <p>Are you sure?</p>
        <div className="mt-4 flex gap-2">
          <Button variant="ghost" onClick={() => setIsModalOpen(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit}>
            Confirm
          </Button>
        </div>
      </Modal>
    </Card>
  );
};
```

## Common Patterns

### Loading State
```tsx
const [isLoading, setIsLoading] = useState(false);

<Button loading={isLoading} onClick={handleClick}>
  Submit
</Button>
```

### Form Submission
```tsx
const [formData, setFormData] = useState({});
const [isSubmitting, setIsSubmitting] = useState(false);

const handleSubmit = async () => {
  setIsSubmitting(true);
  try {
    // API call
    addToast('Saved!', 'success');
  } catch (error) {
    addToast('Error: ' + error.message, 'error');
  } finally {
    setIsSubmitting(false);
  }
};
```

### Empty State Handling
```tsx
{data.length === 0 ? (
  <EmptyState
    icon="📭"
    title="No items"
    description="You haven't created any items yet"
    action={{ label: 'Create one', onClick: () => {} }}
  />
) : (
  <div className="grid gap-4">
    {/* Render items */}
  </div>
)}
```

---

**Last Updated**: February 2025
**Version**: 1.0.0
**Maintained by**: Sangam PWA Team
