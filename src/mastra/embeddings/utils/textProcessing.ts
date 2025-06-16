// Text processing utilities for TF-IDF embedding system
import { removeStopwords, eng } from 'stopword';

/**
 * Tokenizes text into individual words/terms
 */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ') // Replace punctuation with spaces
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim()
    .split(' ')
    .filter(word => word.length > 0);
}

/**
 * Removes stop words from a list of tokens
 */
export function removeStopWords(tokens: string[]): string[] {
  return removeStopwords(tokens, eng);
}

/**
 * Applies stemming to reduce words to their root form
 * Simple suffix removal - can be enhanced with more sophisticated stemming
 */
export function stem(word: string): string {
  // Simple stemming rules
  const stemRules = [
    { suffix: 'ing', replacement: '' },
    { suffix: 'ed', replacement: '' },
    { suffix: 'er', replacement: '' },
    { suffix: 'est', replacement: '' },
    { suffix: 'ly', replacement: '' },
    { suffix: 'ion', replacement: '' },
    { suffix: 'tion', replacement: '' },
    { suffix: 'sion', replacement: '' },
    { suffix: 's', replacement: '' }
  ];

  let stemmed = word;
  for (const rule of stemRules) {
    if (stemmed.endsWith(rule.suffix) && stemmed.length > rule.suffix.length + 2) {
      stemmed = stemmed.slice(0, -rule.suffix.length) + rule.replacement;
      break;
    }
  }
  
  return stemmed;
}

/**
 * Preprocesses text for TF-IDF analysis
 */
export function preprocessText(text: string, options: {
  removeStopwords?: boolean;
  applyStemming?: boolean;
  minWordLength?: number;
} = {}): string[] {
  const {
    removeStopwords: shouldRemoveStopwords = true,
    applyStemming = false,
    minWordLength = 2
  } = options;

  // Tokenize
  let tokens = tokenize(text);

  // Remove stop words
  if (shouldRemoveStopwords) {
    tokens = removeStopWords(tokens);
  }

  // Apply stemming
  if (applyStemming) {
    tokens = tokens.map(stem);
  }

  // Filter by minimum length
  tokens = tokens.filter(token => token.length >= minWordLength);

  return tokens;
}

/**
 * Extracts n-grams from a list of tokens
 */
export function extractNGrams(tokens: string[], n: number): string[] {
  if (n > tokens.length) {
    return [];
  }

  const ngrams: string[] = [];
  for (let i = 0; i <= tokens.length - n; i++) {
    const ngram = tokens.slice(i, i + n).join(' ');
    ngrams.push(ngram);
  }

  return ngrams;
}

/**
 * Calculates term frequency for a document
 */
export function calculateTermFrequency(tokens: string[]): Map<string, number> {
  const tf = new Map<string, number>();
  
  for (const token of tokens) {
    tf.set(token, (tf.get(token) || 0) + 1);
  }

  // Normalize by document length
  const docLength = tokens.length;
  for (const [term, freq] of tf.entries()) {
    tf.set(term, freq / docLength);
  }

  return tf;
}

/**
 * Creates a unique document ID from content
 */
export function createDocumentId(content: string, source?: string): string {
  const contentHash = simpleHash(content.substring(0, 100));
  const sourceHash = source ? simpleHash(source) : 'unknown';
  const timestamp = Date.now();
  
  return `tfidf_${sourceHash}_${contentHash}_${timestamp}`;
}

/**
 * Simple hash function for creating IDs
 */
export function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Normalizes text for better comparison
 */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}