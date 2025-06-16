// Mathematical utility functions for embedding calculations

/**
 * Calculates cosine similarity between two vectors
 */
export function cosineSimilarity(vectorA: number[], vectorB: number[]): number {
  if (vectorA.length !== vectorB.length) {
    throw new Error('Vectors must have the same length');
  }

  if (vectorA.length === 0) {
    return 0;
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vectorA.length; i++) {
    dotProduct += vectorA[i] * vectorB[i];
    normA += vectorA[i] * vectorA[i];
    normB += vectorB[i] * vectorB[i];
  }

  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  
  return magnitude === 0 ? 0 : dotProduct / magnitude;
}

/**
 * Calculates Euclidean distance between two vectors
 */
export function euclideanDistance(vectorA: number[], vectorB: number[]): number {
  if (vectorA.length !== vectorB.length) {
    throw new Error('Vectors must have the same length');
  }

  let sum = 0;
  for (let i = 0; i < vectorA.length; i++) {
    const diff = vectorA[i] - vectorB[i];
    sum += diff * diff;
  }

  return Math.sqrt(sum);
}

/**
 * Normalizes a vector to unit length (L2 normalization)
 */
export function normalizeVector(vector: number[]): number[] {
  const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
  
  if (magnitude === 0) {
    return vector.slice(); // Return copy of zero vector
  }

  return vector.map(val => val / magnitude);
}

/**
 * Calculates the magnitude (length) of a vector
 */
export function vectorMagnitude(vector: number[]): number {
  return Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
}

/**
 * Adds two vectors element-wise
 */
export function addVectors(vectorA: number[], vectorB: number[]): number[] {
  if (vectorA.length !== vectorB.length) {
    throw new Error('Vectors must have the same length');
  }

  return vectorA.map((val, i) => val + vectorB[i]);
}

/**
 * Subtracts vectorB from vectorA element-wise
 */
export function subtractVectors(vectorA: number[], vectorB: number[]): number[] {
  if (vectorA.length !== vectorB.length) {
    throw new Error('Vectors must have the same length');
  }

  return vectorA.map((val, i) => val - vectorB[i]);
}

/**
 * Multiplies a vector by a scalar
 */
export function scalarMultiply(vector: number[], scalar: number): number[] {
  return vector.map(val => val * scalar);
}

/**
 * Calculates dot product of two vectors
 */
export function dotProduct(vectorA: number[], vectorB: number[]): number {
  if (vectorA.length !== vectorB.length) {
    throw new Error('Vectors must have the same length');
  }

  return vectorA.reduce((sum, val, i) => sum + val * vectorB[i], 0);
}

/**
 * Creates a zero vector of specified dimensions
 */
export function createZeroVector(dimensions: number): number[] {
  return new Array(dimensions).fill(0);
}

/**
 * Creates a random vector with values between 0 and 1
 */
export function createRandomVector(dimensions: number): number[] {
  return new Array(dimensions).fill(0).map(() => Math.random());
}

/**
 * Calculates TF-IDF score
 */
export function calculateTfIdf(
  termFrequency: number,
  documentFrequency: number,
  totalDocuments: number
): number {
  if (documentFrequency === 0 || totalDocuments === 0) {
    return 0;
  }

  const idf = Math.log(totalDocuments / documentFrequency);
  return termFrequency * idf;
}

/**
 * Calculates inverse document frequency
 */
export function calculateIdf(documentFrequency: number, totalDocuments: number): number {
  if (documentFrequency === 0 || totalDocuments === 0) {
    return 0;
  }

  return Math.log(totalDocuments / documentFrequency);
}

/**
 * Performs weighted average of multiple vectors
 */
export function weightedAverage(vectors: number[][], weights: number[]): number[] {
  if (vectors.length !== weights.length) {
    throw new Error('Number of vectors must match number of weights');
  }

  if (vectors.length === 0) {
    return [];
  }

  const dimensions = vectors[0].length;
  const result = createZeroVector(dimensions);

  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  
  if (totalWeight === 0) {
    return result;
  }

  for (let i = 0; i < vectors.length; i++) {
    const vector = vectors[i];
    const weight = weights[i] / totalWeight;
    
    for (let j = 0; j < dimensions; j++) {
      result[j] += vector[j] * weight;
    }
  }

  return result;
}

/**
 * Finds the index of the maximum value in an array
 */
export function argMax(array: number[]): number {
  if (array.length === 0) {
    return -1;
  }

  let maxIndex = 0;
  let maxValue = array[0];

  for (let i = 1; i < array.length; i++) {
    if (array[i] > maxValue) {
      maxValue = array[i];
      maxIndex = i;
    }
  }

  return maxIndex;
}

/**
 * Calculates Jaccard similarity between two sets represented as arrays
 */
export function jaccardSimilarity(setA: string[], setB: string[]): number {
  const uniqueA = new Set(setA);
  const uniqueB = new Set(setB);
  
  const intersection = new Set([...uniqueA].filter(x => uniqueB.has(x)));
  const union = new Set([...uniqueA, ...uniqueB]);
  
  return union.size === 0 ? 0 : intersection.size / union.size;
}