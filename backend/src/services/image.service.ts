/**
 * Image Service - EXIF processing and S3 upload
 * Requirements: 2.5
 */

import sharp from 'sharp';
import { logger } from '../config/logger';
import { uploadFile, generateFileKey, isS3Configured } from '../config/s3';
import { saveFileLocally } from '../config/localStorage';

// ============================================
// EXIF Data Types
// ============================================

export interface ExifData {
  gps?: {
    latitude?: number;
    longitude?: number;
    altitude?: number;
  };
  timestamp?: Date;
  // Personal data that should be stripped
  make?: string;
  model?: string;
  software?: string;
  artist?: string;
  copyright?: string;
}

export interface ProcessedImage {
  buffer: Buffer;
  width: number;
  height: number;
  format: string;
  size: number;
  exif?: ExifData;
}

// ============================================
// Image Service Interface
// ============================================

export interface IImageService {
  processAndUploadImage(imageBuffer: Buffer): Promise<string>;
  stripExifData(imageBuffer: Buffer): Promise<Buffer>;
  extractSafeExif(imageBuffer: Buffer): Promise<ExifData | null>;
  resizeImage(imageBuffer: Buffer, maxWidth: number, maxHeight: number): Promise<Buffer>;
  validateImage(imageBuffer: Buffer): Promise<{ valid: boolean; error?: string }>;
}

// ============================================
// Image Service Implementation
// ============================================

class ImageService implements IImageService {
  private readonly MAX_WIDTH = 1920;
  private readonly MAX_HEIGHT = 1920;
  private readonly QUALITY = 80;
  private readonly MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

  /**
   * Process image (strip EXIF, resize) and upload to S3
   * Requirements: 2.5
   */
  async processAndUploadImage(imageBuffer: Buffer): Promise<string> {
    // Validate image
    const validation = await this.validateImage(imageBuffer);
    if (!validation.valid) {
      throw new Error(validation.error || 'Invalid image');
    }

    // Strip EXIF data (keeping only GPS and timestamp conceptually)
    // In practice, we strip ALL EXIF for privacy and re-add GPS from request
    const strippedBuffer = await this.stripExifData(imageBuffer);

    // Resize if needed
    const resizedBuffer = await this.resizeImage(
      strippedBuffer,
      this.MAX_WIDTH,
      this.MAX_HEIGHT
    );

    // Upload to S3 or save locally
    if (isS3Configured()) {
      const key = generateFileKey('reports', 'jpg');
      const url = await uploadFile(resizedBuffer, key, 'image/jpeg');
      logger.info({ key, size: resizedBuffer.length }, 'Image uploaded to S3');
      return url;
    } else {
      // For development without S3, save locally
      logger.info('S3 not configured, saving image locally');
      const url = await saveFileLocally(resizedBuffer, 'reports', 'jpg');
      logger.info({ url, size: resizedBuffer.length }, 'Image saved locally');
      return url;
    }
  }

  /**
   * Strip all EXIF data from image for privacy
   * Requirements: 2.5 - Strip personal EXIF data except GPS and timestamp
   * 
   * Note: Sharp removes ALL metadata by default when processing.
   * GPS coordinates are captured separately from the device and stored in DB.
   */
  async stripExifData(imageBuffer: Buffer): Promise<Buffer> {
    try {
      // Sharp automatically strips EXIF when outputting
      // We explicitly ensure no metadata is kept
      const processedBuffer = await sharp(imageBuffer)
        .rotate() // Auto-rotate based on EXIF orientation before stripping
        .jpeg({
          quality: this.QUALITY,
          mozjpeg: true // Better compression
        })
        .toBuffer();

      logger.debug(
        { originalSize: imageBuffer.length, processedSize: processedBuffer.length },
        'EXIF data stripped from image'
      );

      return processedBuffer;
    } catch (error) {
      logger.error({ error }, 'Failed to strip EXIF data');
      throw new Error('Failed to process image');
    }
  }

  /**
   * Extract safe EXIF data (GPS and timestamp only)
   * This is for logging/debugging purposes
   */
  async extractSafeExif(imageBuffer: Buffer): Promise<ExifData | null> {
    try {
      const metadata = await sharp(imageBuffer).metadata();
      
      if (!metadata.exif) {
        return null;
      }

      // Sharp doesn't parse EXIF directly, but we can check if it exists
      // For full EXIF parsing, you'd need a library like exif-parser
      // For now, we just acknowledge EXIF exists
      return {
        // GPS and timestamp would be extracted here if using exif-parser
        // For this implementation, GPS comes from the device request
      };
    } catch (error) {
      logger.debug({ error }, 'Could not extract EXIF data');
      return null;
    }
  }

  /**
   * Resize image to fit within max dimensions while maintaining aspect ratio
   */
  async resizeImage(
    imageBuffer: Buffer,
    maxWidth: number,
    maxHeight: number
  ): Promise<Buffer> {
    try {
      const metadata = await sharp(imageBuffer).metadata();
      
      // Only resize if image is larger than max dimensions
      if (
        metadata.width &&
        metadata.height &&
        (metadata.width > maxWidth || metadata.height > maxHeight)
      ) {
        return await sharp(imageBuffer)
          .resize(maxWidth, maxHeight, {
            fit: 'inside',
            withoutEnlargement: true
          })
          .jpeg({ quality: this.QUALITY })
          .toBuffer();
      }

      return imageBuffer;
    } catch (error) {
      logger.error({ error }, 'Failed to resize image');
      throw new Error('Failed to resize image');
    }
  }

  /**
   * Validate image format and size
   */
  async validateImage(
    imageBuffer: Buffer
  ): Promise<{ valid: boolean; error?: string }> {
    try {
      // Check size
      if (imageBuffer.length > this.MAX_SIZE_BYTES) {
        return {
          valid: false,
          error: `Image size exceeds ${this.MAX_SIZE_BYTES / (1024 * 1024)}MB limit`
        };
      }

      // Check format using Sharp
      const metadata = await sharp(imageBuffer).metadata();

      if (!metadata.format) {
        return { valid: false, error: 'Unable to determine image format' };
      }

      const allowedFormats = ['jpeg', 'jpg', 'png', 'webp', 'heif', 'heic'];
      if (!allowedFormats.includes(metadata.format.toLowerCase())) {
        return {
          valid: false,
          error: `Invalid image format: ${metadata.format}. Allowed: ${allowedFormats.join(', ')}`
        };
      }

      // Check dimensions
      if (!metadata.width || !metadata.height) {
        return { valid: false, error: 'Unable to determine image dimensions' };
      }

      if (metadata.width < 100 || metadata.height < 100) {
        return { valid: false, error: 'Image too small. Minimum 100x100 pixels' };
      }

      return { valid: true };
    } catch (error) {
      logger.error({ error }, 'Image validation failed');
      return { valid: false, error: 'Invalid or corrupted image file' };
    }
  }

  /**
   * Generate thumbnail for report list view
   */
  async generateThumbnail(
    imageBuffer: Buffer,
    width: number = 200,
    height: number = 200
  ): Promise<Buffer> {
    try {
      return await sharp(imageBuffer)
        .resize(width, height, {
          fit: 'cover',
          position: 'center'
        })
        .jpeg({ quality: 70 })
        .toBuffer();
    } catch (error) {
      logger.error({ error }, 'Failed to generate thumbnail');
      throw new Error('Failed to generate thumbnail');
    }
  }
}

// Export singleton instance
export const imageService = new ImageService();
export default imageService;
