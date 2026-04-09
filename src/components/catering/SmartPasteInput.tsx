import React, { useState, useCallback } from 'react';
import { X, Sparkles, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import type { ParsedMenuItem } from '@/services/cateringService';

interface SmartPasteInputProps {
  businessId: string;
  onItemsParsed: (items: ParsedMenuItem[]) => void;
  onClose: () => void;
}

interface ParsingResult {
  items: ParsedMenuItem[];
  allHavePrices: boolean;
  parseErrors: string[];
}

const SmartPasteInput: React.FC<SmartPasteInputProps> = ({
  businessId,
  onItemsParsed,
  onClose,
}) => {
  const [menuText, setMenuText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [parseResult, setParseResult] = useState<ParsingResult | null>(null);

  /**
   * Extract price from text
   * Handles formats: $12.99, $12, 12.99, etc.
   */
  const extractPrice = (text: string): number | null => {
    const priceMatch = text.match(/\$?(\d+(?:\.\d{1,2})?)/);
    if (priceMatch) {
      return Math.round(parseFloat(priceMatch[1]) * 100); // Convert to cents
    }
    return null;
  };

  /**
   * Detect pricing type from text
   */
  const detectPricingType = (
    text: string,
  ): 'per_person' | 'per_tray' | 'flat_rate' => {
    const lowerText = text.toLowerCase();
    if (lowerText.includes('per person') || lowerText.includes('/person')) {
      return 'per_person';
    }
    if (lowerText.includes('per tray') || lowerText.includes('/tray')) {
      return 'per_tray';
    }
    if (lowerText.includes('flat rate')) {
      return 'flat_rate';
    }
    // Default based on context
    return 'flat_rate';
  };

  /**
   * Extract dietary tags from text
   */
  const extractDietaryTags = (text: string): string[] => {
    const dietaryKeywords: { [key: string]: string } = {
      vegetarian: 'vegetarian',
      vegan: 'vegan',
      halal: 'halal',
      kosher: 'kosher',
      'gluten free': 'gluten_free',
      'gluten-free': 'gluten_free',
      'dairy free': 'dairy_free',
      'dairy-free': 'dairy_free',
      'nut free': 'nut_free',
      'nut-free': 'nut_free',
    };

    const tags: string[] = [];
    const lowerText = text.toLowerCase();

    // Check in order of specificity
    for (const [keyword, tag] of Object.entries(dietaryKeywords)) {
      if (lowerText.includes(keyword) && !tags.includes(tag)) {
        tags.push(tag);
      }
    }

    return tags;
  };

  /**
   * Extract serves count from text
   * Handles: "Serves 10", "(20 pcs)", etc.
   */
  const extractServesCount = (text: string): number | undefined => {
    const servesMatch = text.match(/serves\s*(\d+)/i);
    if (servesMatch) {
      return parseInt(servesMatch[1], 10);
    }

    const pcsMatch = text.match(/\((\d+)\s*pcs?\)/i);
    if (pcsMatch) {
      return parseInt(pcsMatch[1], 10);
    }

    return undefined;
  };

  /**
   * Categorize item based on keywords
   */
  const categorizeItem = (
    name: string,
    description: string,
  ): 'Appetizer' | 'Entree' | 'Side' | 'Dessert' | 'Beverage' | 'Package' => {
    const fullText = `${name} ${description}`.toLowerCase();

    // Beverage
    if (
      /\b(drink|chai|coffee|juice|lassi|tea|smoothie|shake|soda|water|beverage)\b/.test(
        fullText,
      )
    ) {
      return 'Beverage';
    }

    // Dessert
    if (
      /\b(dessert|sweet|halwa|gulab|kulfi|kheer|jalebi|laddu|barfi|ice cream|cake|pudding)\b/.test(
        fullText,
      )
    ) {
      return 'Dessert';
    }

    // Appetizer/Starter
    if (
      /\b(samosa|pakora|chaat|puri|kebab|tikka|spring roll|panipuri|bhaji|fries|appetizer|starter)\b/.test(
        fullText,
      )
    ) {
      return 'Appetizer';
    }

    // Side
    if (
      /\b(rice|naan|roti|dal|raita|paratha|bread|chapati|rice bowl|side|pickle)\b/.test(
        fullText,
      )
    ) {
      return 'Side';
    }

    // Package
    if (
      /\b(package|combo|bundle|platter|tray|feast|special|party|catering)\b/.test(
        fullText,
      )
    ) {
      return 'Package';
    }

    // Default to Entree
    return 'Entree';
  };

  /**
   * Parse menu text into structured items
   */
  const parseMenuText = (text: string): ParsingResult => {
    const items: ParsedMenuItem[] = [];
    const parseErrors: string[] = [];

    // Split by double newlines to get item blocks
    const itemBlocks = text
      .split(/\n\s*\n/)
      .filter((block) => block.trim().length > 0);

    if (itemBlocks.length === 0) {
      return { items: [], allHavePrices: false, parseErrors: [] };
    }

    itemBlocks.forEach((block, blockIndex) => {
      const lines = block.split('\n').filter((line) => line.trim().length > 0);

      if (lines.length === 0) return;

      // First line is typically the item name (with possible price)
      const nameLine = lines[0];

      // Extract name and price from first line
      // Patterns: "Name - $12.99" or "Name - Price / type" or "Name (details) - Price"
      const nameMatch = nameLine.match(/^([^-]+?)(?:\s*-\s*(.+))?$/);
      let itemName = nameMatch ? nameMatch[1].trim() : nameLine;
      const priceSection = nameMatch ? nameMatch[2] : '';

      // Clean up item name (remove parenthetical details for now, they'll be in description)
      itemName = itemName.replace(/\s*\([^)]*\)\s*/, ' ').trim();

      // Extract price from price section or full name line
      const extractedPrice = priceSection
        ? extractPrice(priceSection)
        : extractPrice(nameLine);

      // Get remaining lines as description
      const descriptionLines = lines.slice(1);
      const fullDescription = descriptionLines.join(' ').trim();

      // Extract dietary tags from entire block
      const dietaryTags = extractDietaryTags(block);

      // Extract serves count
      const servesCount = extractServesCount(block);

      // Detect pricing type
      const pricingType = detectPricingType(
        priceSection || fullDescription || nameLine,
      );

      // Categorize
      const category = categorizeItem(itemName, fullDescription);

      // Calculate confidence scores
      const nameConfidence = itemName.length > 3 ? 1.0 : 0.6;
      const priceConfidence = extractedPrice !== null ? 1.0 : 0.3;
      const categoryConfidence =
        category === 'Entree' && extractedPrice === null ? 0.5 : 1.0;
      const dietaryTagsConfidence = dietaryTags.length > 0 ? 1.0 : 0.7;

      const item: ParsedMenuItem = {
        name: itemName,
        price: extractedPrice,
        description: fullDescription,
        category,
        pricingType,
        dietaryTags,
        servesCount,
        confidence: {
          name: nameConfidence,
          price: priceConfidence,
          category: categoryConfidence,
          dietaryTags: dietaryTagsConfidence,
        },
      };

      // Validate minimum requirements
      if (itemName.length < 2) {
        parseErrors.push(`Block ${blockIndex + 1}: Item name too short`);
        return;
      }

      items.push(item);
    });

    const allHavePrices = items.every((item) => item.price !== null);

    return { items, allHavePrices, parseErrors };
  };

  /**
   * Handle parse button click
   */
  const handleParse = useCallback(async () => {
    if (!menuText.trim()) return;

    setIsLoading(true);

    // Simulate async parsing (could call API in future)
    setTimeout(() => {
      const result = parseMenuText(menuText);

      // Filter out items with very low confidence
      const validItems = result.items.filter(
        (item) =>
          item.confidence.name >= 0.6 && item.confidence.price >= 0.3,
      );

      setParseResult({
        items: validItems,
        allHavePrices: validItems.every((item) => item.price !== null),
        parseErrors: result.parseErrors,
      });

      setIsLoading(false);
    }, 500);
  }, [menuText]);

  /**
   * Handle submit parsed items
   */
  const handleSubmit = useCallback(() => {
    if (parseResult && parseResult.items.length > 0) {
      onItemsParsed(parseResult.items);
      onClose();
    }
  }, [parseResult, onItemsParsed, onClose]);

  const isParseDisabled =
    !menuText.trim() || isLoading || parseResult !== null;
  const hasItems = parseResult && parseResult.items.length > 0;
  const hasErrors = parseResult && parseResult.items.length === 0;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">Paste Your Menu</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Close"
          >
            <X size={20} className="text-gray-600" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {!hasItems && !hasErrors && (
            <>
              {/* Info text */}
              <p className="text-gray-600 text-sm leading-relaxed">
                Paste your menu text below — from your website, a document, or
                typed from memory. We'll extract item names, prices,
                descriptions, and dietary info automatically.
              </p>

              {/* Textarea */}
              <div>
                <textarea
                  value={menuText}
                  onChange={(e) => setMenuText(e.target.value)}
                  placeholder={`Samosa Platter (20 pcs) - $34.99 flat rate
Crispy pastries filled with spiced potatoes and peas
Vegetarian, Gluten Free

Butter Chicken Tray - $79.99 / tray
Serves 10. Tender chicken in rich tomato-butter gravy
Halal`}
                  rows={12}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl font-mono text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent resize-none"
                />
                <div className="mt-2 text-xs text-gray-500">
                  {menuText.length} characters • {menuText.split('\n').length}{' '}
                  lines
                </div>
              </div>

              {/* Parse Button */}
              <button
                onClick={handleParse}
                disabled={isParseDisabled}
                className={`w-full py-3 rounded-full font-semibold flex items-center justify-center gap-2 transition-all ${
                  isParseDisabled
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-black text-white hover:bg-gray-800'
                }`}
              >
                {isLoading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Parsing...
                  </>
                ) : (
                  <>
                    <Sparkles size={18} />
                    Parse Menu
                  </>
                )}
              </button>
            </>
          )}

          {/* Results Summary */}
          {hasItems && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 bg-green-50 rounded-lg border border-green-200">
                <CheckCircle2
                  size={20}
                  className="text-green-600 flex-shrink-0 mt-0.5"
                />
                <div>
                  <p className="font-semibold text-green-900">
                    Found {parseResult.items.length} item
                    {parseResult.items.length !== 1 ? 's' : ''}
                  </p>
                  {!parseResult.allHavePrices && (
                    <p className="text-sm text-amber-600 mt-1">
                      ⚠️ Some items are missing prices. You can add them after
                      import.
                    </p>
                  )}
                </div>
              </div>

              {/* Items Preview */}
              <div className="space-y-3 max-h-60 overflow-y-auto">
                {parseResult.items.map((item, index) => (
                  <div
                    key={index}
                    className="p-3 bg-gray-50 rounded-lg border border-gray-200"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 truncate">
                          {item.name}
                        </p>
                        {item.description && (
                          <p className="text-xs text-gray-600 line-clamp-2 mt-1">
                            {item.description}
                          </p>
                        )}
                      </div>
                      {item.price && (
                        <p className="font-semibold text-gray-900 flex-shrink-0">
                          ${item.price.toFixed(2)}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      {item.category && (
                        <span className="inline-block px-2 py-1 bg-gray-200 text-gray-700 text-xs rounded font-medium">
                          {item.category}
                        </span>
                      )}
                      {item.dietaryTags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-block px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    setParseResult(null);
                    setMenuText('');
                  }}
                  className="flex-1 py-2 px-4 border border-gray-300 rounded-full font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Start Over
                </button>
                <button
                  onClick={handleSubmit}
                  className="flex-1 py-2 px-4 bg-black text-white rounded-full font-semibold hover:bg-gray-800 transition-colors"
                >
                  Import Items
                </button>
              </div>
            </div>
          )}

          {/* Error State */}
          {hasErrors && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 bg-red-50 rounded-lg border border-red-200">
                <AlertCircle
                  size={20}
                  className="text-red-600 flex-shrink-0 mt-0.5"
                />
                <div>
                  <p className="font-semibold text-red-900">
                    Couldn't extract any items
                  </p>
                  <p className="text-sm text-red-700 mt-1">
                    Try formatting each item on a separate line with the price
                    included.
                  </p>
                </div>
              </div>

              <button
                onClick={() => {
                  setParseResult(null);
                }}
                className="w-full py-2 px-4 bg-black text-white rounded-full font-semibold hover:bg-gray-800 transition-colors"
              >
                Try Again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SmartPasteInput;
