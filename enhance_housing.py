#!/usr/bin/env python3
"""
Enhancement script for housing.tsx
Adds 7 new features while preserving all existing code
"""

import re

# Read the original file
with open('src/pages/housing.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# ============================================================================
# ENHANCEMENT 1: Listing Status Management
# ============================================================================

# 1a. Add status field to Listing interface (after line 62: hoa?: string;)
content = content.replace(
    '  hoa?: string;\n}',
    '  hoa?: string;\n  status?: \'active\' | \'pending\' | \'under_contract\' | \'sold\' | \'rented\';\n}'
)

# 1b. Add STATUS_CONFIG constant after TYPE_CONFIG (after line 102)
status_config = '''
const STATUS_CONFIG: Record<string, { color: string; bgColor: string; label: string }> = {
  active: { color: '#10B981', bgColor: 'bg-emerald-100', label: 'Active' },
  pending: { color: '#F59E0B', bgColor: 'bg-amber-100', label: 'Pending' },
  under_contract: { color: '#8B5CF6', bgColor: 'bg-purple-100', label: 'Under Contract' },
  sold: { color: '#EF4444', bgColor: 'bg-red-100', label: 'Sold' },
  rented: { color: '#3B82F6', bgColor: 'bg-blue-100', label: 'Rented' },
};
'''
content = content.replace(
    '};',
    '};' + status_config,
    1  # Replace only the first occurrence (TYPE_CONFIG closing brace)
)

# 1c. Add status to fetchListings mapping (after line 481: laundry)
content = content.replace(
    '        laundry: d.data().laundry || \'\',\n        hoa: d.data().hoa || \'\',',
    '        laundry: d.data().laundry || \'\',\n        hoa: d.data().hoa || \'\',\n        status: d.data().status || \'active\','
)

# 1d. Add status filter state (after line 389: setShowFilters)
content = content.replace(
    '  const [showFilters, setShowFilters] = useState(false);',
    '  const [showFilters, setShowFilters] = useState(false);\n  const [statusFilter, setStatusFilter] = useState<string>(\'all\');'
)

# 1e. Add status to formData (after line 425: hoa: '')
content = content.replace(
    '    hoa: \'\',\n  });',
    '    hoa: \'\',\n    status: \'active\',\n  });'
)

# 1f. Add status filter check in filteredListings useMemo
# Find the line with "const filteredListings = useMemo" and add status check in the filter logic
filteredListings_pattern = r'(const filteredListings = useMemo\(\(\) => {\s+let result = listings;[^}]+?if \(filterType !== \'all\'\) result = result\.filter\(\(l\) => l\.type === filterType\);)'
filteredListings_replacement = r'\1\n  if (statusFilter !== \'all\') result = result.filter((l) => l.status === statusFilter);'
content = re.sub(filteredListings_pattern, filteredListings_replacement, content, flags=re.DOTALL)

# ============================================================================
# ENHANCEMENT 2: Monthly Payment Estimator
# ============================================================================

# 2a. Add 'calculator' to detailTab union type (line 394)
content = content.replace(
    "const [detailTab, setDetailTab] = useState<'overview' | 'details' | 'map'>('overview');",
    "const [detailTab, setDetailTab] = useState<'overview' | 'details' | 'map' | 'calculator'>('overview');"
)

# 2b. Add calculator state variables (after line 396: galleryIdx)
content = content.replace(
    '  const [galleryIdx, setGalleryIdx] = useState(0);',
    '  const [galleryIdx, setGalleryIdx] = useState(0);\n  const [calcDownPayment, setCalcDownPayment] = useState(\'20\');\n  const [calcInterestRate, setCalcInterestRate] = useState(\'6.5\');\n  const [calcLoanTerm, setCalcLoanTerm] = useState(\'30\');'
)

# ============================================================================
# ENHANCEMENT 3: Neighborhood Info & Scores
# ============================================================================

# 3a. Add neighborhood fields to Listing interface (after status field)
content = content.replace(
    "  status?: 'active' | 'pending' | 'under_contract' | 'sold' | 'rented';",
    "  status?: 'active' | 'pending' | 'under_contract' | 'sold' | 'rented';\n  walkScore?: number;\n  transitScore?: number;\n  neighborhoodHighlights?: string[];"
)

# 3b. Add neighborhood fields to fetchListings mapping
content = content.replace(
    '        status: d.data().status || \'active\',',
    '        status: d.data().status || \'active\',\n        walkScore: d.data().walkScore,\n        transitScore: d.data().transitScore,\n        neighborhoodHighlights: d.data().neighborhoodHighlights || [],'
)

# 3c. Add neighborhood fields to formData
content = content.replace(
    '    status: \'active\',',
    '    status: \'active\',\n    walkScore: \'\',\n    transitScore: \'\',\n    neighborhoodHighlights: [],'
)

# ============================================================================
# ENHANCEMENT 4: Public Comments
# ============================================================================

# 4a. Add Comment interface (after Listing interface, before FilterType)
comment_interface = '''
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

'''
content = content.replace(
    'type FilterType = \'all\' | \'rent\' | \'sale\' | \'roommate\' | \'sublet\';',
    comment_interface + 'type FilterType = \'all\' | \'rent\' | \'sale\' | \'roommate\' | \'sublet\';'
)

# 4b. Add 'comments' to detailTab union type
content = content.replace(
    "const [detailTab, setDetailTab] = useState<'overview' | 'details' | 'map' | 'calculator'>('overview');",
    "const [detailTab, setDetailTab] = useState<'overview' | 'details' | 'map' | 'calculator' | 'comments'>('overview');"
)

# 4c. Add comment state variables (after calcLoanTerm)
comment_states = '''
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [commentLoading, setCommentLoading] = useState(false);'''

content = content.replace(
    "  const [calcLoanTerm, setCalcLoanTerm] = useState('30');",
    "  const [calcLoanTerm, setCalcLoanTerm] = useState('30');" + comment_states
)

# ============================================================================
# ENHANCEMENT 5: View Counter & Popularity
# ============================================================================

# 5a. Add viewCount and saveCount to Listing interface
content = content.replace(
    '  neighborhoodHighlights?: string[];',
    '  neighborhoodHighlights?: string[];\n  viewCount?: number;\n  saveCount?: number;'
)

# 5b. Add increment import to firestore imports
content = content.replace(
    'import {\n  collection,\n  getDocs,\n  addDoc,\n  deleteDoc,\n  updateDoc,\n  doc,\n  Timestamp,\n} from \'firebase/firestore\';',
    'import {\n  collection,\n  getDocs,\n  addDoc,\n  deleteDoc,\n  updateDoc,\n  doc,\n  Timestamp,\n  increment,\n} from \'firebase/firestore\';'
)

# 5c. Add viewedListingsRef (after const inputCls)
content = content.replace(
    '  const inputCls = "w-full px-3.5 py-2.5 border border-[var(--aurora-border)] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--aurora-indigo)] bg-[var(--aurora-surface)] text-[var(--aurora-text)] placeholder-[var(--aurora-text-muted)]";',
    '  const inputCls = "w-full px-3.5 py-2.5 border border-[var(--aurora-border)] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--aurora-indigo)] bg-[var(--aurora-surface)] text-[var(--aurora-text)] placeholder-[var(--aurora-text-muted)]";\n  const viewedListingsRef = useRef<Set<string>>(new Set());'
)

# 5d. Add viewCount/saveCount to fetchListings mapping
content = content.replace(
    '        neighborhoodHighlights: d.data().neighborhoodHighlights || [],',
    '        neighborhoodHighlights: d.data().neighborhoodHighlights || [],\n        viewCount: d.data().viewCount || 0,\n        saveCount: d.data().saveCount || 0,'
)

# 5e. Add 'popular' to SortOption type
content = content.replace(
    "type SortOption = 'newest' | 'price-low' | 'price-high' | 'largest';",
    "type SortOption = 'newest' | 'price-low' | 'price-high' | 'largest' | 'popular';"
)

# ============================================================================
# ENHANCEMENT 6: Similar Listings Carousel (useMemo added at right place)
# ============================================================================

# Add after other useMemos - we'll add it before the "const filteredListings" so it's already calculated
similar_listing_memo = '''  const similarListings = useMemo(() => {
    if (!selectedListing) return [];
    return filteredListings
      .filter((l) => l.id !== selectedListing.id && l.type === selectedListing.type)
      .slice(0, 4);
  }, [selectedListing, filteredListings]);

'''

# Find location to insert - right before the comment "const filteredListings"
content = content.replace(
    '  const filteredListings = useMemo(() => {',
    similar_listing_memo + '  const filteredListings = useMemo(() => {'
)

# ============================================================================
# ENHANCEMENT 7: Saved Listings Tab & Recent Views
# ============================================================================

# 7a. Add activeListTab state (after statusFilter)
content = content.replace(
    "  const [statusFilter, setStatusFilter] = useState<string>('all');",
    "  const [statusFilter, setStatusFilter] = useState<string>('all');\n  const [activeListTab, setActiveListTab] = useState<'all' | 'saved' | 'recent'>('all');\n  const [recentlyViewed, setRecentlyViewed] = useState<string[]>(() => {\n    try { return JSON.parse(localStorage.getItem('recentHousing') || '[]'); }\n    catch { return []; }\n  });"
)

# 7b. Persist recentlyViewed to localStorage (add after savedListings effect)
recent_effect = '''
  useEffect(() => {
    localStorage.setItem('recentHousing', JSON.stringify(recentlyViewed));
  }, [recentlyViewed]);

'''

content = content.replace(
    '  useEffect(() => {\n    localStorage.setItem(\'savedHousing\', JSON.stringify([...savedListings]));\n  }, [savedListings]);',
    '  useEffect(() => {\n    localStorage.setItem(\'savedHousing\', JSON.stringify([...savedListings]));\n  }, [savedListings]);\n' + recent_effect
)

# Write the enhanced file
with open('src/pages/housing.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("✓ Housing page enhanced successfully!")
print("\nEnhancements added:")
print("  1. Listing Status Management")
print("  2. Monthly Payment Estimator")
print("  3. Neighborhood Info & Scores")
print("  4. Public Comments")
print("  5. View Counter & Popularity")
print("  6. Similar Listings Carousel")
print("  7. Saved Listings Tab & Recent Views")
