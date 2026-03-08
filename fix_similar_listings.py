#!/usr/bin/env python3
"""
Fix the order of similarListings useMemo to be after filteredListings
"""

with open('src/pages/housing.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Remove the incorrectly placed similarListings
content = content.replace(
    '''  /* filter + sort */
  const similarListings = useMemo(() => {
    if (!selectedListing) return [];
    return filteredListings
      .filter((l) => l.id !== selectedListing.id && l.type === selectedListing.type)
      .slice(0, 4);
  }, [selectedListing, filteredListings]);

  const filteredListings = useMemo(() => {''',
    '''  /* filter + sort */
  const filteredListings = useMemo(() => {'''
)

# Now add it after filteredListings useMemo closes
content = content.replace(
    '''  }, [listings, filterType, searchQuery, selectedHeritage, bedsFilter, priceRange, sortBy]);

  /* counts */''',
    '''  }, [listings, filterType, searchQuery, selectedHeritage, bedsFilter, priceRange, sortBy]);

  const similarListings = useMemo(() => {
    if (!selectedListing) return [];
    return filteredListings
      .filter((l) => l.id !== selectedListing.id && l.type === selectedListing.type)
      .slice(0, 4);
  }, [selectedListing, filteredListings]);

  /* counts */'''
)

with open('src/pages/housing.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("✓ Fixed similarListings useMemo order")
