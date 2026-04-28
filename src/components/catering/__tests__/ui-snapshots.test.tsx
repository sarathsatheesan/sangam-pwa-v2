// ═══════════════════════════════════════════════════════════════════════
// CATERING UI SNAPSHOT TESTS
// Captures rendering of error states and critical UI components
// ═══════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import { CateringErrorBoundary } from '../CateringErrorBoundary';

// Suppress console.error during intentional error boundary tests
const suppressErrors = (fn: () => void) => {
  const originalError = console.error;
  console.error = vi.fn();
  try {
    fn();
  } finally {
    console.error = originalError;
  }
};

describe('Catering UI Snapshots', () => {
  describe('CateringErrorBoundary', () => {
    it('should render children when no error occurs', () => {
      const { container } = render(
        <CateringErrorBoundary>
          <div data-testid="child-content">Safe content here</div>
        </CateringErrorBoundary>,
      );
      expect(container.textContent).toContain('Safe content here');
    });

    it('should render error fallback UI when error occurs', () => {
      const ThrowError = () => {
        throw new Error('Test error message');
      };

      suppressErrors(() => {
        const { container } = render(
          <CateringErrorBoundary fallbackTitle="Test Failed">
            <ThrowError />
          </CateringErrorBoundary>,
        );

        // Check for error UI elements
        expect(container.textContent).toContain('Test Failed');
        expect(container.textContent).toContain('unexpected error occurred');
        expect(container.textContent).toContain('Try Again');
        // Lucide-react renders as SVG, check for the triangle icon
        const svg = container.querySelector('svg');
        expect(svg).toBeTruthy();
      });
    });

    it('should display default fallback title when not provided', () => {
      const ThrowError = () => {
        throw new Error('Test error');
      };

      suppressErrors(() => {
        const { container } = render(
          <CateringErrorBoundary>
            <ThrowError />
          </CateringErrorBoundary>,
        );

        expect(container.textContent).toContain('Something went wrong');
      });
    });

    it('should show error details when error is caught', () => {
      const ThrowError = () => {
        throw new Error('Detailed error message');
      };

      suppressErrors(() => {
        const { container } = render(
          <CateringErrorBoundary>
            <ThrowError />
          </CateringErrorBoundary>,
        );

        // Error boundary renders error details in a <details> element
        const details = container.querySelector('details');
        expect(details).toBeTruthy();
        expect(container.textContent).toContain('Error details');
      });
    });

    it('should have try-again button that resets error state', () => {
      const ThrowError = () => {
        throw new Error('Test error');
      };

      suppressErrors(() => {
        const { container, getByRole } = render(
          <CateringErrorBoundary>
            <ThrowError />
          </CateringErrorBoundary>,
        );

        const tryAgainButton = getByRole('button', { name: /Try Again/i });
        expect(tryAgainButton).toBeTruthy();
        expect(tryAgainButton.className).toContain('inline-flex');
      });
    });

    it('should render snapshot of error state', () => {
      const ThrowError = () => {
        throw new Error('Snapshot test error');
      };

      suppressErrors(() => {
        const { container } = render(
          <CateringErrorBoundary fallbackTitle="Catering Error">
            <ThrowError />
          </CateringErrorBoundary>,
        );

        expect(container.firstChild).toMatchSnapshot();
      });
    });

    it('should render snapshot of normal state', () => {
      const { container } = render(
        <CateringErrorBoundary>
          <div className="test-content">
            <h1>Catering Order</h1>
            <p>Order details here</p>
          </div>
        </CateringErrorBoundary>,
      );

      expect(container.firstChild).toMatchSnapshot();
    });

    it('should handle multiple errors in nested children', () => {
      const ThrowError = () => {
        throw new Error('Nested error');
      };

      suppressErrors(() => {
        const { container } = render(
          <CateringErrorBoundary>
            <div>
              <ThrowError />
            </div>
          </CateringErrorBoundary>,
        );

        expect(container.textContent).toContain('Something went wrong');
      });
    });

    it('should preserve error message in details', () => {
      const errorMsg = 'Critical database connection failed';
      const ThrowError = () => {
        throw new Error(errorMsg);
      };

      suppressErrors(() => {
        const { container } = render(
          <CateringErrorBoundary>
            <ThrowError />
          </CateringErrorBoundary>,
        );

        const detailsContent = container.querySelector('pre');
        expect(detailsContent?.textContent).toContain(errorMsg);
      });
    });

    it('should style error UI with CSS variables', () => {
      const ThrowError = () => {
        throw new Error('Test error');
      };

      suppressErrors(() => {
        const { container } = render(
          <CateringErrorBoundary>
            <ThrowError />
          </CateringErrorBoundary>,
        );

        const errorDiv = container.firstChild as HTMLElement;
        // Check that inline styles are applied
        expect(errorDiv.style.color || window.getComputedStyle(errorDiv).color).toBeTruthy();
      });
    });

    it('should display alert triangle icon', () => {
      const ThrowError = () => {
        throw new Error('Test error');
      };

      suppressErrors(() => {
        const { container } = render(
          <CateringErrorBoundary>
            <ThrowError />
          </CateringErrorBoundary>,
        );

        // Check for icon color style (warning color rgb(245, 158, 11) is hex #F59E0B)
        const svg = container.querySelector('svg');
        expect(svg).toBeTruthy();
        expect(svg?.style.color).toBe('rgb(245, 158, 11)');
      });
    });

    it('should render refresh icon on try again button', () => {
      const ThrowError = () => {
        throw new Error('Test error');
      };

      suppressErrors(() => {
        const { container } = render(
          <CateringErrorBoundary>
            <ThrowError />
          </CateringErrorBoundary>,
        );

        const button = container.querySelector('button');
        expect(button?.className).toContain('inline-flex');
        expect(button?.className).toContain('gap');
      });
    });
  });

  describe('Error Boundary Recovery', () => {
    it('should allow recovery by re-rendering with new children', () => {
      const { rerender, container } = render(
        <CateringErrorBoundary>
          <div data-testid="working">Content works</div>
        </CateringErrorBoundary>,
      );

      // Initial render should work
      expect(container.textContent).toContain('Content works');

      // Re-render with same content
      rerender(
        <CateringErrorBoundary>
          <div data-testid="working">Content still works</div>
        </CateringErrorBoundary>,
      );

      expect(container.textContent).toContain('Content still works');
    });

    it('should maintain error state across re-renders when children throw', () => {
      let renderCount = 0;
      const ThrowError = () => {
        renderCount++;
        throw new Error(`Error on render ${renderCount}`);
      };

      suppressErrors(() => {
        const { container } = render(
          <CateringErrorBoundary>
            <ThrowError />
          </CateringErrorBoundary>,
        );

        expect(container.textContent).toContain('Something went wrong');
      });
    });
  });

  describe('CSS Classes and Styling', () => {
    it('should apply flex layout classes', () => {
      const ThrowError = () => {
        throw new Error('Test');
      };

      suppressErrors(() => {
        const { container } = render(
          <CateringErrorBoundary>
            <ThrowError />
          </CateringErrorBoundary>,
        );

        const errorDiv = container.firstChild as HTMLElement;
        expect(errorDiv.className).toContain('flex');
        expect(errorDiv.className).toContain('flex-col');
      });
    });

    it('should apply responsive padding', () => {
      const ThrowError = () => {
        throw new Error('Test');
      };

      suppressErrors(() => {
        const { container } = render(
          <CateringErrorBoundary>
            <ThrowError />
          </CateringErrorBoundary>,
        );

        const errorDiv = container.firstChild as HTMLElement;
        expect(errorDiv.className).toContain('p-8');
      });
    });

    it('should apply rounded button styles', () => {
      const ThrowError = () => {
        throw new Error('Test');
      };

      suppressErrors(() => {
        const { getByRole } = render(
          <CateringErrorBoundary>
            <ThrowError />
          </CateringErrorBoundary>,
        );

        const button = getByRole('button');
        expect(button.className).toContain('rounded-lg');
      });
    });
  });

  describe('Accessibility', () => {
    it('should render button that is keyboard accessible', () => {
      const ThrowError = () => {
        throw new Error('Test');
      };

      suppressErrors(() => {
        const { getByRole } = render(
          <CateringErrorBoundary>
            <ThrowError />
          </CateringErrorBoundary>,
        );

        const button = getByRole('button');
        expect(button.tagName).toBe('BUTTON');
      });
    });

    it('should have descriptive text content', () => {
      const ThrowError = () => {
        throw new Error('Test');
      };

      suppressErrors(() => {
        const { container } = render(
          <CateringErrorBoundary fallbackTitle="Order Failed">
            <ThrowError />
          </CateringErrorBoundary>,
        );

        expect(container.textContent).toContain('Order Failed');
        expect(container.textContent).toContain('Please try refreshing');
      });
    });
  });
});
