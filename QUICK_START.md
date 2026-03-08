# Sangam PWA Component Library - Quick Start

## Installation & Setup

The component library is already built and ready to use. All dependencies are installed in your `package.json`.

## Using Components in Your Pages

### 1. Import the Components

```typescript
// In your page/component file
import Button from '@/components/shared/Button';
import Card from '@/components/shared/Card';
import { useToast } from '@/contexts/ToastContext';
```

### 2. Basic Button Example

```tsx
import Button from '@/components/shared/Button';

export const MyPage = () => {
  const handleClick = () => {
    console.log('Button clicked!');
  };

  return (
    <div>
      {/* Primary button */}
      <Button onClick={handleClick}>Click me</Button>

      {/* Different variants */}
      <Button variant="secondary">Secondary</Button>
      <Button variant="danger">Delete</Button>
      <Button variant="ghost">Cancel</Button>

      {/* Different sizes */}
      <Button size="sm">Small</Button>
      <Button size="md">Medium</Button>
      <Button size="lg">Large</Button>

      {/* Full width */}
      <Button fullWidth>Full Width Button</Button>

      {/* Loading state */}
      <Button loading>Loading...</Button>
    </div>
  );
};
```

### 3. Card with Content

```tsx
import Card from '@/components/shared/Card';

export const MyPage = () => {
  return (
    <Card hover padding="lg">
      <h2>Card Title</h2>
      <p>Card content goes here</p>
    </Card>
  );
};
```

### 4. Using Toast Notifications

```tsx
import { useToast } from '@/contexts/ToastContext';
import Button from '@/components/shared/Button';

export const MyPage = () => {
  const { addToast } = useToast();

  return (
    <div className="space-y-2">
      <Button onClick={() => addToast('Success!', 'success')}>
        Show Success Toast
      </Button>
      <Button onClick={() => addToast('Error occurred', 'error')}>
        Show Error Toast
      </Button>
      <Button onClick={() => addToast('Info message', 'info')}>
        Show Info Toast
      </Button>
      <Button onClick={() => addToast('Warning!', 'warning')}>
        Show Warning Toast
      </Button>
    </div>
  );
};
```

### 5. Modal Dialog

```tsx
import { useState } from 'react';
import Button from '@/components/shared/Button';
import Modal from '@/components/shared/Modal';

export const MyPage = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setIsOpen(true)}>Open Modal</Button>

      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Confirm Action"
      >
        <p>Are you sure you want to proceed?</p>
        <div className="mt-6 flex gap-2 justify-end border-t border-gray-200 pt-4">
          <Button variant="ghost" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          <Button onClick={() => setIsOpen(false)}>
            Confirm
          </Button>
        </div>
      </Modal>
    </>
  );
};
```

### 6. Search Input

```tsx
import { useState } from 'react';
import SearchInput from '@/components/forms/SearchInput';

export const MyPage = () => {
  const [query, setQuery] = useState('');

  return (
    <SearchInput
      placeholder="Search businesses..."
      value={query}
      onChange={setQuery}
      onClear={() => setQuery('')}
    />
  );
};
```

### 7. Empty State

```tsx
import EmptyState from '@/components/shared/EmptyState';

export const MyPage = () => {
  return (
    <EmptyState
      icon="📭"
      title="No results found"
      description="Try adjusting your search filters"
      action={{
        label: 'Clear Filters',
        onClick: () => console.log('Clear filters'),
      }}
    />
  );
};
```

### 8. Skeleton Loading

```tsx
import SkeletonLoader from '@/components/shared/SkeletonLoader';

export const MyPage = () => {
  const [isLoading, setIsLoading] = useState(true);

  return (
    <div>
      {isLoading ? (
        <SkeletonLoader variant="list" count={3} />
      ) : (
        <div>Your content here</div>
      )}
    </div>
  );
};
```

## Complete Page Example

```tsx
import { useState } from 'react';
import Button from '@/components/shared/Button';
import Card from '@/components/shared/Card';
import Modal from '@/components/shared/Modal';
import SearchInput from '@/components/forms/SearchInput';
import EmptyState from '@/components/shared/EmptyState';
import { useToast } from '@/contexts/ToastContext';

export const BusinessListPage = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { addToast } = useToast();

  const [businesses, setBusinesses] = useState([
    { id: 1, name: 'Restaurant A', category: 'Food' },
    { id: 2, name: 'Hotel B', category: 'Accommodation' },
  ]);

  const handleCreateBusiness = async () => {
    setIsSubmitting(true);
    try {
      // API call here
      await new Promise(resolve => setTimeout(resolve, 1000));
      addToast('Business created successfully!', 'success');
      setIsModalOpen(false);
    } catch (error) {
      addToast('Failed to create business', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredBusinesses = businesses.filter(b =>
    b.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Businesses</h1>
        <Button onClick={() => setIsModalOpen(true)}>Add Business</Button>
      </div>

      {/* Search */}
      <Card>
        <SearchInput
          placeholder="Search by name..."
          value={searchQuery}
          onChange={setSearchQuery}
          onClear={() => setSearchQuery('')}
        />
      </Card>

      {/* Businesses List */}
      {filteredBusinesses.length === 0 ? (
        <EmptyState
          icon="🏢"
          title="No businesses found"
          description="Create your first business listing"
          action={{
            label: 'Add Business',
            onClick: () => setIsModalOpen(true),
          }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredBusinesses.map(business => (
            <Card key={business.id} hover padding="lg">
              <h3 className="font-semibold mb-2">{business.name}</h3>
              <p className="text-sm text-gray-600 mb-4">{business.category}</p>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary">
                  View
                </Button>
                <Button size="sm" variant="danger">
                  Delete
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Add New Business"
      >
        <div className="space-y-4">
          <input
            type="text"
            placeholder="Business name"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0032A0]"
          />
          <input
            type="text"
            placeholder="Category"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0032A0]"
          />
          <div className="flex gap-2 justify-end pt-4 border-t">
            <Button variant="ghost" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button loading={isSubmitting} onClick={handleCreateBusiness}>
              Create
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
```

## Common Props Reference

### Button
```tsx
<Button
  variant="primary" // 'primary' | 'secondary' | 'danger' | 'ghost'
  size="md" // 'sm' | 'md' | 'lg'
  loading={false}
  icon={<Heart size={20} />}
  fullWidth={false}
  disabled={false}
>
  Click me
</Button>
```

### Card
```tsx
<Card
  hover={true}
  padding="md" // 'none' | 'sm' | 'md' | 'lg'
  className="custom-class"
>
  Content
</Card>
```

### Modal
```tsx
<Modal
  isOpen={true}
  onClose={() => {}}
  title="Modal Title"
  size="md" // 'sm' | 'md' | 'lg' | 'xl'
>
  Content
</Modal>
```

### SearchInput
```tsx
<SearchInput
  placeholder="Search..."
  value={query}
  onChange={(val) => setQuery(val)}
  onClear={() => setQuery('')}
/>
```

## Color Classes Reference

```tsx
// Primary (Delta Navy)
className="bg-[#0032A0] text-[#0032A0] border-[#0032A0]"

// Accent (Delta Red)
className="bg-[#C8102E] text-[#C8102E]"

// Background
className="bg-[#F5F7FA]"

// Text
className="text-[#1A1A2E] text-[#5A6A7E]"

// With Tailwind prefixes
className="hover:bg-[#0032A0] focus:ring-[#0032A0]"
```

## Responsive Tailwind Classes

```tsx
// Mobile first
className="p-4 sm:p-6 lg:p-8"
className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
className="hidden sm:block"
className="flex-col sm:flex-row"
```

## Import Patterns

```typescript
// Option 1: Import from component file
import Button from '@/components/shared/Button';

// Option 2: Import from index (when using index.ts exports)
import { Button, Card, Modal } from '@/components/shared';

// Option 3: Import from layout
import { AppHeader, ModuleSelector } from '@/components/layout';

// Option 4: Import from forms
import { SearchInput } from '@/components/forms';
```

## Next Steps

1. **Read the full documentation** at `/src/components/COMPONENT_LIBRARY.md`
2. **Check integration examples** at `/src/components/INTEGRATION_GUIDE.md`
3. **Use components in your pages** - Start building features!
4. **Customize as needed** - All components are fully typed and extensible

## Support & Troubleshooting

### TypeScript Issues
- Ensure all context providers are in your App root
- Check that `@/` path alias is configured in `tsconfig.json`

### Styling Issues
- Verify Tailwind CSS is properly configured
- Check that arbitrary color values like `bg-[#0032A0]` are not being purged
- Use `safelist` in Tailwind config if needed

### Component Not Rendering
- Check that required props are provided
- Verify context hooks are within appropriate providers
- Check browser console for error messages

## Key Files

| File | Purpose |
|------|---------|
| `/src/components/shared/Button.tsx` | Reusable button component |
| `/src/components/shared/Card.tsx` | Container component |
| `/src/components/shared/Modal.tsx` | Dialog component |
| `/src/components/shared/Toast.tsx` | Notification system |
| `/src/components/shared/EmptyState.tsx` | Empty state UI |
| `/src/components/forms/SearchInput.tsx` | Search input field |
| `/src/components/layout/AppHeader.tsx` | Main app header |
| `/src/components/layout/ModuleSelector.tsx` | Module tab navigation |
| `/src/components/layout/AppFooter.tsx` | App footer |
| `/src/layouts/MainLayout.tsx` | Root layout structure |

---

**Version**: 1.0.0
**Last Updated**: February 22, 2025
