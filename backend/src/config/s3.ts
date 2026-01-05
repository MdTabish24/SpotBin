import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { config } from './env';
import { logger } from './logger';
import { v4 as uuidv4 } from 'uuid';

// S3 Client configuration (works with both AWS S3 and Cloudflare R2)
const s3Client = new S3Client({
  region: config.s3.region,
  endpoint: config.s3.endpoint,
  credentials: {
    accessKeyId: config.s3.accessKeyId,
    secretAccessKey: config.s3.secretAccessKey,
  },
  // For Cloudflare R2 compatibility
  forcePathStyle: config.s3.endpoint?.includes('r2.cloudflarestorage.com'),
});

// Generate unique file key
export const generateFileKey = (folder: string, extension: string = 'jpg'): string => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const uuid = uuidv4();
  
  return `${folder}/${year}/${month}/${day}/${uuid}.${extension}`;
};

// Upload file to S3
export const uploadFile = async (
  buffer: Buffer,
  key: string,
  contentType: string = 'image/jpeg'
): Promise<string> => {
  try {
    const command = new PutObjectCommand({
      Bucket: config.s3.bucketName,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      // Make publicly readable (adjust based on your needs)
      // ACL: 'public-read',
    });

    await s3Client.send(command);
    
    // Return the public URL
    const url = config.s3.endpoint
      ? `${config.s3.endpoint}/${config.s3.bucketName}/${key}`
      : `https://${config.s3.bucketName}.s3.${config.s3.region}.amazonaws.com/${key}`;
    
    logger.info({ key }, 'File uploaded to S3');
    return url;
  } catch (error) {
    logger.error({ error, key }, 'Failed to upload file to S3');
    throw error;
  }
};

// Generate presigned URL for upload (client-side upload)
export const getPresignedUploadUrl = async (
  key: string,
  contentType: string = 'image/jpeg',
  expiresIn: number = 3600 // 1 hour
): Promise<{ uploadUrl: string; fileUrl: string }> => {
  try {
    const command = new PutObjectCommand({
      Bucket: config.s3.bucketName,
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn });
    
    const fileUrl = config.s3.endpoint
      ? `${config.s3.endpoint}/${config.s3.bucketName}/${key}`
      : `https://${config.s3.bucketName}.s3.${config.s3.region}.amazonaws.com/${key}`;

    return { uploadUrl, fileUrl };
  } catch (error) {
    logger.error({ error, key }, 'Failed to generate presigned upload URL');
    throw error;
  }
};

// Generate presigned URL for download
export const getPresignedDownloadUrl = async (
  key: string,
  expiresIn: number = 3600 // 1 hour
): Promise<string> => {
  try {
    const command = new GetObjectCommand({
      Bucket: config.s3.bucketName,
      Key: key,
    });

    return await getSignedUrl(s3Client, command, { expiresIn });
  } catch (error) {
    logger.error({ error, key }, 'Failed to generate presigned download URL');
    throw error;
  }
};

// Delete file from S3
export const deleteFile = async (key: string): Promise<void> => {
  try {
    const command = new DeleteObjectCommand({
      Bucket: config.s3.bucketName,
      Key: key,
    });

    await s3Client.send(command);
    logger.info({ key }, 'File deleted from S3');
  } catch (error) {
    logger.error({ error, key }, 'Failed to delete file from S3');
    throw error;
  }
};

// Extract key from full URL
export const extractKeyFromUrl = (url: string): string | null => {
  try {
    const urlObj = new URL(url);
    // Remove leading slash
    return urlObj.pathname.substring(1);
  } catch {
    return null;
  }
};

// Check if S3 is configured
export const isS3Configured = (): boolean => {
  return !!(
    config.s3.accessKeyId &&
    config.s3.secretAccessKey &&
    config.s3.bucketName &&
    config.s3.accessKeyId !== 'placeholder'
  );
};

export default s3Client;
