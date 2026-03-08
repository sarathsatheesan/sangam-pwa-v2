# Key Code Additions to housing.tsx

## 1. Enhanced Listing Interface (Lines 64-69)

```typescript
interface Listing {
  // ... existing fields ...
  hoa?: string;
  status?: 'active' | 'pending' | 'under_contract' | 'sold' | 'rented';
  walkScore?: number;
  transitScore?: number;
  neighborhoodHighlights?: string[];
  viewCount?: number;
  saveCount?: number;
}
```

## 2. Comment Interface (Lines 73-83)

```typescript
interface Comment {
  id: string;
  listingId: string;
  userId: string;
  userName: string;
  userAvatar: string;
  text: string;
  likes: number;
  likedBy: string[];
  createdAt: any;
}
```

## 3. Enhanced Type Definitions (Lines 85-87)

```typescript
type FilterType = 'all' | 'rent' | 'sale' | 'roommate' | 'sublet';
type ViewMode = 'grid' | 'list';
type SortOption = 'newest' | 'price-low' | 'price-high' | 'largest' | 'popular';
```

## 4. STATUS_CONFIG Constant (Lines 116-122)

```typescript
const STATUS_CONFIG: Record<string, { color: string; bgColor: string; label: string }> = {
  active: { color: '#10B981', bgColor: 'bg-emerald-100', label: 'Active' },
  pending: { color: '#F59E0B', bgColor: 'bg-amber-100', label: 'Pending' },
  under_contract: { color: '#8B5CF6', bgColor: 'bg-purple-100', label: 'Under Contract' },
  sold: { color: '#EF4444', bgColor: 'bg-red-100', label: 'Sold' },
  rented: { color: '#3B82F6', bgColor: 'bg-blue-100', label: 'Rented' },
};
```

## 5. Firebase Imports (Line 10)

```typescript
import {
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  updateDoc,
  doc,
  Timestamp,
  increment,  // <- ADDED
} from 'firebase/firestore';
```

## 6. New State Variables (Lines 418-436)

```typescript
const [statusFilter, setStatusFilter] = useState<string>('all');
const [activeListTab, setActiveListTab] = useState<'all' | 'saved' | 'recent'>('all');
const [recentlyViewed, setRecentlyViewed] = useState<string[]>(() => {
  try { return JSON.parse(localStorage.getItem('recentHousing') || '[]'); }
  catch { return []; }
});
const [savedListings, setSavedListings] = useState<Set<string>>(() => { /* existing */ });
const [detailTab, setDetailTab] = useState<'overview' | 'details' | 'map' | 'calculator' | 'comments'>('overview');
const [photoGalleryOpen, setPhotoGalleryOpen] = useState(false);
const [galleryIdx, setGalleryIdx] = useState(0);
const [calcDownPayment, setCalcDownPayment] = useState('20');
const [calcInterestRate, setCalcInterestRate] = useState('6.5');
const [calcLoanTerm, setCalcLoanTerm] = useState('30');
const [comments, setComments] = useState<Comment[]>([]);
const [commentText, setCommentText] = useState('');
const [commentLoading, setCommentLoading] = useState(false);
```

## 7. ViewedListings Ref (Line 473)

```typescript
const viewedListingsRef = useRef<Set<string>>(new Set());
```

## 8. Enhanced formData (Lines 466-469)

```typescript
const [formData, setFormData] = useState({
  // ... existing fields ...
  hoa: '',
  status: 'active',          // <- ADDED
  walkScore: '',             // <- ADDED
  transitScore: '',          // <- ADDED
  neighborhoodHighlights: [],// <- ADDED
});
```

## 9. localStorage Effects (Lines 480-482)

```typescript
useEffect(() => {
  localStorage.setItem('recentHousing', JSON.stringify(recentlyViewed));
}, [recentlyViewed]);
```

## 10. Enhanced fetchListings Data Mapping (Lines 535-540)

```typescript
const data: Listing[] = snapshot.docs.map((d) => ({
  // ... existing mappings ...
  hoa: d.data().hoa || '',
  status: d.data().status || 'active',           // <- ADDED
  walkScore: d.data().walkScore,                 // <- ADDED
  transitScore: d.data().transitScore,           // <- ADDED
  neighborhoodHighlights: d.data().neighborhoodHighlights || [],  // <- ADDED
  viewCount: d.data().viewCount || 0,            // <- ADDED
  saveCount: d.data().saveCount || 0,            // <- ADDED
}));
```

## 11. Similar Listings useMemo (Lines 592-597)

```typescript
const similarListings = useMemo(() => {
  if (!selectedListing) return [];
  return filteredListings
    .filter((l) => l.id !== selectedListing.id && l.type === selectedListing.type)
    .slice(0, 4);
}, [selectedListing, filteredListings]);
```

## 12. Status Filter in filteredListings (Line 571)

```typescript
const filteredListings = useMemo(() => {
  let result = listings.filter((l) => {
    if (filterType !== 'all' && l.type !== filterType) return false;
    // ... other filters ...
    if (statusFilter !== 'all' && l.status !== statusFilter) return false;  // <- ADDED
    // ... rest of filters ...
  });
  // ...
}, [listings, filterType, searchQuery, selectedHeritage, bedsFilter, priceRange, sortBy, statusFilter]);  // statusFilter added to deps
```

## 13. Popular Sort Case (Line 586)

```typescript
switch (sortBy) {
  case 'price-low': return parseNumericPrice(a.price) - parseNumericPrice(b.price);
  case 'price-high': return parseNumericPrice(b.price) - parseNumericPrice(a.price);
  case 'largest': return (b.sqft || 0) - (a.sqft || 0);
  case 'popular': return ((b.viewCount || 0) + (b.saveCount || 0)) - ((a.viewCount || 0) + (a.saveCount || 0));  // <- ADDED
  default: return (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0);
}
```

## Summary of Changes by Line Count

| Enhancement | Lines Added |
|---|---|
| Listing interface fields | 5 |
| Comment interface | 11 |
| STATUS_CONFIG constant | 7 |
| increment import | 1 |
| State variables | 18 |
| viewedListingsRef | 1 |
| formData enhancements | 4 |
| localStorage effects | 3 |
| fetchListings mappings | 6 |
| similarListings useMemo | 6 |
| Status filter in useMemo | 1 |
| Popular sort case | 1 |
| **Total** | **64 lines** |

Note: File grew by 66 lines total due to formatting and spacing.
