#!/usr/bin/env python3
"""
Add 'popular' sort case to the sort logic
"""

with open('src/pages/housing.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Add popular sort case
content = content.replace(
    '''      switch (sortBy) {
        case 'price-low': return parseNumericPrice(a.price) - parseNumericPrice(b.price);
        case 'price-high': return parseNumericPrice(b.price) - parseNumericPrice(a.price);
        case 'largest': return (b.sqft || 0) - (a.sqft || 0);
        default: return (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0);
      }''',
    '''      switch (sortBy) {
        case 'price-low': return parseNumericPrice(a.price) - parseNumericPrice(b.price);
        case 'price-high': return parseNumericPrice(b.price) - parseNumericPrice(a.price);
        case 'largest': return (b.sqft || 0) - (a.sqft || 0);
        case 'popular': return ((b.viewCount || 0) + (b.saveCount || 0)) - ((a.viewCount || 0) + (a.saveCount || 0));
        default: return (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0);
      }'''
)

with open('src/pages/housing.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("✓ Added 'popular' sort case")
