import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Plus,
  Pencil,
  Copy,
  Archive,
  ArchiveRestore,
  Trash2,
  X,
  ChevronDown,
  ChevronUp,
  Camera,
  Search,
  Package,
  FileText,
  Sparkles,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import type { CateringMenuItem, ParsedMenuItem, MenuTemplateItem } from '@/services/cateringService';
import {
  subscribeToMenuItems,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
  archiveMenuItem,
  restoreMenuItem,
  batchCreateMenuItems,
  formatPrice,
} from '@/services/cateringService';
import { compressImage } from '@/components/business/imageUtils';
import { useToast } from '@/contexts/ToastContext';
import SmartPasteInput from './SmartPasteInput';
import TemplateSelector from './TemplateSelector';
import MenuItemReviewGrid from './MenuItemReviewGrid';

interface VendorMenuEditorProps {
  businessId: string;
  businessName: string;
  onBack: () => void;
}

type FilterTab = 'all' | 'active' | 'archived';
type PricingType = 'per_person' | 'per_tray' | 'flat_rate';
type Category = 'Appetizer' | 'Entree' | 'Side' | 'Dessert' | 'Beverage' | 'Package';
type DietaryTag = 'vegetarian' | 'vegan' | 'halal' | 'kosher' | 'gluten_free' | 'dairy_free' | 'nut_free';

interface ItemFormData {
  id?: string;
  name: string;
  price: string;
  category: Category;
  pricingType: PricingType;
  description: string;
  dietaryTags: DietaryTag[];
  servesCount: string;
  prepTimeMinutes: string;
  minOrderQty: string;
  maxOrderQty: string;
  photoUrl: string;
}

const CATEGORY_LABELS: Record<Category, string> = {
  Appetizer: 'Appetizer',
  Entree: 'Entree',
  Side: 'Side',
  Dessert: 'Dessert',
  Beverage: 'Beverage',
  Package: 'Package',
};

const CATEGORY_ORDER: Category[] = ['Appetizer', 'Entree', 'Side', 'Dessert', 'Beverage', 'Package'];

const DIETARY_LABELS: Record<DietaryTag, string> = {
  vegetarian: 'Vegetarian',
  vegan: 'Vegan',
  halal: 'Halal',
  kosher: 'Kosher',
  gluten_free: 'Gluten-Free',
  dairy_free: 'Dairy-Free',
  nut_free: 'Nut-Free',
};

const DIETARY_COLORS: Record<DietaryTag, string> = {
  vegetarian: '#22c55e',
  vegan: '#10b981',
  halal: '#f59e0b',
  kosher: '#8b5cf6',
  gluten_free: '#ec4899',
  dairy_free: '#06b6d4',
  nut_free: '#f97316',
};

const STOCK_CONFIG = {
  in_stock: { label: 'In Stock', color: '#22c55e' },
  low_stock: { label: 'Low Stock', color: '#f59e0b' },
  out_of_stock: { label: 'Out of Stock', color: '#ef4444' },
};

const EMPTY_FORM_DATA: ItemFormData = {
  name: '',
  price: '',
  category: 'Appetizer',
  pricingType: 'per_person',
  description: '',
  dietaryTags: [],
  servesCount: '',
  prepTimeMinutes: '',
  minOrderQty: '',
  maxOrderQty: '',
  photoUrl: '',
};

export default function VendorMenuEditor({
  businessId,
  businessName,
  onBack,
}: VendorMenuEditorProps) {
  const { addToast } = useToast();
  const [menuItems, setMenuItems] = useState<CateringMenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [formData, setFormData] = useState<ItemFormData>(EMPTY_FORM_DATA);
  const [isEditingMode, setIsEditingMode] = useState(false);
  const [expandedDetails, setExpandedDetails] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>('');
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<Category>>(
    new Set(CATEGORY_ORDER)
  );
  // Smart Paste / Template sub-views
  type SubView = 'list' | 'smartPaste' | 'templateSelector' | 'reviewGrid';
  const [subView, setSubView] = useState<SubView>('list');
  const [parsedItems, setParsedItems] = useState<ParsedMenuItem[]>([]);
  const [publishing, setPublishing] = useState(false);

  // Subscribe to menu items
  useEffect(() => {
    setLoading(true);
    const unsubscribe = subscribeToMenuItems(
      businessId,
      (items: CateringMenuItem[]) => {
        setMenuItems(items);
        setLoading(false);
      },
      (error: Error) => {
        addToast('Failed to load menu items', 'error');
        console.error('Menu items subscription error:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [businessId, addToast]);

  // Filter items
  const filteredItems = useMemo(() => {
    let items = menuItems;

    // Apply filter tab
    if (filterTab === 'active') {
      items = items.filter((item) => !item.archived);
    } else if (filterTab === 'archived') {
      items = items.filter((item) => item.archived);
    }

    // Apply search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      items = items.filter(
        (item) =>
          item.name.toLowerCase().includes(query) ||
          item.description?.toLowerCase().includes(query)
      );
    }

    return items;
  }, [menuItems, filterTab, searchQuery]);

  // Group items by category
  const groupedItems = useMemo(() => {
    const grouped: Record<string, CateringMenuItem[]> = {
      Appetizer: [],
      Entree: [],
      Side: [],
      Dessert: [],
      Beverage: [],
      Package: [],
    };

    filteredItems.forEach((item) => {
      const category = (item.category as Category) || 'Appetizer';
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(item);
    });

    return grouped;
  }, [filteredItems]);

  const openAddItemDrawer = useCallback(() => {
    setFormData(EMPTY_FORM_DATA);
    setPhotoPreview('');
    setIsEditingMode(false);
    setExpandedDetails(false);
    setSubmitAttempted(false);
    setDrawerOpen(true);
  }, []);

  const openEditItemDrawer = useCallback((item: CateringMenuItem) => {
    setFormData({
      id: item.id,
      name: item.name,
      price: (item.price / 100).toFixed(2),
      category: (item.category as Category) || 'Appetizer',
      pricingType: (item.pricingType as PricingType) || 'per_person',
      description: item.description || '',
      dietaryTags: (item.dietaryTags as DietaryTag[]) || [],
      servesCount: item.servesCount?.toString() || '',
      prepTimeMinutes: item.prepTimeMinutes?.toString() || '',
      minOrderQty: item.minOrderQty?.toString() || '',
      maxOrderQty: item.maxOrderQty?.toString() || '',
      photoUrl: item.photoUrl || '',
    });
    setPhotoPreview(item.photoUrl || '');
    setIsEditingMode(true);
    setExpandedDetails(false);
    setSubmitAttempted(false);
    setDrawerOpen(true);
  }, []);

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    setTimeout(() => {
      setFormData(EMPTY_FORM_DATA);
      setPhotoPreview('');
      setIsEditingMode(false);
      setExpandedDetails(false);
    }, 300);
  }, []);

  const handlePhotoUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      // compressImage already returns a base64 data-URL string
      const base64 = await compressImage(file);
      setPhotoPreview(base64);
      setFormData((prev) => ({ ...prev, photoUrl: base64 }));
    } catch (error) {
      addToast('Failed to process image', 'error');
      console.error('Photo upload error:', error);
    }
  }, [addToast]);

  const handleSaveItem = useCallback(async () => {
    setSubmitAttempted(true);

    const missingFields: string[] = [];
    if (!formData.name.trim()) missingFields.push('Name');
    if (!formData.price || parseFloat(formData.price) < 0) missingFields.push('Price');

    if (missingFields.length > 0) {
      addToast(`Please fill in: ${missingFields.join(', ')}`, 'error');
      return;
    }

    setSaving(true);
    try {
      const priceInCents = Math.round(parseFloat(formData.price) * 100);
      const itemData = {
        businessId,
        name: formData.name.trim(),
        price: priceInCents,
        category: formData.category,
        pricingType: formData.pricingType,
        description: formData.description.trim(),
        dietaryTags: formData.dietaryTags,
        available: true,
        servesCount: formData.servesCount ? parseInt(formData.servesCount) : undefined,
        prepTimeMinutes: formData.prepTimeMinutes
          ? parseInt(formData.prepTimeMinutes)
          : undefined,
        minOrderQty: formData.minOrderQty ? parseInt(formData.minOrderQty) : undefined,
        maxOrderQty: formData.maxOrderQty ? parseInt(formData.maxOrderQty) : undefined,
        photoUrl: formData.photoUrl || undefined,
      };

      if (isEditingMode && formData.id) {
        await updateMenuItem(formData.id, itemData);
        addToast('Item updated successfully', 'success');
      } else {
        await createMenuItem(itemData);
        addToast('Item added successfully', 'success');
      }

      closeDrawer();
    } catch (error) {
      addToast('Failed to save item', 'error');
      console.error('Save item error:', error);
    } finally {
      setSaving(false);
    }
  }, [formData, businessId, isEditingMode, addToast, closeDrawer]);

  const handleDuplicateItem = useCallback(
    async (item: CateringMenuItem) => {
      const newItem = {
        businessId,
        name: `${item.name} (Copy)`,
        price: item.price,
        category: item.category,
        pricingType: item.pricingType,
        description: item.description,
        dietaryTags: item.dietaryTags,
        servesCount: item.servesCount,
        prepTimeMinutes: item.prepTimeMinutes,
        minOrderQty: item.minOrderQty,
        maxOrderQty: item.maxOrderQty,
        photoUrl: item.photoUrl,
      };

      try {
        await createMenuItem(newItem);
        addToast('Item duplicated successfully', 'success');
      } catch (error) {
        addToast('Failed to duplicate item', 'error');
        console.error('Duplicate item error:', error);
      }
    },
    [businessId, addToast]
  );

  const handleArchiveItem = useCallback(
    async (itemId: string, isArchived: boolean) => {
      try {
        if (isArchived) {
          await restoreMenuItem(itemId);
          addToast('Item restored', 'success');
        } else {
          await archiveMenuItem(itemId);
          addToast('Item archived — customers can no longer see it', 'success');
        }
      } catch (error) {
        addToast(`Failed to ${isArchived ? 'restore' : 'archive'} item`, 'error');
        console.error('Archive item error:', error);
      }
    },
    [addToast]
  );

  const handleDeleteItem = useCallback(
    async (itemId: string) => {
      setDeletingId(itemId);
    },
    []
  );

  const confirmDelete = useCallback(
    async (itemId: string) => {
      try {
        await deleteMenuItem(itemId);
        addToast('Item deleted', 'success');
        setDeletingId(null);
      } catch (error) {
        addToast('Failed to delete item', 'error');
        console.error('Delete item error:', error);
      }
    },
    [addToast]
  );

  const toggleCategory = useCallback((category: Category) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  }, []);

  const activeCount = menuItems.filter((item) => !item.archived).length;
  const archivedCount = menuItems.filter((item) => item.archived).length;

  const hasAnyItems = menuItems.length > 0;

  // ── Smart Paste handlers ─────────────────────────────
  const handleSmartPasteParsed = useCallback((items: ParsedMenuItem[]) => {
    setParsedItems(items);
    setSubView('reviewGrid');
  }, []);

  // ── Template handler ─────────────────────────────────
  const handleTemplateSelected = useCallback((templateItems: MenuTemplateItem[]) => {
    // Blank template → go straight to the list view and open the Add Item drawer
    if (templateItems.length === 0) {
      setSubView('list');
      // Small delay so the list view mounts before we open the drawer
      setTimeout(() => {
        setFormData(EMPTY_FORM_DATA);
        setPhotoPreview('');
        setIsEditingMode(false);
        setExpandedDetails(false);
        setDrawerOpen(true);
      }, 50);
      return;
    }
    // Convert MenuTemplateItems → ParsedMenuItems for the review grid
    const parsed: ParsedMenuItem[] = templateItems.map((t) => ({
      name: t.name,
      price: null, // vendors must set prices
      description: t.description,
      category: t.category,
      pricingType: t.pricingType,
      dietaryTags: t.dietaryTags || [],
      servesCount: t.servesCount,
      confidence: { name: 1, price: 0.3, category: 1, dietaryTags: 1 },
    }));
    setParsedItems(parsed);
    setSubView('reviewGrid');
  }, []);

  // ── Publish reviewed items → Firestore ────────────────
  const handlePublishItems = useCallback(
    async (items: ParsedMenuItem[]) => {
      setPublishing(true);
      try {
        const menuItemsToCreate: Omit<CateringMenuItem, 'id'>[] = items.map((item, i) => ({
          businessId,
          name: item.name,
          price: item.price || 0,
          description: item.description || '',
          category: (item.category || 'Entree') as CateringMenuItem['category'],
          pricingType: item.pricingType || 'per_person',
          dietaryTags: item.dietaryTags || [],
          servesCount: item.servesCount,
          available: true,
          sortOrder: menuItems.length + i,
        }));
        await batchCreateMenuItems(menuItemsToCreate);
        addToast(`${items.length} item${items.length > 1 ? 's' : ''} added to menu!`, 'success');
        setParsedItems([]);
        setSubView('list');
      } catch (error) {
        addToast('Failed to publish items', 'error');
        console.error('Publish items error:', error);
      } finally {
        setPublishing(false);
      }
    },
    [businessId, menuItems.length, addToast]
  );

  return (
    <div className="flex flex-col h-full bg-white" style={{ backgroundColor: 'var(--aurora-bg)' }}>
      {/* Header */}
      <div className="border-b px-6 py-4" style={{ borderColor: 'var(--aurora-border)' }}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Go back"
            >
              <X size={20} style={{ color: 'var(--aurora-text)' }} />
            </button>
            <div>
              <h1 className="text-2xl font-bold" style={{ color: 'var(--aurora-text)' }}>
                Menu
              </h1>
              <p className="text-sm" style={{ color: 'var(--aurora-text-secondary)' }}>
                {businessName}
              </p>
            </div>
          </div>
          <div
            className="px-4 py-2 rounded-lg"
            style={{ backgroundColor: 'var(--aurora-surface-variant, #EDF0F7)' }}
          >
            <p className="text-sm font-medium" style={{ color: 'var(--aurora-text)' }}>
              {menuItems.length} item{menuItems.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {/* Toolbar */}
        {hasAnyItems && (
          <div className="flex flex-wrap gap-2 mb-4">
            <button
              onClick={openAddItemDrawer}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors hover:opacity-90"
              style={{
                backgroundColor: '#6366F1',
                color: '#FFFFFF',
              }}
              aria-label="Add new menu item"
            >
              <Plus size={18} />
              Add Item
            </button>
            <button
              onClick={() => setSubView('smartPaste')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors hover:opacity-90"
              style={{
                backgroundColor: 'var(--aurora-surface-variant, #EDF0F7)',
                color: 'var(--aurora-text)',
              }}
              aria-label="Paste menu items"
            >
              <Sparkles size={18} />
              Paste Menu
            </button>
            <button
              onClick={() => setSubView('templateSelector')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors hover:opacity-90"
              style={{
                backgroundColor: 'var(--aurora-surface-variant, #EDF0F7)',
                color: 'var(--aurora-text)',
              }}
              aria-label="Start from template"
            >
              <FileText size={18} />
              Start from Template
            </button>
          </div>
        )}

        {/* Filter Tabs */}
        {hasAnyItems && (
          <div className="flex gap-4 border-t pt-4" style={{ borderColor: 'var(--aurora-border)' }}>
            <button
              onClick={() => setFilterTab('all')}
              className={`pb-2 px-1 font-medium border-b-2 transition-colors ${
                filterTab === 'all'
                  ? 'border-b-2'
                  : 'border-b-2 border-transparent'
              }`}
              style={{
                color: filterTab === 'all' ? '#6366F1' : 'var(--aurora-text-secondary)',
                borderColor: filterTab === 'all' ? '#6366F1' : 'transparent',
              }}
              aria-label="Show all items"
              aria-pressed={filterTab === 'all'}
            >
              All ({menuItems.length})
            </button>
            <button
              onClick={() => setFilterTab('active')}
              className={`pb-2 px-1 font-medium border-b-2 transition-colors ${
                filterTab === 'active'
                  ? 'border-b-2'
                  : 'border-b-2 border-transparent'
              }`}
              style={{
                color: filterTab === 'active' ? '#6366F1' : 'var(--aurora-text-secondary)',
                borderColor: filterTab === 'active' ? '#6366F1' : 'transparent',
              }}
              aria-label="Show active items"
              aria-pressed={filterTab === 'active'}
            >
              Active ({activeCount})
            </button>
            <button
              onClick={() => setFilterTab('archived')}
              className={`pb-2 px-1 font-medium border-b-2 transition-colors ${
                filterTab === 'archived'
                  ? 'border-b-2'
                  : 'border-b-2 border-transparent'
              }`}
              style={{
                color: filterTab === 'archived' ? '#6366F1' : 'var(--aurora-text-secondary)',
                borderColor: filterTab === 'archived' ? '#6366F1' : 'transparent',
              }}
              aria-label="Show archived items"
              aria-pressed={filterTab === 'archived'}
            >
              Archived ({archivedCount})
            </button>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        {/* Sub-views: Smart Paste, Template Selector, Review Grid */}
        {subView === 'smartPaste' && (
          <SmartPasteInput
            businessId={businessId}
            onItemsParsed={handleSmartPasteParsed}
            onClose={() => setSubView('list')}
          />
        )}
        {subView === 'templateSelector' && (
          <TemplateSelector
            businessId={businessId}
            onSelectTemplate={handleTemplateSelected}
            onClose={() => setSubView('list')}
          />
        )}
        {subView === 'reviewGrid' && (
          <MenuItemReviewGrid
            items={parsedItems}
            onItemsChange={setParsedItems}
            onPublish={handlePublishItems}
            onCancel={() => { setParsedItems([]); setSubView('list'); }}
            publishing={publishing}
          />
        )}
        {subView === 'list' && (loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 size={32} className="animate-spin" style={{ color: '#6366F1' }} />
          </div>
        ) : !hasAnyItems ? (
          <EmptyState onAddItem={openAddItemDrawer} onPasteMenu={() => setSubView('smartPaste')} onStartTemplate={() => setSubView('templateSelector')} />
        ) : filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full px-6 py-12">
            <Search size={48} style={{ color: 'var(--aurora-text-secondary)' }} className="mb-4 opacity-50" />
            <p className="text-lg font-medium" style={{ color: 'var(--aurora-text)' }}>
              No items found
            </p>
            <p style={{ color: 'var(--aurora-text-secondary)' }}>
              Try adjusting your search or filters
            </p>
          </div>
        ) : (
          <div className="px-6 py-6">
            {/* Search Bar */}
            <div className="mb-6 relative">
              <Search
                size={18}
                className="absolute left-3 top-1/2 transform -translate-y-1/2"
                style={{ color: 'var(--aurora-text-secondary)' }}
              />
              <input
                type="text"
                placeholder="Search items by name or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-indigo-500"
                style={{
                  borderColor: 'var(--aurora-border)',
                  backgroundColor: 'var(--aurora-surface-variant, #EDF0F7)',
                  color: 'var(--aurora-text)',
                }}
                aria-label="Search menu items"
              />
            </div>

            {/* Categories */}
            {CATEGORY_ORDER.map((category) => {
              const items = groupedItems[category];
              if (items.length === 0) return null;

              const isExpanded = expandedCategories.has(category);

              return (
                <div key={category} className="mb-6">
                  {/* Category Header */}
                  <button
                    onClick={() => toggleCategory(category)}
                    className="w-full flex items-center justify-between mb-3 px-4 py-3 rounded-lg hover:opacity-80 transition-opacity"
                    style={{
                      backgroundColor: 'var(--aurora-surface-variant, #EDF0F7)',
                      color: 'var(--aurora-text)',
                    }}
                    aria-expanded={isExpanded}
                    aria-label={`Toggle ${CATEGORY_LABELS[category]} section`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-lg">{CATEGORY_LABELS[category]}</span>
                      <span
                        className="px-2 py-1 text-xs font-medium rounded"
                        style={{
                          backgroundColor: 'var(--aurora-bg)',
                          color: 'var(--aurora-text-secondary)',
                        }}
                      >
                        {items.length}
                      </span>
                    </div>
                    {isExpanded ? (
                      <ChevronUp size={20} />
                    ) : (
                      <ChevronDown size={20} />
                    )}
                  </button>

                  {/* Category Items */}
                  {isExpanded && (
                    <div className="space-y-3">
                      {items.map((item) => (
                        <MenuItem
                          key={item.id}
                          item={item}
                          onEdit={() => openEditItemDrawer(item)}
                          onDuplicate={() => handleDuplicateItem(item)}
                          onArchive={() =>
                            handleArchiveItem(item.id, item.archived || false)
                          }
                          onDelete={() => handleDeleteItem(item.id)}
                          isDeletingId={deletingId}
                          onConfirmDelete={confirmDelete}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Add/Edit Drawer */}
      {drawerOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity"
            onClick={closeDrawer}
            aria-hidden="true"
          />

          {/* Drawer */}
          <div
            className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-xl z-50 transform transition-transform duration-300 flex flex-col"
            style={{
              backgroundColor: 'var(--aurora-bg)',
              transform: drawerOpen ? 'translateX(0)' : 'translateX(100%)',
            }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="drawer-title"
          >
            {/* Drawer Header */}
            <div
              className="flex items-center justify-between p-6 border-b shrink-0 bg-white z-10"
              style={{
                borderColor: 'var(--aurora-border)',
                backgroundColor: 'var(--aurora-bg)',
              }}
            >
              <h2 id="drawer-title" className="text-xl font-bold" style={{ color: 'var(--aurora-text)' }}>
                {isEditingMode ? 'Edit Item' : 'Add Item'}
              </h2>
              <button
                onClick={closeDrawer}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="Close drawer"
              >
                <X size={20} style={{ color: 'var(--aurora-text)' }} />
              </button>
            </div>

            {/* Drawer Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Photo Upload */}
              <div>
                <label className="block text-sm font-medium mb-3" style={{ color: 'var(--aurora-text)' }}>
                  Photo
                </label>
                <div
                  className="relative w-full h-40 rounded-lg border-2 border-dashed flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity"
                  style={{
                    borderColor: 'var(--aurora-border)',
                    backgroundColor: 'var(--aurora-surface-variant, #EDF0F7)',
                  }}
                >
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                    aria-label="Upload item photo"
                  />
                  {photoPreview ? (
                    <img
                      src={photoPreview}
                      alt="Item preview"
                      className="w-full h-full object-cover rounded-lg"
                    />
                  ) : (
                    <div className="text-center">
                      <Camera size={32} style={{ color: 'var(--aurora-text-secondary)' }} className="mx-auto mb-2" />
                      <p className="text-sm" style={{ color: 'var(--aurora-text-secondary)' }}>
                        Click to upload
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Required Section */}
              <div className="space-y-4">
                <h3 className="font-semibold" style={{ color: 'var(--aurora-text)' }}>
                  Required
                </h3>

                {/* Name */}
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: 'var(--aurora-text)' }}>
                    Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="Item name"
                    className="w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2"
                    style={{
                      borderColor: submitAttempted && !formData.name.trim() ? '#EF4444' : 'var(--aurora-border)',
                      backgroundColor: 'var(--aurora-surface-variant, #EDF0F7)',
                      color: 'var(--aurora-text)',
                    }}
                    aria-label="Item name"
                    aria-invalid={submitAttempted && !formData.name.trim()}
                  />
                  {submitAttempted && !formData.name.trim() && (
                    <p style={{ color: '#EF4444', fontSize: '0.75rem', marginTop: '4px' }}>
                      Item name is required
                    </p>
                  )}
                </div>

                {/* Price */}
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: 'var(--aurora-text)' }}>
                    Price ($) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.price}
                    onChange={(e) => setFormData((prev) => ({ ...prev, price: e.target.value }))}
                    placeholder="0.00"
                    className="w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2"
                    style={{
                      borderColor: submitAttempted && (!formData.price || parseFloat(formData.price) < 0) ? '#EF4444' : 'var(--aurora-border)',
                      backgroundColor: 'var(--aurora-surface-variant, #EDF0F7)',
                      color: 'var(--aurora-text)',
                    }}
                    aria-label="Item price in dollars"
                    aria-invalid={submitAttempted && (!formData.price || parseFloat(formData.price) < 0)}
                  />
                  {submitAttempted && (!formData.price || parseFloat(formData.price) < 0) && (
                    <p style={{ color: '#EF4444', fontSize: '0.75rem', marginTop: '4px' }}>
                      A valid price is required
                    </p>
                  )}
                </div>

                {/* Category */}
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: 'var(--aurora-text)' }}>
                    Category *
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        category: e.target.value as Category,
                      }))
                    }
                    className="w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2"
                    style={{
                      borderColor: 'var(--aurora-border)',
                      backgroundColor: 'var(--aurora-surface-variant, #EDF0F7)',
                      color: 'var(--aurora-text)',
                    }}
                    aria-label="Item category"
                  >
                    {CATEGORY_ORDER.map((cat) => (
                      <option key={cat} value={cat}>
                        {CATEGORY_LABELS[cat]}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Pricing Type */}
                <div>
                  <label className="block text-sm font-medium mb-3" style={{ color: 'var(--aurora-text)' }}>
                    Pricing Type *
                  </label>
                  <div className="flex gap-2">
                    {(['per_person', 'per_tray', 'flat_rate'] as PricingType[]).map((type) => (
                      <button
                        key={type}
                        onClick={() =>
                          setFormData((prev) => ({
                            ...prev,
                            pricingType: type,
                          }))
                        }
                        className={`flex-1 px-3 py-2 rounded-lg border-2 font-medium transition-colors ${
                          formData.pricingType === type
                            ? 'border-2'
                            : 'border-2'
                        }`}
                        style={{
                          borderColor:
                            formData.pricingType === type
                              ? '#6366F1'
                              : 'var(--aurora-border)',
                          backgroundColor:
                            formData.pricingType === type
                              ? '#6366F1'
                              : 'var(--aurora-surface-variant, #EDF0F7)',
                          color:
                            formData.pricingType === type
                              ? 'white'
                              : 'var(--aurora-text)',
                        }}
                        aria-pressed={formData.pricingType === type}
                        aria-label={`${type.replace('_', ' ')}`}
                      >
                        {type === 'per_person'
                          ? '/ Person'
                          : type === 'per_tray'
                          ? '/ Tray'
                          : 'Flat Rate'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* More Details Section */}
              <div>
                <button
                  onClick={() => setExpandedDetails(!expandedDetails)}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-lg hover:opacity-80 transition-opacity"
                  style={{
                    backgroundColor: 'var(--aurora-surface-variant, #EDF0F7)',
                    color: 'var(--aurora-text)',
                  }}
                  aria-expanded={expandedDetails}
                  aria-label="Expand more details section"
                >
                  <span className="font-semibold">More Details</span>
                  {expandedDetails ? (
                    <ChevronUp size={20} />
                  ) : (
                    <ChevronDown size={20} />
                  )}
                </button>

                {expandedDetails && (
                  <div className="mt-4 space-y-4 pt-4 border-t" style={{ borderColor: 'var(--aurora-border)' }}>
                    {/* Description */}
                    <div>
                      <label className="block text-sm font-medium mb-2" style={{ color: 'var(--aurora-text)' }}>
                        Description
                      </label>
                      <textarea
                        value={formData.description}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            description: e.target.value,
                          }))
                        }
                        placeholder="Item description"
                        rows={3}
                        className="w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 resize-none"
                        style={{
                          borderColor: 'var(--aurora-border)',
                          backgroundColor: 'var(--aurora-surface-variant, #EDF0F7)',
                          color: 'var(--aurora-text)',
                        }}
                        aria-label="Item description"
                      />
                    </div>

                    {/* Dietary Tags */}
                    <div>
                      <label className="block text-sm font-medium mb-3" style={{ color: 'var(--aurora-text)' }}>
                        Dietary Tags
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        {(Object.keys(DIETARY_LABELS) as DietaryTag[]).map((tag) => (
                          <label
                            key={tag}
                            className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
                          >
                            <input
                              type="checkbox"
                              checked={formData.dietaryTags.includes(tag)}
                              onChange={(e) => {
                                setFormData((prev) => ({
                                  ...prev,
                                  dietaryTags: e.target.checked
                                    ? [...prev.dietaryTags, tag]
                                    : prev.dietaryTags.filter((t) => t !== tag),
                                }));
                              }}
                              className="rounded accent-blue-500"
                              aria-label={DIETARY_LABELS[tag]}
                            />
                            <span className="text-sm" style={{ color: 'var(--aurora-text)' }}>
                              {DIETARY_LABELS[tag]}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Serves Count */}
                    <div>
                      <label className="block text-sm font-medium mb-2" style={{ color: 'var(--aurora-text)' }}>
                        Serves Count
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={formData.servesCount}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            servesCount: e.target.value,
                          }))
                        }
                        placeholder="Number of people"
                        className="w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2"
                        style={{
                          borderColor: 'var(--aurora-border)',
                          backgroundColor: 'var(--aurora-surface-variant, #EDF0F7)',
                          color: 'var(--aurora-text)',
                        }}
                        aria-label="Number of people this item serves"
                      />
                    </div>

                    {/* Prep Time */}
                    <div>
                      <label className="block text-sm font-medium mb-2" style={{ color: 'var(--aurora-text)' }}>
                        Prep Time (minutes)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={formData.prepTimeMinutes}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            prepTimeMinutes: e.target.value,
                          }))
                        }
                        placeholder="0"
                        className="w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2"
                        style={{
                          borderColor: 'var(--aurora-border)',
                          backgroundColor: 'var(--aurora-surface-variant, #EDF0F7)',
                          color: 'var(--aurora-text)',
                        }}
                        aria-label="Preparation time in minutes"
                      />
                    </div>

                    {/* Min Order Qty */}
                    <div>
                      <label className="block text-sm font-medium mb-2" style={{ color: 'var(--aurora-text)' }}>
                        Min Order Qty
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={formData.minOrderQty}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            minOrderQty: e.target.value,
                          }))
                        }
                        placeholder="0"
                        className="w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2"
                        style={{
                          borderColor: 'var(--aurora-border)',
                          backgroundColor: 'var(--aurora-surface-variant, #EDF0F7)',
                          color: 'var(--aurora-text)',
                        }}
                        aria-label="Minimum order quantity"
                      />
                    </div>

                    {/* Max Order Qty */}
                    <div>
                      <label className="block text-sm font-medium mb-2" style={{ color: 'var(--aurora-text)' }}>
                        Max Order Qty
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={formData.maxOrderQty}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            maxOrderQty: e.target.value,
                          }))
                        }
                        placeholder="No limit"
                        className="w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2"
                        style={{
                          borderColor: 'var(--aurora-border)',
                          backgroundColor: 'var(--aurora-surface-variant, #EDF0F7)',
                          color: 'var(--aurora-text)',
                        }}
                        aria-label="Maximum order quantity"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Drawer Footer */}
            <div
              className="border-t p-6 space-y-3 shrink-0 bg-white"
              style={{
                borderColor: 'var(--aurora-border)',
                backgroundColor: 'var(--aurora-bg)',
              }}
            >
              <button
                onClick={handleSaveItem}
                disabled={saving}
                className="w-full py-3 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  backgroundColor: '#6366F1',
                  color: 'white',
                }}
                aria-label={isEditingMode ? 'Save changes' : 'Add item'}
              >
                {saving ? (
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 size={18} className="animate-spin" />
                    Saving...
                  </div>
                ) : isEditingMode ? (
                  'Save Changes'
                ) : (
                  'Add Item'
                )}
              </button>
              <button
                onClick={closeDrawer}
                disabled={saving}
                className="w-full py-3 rounded-lg font-semibold transition-colors disabled:opacity-50"
                style={{
                  backgroundColor: 'var(--aurora-surface-variant, #EDF0F7)',
                  color: 'var(--aurora-text)',
                }}
                aria-label="Cancel"
              >
                Cancel
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * MenuItem Component
 */
function MenuItem({
  item,
  onEdit,
  onDuplicate,
  onArchive,
  onDelete,
  isDeletingId,
  onConfirmDelete,
}: {
  item: CateringMenuItem;
  onEdit: () => void;
  onDuplicate: () => void;
  onArchive: () => void;
  onDelete: () => void;
  isDeletingId: string | null;
  onConfirmDelete: (id: string) => void;
}) {
  const pricingTypeLabels: Record<string, string> = {
    per_person: '/ person',
    per_tray: '/ tray',
    flat_rate: 'flat rate',
  };

  const pricingLabel = pricingTypeLabels[item.pricingType || 'per_person'] || '/ person';

  return (
    <>
      <div
        className="p-4 rounded-lg border flex items-start gap-4 hover:shadow-md transition-shadow"
        style={{
          backgroundColor: 'var(--aurora-surface-variant, #EDF0F7)',
          borderColor: 'var(--aurora-border)',
        }}
      >
        {/* Photo Thumbnail */}
        <div className="flex-shrink-0">
          {item.photoUrl ? (
            <img
              src={item.photoUrl}
              alt={item.name}
              className="w-10 h-10 rounded-lg object-cover"
            />
          ) : (
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: 'var(--aurora-bg)' }}
            >
              <Package size={20} style={{ color: 'var(--aurora-text-secondary)' }} />
            </div>
          )}
        </div>

        {/* Item Details */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-start gap-2 mb-2">
            <h3 className="font-bold" style={{ color: 'var(--aurora-text)' }}>
              {item.name}
            </h3>
            {item.archived && (
              <span
                className="text-xs font-semibold px-2 py-1 rounded"
                style={{
                  backgroundColor: '#f3f4f6',
                  color: '#6b7280',
                }}
              >
                Archived
              </span>
            )}
          </div>

          <p className="text-sm mb-2" style={{ color: 'var(--aurora-text-secondary)' }}>
            {formatPrice(item.price)} {pricingLabel}
          </p>

          {/* Dietary Tags */}
          {item.dietaryTags && item.dietaryTags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {(item.dietaryTags as DietaryTag[]).map((tag) => (
                <div
                  key={tag}
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: DIETARY_COLORS[tag] }}
                  title={DIETARY_LABELS[tag]}
                  aria-label={DIETARY_LABELS[tag]}
                />
              ))}
            </div>
          )}

          {/* Description Preview */}
          {item.description && (
            <p className="text-xs mb-2 line-clamp-1" style={{ color: 'var(--aurora-text-secondary)' }}>
              {item.description}
            </p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex-shrink-0 flex gap-2">
          <button
            onClick={onEdit}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="Edit item"
            aria-label={`Edit ${item.name}`}
          >
            <Pencil size={18} style={{ color: 'var(--aurora-text-secondary)' }} />
          </button>
          <button
            onClick={onDuplicate}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="Duplicate item"
            aria-label={`Duplicate ${item.name}`}
          >
            <Copy size={18} style={{ color: 'var(--aurora-text-secondary)' }} />
          </button>
          <button
            onClick={onArchive}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title={item.archived ? 'Restore item' : 'Archive item'}
            aria-label={item.archived ? `Restore ${item.name}` : `Archive ${item.name}`}
          >
            {item.archived ? (
              <ArchiveRestore size={18} style={{ color: 'var(--aurora-text-secondary)' }} />
            ) : (
              <Archive size={18} style={{ color: 'var(--aurora-text-secondary)' }} />
            )}
          </button>
          <button
            onClick={onDelete}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="Delete item"
            aria-label={`Delete ${item.name}`}
          >
            <Trash2 size={18} style={{ color: '#ef4444' }} />
          </button>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {isDeletingId === item.id && (
        <>
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-40"
            onClick={() => setDeletingId(null)}
            aria-hidden="true"
          />
          <div
            className="fixed inset-0 flex items-center justify-center z-50 p-4"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-dialog-title"
          >
            <div
              className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6"
              style={{ backgroundColor: 'var(--aurora-bg)' }}
            >
              <div className="flex items-start gap-3 mb-4">
                <AlertCircle size={24} style={{ color: '#ef4444' }} className="flex-shrink-0 mt-0.5" />
                <div>
                  <h3 id="delete-dialog-title" className="font-bold" style={{ color: 'var(--aurora-text)' }}>
                    Delete Item?
                  </h3>
                  <p className="text-sm mt-1" style={{ color: 'var(--aurora-text-secondary)' }}>
                    This action cannot be undone. The item "{item.name}" will be permanently deleted.
                  </p>
                </div>
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setDeletingId(null)}
                  className="px-4 py-2 rounded-lg font-medium transition-colors"
                  style={{
                    backgroundColor: 'var(--aurora-surface-variant, #EDF0F7)',
                    color: 'var(--aurora-text)',
                  }}
                  aria-label="Cancel deletion"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    onConfirmDelete(item.id);
                  }}
                  className="px-4 py-2 rounded-lg font-medium text-white transition-colors"
                  style={{ backgroundColor: '#ef4444' }}
                  aria-label={`Confirm delete ${item.name}`}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}

/**
 * EmptyState Component
 */
function EmptyState({ onAddItem, onPasteMenu, onStartTemplate }: { onAddItem: () => void; onPasteMenu: () => void; onStartTemplate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-6 py-12">
      <Utensils
        size={64}
        style={{ color: '#6366F1' }}
        className="mb-6 opacity-20"
      />
      <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--aurora-text)' }}>
        Build Your Menu
      </h2>
      <p className="text-center mb-8" style={{ color: 'var(--aurora-text-secondary)' }}>
        Start by adding items to your catering menu. Customers will see these items when placing orders.
      </p>

      <div className="grid gap-4 w-full max-w-md">
        <button
          onClick={onAddItem}
          className="p-6 rounded-lg text-center hover:shadow-md transition-shadow border-2"
          style={{
            backgroundColor: 'var(--aurora-surface-variant, #EDF0F7)',
            borderColor: '#6366F1',
            color: 'var(--aurora-text)',
          }}
        >
          <Plus size={32} style={{ color: '#6366F1' }} className="mx-auto mb-2" />
          <h3 className="font-semibold mb-1">Add Item</h3>
          <p className="text-sm" style={{ color: 'var(--aurora-text-secondary)' }}>
            Create items one at a time
          </p>
        </button>

        <button
          onClick={onPasteMenu}
          className="p-6 rounded-lg text-center hover:shadow-md transition-shadow border-2 cursor-pointer"
          style={{
            backgroundColor: 'var(--aurora-surface-variant, #EDF0F7)',
            borderColor: 'var(--aurora-border)',
            color: 'var(--aurora-text)',
          }}
        >
          <Sparkles size={32} style={{ color: '#6366F1' }} className="mx-auto mb-2" />
          <h3 className="font-semibold mb-1">Paste Menu</h3>
          <p className="text-sm" style={{ color: 'var(--aurora-text-secondary)' }}>
            Paste text from an existing menu
          </p>
        </button>

        <button
          onClick={onStartTemplate}
          className="p-6 rounded-lg text-center hover:shadow-md transition-shadow border-2 cursor-pointer"
          style={{
            backgroundColor: 'var(--aurora-surface-variant, #EDF0F7)',
            borderColor: 'var(--aurora-border)',
            color: 'var(--aurora-text)',
          }}
        >
          <FileText size={32} style={{ color: '#6366F1' }} className="mx-auto mb-2" />
          <h3 className="font-semibold mb-1">Start from Template</h3>
          <p className="text-sm" style={{ color: 'var(--aurora-text-secondary)' }}>
            Pick a cuisine template to get started
          </p>
        </button>
      </div>
    </div>
  );
}

// Add this missing import
import { Utensils } from 'lucide-react';

// Fix the state management issue - define setDeletingId in MenuItem
function MenuItemWrapper({
  item,
  onEdit,
  onDuplicate,
  onArchive,
  onDelete,
  isDeletingId,
  onConfirmDelete,
}: {
  item: CateringMenuItem;
  onEdit: () => void;
  onDuplicate: () => void;
  onArchive: () => void;
  onDelete: () => void;
  isDeletingId: string | null;
  onConfirmDelete: (id: string) => void;
}) {
  const [localDeleting, setLocalDeleting] = useState(false);

  return (
    <MenuItem
      item={item}
      onEdit={onEdit}
      onDuplicate={onDuplicate}
      onArchive={onArchive}
      onDelete={() => {
        setLocalDeleting(true);
        onDelete();
      }}
      isDeletingId={isDeletingId === item.id ? item.id : null}
      onConfirmDelete={onConfirmDelete}
    />
  );
}