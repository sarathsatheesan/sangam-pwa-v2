# Component Library Integration Guide

This guide demonstrates how to integrate the Sangam PWA component library into your pages and features.

## Quick Start

### 1. Basic Page Setup

```tsx
// src/pages/MyPage.tsx
import { useState } from 'react';
import Button from '@/components/shared/Button';
import Card from '@/components/shared/Card';
import SearchInput from '@/components/forms/SearchInput';
import { useToast } from '@/contexts/ToastContext';

export const MyPage = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const { addToast } = useToast();

  const handleSearch = () => {
    if (searchQuery) {
      addToast(`Searching for "${searchQuery}"`, 'info');
    }
  };

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <h1 className="text-3xl font-bold text-[#1A1A2E]">My Page</h1>

      <Card hover padding="md">
        <SearchInput
          placeholder="Search items..."
          value={searchQuery}
          onChange={setSearchQuery}
          onClear={() => setSearchQuery('')}
        />
        <div className="mt-4">
          <Button onClick={handleSearch} fullWidth>
            Search
          </Button>
        </div>
      </Card>
    </div>
  );
};
```

### 2. Form Submission with Modal

```tsx
import { useState } from 'react';
import Button from '@/components/shared/Button';
import Card from '@/components/shared/Card';
import Modal from '@/components/shared/Modal';
import { useToast } from '@/contexts/ToastContext';

export const CreateListingPage = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
  });
  const { addToast } = useToast();

  const handleSubmit = async () => {
    if (!formData.title) {
      addToast('Please fill in all required fields', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      // API call to create listing
      await new Promise(resolve => setTimeout(resolve, 1000));
      addToast('Listing created successfully!', 'success');
      setIsModalOpen(false);
      setFormData({ title: '', description: '' });
    } catch (error) {
      addToast('Failed to create listing', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-4 sm:p-6">
      <Card>
        <h2 className="text-2xl font-bold mb-4">Create New Listing</h2>
        <Button onClick={() => setIsModalOpen(true)}>New Listing</Button>
      </Card>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Create Listing"
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Title
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0032A0] focus:border-transparent"
              placeholder="Enter title"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0032A0] focus:border-transparent"
              placeholder="Enter description"
              rows={4}
            />
          </div>

          <div className="flex gap-2 justify-end pt-4 border-t border-gray-200">
            <Button variant="ghost" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={isSubmitting}
              onClick={handleSubmit}
            >
              Create
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
```

### 3. List with Empty State

```tsx
import { useState, useEffect } from 'react';
import Card from '@/components/shared/Card';
import EmptyState from '@/components/shared/EmptyState';
import SkeletonLoader from '@/components/shared/SkeletonLoader';
import Button from '@/components/shared/Button';

export const ItemsListPage = () => {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadItems = async () => {
      try {
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1000));
        setItems([
          { id: 1, title: 'Item 1', description: 'Description 1' },
          { id: 2, title: 'Item 2', description: 'Description 2' },
        ]);
      } finally {
        setLoading(false);
      }
    };

    loadItems();
  }, []);

  if (loading) {
    return (
      <div className="p-4 sm:p-6">
        <SkeletonLoader variant="list" count={3} />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6">
      {items.length === 0 ? (
        <EmptyState
          icon="📭"
          title="No items found"
          description="Start by creating your first item"
          action={{
            label: 'Create Item',
            onClick: () => console.log('Create new item'),
          }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map((item) => (
            <Card key={item.id} hover padding="lg">
              <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
              <p className="text-gray-600 mb-4">{item.description}</p>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm">
                  Edit
                </Button>
                <Button variant="danger" size="sm">
                  Delete
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
```

### 4. Responsive Grid Layout

```tsx
import Card from '@/components/shared/Card';

export const GridPage = () => {
  const items = Array.from({ length: 6 }, (_, i) => ({
    id: i,
    title: `Item ${i + 1}`,
  }));

  return (
    <div className="p-4 sm:p-6">
      <h1 className="text-3xl font-bold mb-6">Grid Layout</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {items.map((item) => (
          <Card key={item.id} hover padding="md">
            <div className="aspect-video bg-gray-200 rounded-lg mb-3" />
            <h3 className="font-semibold">{item.title}</h3>
          </Card>
        ))}
      </div>
    </div>
  );
};
```

### 5. Loading States

```tsx
import Button from '@/components/shared/Button';
import { useState } from 'react';

export const LoadingExample = () => {
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = async () => {
    setIsLoading(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));
      console.log('Done!');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-4">
      <Button loading={isLoading} onClick={handleClick}>
        {isLoading ? 'Loading...' : 'Click me'}
      </Button>

      <Button variant="danger" loading={isLoading} disabled={isLoading}>
        Disabled while loading
      </Button>
    </div>
  );
};
```

### 6. Mobile-Responsive Example

```tsx
import Card from '@/components/shared/Card';
import Button from '@/components/shared/Button';

export const ResponsivePage = () => {
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Mobile: single column, Tablet: two columns, Desktop: three columns */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} hover padding="lg">
            <h3 className="text-lg font-semibold mb-2">Card {i + 1}</h3>
            <p className="text-gray-600 text-sm mb-4">
              This card adapts to different screen sizes
            </p>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" className="flex-1">
                Action 1
              </Button>
              <Button size="sm" className="flex-1">
                Action 2
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};
```

## Component Composition Patterns

### Error Handling Pattern

```tsx
const [error, setError] = useState<string | null>(null);

const handleAction = async () => {
  try {
    setError(null);
    // Do something
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    setError(message);
    addToast(message, 'error');
  }
};

// In render:
{error && (
  <Card className="border-l-4 border-red-500 bg-red-50 text-red-800">
    <p className="font-medium">{error}</p>
    <Button size="sm" variant="ghost" onClick={() => setError(null)}>
      Dismiss
    </Button>
  </Card>
)}
```

### Pagination Pattern

```tsx
const [page, setPage] = useState(1);
const itemsPerPage = 12;

const handlePrevious = () => setPage(p => Math.max(1, p - 1));
const handleNext = () => setPage(p => p + 1);

// In render:
<div className="flex gap-2 justify-center mt-8">
  <Button
    variant="secondary"
    onClick={handlePrevious}
    disabled={page === 1}
  >
    Previous
  </Button>
  <div className="flex items-center gap-2 px-4">
    Page {page}
  </div>
  <Button variant="secondary" onClick={handleNext}>
    Next
  </Button>
</div>
```

### Filter Pattern

```tsx
const [filters, setFilters] = useState({
  category: '',
  sortBy: 'recent',
});

const handleFilterChange = (key: string, value: string) => {
  setFilters(prev => ({ ...prev, [key]: value }));
};

// In render:
<div className="flex flex-wrap gap-2 mb-6">
  <select
    value={filters.category}
    onChange={(e) => handleFilterChange('category', e.target.value)}
    className="px-3 py-2 border border-gray-300 rounded-lg"
  >
    <option value="">All Categories</option>
    <option value="food">Food</option>
    <option value="services">Services</option>
  </select>

  {filters.category && (
    <Button
      variant="secondary"
      size="sm"
      onClick={() => handleFilterChange('category', '')}
    >
      Clear Filter
    </Button>
  )}
</div>
```

## Context Integration Examples

### Using Toast Notifications

```tsx
import { useToast } from '@/contexts/ToastContext';

export const MyComponent = () => {
  const { addToast } = useToast();

  const handleSuccess = () => addToast('Action completed!', 'success', 3000);
  const handleError = () => addToast('Something went wrong', 'error', 5000);
  const handleInfo = () => addToast('Just so you know...', 'info');
  const handleWarning = () => addToast('Be careful!', 'warning');

  return (
    <div className="flex flex-wrap gap-2 p-6">
      <Button onClick={handleSuccess} className="bg-green-600">
        Success
      </Button>
      <Button onClick={handleError} className="bg-red-600">
        Error
      </Button>
      <Button onClick={handleInfo} className="bg-blue-600">
        Info
      </Button>
      <Button onClick={handleWarning} className="bg-yellow-600">
        Warning
      </Button>
    </div>
  );
};
```

### Using Auth Context

```tsx
import { useAuth } from '@/contexts/AuthContext';
import EmptyState from '@/components/shared/EmptyState';

export const ProtectedFeature = () => {
  const { user, userProfile, isAdmin } = useAuth();

  if (!user) {
    return (
      <EmptyState
        icon="🔒"
        title="Sign in required"
        description="You must be signed in to access this feature"
        action={{
          label: 'Sign In',
          onClick: () => navigate('/login'),
        }}
      />
    );
  }

  return (
    <div className="p-6">
      <h2>Welcome, {userProfile?.name}!</h2>
      {isAdmin && <AdminPanel />}
    </div>
  );
};
```

### Using Location Context

```tsx
import { useLocation } from '@/contexts/LocationContext';
import Button from '@/components/shared/Button';

export const LocationAwareFeature = () => {
  const { selectedLocation, setLocationByGeo, clearLocation } = useLocation();

  const handleUseCurrentLocation = async () => {
    try {
      await setLocationByGeo();
      addToast('Location detected!', 'success');
    } catch (error) {
      addToast('Could not detect location', 'error');
    }
  };

  return (
    <div className="p-6">
      {selectedLocation ? (
        <>
          <p>
            Current location: {selectedLocation.city}, {selectedLocation.stateAbbr}
          </p>
          <Button onClick={clearLocation} variant="secondary">
            Change Location
          </Button>
        </>
      ) : (
        <Button onClick={handleUseCurrentLocation}>
          Use Current Location
        </Button>
      )}
    </div>
  );
};
```

## Styling Tips

### Custom Spacing
```tsx
// Use Tailwind's spacing scale
<div className="p-4 sm:p-6 lg:p-8 gap-4 sm:gap-6 lg:gap-8">
  {/* content */}
</div>
```

### Custom Colors
```tsx
// Use delta colors with arbitrary values
<div className="bg-[#0032A0] text-white">Primary</div>
<div className="bg-[#C8102E] text-white">Accent</div>
<div className="bg-[#F5F7FA] text-[#1A1A2E]">Background</div>
```

### Hover Effects
```tsx
<div className="hover:shadow-md hover:bg-gray-100 transition-all duration-300">
  {/* Smooth hover effects */}
</div>
```

### Dark Mode Support (Future)
```tsx
// When implementing dark mode, use Tailwind's dark: prefix
<div className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
  {/* Supports both light and dark */}
</div>
```

## Testing Components

### Unit Testing Example
```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import Button from '@/components/shared/Button';

describe('Button', () => {
  it('renders with text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const handleClick = jest.fn();
    render(<Button onClick={handleClick}>Click me</Button>);
    fireEvent.click(screen.getByText('Click me'));
    expect(handleClick).toHaveBeenCalled();
  });

  it('shows loading state', () => {
    render(<Button loading>Loading</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });
});
```

## Performance Optimization

### Memoizing Components
```tsx
import { memo } from 'react';

const ExpensiveCard = memo(({ data }: { data: any }) => {
  return <Card>{/* render data */}</Card>;
});
```

### Lazy Loading
```tsx
import { lazy, Suspense } from 'react';
import SkeletonLoader from '@/components/shared/SkeletonLoader';

const HeavyComponent = lazy(() => import('./HeavyComponent'));

export const Page = () => (
  <Suspense fallback={<SkeletonLoader variant="card" />}>
    <HeavyComponent />
  </Suspense>
);
```

---

For more information, see [COMPONENT_LIBRARY.md](./COMPONENT_LIBRARY.md)
