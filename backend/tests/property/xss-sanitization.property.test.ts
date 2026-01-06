/**
 * Property Tests for XSS Sanitization
 * Feature: cleancity-waste-management
 * Property 36: XSS sanitization
 * Validates: Requirements 15.5
 * 
 * For any user input containing potential XSS patterns (script tags, event handlers,
 * javascript: URLs), the sanitized output SHALL NOT contain executable JavaScript.
 */

import * as fc from 'fast-check';
import {
  sanitizeString,
  containsXss,
  detectXssPatterns,
  sanitizeObject,
  validateNoExecutableJs,
  getSanitizationResult,
  encodeHtmlEntities,
} from '../../src/middleware/xssSanitizer';

describe('Feature: cleancity-waste-management', () => {
  describe('Property 36: XSS sanitization', () => {
    // ============================================
    // Script Tag Removal Tests
    // ============================================
    describe('Script tag removal', () => {
      it('should remove simple script tags', () => {
        fc.assert(
          fc.property(
            fc.string({ minLength: 0, maxLength: 100 }),
            (content) => {
              const input = `<script>${content}</script>`;
              const sanitized = sanitizeString(input);
              
              // Should not contain script tags
              expect(sanitized.toLowerCase()).not.toContain('<script');
              expect(sanitized.toLowerCase()).not.toContain('</script>');
              expect(validateNoExecutableJs(sanitized)).toBe(true);
            }
          ),
          { numRuns: 100 }
        );
      });

      it('should remove script tags with attributes', () => {
        fc.assert(
          fc.property(
            fc.constantFrom('type="text/javascript"', 'src="evil.js"', 'async', 'defer'),
            fc.string({ minLength: 0, maxLength: 50 }),
            (attr, content) => {
              const input = `<script ${attr}>${content}</script>`;
              const sanitized = sanitizeString(input);
              
              expect(sanitized.toLowerCase()).not.toContain('<script');
              expect(validateNoExecutableJs(sanitized)).toBe(true);
            }
          ),
          { numRuns: 100 }
        );
      });

      it('should remove nested script tags', () => {
        const input = '<script><script>alert(1)</script></script>';
        const sanitized = sanitizeString(input);
        
        expect(sanitized.toLowerCase()).not.toContain('<script');
        expect(validateNoExecutableJs(sanitized)).toBe(true);
      });

      it('should handle case variations of script tags', () => {
        const variations = [
          '<SCRIPT>alert(1)</SCRIPT>',
          '<ScRiPt>alert(1)</ScRiPt>',
          '<script >alert(1)</script >',
          '< script>alert(1)</ script>',
        ];

        for (const input of variations) {
          const sanitized = sanitizeString(input);
          expect(sanitized.toLowerCase()).not.toContain('<script');
        }
      });
    });

    // ============================================
    // Event Handler Removal Tests
    // ============================================
    describe('Event handler removal', () => {
      it('should remove onclick handlers', () => {
        fc.assert(
          fc.property(
            fc.string({ minLength: 1, maxLength: 50 }),
            (jsCode) => {
              const input = `<div onclick="${jsCode}">Click me</div>`;
              const sanitized = sanitizeString(input);
              
              expect(sanitized.toLowerCase()).not.toMatch(/onclick\s*=/);
              expect(validateNoExecutableJs(sanitized)).toBe(true);
            }
          ),
          { numRuns: 100 }
        );
      });

      it('should remove all common event handlers', () => {
        const eventHandlers = [
          'onclick', 'onerror', 'onload', 'onmouseover', 'onmouseout',
          'onfocus', 'onblur', 'onsubmit', 'onchange', 'onkeydown',
          'onkeyup', 'onkeypress', 'ondblclick', 'oncontextmenu',
        ];

        fc.assert(
          fc.property(
            fc.constantFrom(...eventHandlers),
            fc.string({ minLength: 1, maxLength: 30 }),
            (handler, jsCode) => {
              const input = `<img ${handler}="${jsCode}" src="x">`;
              const sanitized = sanitizeString(input);
              
              const handlerPattern = new RegExp(`${handler}\\s*=`, 'i');
              expect(sanitized).not.toMatch(handlerPattern);
            }
          ),
          { numRuns: 100 }
        );
      });

      it('should remove event handlers with single quotes', () => {
        const input = "<div onclick='alert(1)'>test</div>";
        const sanitized = sanitizeString(input);
        
        expect(sanitized.toLowerCase()).not.toMatch(/onclick\s*=/);
        expect(validateNoExecutableJs(sanitized)).toBe(true);
      });

      it('should remove event handlers without quotes', () => {
        const input = '<div onclick=alert(1)>test</div>';
        const sanitized = sanitizeString(input);
        
        expect(sanitized.toLowerCase()).not.toMatch(/onclick\s*=/);
      });
    });

    // ============================================
    // JavaScript URL Removal Tests
    // ============================================
    describe('JavaScript URL removal', () => {
      it('should remove javascript: URLs', () => {
        fc.assert(
          fc.property(
            fc.string({ minLength: 1, maxLength: 50 }),
            (jsCode) => {
              const input = `<a href="javascript:${jsCode}">Click</a>`;
              const sanitized = sanitizeString(input);
              
              expect(sanitized.toLowerCase()).not.toContain('javascript:');
              expect(validateNoExecutableJs(sanitized)).toBe(true);
            }
          ),
          { numRuns: 100 }
        );
      });

      it('should remove javascript: URLs with spaces', () => {
        const variations = [
          'javascript:alert(1)',
          'javascript :alert(1)',
          'javascript: alert(1)',
          'javascript : alert(1)',
          'JAVASCRIPT:alert(1)',
        ];

        for (const url of variations) {
          const input = `<a href="${url}">Click</a>`;
          const sanitized = sanitizeString(input);
          
          expect(sanitized.toLowerCase()).not.toContain('javascript:');
        }
      });

      it('should remove vbscript: URLs', () => {
        const input = '<a href="vbscript:msgbox(1)">Click</a>';
        const sanitized = sanitizeString(input);
        
        expect(sanitized.toLowerCase()).not.toContain('vbscript:');
      });
    });


    // ============================================
    // Iframe and Object Tag Removal Tests
    // ============================================
    describe('Iframe and object tag removal', () => {
      it('should remove iframe tags', () => {
        fc.assert(
          fc.property(
            fc.webUrl(),
            (url) => {
              const input = `<iframe src="${url}"></iframe>`;
              const sanitized = sanitizeString(input);
              
              expect(sanitized.toLowerCase()).not.toContain('<iframe');
            }
          ),
          { numRuns: 100 }
        );
      });

      it('should remove object tags', () => {
        const input = '<object data="evil.swf" type="application/x-shockwave-flash"></object>';
        const sanitized = sanitizeString(input);
        
        expect(sanitized.toLowerCase()).not.toContain('<object');
      });

      it('should remove embed tags', () => {
        const input = '<embed src="evil.swf" type="application/x-shockwave-flash">';
        const sanitized = sanitizeString(input);
        
        expect(sanitized.toLowerCase()).not.toContain('<embed');
      });
    });

    // ============================================
    // CSS Expression Removal Tests
    // ============================================
    describe('CSS expression removal', () => {
      it('should remove CSS expressions', () => {
        const input = '<div style="width: expression(alert(1))">test</div>';
        const sanitized = sanitizeString(input);
        
        expect(sanitized.toLowerCase()).not.toContain('expression(');
      });
    });

    // ============================================
    // Object Sanitization Tests
    // ============================================
    describe('Object sanitization', () => {
      it('should sanitize nested objects', () => {
        fc.assert(
          fc.property(
            fc.string({ minLength: 1, maxLength: 30 }),
            (text) => {
              const input = {
                name: `<script>${text}</script>`,
                nested: {
                  value: `<img onerror="alert(1)" src="x">`,
                  deep: {
                    content: `javascript:${text}`,
                  },
                },
              };

              const sanitized = sanitizeObject(input);

              expect(sanitized.name.toLowerCase()).not.toContain('<script');
              expect(sanitized.nested.value.toLowerCase()).not.toMatch(/onerror\s*=/);
              expect(sanitized.nested.deep.content.toLowerCase()).not.toContain('javascript:');
            }
          ),
          { numRuns: 100 }
        );
      });

      it('should sanitize arrays', () => {
        const input = [
          '<script>alert(1)</script>',
          '<img onerror="alert(2)">',
          'javascript:alert(3)',
        ];

        const sanitized = sanitizeObject(input);

        expect(sanitized[0].toLowerCase()).not.toContain('<script');
        expect(sanitized[1].toLowerCase()).not.toMatch(/onerror\s*=/);
        expect(sanitized[2].toLowerCase()).not.toContain('javascript:');
      });

      it('should preserve non-string values', () => {
        const input = {
          number: 42,
          boolean: true,
          nullValue: null,
          undefinedValue: undefined,
          array: [1, 2, 3],
        };

        const sanitized = sanitizeObject(input);

        expect(sanitized.number).toBe(42);
        expect(sanitized.boolean).toBe(true);
        expect(sanitized.nullValue).toBeNull();
        expect(sanitized.undefinedValue).toBeUndefined();
        expect(sanitized.array).toEqual([1, 2, 3]);
      });
    });

    // ============================================
    // Detection Tests
    // ============================================
    describe('XSS detection', () => {
      it('should detect XSS patterns', () => {
        const maliciousInputs = [
          '<script>alert(1)</script>',
          '<img onerror="alert(1)">',
          'javascript:alert(1)',
          '<iframe src="evil.com"></iframe>',
        ];

        for (const input of maliciousInputs) {
          expect(containsXss(input)).toBe(true);
        }
      });

      it('should not flag clean inputs', () => {
        fc.assert(
          fc.property(
            fc.string({ minLength: 0, maxLength: 100 }).filter(
              (s) => !s.includes('<') && !s.includes('>') && !s.includes('javascript')
            ),
            (cleanInput) => {
              expect(containsXss(cleanInput)).toBe(false);
            }
          ),
          { numRuns: 100 }
        );
      });

      it('should identify specific XSS patterns', () => {
        const input = '<script>alert(1)</script><img onerror="x">';
        const patterns = detectXssPatterns(input);
        
        expect(patterns.length).toBeGreaterThan(0);
        expect(patterns).toContain('scriptTags');
      });
    });

    // ============================================
    // Sanitization Result Tests
    // ============================================
    describe('Sanitization result metadata', () => {
      it('should provide accurate sanitization metadata', () => {
        fc.assert(
          fc.property(
            fc.constantFrom(
              '<script>alert(1)</script>',
              '<img onerror="alert(1)">',
              'javascript:alert(1)',
              'Hello World',
              'Normal text without XSS'
            ),
            (input) => {
              const result = getSanitizationResult(input);
              
              expect(result.original).toBe(input);
              expect(typeof result.sanitized).toBe('string');
              expect(typeof result.wasModified).toBe('boolean');
              expect(Array.isArray(result.detectedPatterns)).toBe(true);
              expect(typeof result.isClean).toBe('boolean');
              
              // If patterns were detected, input should have been modified
              if (result.detectedPatterns.length > 0) {
                expect(result.wasModified).toBe(true);
              }
              
              // Sanitized output should always be clean
              expect(result.isClean).toBe(true);
            }
          ),
          { numRuns: 100 }
        );
      });
    });

    // ============================================
    // HTML Entity Encoding Tests
    // ============================================
    describe('HTML entity encoding', () => {
      it('should encode special HTML characters', () => {
        const input = '<script>alert("test")</script>';
        const encoded = encodeHtmlEntities(input);
        
        expect(encoded).not.toContain('<');
        expect(encoded).not.toContain('>');
        expect(encoded).toContain('&lt;');
        expect(encoded).toContain('&gt;');
      });

      it('should encode all dangerous characters', () => {
        const dangerousChars = ['&', '<', '>', '"', "'", '/', '`', '='];
        
        for (const char of dangerousChars) {
          const encoded = encodeHtmlEntities(char);
          expect(encoded).not.toBe(char);
          expect(encoded.startsWith('&')).toBe(true);
        }
      });
    });

    // ============================================
    // Edge Cases
    // ============================================
    describe('Edge cases', () => {
      it('should handle empty strings', () => {
        expect(sanitizeString('')).toBe('');
        expect(containsXss('')).toBe(false);
      });

      it('should handle null and undefined', () => {
        expect(sanitizeObject(null)).toBeNull();
        expect(sanitizeObject(undefined)).toBeUndefined();
      });

      it('should handle very long strings', () => {
        const longScript = '<script>' + 'a'.repeat(10000) + '</script>';
        const sanitized = sanitizeString(longScript);
        
        expect(sanitized.toLowerCase()).not.toContain('<script');
      });

      it('should handle unicode characters', () => {
        const input = '<script>alert("こんにちは")</script>';
        const sanitized = sanitizeString(input);
        
        expect(sanitized.toLowerCase()).not.toContain('<script');
      });

      it('should handle mixed content', () => {
        const input = 'Hello <script>alert(1)</script> World <img onerror="x"> End';
        const sanitized = sanitizeString(input);
        
        expect(sanitized).toContain('Hello');
        expect(sanitized).toContain('World');
        expect(sanitized).toContain('End');
        expect(sanitized.toLowerCase()).not.toContain('<script');
        expect(sanitized.toLowerCase()).not.toMatch(/onerror\s*=/);
      });
    });

    // ============================================
    // Property: Sanitized output never contains executable JS
    // ============================================
    describe('Universal property: No executable JavaScript in output', () => {
      it('should never produce output with executable JavaScript', () => {
        // Generate various XSS attack vectors
        const xssVectors = fc.oneof(
          // Script tags
          fc.string().map((s) => `<script>${s}</script>`),
          // Event handlers
          fc.string().map((s) => `<img onerror="${s}" src="x">`),
          fc.string().map((s) => `<div onclick="${s}">test</div>`),
          // JavaScript URLs
          fc.string().map((s) => `javascript:${s}`),
          // Iframes
          fc.webUrl().map((url) => `<iframe src="${url}"></iframe>`),
          // Mixed content
          fc.string().map((s) => `Hello <script>${s}</script> World`),
          // Nested attacks
          fc.string().map((s) => `<script><script>${s}</script></script>`),
        );

        fc.assert(
          fc.property(xssVectors, (input) => {
            const sanitized = sanitizeString(input);
            
            // The sanitized output should never contain executable JavaScript
            return validateNoExecutableJs(sanitized);
          }),
          { numRuns: 100 }
        );
      });
    });
  });
});
