import { ETHNICITY_KEYWORDS } from '../constants/config';

/**
 * Fuzzy search: filters and sorts options by relevance to query
 * Uses substring match + word-boundary match + character sequence match
 */
export function fuzzySearch(query: string, options: string[]): string[] {
  if (!query || !query.trim()) return options;

  const searchStr = query.toLowerCase().trim();

  return options
    .map((option) => {
      const lower = option.toLowerCase();
      let score = 0;

      // Exact match
      if (lower === searchStr) {
        score += 200;
      }

      // Starts with query
      if (lower.startsWith(searchStr)) {
        score += 150;
      }

      // Contains query as substring
      if (lower.includes(searchStr)) {
        score += 100;
      }

      // Word boundary match (any word in option starts with query)
      const words = lower.split(/[\s\-]+/);
      if (words.some((w) => w.startsWith(searchStr))) {
        score += 75;
      }

      // Partial word match (any word contains query)
      if (words.some((w) => w.includes(searchStr))) {
        score += 50;
      }

      // Character sequence match (fuzzy)
      let queryIdx = 0;
      for (let i = 0; i < lower.length && queryIdx < searchStr.length; i++) {
        if (lower[i] === searchStr[queryIdx]) {
          queryIdx++;
        }
      }
      if (queryIdx === searchStr.length) {
        score += 25;
      }

      return { option, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ option }) => option);
}

/**
 * Suggests ethnicity options based on keyword matching
 * Maps common language/ethnic terms to their full ethnicity option
 */
export function suggestEthnicity(input: string): string[] {
  if (!input || !input.trim()) return [];

  const searchStr = input.toLowerCase().trim();
  const suggestions: Set<string> = new Set();

  // Check keyword mappings
  for (const [keyword, options] of Object.entries(ETHNICITY_KEYWORDS) as [string, string[]][]) {
    if (keyword.includes(searchStr) || searchStr.includes(keyword)) {
      options.forEach((opt: string) => suggestions.add(opt));
    }
  }

  return Array.from(suggestions);
}

/**
 * Capitalizes a string properly (Title Case)
 */
export function capitalize(str: string): string {
  return str
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Formats a custom ethnicity entry with proper capitalization
 * Tries to match "Region - Subgroup" pattern
 */
export function formatCustomEthnicity(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return '';

  // Check if already in "Region - Subgroup" format
  if (trimmed.includes(' - ')) {
    const parts = trimmed.split(' - ');
    return parts.map((p) => capitalize(p.trim())).join(' - ');
  }

  return capitalize(trimmed);
}
