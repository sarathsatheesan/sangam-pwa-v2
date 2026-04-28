/**
 * Lightweight performance metrics collection.
 * Tracks Firestore query latency and component render time.
 * Usage:
 *   const result = await measureAsync('fetchOrders', () => fetchOrdersByCustomer(id));
 *   recordMetric('renderOrderCard', Date.now() - startTime);
 *   console.log(getAverageDuration('fetchOrders')); // avg latency in ms
 */

interface PerfEntry {
  name: string;
  duration: number;
  timestamp: number;
  metadata?: Record<string, any>;
}

const metrics: PerfEntry[] = [];
const MAX_METRICS = 500;

/**
 * Measure the duration of an async operation.
 */
export async function measureAsync<T>(
  name: string,
  fn: () => Promise<T>,
  metadata?: Record<string, any>,
): Promise<T> {
  const start = performance.now();
  try {
    const result = await fn();
    recordMetric(name, performance.now() - start, metadata);
    return result;
  } catch (err) {
    recordMetric(`${name}_error`, performance.now() - start, metadata);
    throw err;
  }
}

/**
 * Record a performance metric.
 */
export function recordMetric(
  name: string,
  duration: number,
  metadata?: Record<string, any>,
): void {
  metrics.push({ name, duration, timestamp: Date.now(), metadata });
  if (metrics.length > MAX_METRICS) metrics.shift();

  // Use Performance API if available
  if (typeof performance !== 'undefined' && performance.mark) {
    try {
      performance.mark(`${name}-end`);
    } catch {
      // PerformanceObserver not supported or quota exceeded
    }
  }
}

/**
 * Get all recorded metrics.
 */
export function getMetrics(): PerfEntry[] {
  return [...metrics];
}

/**
 * Get average duration for a specific metric.
 */
export function getAverageDuration(name: string): number {
  const matching = metrics.filter((m) => m.name === name);
  if (matching.length === 0) return 0;
  return matching.reduce((sum, m) => sum + m.duration, 0) / matching.length;
}

/**
 * Initialize web-vitals collection (call once at app startup).
 * Observes Core Web Vitals: LCP, FID, CLS.
 */
export function initWebVitals(): void {
  if (typeof window === 'undefined') return;

  // Use PerformanceObserver for Core Web Vitals
  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        recordMetric(`web-vital:${entry.entryType}`, entry.duration || 0, {
          name: entry.name,
          startTime: entry.startTime,
        });
      }
    });
    observer.observe({
      entryTypes: ['largest-contentful-paint', 'first-input', 'layout-shift'],
    });
  } catch {
    // PerformanceObserver not supported
  }
}
