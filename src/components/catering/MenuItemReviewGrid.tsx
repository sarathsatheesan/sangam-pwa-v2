import React, { useState, useMemo } from 'react';
import { X, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import type { ParsedMenuItem, MenuCategory } from '@/services/cateringService';

interface MenuItemReviewGridProps {
  items: ParsedMenuItem[];
  onItemsChange: (items: ParsedMenuItem[]) => void;
  onPublish: (items: ParsedMenuItem[]) => void;
  onCancel: () => void;
  publishing?: boolean;
}

const DIETARY_TAGS: { value: string; label: string }[] = [
  { value: 'vegetarian', label: 'Vegetarian' },
  { value: 'vegan', label: 'Vegan' },
  { value: 'gluten_free', label: 'Gluten-Free' },
  { value: 'dairy_free', label: 'Dairy-Free' },
  { value: 'nut_free', label: 'Nut-Free' },
  { value: 'halal', label: 'Halal' },
  { value: 'kosher', label: 'Kosher' },
];

const CATEGORIES: MenuCategory[] = [
  'Appetizer',
  'Entree',
  'Side',
  'Dessert',
  'Beverage',
  'Package',
];

const MenuItemReviewGrid: React.FC<MenuItemReviewGridProps> = ({
  items,
  onItemsChange,
  onPublish,
  onCancel,
  publishing = false,
}) => {
  const [editingItems, setEditingItems] = useState<ParsedMenuItem[]>(items);

  // Validate items
  const validationStatus = useMemo(() => {
    const invalid = editingItems.filter(
      item =>
        !item.name ||
        !item.category ||
        !item.price ||
        item.price <= 0
    );
    return {
      valid: editingItems.length - invalid.length,
      invalid: invalid.length,
      isAllValid: invalid.length === 0,
    };
  }, [editingItems]);

  // Update a specific item field
  const updateItem = (index: number, field: keyof ParsedMenuItem, value: any) => {
    const updated = [...editingItems];
    updated[index] = { ...updated[index], [field]: value };
    setEditingItems(updated);
    onItemsChange(updated);
  };

  // Remove an item
  const removeItem = (index: number) => {
    const updated = editingItems.filter((_, i) => i !== index);
    setEditingItems(updated);
    onItemsChange(updated);
  };

  // Toggle dietary tag
  const toggleDietaryTag = (index: number, tag: string) => {
    const item = editingItems[index];
    const tags = item.dietaryTags || [];
    const updated = [...editingItems];
    updated[index] = {
      ...updated[index],
      dietaryTags: tags.includes(tag)
        ? tags.filter(t => t !== tag)
        : [...tags, tag],
    };
    setEditingItems(updated);
    onItemsChange(updated);
  };

  // Publish handler
  const handlePublish = () => {
    if (validationStatus.isAllValid) {
      onPublish(editingItems);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4 md:p-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Review Your Menu Items
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              {editingItems.length} {editingItems.length === 1 ? 'item' : 'items'} to review
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              disabled={publishing}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              Cancel
            </button>
            <button
              onClick={handlePublish}
              disabled={!validationStatus.isAllValid || publishing}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2"
            >
              {publishing && <Loader2 className="w-4 h-4 animate-spin" />}
              Publish All
            </button>
          </div>
        </div>
      </div>

      {/* Validation Status */}
      {validationStatus.invalid > 0 && (
        <div className="bg-amber-50 border-t border-amber-200 p-4 md:p-6">
          <div className="max-w-6xl mx-auto flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <p className="text-sm font-medium text-amber-900">
              {validationStatus.invalid} {validationStatus.invalid === 1 ? 'item needs' : 'items need'} attention
            </p>
          </div>
        </div>
      )}

      {/* Grid of Cards */}
      <div className="p-4 md:p-6 pb-32 md:pb-8">
        <div className="max-w-6xl mx-auto">
          {editingItems.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-600">No items to review</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {editingItems.map((item, index) => {
                const hasLowConfidence =
                  (item.confidence?.name && item.confidence.name < 0.7) ||
                  (item.confidence?.category && item.confidence.category < 0.7) ||
                  (item.confidence?.price && item.confidence.price < 0.7);

                const hasMissingPrice = !item.price || item.price <= 0;
                const hasMissingName = !item.name;
                const hasMissingCategory = !item.category;

                return (
                  <div
                    key={index}
                    className={`rounded-xl border p-4 bg-white shadow-sm relative ${
                      hasMissingPrice
                        ? 'border-red-300'
                        : hasLowConfidence
                        ? 'border-l-4 border-l-amber-400 border-gray-200'
                        : 'border-gray-200'
                    }`}
                  >
                    {/* Remove Button */}
                    <button
                      onClick={() => removeItem(index)}
                      className="absolute top-3 right-3 p-1 hover:bg-gray-100 rounded transition"
                      aria-label="Remove item"
                    >
                      <X className="w-4 h-4 text-gray-400" />
                    </button>

                    {/* Confidence Indicator */}
                    {hasLowConfidence && (
                      <div className="flex items-center gap-1 mb-3 text-xs text-amber-700 font-medium">
                        <AlertCircle className="w-3 h-3" />
                        Please verify
                      </div>
                    )}

                    {/* Name Input */}
                    <div className="mb-4">
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Name
                        {hasMissingName && (
                          <span className="text-red-600"> *</span>
                        )}
                      </label>
                      <input
                        type="text"
                        value={item.name || ''}
                        onChange={(e) => updateItem(index, 'name', e.target.value)}
                        className={`w-full px-3 py-2 border rounded-lg text-sm font-semibold transition ${
                          hasMissingName
                            ? 'border-red-300 focus:ring-red-200'
                            : 'border-gray-300 focus:ring-blue-200'
                        } focus:ring-2 focus:outline-none`}
                        placeholder="Item name"
                      />
                    </div>

                    {/* Price Input */}
                    <div className="mb-4">
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Price
                        {hasMissingPrice && (
                          <span className="text-red-600"> *</span>
                        )}
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-2 text-sm text-gray-600">$</span>
                        <input
                          type="number"
                          value={item.price ? (item.price / 100).toFixed(2) : ''}
                          onChange={(e) => {
                            const dollars = parseFloat(e.target.value) || 0;
                            updateItem(index, 'price', Math.round(dollars * 100));
                          }}
                          step="0.01"
                          min="0"
                          className={`w-full pl-8 pr-3 py-2 border rounded-lg text-sm transition ${
                            hasMissingPrice
                              ? 'border-red-300 focus:ring-red-200'
                              : 'border-gray-300 focus:ring-blue-200'
                          } focus:ring-2 focus:outline-none`}
                          placeholder="0.00"
                        />
                        {hasMissingPrice && (
                          <div className="absolute right-3 top-2 px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded">
                            Set price
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Category Dropdown */}
                    <div className="mb-4">
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Category
                        {hasMissingCategory && (
                          <span className="text-red-600"> *</span>
                        )}
                      </label>
                      <select
                        value={item.category || ''}
                        onChange={(e) => updateItem(index, 'category', e.target.value as MenuCategory)}
                        className={`w-full px-3 py-2 border rounded-lg text-sm transition ${
                          item.confidence?.category && item.confidence.category < 0.7
                            ? 'bg-amber-50 border-amber-300'
                            : 'bg-white border-gray-300'
                        } focus:ring-2 focus:ring-blue-200 focus:outline-none`}
                      >
                        <option value="">Select a category</option>
                        {CATEGORIES.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Pricing Type Toggle */}
                    <div className="mb-4">
                      <label className="block text-xs font-semibold text-gray-700 mb-2">
                        Pricing Type
                      </label>
                      <div className="flex gap-2">
                        {([
                          { value: 'per_person', label: 'Person' },
                          { value: 'per_tray', label: 'Tray' },
                          { value: 'flat_rate', label: 'Flat' },
                        ] as const).map((type) => (
                          <button
                            key={type.value}
                            onClick={() => updateItem(index, 'pricingType', type.value)}
                            className={`flex-1 px-3 py-1.5 text-xs font-medium rounded transition ${
                              item.pricingType === type.value
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            {type.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Description */}
                    <div className="mb-4">
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Description
                      </label>
                      <textarea
                        value={item.description || ''}
                        onChange={(e) => updateItem(index, 'description', e.target.value)}
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm transition focus:ring-2 focus:ring-blue-200 focus:outline-none resize-none"
                        placeholder="Item description"
                      />
                    </div>

                    {/* Dietary Tags */}
                    <div className="mb-4">
                      <label className="block text-xs font-semibold text-gray-700 mb-2">
                        Dietary Tags
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {DIETARY_TAGS.map((tag) => {
                          const isSelected = (item.dietaryTags || []).includes(tag.value);
                          return (
                            <button
                              key={tag.value}
                              onClick={() => toggleDietaryTag(index, tag.value)}
                              className={`px-3 py-1 text-xs font-medium rounded-full transition ${
                                isSelected
                                  ? 'bg-gray-900 text-white'
                                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                              }`}
                            >
                              {tag.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Serves Count */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Serves Count
                      </label>
                      <input
                        type="number"
                        value={item.servesCount || ''}
                        onChange={(e) => updateItem(index, 'servesCount', e.target.value ? parseInt(e.target.value) : undefined)}
                        min="1"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm transition focus:ring-2 focus:ring-blue-200 focus:outline-none"
                        placeholder="Optional"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Sticky Bottom Bar (Mobile) / Static (Desktop) */}
      <div className="fixed bottom-0 left-0 right-0 md:static bg-white border-t border-gray-200 p-4 md:p-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex-1">
            <p className="text-sm text-gray-600">
              <span className="font-medium text-gray-900">{validationStatus.valid}</span> items ready
              {validationStatus.invalid > 0 && (
                <>
                  {' · '}
                  <span className="font-medium text-amber-600">{validationStatus.invalid} need attention</span>
                </>
              )}
            </p>
          </div>
          <button
            onClick={handlePublish}
            disabled={!validationStatus.isAllValid || publishing}
            className="w-full md:w-auto px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2 font-medium"
          >
            {publishing && <Loader2 className="w-4 h-4 animate-spin" />}
            Publish All
          </button>
        </div>
      </div>
    </div>
  );
};

export default MenuItemReviewGrid;
