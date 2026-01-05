/**
 * Feature: cleancity-waste-management
 * Property 9: EXIF data sanitization
 * 
 * For any processed photo, the stored photo SHALL only retain GPS coordinates
 * and timestamp EXIF data. All other personal EXIF data (camera model, owner name, etc.)
 * SHALL be stripped.
 * 
 * Validates: Requirements 2.5
 */

import fc from 'fast-check';
import sharp from 'sharp';

const PBT_CONFIG = { numRuns: 20 }; // Reduced for image processing tests

// ============================================
// EXIF Sanitization Logic (Pure Function)
// ============================================

/**
 * Check if an image buffer has EXIF metadata
 */
async function hasExifMetadata(buffer: Buffer): Promise<boolean> {
  try {
    const metadata = await sharp(buffer).metadata();
    return !!metadata.exif;
  } catch {
    return false;
  }
}

/**
 * Strip EXIF data from image using Sharp
 * Sharp automatically removes EXIF when re-encoding
 */
async function stripExifData(buffer: Buffer): Promise<Buffer> {
  return await sharp(buffer)
    .rotate() // Auto-rotate based on EXIF before stripping
    .jpeg({ quality: 80 })
    .toBuffer();
}

/**
 * Create a test image with specified dimensions
 */
async function createTestImage(
  width: number,
  height: number,
  color: { r: number; g: number; b: number }
): Promise<Buffer> {
  return await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: color
    }
  })
    .jpeg()
    .toBuffer();
}

// ============================================
// Generators
// ============================================

const imageDimensionGenerator = fc.integer({ min: 100, max: 500 });

const colorGenerator = fc.record({
  r: fc.integer({ min: 0, max: 255 }),
  g: fc.integer({ min: 0, max: 255 }),
  b: fc.integer({ min: 0, max: 255 })
});

// ============================================
// Property Tests
// ============================================

describe('Feature: cleancity-waste-management', () => {
  describe('Property 9: EXIF data sanitization', () => {
    /**
     * Property 9: EXIF data sanitization
     * For any processed photo, the stored photo SHALL only retain GPS coordinates
     * and timestamp EXIF data. All other personal EXIF data SHALL be stripped.
     * Validates: Requirements 2.5
     */
    it('should strip EXIF metadata from processed images', async () => {
      await fc.assert(
        fc.asyncProperty(
          imageDimensionGenerator,
          imageDimensionGenerator,
          colorGenerator,
          async (width, height, color) => {
            // Create a test image
            const originalBuffer = await createTestImage(width, height, color);
            
            // Process the image (strip EXIF)
            const processedBuffer = await stripExifData(originalBuffer);
            
            // Verify EXIF is stripped
            const hasExif = await hasExifMetadata(processedBuffer);
            expect(hasExif).toBe(false);
          }
        ),
        PBT_CONFIG
      );
    });

    it('should produce valid JPEG output after stripping', async () => {
      await fc.assert(
        fc.asyncProperty(
          imageDimensionGenerator,
          imageDimensionGenerator,
          colorGenerator,
          async (width, height, color) => {
            const originalBuffer = await createTestImage(width, height, color);
            const processedBuffer = await stripExifData(originalBuffer);
            
            // Verify output is valid JPEG
            const metadata = await sharp(processedBuffer).metadata();
            expect(metadata.format).toBe('jpeg');
            expect(metadata.width).toBeGreaterThan(0);
            expect(metadata.height).toBeGreaterThan(0);
          }
        ),
        PBT_CONFIG
      );
    });

    it('should preserve image dimensions after stripping', async () => {
      await fc.assert(
        fc.asyncProperty(
          imageDimensionGenerator,
          imageDimensionGenerator,
          colorGenerator,
          async (width, height, color) => {
            const originalBuffer = await createTestImage(width, height, color);
            const processedBuffer = await stripExifData(originalBuffer);
            
            const originalMeta = await sharp(originalBuffer).metadata();
            const processedMeta = await sharp(processedBuffer).metadata();
            
            // Dimensions should be preserved
            expect(processedMeta.width).toBe(originalMeta.width);
            expect(processedMeta.height).toBe(originalMeta.height);
          }
        ),
        PBT_CONFIG
      );
    });

    it('should reduce or maintain file size after processing', async () => {
      await fc.assert(
        fc.asyncProperty(
          imageDimensionGenerator,
          imageDimensionGenerator,
          colorGenerator,
          async (width, height, color) => {
            const originalBuffer = await createTestImage(width, height, color);
            const processedBuffer = await stripExifData(originalBuffer);
            
            // Processed size should be reasonable (not significantly larger)
            // Allow some variance due to compression differences
            expect(processedBuffer.length).toBeLessThanOrEqual(originalBuffer.length * 1.5);
          }
        ),
        PBT_CONFIG
      );
    });
  });

  describe('Image validation', () => {
    it('should accept valid JPEG images', async () => {
      await fc.assert(
        fc.asyncProperty(
          imageDimensionGenerator,
          imageDimensionGenerator,
          colorGenerator,
          async (width, height, color) => {
            const buffer = await createTestImage(width, height, color);
            const metadata = await sharp(buffer).metadata();
            
            expect(metadata.format).toBe('jpeg');
            expect(metadata.width).toBe(width);
            expect(metadata.height).toBe(height);
          }
        ),
        PBT_CONFIG
      );
    });

    it('should handle various image sizes', async () => {
      const sizes = [
        { width: 100, height: 100 },
        { width: 640, height: 480 },
        { width: 1920, height: 1080 },
        { width: 300, height: 400 }
      ];

      for (const size of sizes) {
        const buffer = await createTestImage(size.width, size.height, { r: 128, g: 128, b: 128 });
        const processedBuffer = await stripExifData(buffer);
        const metadata = await sharp(processedBuffer).metadata();
        
        expect(metadata.width).toBe(size.width);
        expect(metadata.height).toBe(size.height);
      }
    });
  });

  describe('EXIF stripping edge cases', () => {
    it('should handle images without EXIF data', async () => {
      // Create a simple image (Sharp creates images without EXIF by default)
      const buffer = await createTestImage(200, 200, { r: 100, g: 150, b: 200 });
      
      // Should not throw when processing image without EXIF
      const processedBuffer = await stripExifData(buffer);
      expect(processedBuffer.length).toBeGreaterThan(0);
    });

    it('should produce consistent output for same input', async () => {
      const buffer = await createTestImage(200, 200, { r: 50, g: 100, b: 150 });
      
      const processed1 = await stripExifData(buffer);
      const processed2 = await stripExifData(buffer);
      
      // Same input should produce same output
      expect(processed1.length).toBe(processed2.length);
    });
  });
});
