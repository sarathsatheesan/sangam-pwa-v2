// Content Moderation Utility for ethniCity Community Platform
// Client-side content scanning with keyword-based detection + Smart Filter AI
// TODO: This moderation runs client-side only and can be bypassed.
// Implement server-side moderation via Firebase Cloud Functions for production use.

export interface ModerationResult {
  isClean: boolean;
  flaggedCategories: string[];
  severity: 'none' | 'low' | 'medium' | 'high';
  flaggedWords: string[];
  message: string;
}

// Leetspeak normalization map
const LEETSPEAK_MAP: Record<string, string> = {
  '@': 'a',
  '4': 'a',
  '8': 'b',
  '(': 'c',
  '3': 'e',
  '6': 'g',
  '1': 'i',
  '!': 'i',
  '|': 'i',
  '0': 'o',
  '5': 's',
  '$': 's',
  '7': 't',
  '+': 't',
  '2': 'z',
};

// Unicode lookalike map — Cyrillic/Greek characters that visually resemble Latin letters
const UNICODE_LOOKALIKE_MAP: Record<string, string> = {
  '\u0430': 'a', // Cyrillic а
  '\u0435': 'e', // Cyrillic е
  '\u043e': 'o', // Cyrillic о
  '\u0440': 'p', // Cyrillic р
  '\u0441': 'c', // Cyrillic с
  '\u0443': 'y', // Cyrillic у
  '\u0445': 'x', // Cyrillic х
  '\u0456': 'i', // Cyrillic і
  '\u03b1': 'a', // Greek α
  '\u03bf': 'o', // Greek ο
  '\u03b5': 'e', // Greek ε
  '\u03b9': 'i', // Greek ι
  '\u0391': 'a', // Greek Α
  '\u0392': 'b', // Greek Β
  '\u0395': 'e', // Greek Ε
  '\u039f': 'o', // Greek Ο
};

// Contextual toxic phrases that require multi-word context to detect
const CONTEXTUAL_TOXIC_PHRASES: Record<string, string> = {
  'should be deported': 'hate_speech',
  'go back where you came from': 'hate_speech',
  'not welcome here': 'harassment',
  'people like you': 'hate_speech',
  'your kind': 'hate_speech',
  'dont belong here': 'hate_speech',
  'you deserve to suffer': 'harassment',
  'nobody likes you': 'harassment',
  'should be ashamed': 'harassment',
  'worthless human': 'harassment',
  'waste of space': 'harassment',
  'better off dead': 'harassment',
  'no one will miss you': 'harassment',
  'you disgust me': 'harassment',
  'send nudes': 'explicit',
  'want to see you naked': 'explicit',
};

// Profanity keywords (English common profanity)
const PROFANITY_WORDS: string[] = [
  'fuck', 'shit', 'ass', 'bitch', 'damn', 'crap', 'dick', 'piss',
  'bastard', 'cunt', 'whore', 'slut', 'cock', 'douche', 'wanker',
  'twat', 'bollocks', 'bugger', 'arse', 'prick', 'tosser',
  'motherfucker', 'bullshit', 'horseshit', 'dipshit', 'jackass',
  'dumbass', 'asshole', 'arsehole', 'shithead', 'dickhead',
  'fuckface', 'fucktard', 'retard', 'retarded',
];

// Hate speech keywords - caste-based, religious, nationality-based, racial
const HATE_SPEECH_WORDS: string[] = [
  // Caste-based slurs (important for South Asian context)
  'untouchable', 'chamar', 'bhangi', 'chuhra', 'dalit scum',
  'low caste', 'outcaste', 'achoot',
  // Religious slurs
  'kafir', 'kaffir', 'infidel scum', 'jihadi', 'terrorist muslim',
  'hindu terrorist', 'saffron terror', 'pagan scum',
  'christard', 'muzzie', 'raghead',
  // Nationality-based
  'paki', 'pakis', 'chinki', 'gook', 'chink', 'spic',
  'wetback', 'gringo', 'beaner', 'kike', 'yid',
  // Racial slurs
  'nigger', 'nigga', 'negro', 'coon', 'spook', 'darkie',
  'brownie', 'sand nigger', 'camel jockey', 'towelhead',
  'curry muncher', 'dot head', 'street shitter',
  // General hate
  'subhuman', 'vermin', 'cockroach', 'go back to your country',
  'white supremacy', 'ethnic cleansing', 'genocide is good',
  'death to', 'kill all',
];

// Harassment keywords - threats, doxxing, personal attacks
const HARASSMENT_WORDS: string[] = [
  'kill yourself', 'kys', 'go die', 'hope you die',
  'i will find you', 'i know where you live',
  'doxx', 'doxing', 'your address is', 'your phone number is',
  'i will hurt you', 'watch your back', 'you are dead',
  'ill beat you', 'ill kill you', 'gonna kill',
  'rape you', 'rape threat', 'sexual assault',
  'stalk', 'stalking', 'following you',
  'swat', 'swatting',
  'expose you', 'ruin your life', 'destroy you',
];

// Spam/Scam keywords
const SPAM_SCAM_WORDS: string[] = [
  'send money', 'wire transfer', 'western union',
  'nigerian prince', 'lottery winner', 'you have won',
  'click this link', 'free gift card', 'act now',
  'limited time offer', 'make money fast', 'get rich quick',
  'crypto invest', 'guaranteed returns', 'double your money',
  'mlm opportunity', 'network marketing opportunity',
  'work from home earn', 'passive income secret',
  'whatsapp me at', 'telegram me at', 'dm for details',
  'visa agent', 'guaranteed green card', 'immigration consultant cheap',
  'fake documents', 'fake passport', 'fake visa',
  'pay with gift cards', 'bitcoin only', 'untraceable payment',
];

// Explicit content keywords
const EXPLICIT_WORDS: string[] = [
  'porn', 'pornography', 'xxx', 'nsfw', 'nude', 'nudes',
  'naked', 'sex video', 'sexual content', 'onlyfans',
  'escort', 'prostitut', 'call girl', 'massage parlor',
  'gore', 'beheading', 'dismember', 'mutilat',
  'child abuse', 'pedophil', 'cp ',
  'drug dealer', 'buy drugs', 'sell drugs',
  'meth', 'cocaine', 'heroin dealer',
];

// Category severity mapping
const CATEGORY_SEVERITY: Record<string, 'low' | 'medium' | 'high'> = {
  profanity: 'low',
  hate_speech: 'high',
  harassment: 'high',
  spam_scam: 'medium',
  explicit: 'high',
};

// Category display names
const CATEGORY_NAMES: Record<string, string> = {
  profanity: 'Profanity',
  hate_speech: 'Hate Speech',
  harassment: 'Harassment',
  spam_scam: 'Spam / Scam',
  explicit: 'Explicit Content',
};

/**
 * Normalize text for moderation scanning
 * - Lowercase
 * - Replace leetspeak characters
 * - Remove excessive special characters
 * - Normalize whitespace
 */
function normalizeText(text: string): string {
  let normalized = text.toLowerCase();

  // Replace unicode lookalike characters (Cyrillic, Greek)
  let unicodeResult = '';
  for (const char of normalized) {
    unicodeResult += UNICODE_LOOKALIKE_MAP[char] || char;
  }
  normalized = unicodeResult;

  // Remove zero-width characters and invisible unicode
  normalized = normalized.replace(/[\u200B-\u200F\u2028-\u202F\uFEFF]/g, '');

  // Replace leetspeak characters
  let result = '';
  for (const char of normalized) {
    result += LEETSPEAK_MAP[char] || char;
  }
  normalized = result;

  // Remove repeated characters (e.g., "fuuuuck" -> "fuck")
  normalized = normalized.replace(/(.)\1{2,}/g, '$1$1');

  // Collapse spaced-out letters (e.g., "f u c k" -> "fuck")
  // Only collapse when 3+ single letters are separated by spaces
  normalized = normalized.replace(/\b([a-z])\s+(?=[a-z]\b)/g, '$1');

  // Normalize whitespace
  normalized = normalized.replace(/\s+/g, ' ').trim();

  return normalized;
}

/**
 * Check if text contains a keyword using word-boundary matching
 */
function containsKeyword(normalizedText: string, keyword: string): boolean {
  const normalizedKeyword = keyword.toLowerCase();

  // For multi-word phrases, use simple includes
  if (normalizedKeyword.includes(' ')) {
    return normalizedText.includes(normalizedKeyword);
  }

  // For single words, use word boundary matching
  const regex = new RegExp(`\\b${escapeRegex(normalizedKeyword)}\\b`, 'i');
  return regex.test(normalizedText);
}

/**
 * Escape special regex characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Scan text against a category's keyword list
 */
function scanCategory(normalizedText: string, keywords: string[]): string[] {
  const found: string[] = [];
  for (const keyword of keywords) {
    if (containsKeyword(normalizedText, keyword)) {
      found.push(keyword);
    }
  }
  return found;
}

/**
 * Get the highest severity from a list of categories
 */
function getHighestSeverity(categories: string[]): 'none' | 'low' | 'medium' | 'high' {
  const severityOrder: Record<string, number> = { none: 0, low: 1, medium: 2, high: 3 };
  let highest: 'none' | 'low' | 'medium' | 'high' = 'none';

  for (const category of categories) {
    const severity = CATEGORY_SEVERITY[category] || 'low';
    if (severityOrder[severity] > severityOrder[highest]) {
      highest = severity;
    }
  }

  return highest;
}

/**
 * Generate user-facing message based on moderation result
 */
function generateMessage(severity: string, categories: string[]): string {
  if (severity === 'high') {
    const names = categories
      .filter((c) => CATEGORY_SEVERITY[c] === 'high')
      .map((c) => CATEGORY_NAMES[c])
      .join(', ');
    return `Your content was blocked because it contains ${names}. Please revise and try again.`;
  }
  if (severity === 'medium') {
    return 'Your content has been posted but flagged for review by moderators.';
  }
  if (severity === 'low') {
    return 'Your content has been posted but may be reviewed by moderators.';
  }
  return '';
}

/**
 * Main moderation function - scans text for harmful content
 *
 * @param text - The text content to moderate
 * @returns ModerationResult with severity and flagged categories
 */
export function moderateContent(text: string): ModerationResult {
  if (!text || text.trim().length === 0) {
    return {
      isClean: true,
      flaggedCategories: [],
      severity: 'none',
      flaggedWords: [],
      message: '',
    };
  }

  const normalizedText = normalizeText(text);
  const flaggedCategories: string[] = [];
  const allFlaggedWords: string[] = [];

  // Scan each category
  const categoryScans: Record<string, string[]> = {
    profanity: scanCategory(normalizedText, PROFANITY_WORDS),
    hate_speech: scanCategory(normalizedText, HATE_SPEECH_WORDS),
    harassment: scanCategory(normalizedText, HARASSMENT_WORDS),
    spam_scam: scanCategory(normalizedText, SPAM_SCAM_WORDS),
    explicit: scanCategory(normalizedText, EXPLICIT_WORDS),
  };

  for (const [category, flaggedWords] of Object.entries(categoryScans)) {
    if (flaggedWords.length > 0) {
      flaggedCategories.push(category);
      allFlaggedWords.push(...flaggedWords);
    }
  }

  const severity = getHighestSeverity(flaggedCategories);
  const message = generateMessage(severity, flaggedCategories);

  return {
    isClean: flaggedCategories.length === 0,
    flaggedCategories,
    severity,
    flaggedWords: [...new Set(allFlaggedWords)], // deduplicate
    message,
  };
}

/**
 * Quick check if content should be blocked (high severity)
 */
export function shouldBlockContent(text: string): boolean {
  const result = moderateContent(text);
  return result.severity === 'high';
}

/**
 * Quick check if content should be flagged for review
 */
export function shouldFlagContent(text: string): boolean {
  const result = moderateContent(text);
  return result.severity === 'medium' || result.severity === 'low';
}

// ─── Smart Filter: Enhanced AI-powered Content Detection ──────────

export interface SmartFilterResult {
  isClean: boolean;
  score: number;               // 0.0–1.0 toxicity score
  riskLevel: 'low' | 'medium' | 'high';
  recommendation: 'allow' | 'warn' | 'block';
  friendlyMessage: string;
  moderationResult: ModerationResult;
  detectedObfuscation: boolean;
  contextualFlags: string[];   // Contextual phrases found
}

// Category weight multipliers for toxicity scoring
const CATEGORY_WEIGHTS: Record<string, number> = {
  hate_speech: 3.0,
  harassment: 2.5,
  explicit: 2.0,
  spam_scam: 1.5,
  profanity: 1.0,
};

/**
 * Detect obfuscation attempts in text
 * Checks for spaced-out letters, mixed special chars, excessive punctuation
 */
function detectObfuscation(text: string): boolean {
  // Pattern 1: Letters separated by dots/dashes/underscores (f.u.c.k or f-u-c-k)
  const dotSpaced = /[a-zA-Z][.\-_][a-zA-Z][.\-_][a-zA-Z]/;
  if (dotSpaced.test(text)) return true;

  // Pattern 2: Asterisks/symbols replacing letters (f*ck, a$$, sh!t)
  const symbolReplacement = /[a-zA-Z][*#%&][a-zA-Z]/;
  if (symbolReplacement.test(text)) return true;

  // Pattern 3: Excessive mixed casing within words (FuCk, sHiT)
  const words = text.split(/\s+/);
  for (const word of words) {
    if (word.length >= 4) {
      let caseChanges = 0;
      for (let i = 1; i < word.length; i++) {
        const prevUpper = word[i - 1] === word[i - 1].toUpperCase() && word[i - 1] !== word[i - 1].toLowerCase();
        const currUpper = word[i] === word[i].toUpperCase() && word[i] !== word[i].toLowerCase();
        if (prevUpper !== currUpper) caseChanges++;
      }
      if (caseChanges >= 3) return true;
    }
  }

  return false;
}

/**
 * Scan for contextual toxic phrases
 */
function scanContextualPhrases(normalizedText: string): { category: string; phrase: string }[] {
  const found: { category: string; phrase: string }[] = [];
  for (const [phrase, category] of Object.entries(CONTEXTUAL_TOXIC_PHRASES)) {
    if (normalizedText.includes(phrase.toLowerCase())) {
      found.push({ category, phrase });
    }
  }
  return found;
}

/**
 * Calculate toxicity score based on flagged content
 * Returns a score between 0.0 (clean) and 1.0 (highly toxic)
 */
function calculateToxicityScore(
  text: string,
  flaggedCategories: string[],
  flaggedWords: string[],
  contextualFlags: { category: string; phrase: string }[],
  hasObfuscation: boolean
): number {
  if (flaggedCategories.length === 0 && contextualFlags.length === 0) return 0;

  const wordCount = Math.max(text.split(/\s+/).length, 1);
  let score = 0;

  // Base score: weighted sum of flagged categories
  for (const category of flaggedCategories) {
    const weight = CATEGORY_WEIGHTS[category] || 1.0;
    const categoryWords = flaggedWords.length;
    // Density: more flagged words in shorter text = higher score
    score += (weight * Math.min(categoryWords, 5)) / (wordCount * 0.5);
  }

  // Add contextual phrase penalties
  for (const flag of contextualFlags) {
    const weight = CATEGORY_WEIGHTS[flag.category] || 1.5;
    score += weight * 0.15;
  }

  // Obfuscation penalty — user is actively trying to bypass filters
  if (hasObfuscation) {
    score += 0.2;
  }

  // All-caps bonus (shouting)
  const allCapsWords = text.split(/\s+/).filter(
    (w) => w.length > 3 && w === w.toUpperCase() && /[A-Z]/.test(w)
  );
  if (allCapsWords.length >= 2) {
    score += allCapsWords.length * 0.05;
  }

  // Clamp to 0.0–1.0
  return Math.min(Math.max(score, 0), 1.0);
}

/**
 * Generate friendly deflection message based on recommendation
 */
function getFriendlyMessage(recommendation: 'allow' | 'warn' | 'block', categories: string[]): string {
  if (recommendation === 'block') {
    const names = categories
      .filter((c) => CATEGORY_SEVERITY[c] === 'high')
      .map((c) => CATEGORY_NAMES[c] || c)
      .join(', ');
    return names
      ? `This content contains ${names} and cannot be posted. Please revise your message to keep our community welcoming for everyone.`
      : 'This content contains language that isn\'t allowed in our community. Please revise and try again.';
  }
  if (recommendation === 'warn') {
    return 'Your message may contain language that could be hurtful to others. Would you like to rephrase it to keep our community welcoming?';
  }
  return '';
}

/**
 * Smart Filter — Enhanced AI-powered content detection
 *
 * Combines keyword matching, contextual phrase detection, obfuscation detection,
 * and toxicity scoring for more accurate content moderation.
 *
 * @param text - The text content to analyze
 * @returns SmartFilterResult with score, recommendation, and friendly messaging
 */
export function smartFilter(text: string): SmartFilterResult {
  if (!text || text.trim().length === 0) {
    return {
      isClean: true,
      score: 0,
      riskLevel: 'low',
      recommendation: 'allow',
      friendlyMessage: '',
      moderationResult: {
        isClean: true,
        flaggedCategories: [],
        severity: 'none',
        flaggedWords: [],
        message: '',
      },
      detectedObfuscation: false,
      contextualFlags: [],
    };
  }

  // Run base moderation
  const moderationResult = moderateContent(text);
  const normalizedText = normalizeText(text);

  // Detect obfuscation
  const hasObfuscation = detectObfuscation(text);

  // Scan contextual phrases
  const contextualFlags = scanContextualPhrases(normalizedText);

  // Merge contextual categories into flagged categories
  const allCategories = [...moderationResult.flaggedCategories];
  const allContextPhrases: string[] = [];
  for (const flag of contextualFlags) {
    if (!allCategories.includes(flag.category)) {
      allCategories.push(flag.category);
    }
    allContextPhrases.push(flag.phrase);
  }

  // Calculate toxicity score
  const score = calculateToxicityScore(
    text,
    allCategories,
    moderationResult.flaggedWords,
    contextualFlags,
    hasObfuscation
  );

  // Determine risk level and recommendation
  let riskLevel: 'low' | 'medium' | 'high';
  let recommendation: 'allow' | 'warn' | 'block';

  if (score > 0.7 || moderationResult.severity === 'high') {
    riskLevel = 'high';
    recommendation = 'block';
  } else if (score > 0.3 || moderationResult.severity === 'medium') {
    riskLevel = 'medium';
    recommendation = 'warn';
  } else {
    riskLevel = 'low';
    recommendation = 'allow';
  }

  // If obfuscation detected with any flagged content, escalate
  if (hasObfuscation && allCategories.length > 0 && recommendation === 'allow') {
    riskLevel = 'medium';
    recommendation = 'warn';
  }

  const friendlyMessage = getFriendlyMessage(recommendation, allCategories);

  return {
    isClean: allCategories.length === 0,
    score,
    riskLevel,
    recommendation,
    friendlyMessage,
    moderationResult,
    detectedObfuscation: hasObfuscation,
    contextualFlags: allContextPhrases,
  };
}
