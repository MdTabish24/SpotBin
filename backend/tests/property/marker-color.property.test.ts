import * as fc from 'fast-check';

/**
 * Feature: cleancity-waste-management
 * Property 26: Marker color coding
 * Validates: Requirements 9.2
 * 
 * For any map marker displayed, the color SHALL match the report status:
 * - Red for "open"
 * - Yellow for "in_progress" or "assigned"
 * - Green for "resolved" or "verified"
 */

// Status types
type ReportStatus = 'open' | 'assigned' | 'in_progress' | 'verified' | 'resolved';

// Color types
type MarkerColor = 'red' | 'yellow' | 'green';

// Status to color mapping (as defined in requirements 9.2)
const STATUS_COLOR_MAP: Record<ReportStatus, MarkerColor> = {
  open: 'red',
  assigned: 'yellow',
  in_progress: 'yellow',
  verified: 'green',
  resolved: 'green',
};

// Function to get marker color from status
function getMarkerColor(status: ReportStatus): MarkerColor {
  return STATUS_COLOR_MAP[status];
}

// Validate that a color is valid
function isValidMarkerColor(color: string): color is MarkerColor {
  return ['red', 'yellow', 'green'].includes(color);
}

// Validate status-color mapping
function validateStatusColorMapping(status: ReportStatus, expectedColor: MarkerColor): boolean {
  const actualColor = getMarkerColor(status);
  return actualColor === expectedColor;
}

// Generator for report status
const reportStatusArb = fc.constantFrom<ReportStatus>(
  'open',
  'assigned',
  'in_progress',
  'verified',
  'resolved'
);

// Generator for marker color
const markerColorArb = fc.constantFrom<MarkerColor>('red', 'yellow', 'green');

describe('Feature: cleancity-waste-management', () => {
  describe('Property 26: Marker color coding', () => {
    describe('Status to color mapping', () => {
      it('should return red for open status', () => {
        expect(getMarkerColor('open')).toBe('red');
      });

      it('should return yellow for assigned status', () => {
        expect(getMarkerColor('assigned')).toBe('yellow');
      });

      it('should return yellow for in_progress status', () => {
        expect(getMarkerColor('in_progress')).toBe('yellow');
      });

      it('should return green for verified status', () => {
        expect(getMarkerColor('verified')).toBe('green');
      });

      it('should return green for resolved status', () => {
        expect(getMarkerColor('resolved')).toBe('green');
      });
    });

    describe('Property: All statuses map to valid colors', () => {
      it('should always return a valid marker color for any status', () => {
        fc.assert(
          fc.property(reportStatusArb, (status) => {
            const color = getMarkerColor(status);
            return isValidMarkerColor(color);
          }),
          { numRuns: 100 }
        );
      });
    });

    describe('Property: Color mapping is deterministic', () => {
      it('should return the same color for the same status every time', () => {
        fc.assert(
          fc.property(reportStatusArb, (status) => {
            const color1 = getMarkerColor(status);
            const color2 = getMarkerColor(status);
            return color1 === color2;
          }),
          { numRuns: 100 }
        );
      });
    });

    describe('Property: Red indicates open/pending reports', () => {
      it('should only use red for open status', () => {
        fc.assert(
          fc.property(reportStatusArb, (status) => {
            const color = getMarkerColor(status);
            if (color === 'red') {
              return status === 'open';
            }
            return true;
          }),
          { numRuns: 100 }
        );
      });
    });

    describe('Property: Yellow indicates work in progress', () => {
      it('should use yellow for assigned and in_progress statuses', () => {
        fc.assert(
          fc.property(reportStatusArb, (status) => {
            const color = getMarkerColor(status);
            if (color === 'yellow') {
              return status === 'assigned' || status === 'in_progress';
            }
            return true;
          }),
          { numRuns: 100 }
        );
      });
    });

    describe('Property: Green indicates completion', () => {
      it('should use green for verified and resolved statuses', () => {
        fc.assert(
          fc.property(reportStatusArb, (status) => {
            const color = getMarkerColor(status);
            if (color === 'green') {
              return status === 'verified' || status === 'resolved';
            }
            return true;
          }),
          { numRuns: 100 }
        );
      });
    });

    describe('Property: Status progression reflects color progression', () => {
      it('should follow logical color progression (red -> yellow -> green)', () => {
        // Define status progression order
        const statusOrder: ReportStatus[] = ['open', 'assigned', 'in_progress', 'verified', 'resolved'];
        const colorOrder: MarkerColor[] = ['red', 'yellow', 'green'];

        const getColorIndex = (color: MarkerColor): number => colorOrder.indexOf(color);

        // For any two consecutive statuses, the color should either stay same or progress
        for (let i = 0; i < statusOrder.length - 1; i++) {
          const currentStatus = statusOrder[i];
          const nextStatus = statusOrder[i + 1];
          const currentColor = getMarkerColor(currentStatus);
          const nextColor = getMarkerColor(nextStatus);
          
          const currentColorIndex = getColorIndex(currentColor);
          const nextColorIndex = getColorIndex(nextColor);
          
          // Color should either stay same or increase (progress)
          expect(nextColorIndex).toBeGreaterThanOrEqual(currentColorIndex);
        }
      });
    });

    describe('Property: All colors are used', () => {
      it('should use all three colors across all statuses', () => {
        const allStatuses: ReportStatus[] = ['open', 'assigned', 'in_progress', 'verified', 'resolved'];
        const usedColors = new Set(allStatuses.map(getMarkerColor));
        
        expect(usedColors.has('red')).toBe(true);
        expect(usedColors.has('yellow')).toBe(true);
        expect(usedColors.has('green')).toBe(true);
        expect(usedColors.size).toBe(3);
      });
    });

    describe('Property: Color distribution is balanced', () => {
      it('should have reasonable distribution of colors', () => {
        const allStatuses: ReportStatus[] = ['open', 'assigned', 'in_progress', 'verified', 'resolved'];
        const colorCounts: Record<MarkerColor, number> = { red: 0, yellow: 0, green: 0 };
        
        allStatuses.forEach(status => {
          const color = getMarkerColor(status);
          colorCounts[color]++;
        });
        
        // Red: 1 status (open)
        expect(colorCounts.red).toBe(1);
        // Yellow: 2 statuses (assigned, in_progress)
        expect(colorCounts.yellow).toBe(2);
        // Green: 2 statuses (verified, resolved)
        expect(colorCounts.green).toBe(2);
      });
    });

    describe('Edge cases', () => {
      it('should handle all valid status values', () => {
        const validStatuses: ReportStatus[] = ['open', 'assigned', 'in_progress', 'verified', 'resolved'];
        
        validStatuses.forEach(status => {
          expect(() => getMarkerColor(status)).not.toThrow();
          expect(isValidMarkerColor(getMarkerColor(status))).toBe(true);
        });
      });
    });

    describe('Consistency with UI requirements', () => {
      it('should match the documented color scheme', () => {
        // As per Requirements 9.2:
        // Red (Open), Yellow (In Progress), Green (Resolved)
        
        // Open reports should be red (urgent attention needed)
        expect(getMarkerColor('open')).toBe('red');
        
        // Work in progress should be yellow (being handled)
        expect(getMarkerColor('assigned')).toBe('yellow');
        expect(getMarkerColor('in_progress')).toBe('yellow');
        
        // Completed reports should be green (done)
        expect(getMarkerColor('verified')).toBe('green');
        expect(getMarkerColor('resolved')).toBe('green');
      });
    });
  });
});
