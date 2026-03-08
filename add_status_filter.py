#!/usr/bin/env python3
"""
Add status filter check to filteredListings useMemo
"""

with open('src/pages/housing.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Add status filter check in the filter logic
content = content.replace(
    '''      if (bedsFilter !== 'any') {
        if (l.beds < parseInt(bedsFilter)) return false;
      }
      const priceNum = parseNumericPrice(l.price);
      if (priceRange[0] && priceNum < parseFloat(priceRange[0])) return false;
      if (priceRange[1] && priceNum > parseFloat(priceRange[1])) return false;
      return true;''',
    '''      if (bedsFilter !== 'any') {
        if (l.beds < parseInt(bedsFilter)) return false;
      }
      if (statusFilter !== 'all' && l.status !== statusFilter) return false;
      const priceNum = parseNumericPrice(l.price);
      if (priceRange[0] && priceNum < parseFloat(priceRange[0])) return false;
      if (priceRange[1] && priceNum > parseFloat(priceRange[1])) return false;
      return true;'''
)

# Add statusFilter to the dependencies array
content = content.replace(
    '''  }, [listings, filterType, searchQuery, selectedHeritage, bedsFilter, priceRange, sortBy]);''',
    '''  }, [listings, filterType, searchQuery, selectedHeritage, bedsFilter, priceRange, sortBy, statusFilter]);'''
)

with open('src/pages/housing.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("✓ Added status filter check to filteredListings")
