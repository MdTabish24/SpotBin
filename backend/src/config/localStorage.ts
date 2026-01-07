/**
 * Local File Storage - For development without S3/R2
 * Saves images to local uploads folder
 */

import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { logger } from './logger';

const UPLOADS_DIR = path.join(process.cwd(), 'uploads');

// Ensure uploads directory exists
export const ensureUploadsDir = (): void => {
  const dirs = [
    UPLOADS_DIR,
    path.join(UPLOADS_DIR, 'reports'),
    path.join(UPLOADS_DIR, 'verifications'),
  ];

  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      logger.info({ dir }, 'Created uploads directory');
    }
  });
};

// Generate unique file path
export const generateLocalFilePath = (folder: string, extension: string = 'jpg'): string => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const uuid = uuidv4();
  
  const subDir = path.join(UPLOADS_DIR, folder, `${year}`, `${month}`, `${day}`);
  
  // Create subdirectory if not exists
  if (!fs.existsSync(subDir)) {
    fs.mkdirSync(subDir, { recursive: true });
  }
  
  return path.join(subDir, `${uuid}.${extension}`);
};

// Save file locally
export const saveFileLocally = async (
  buffer: Buffer,
  folder: string,
  extension: string = 'jpg'
): Promise<string> => {
  ensureUploadsDir();
  
  const filePath = generateLocalFilePath(folder, extension);
  
  await fs.promises.writeFile(filePath, buffer);
  
  // Return relative URL path
  const relativePath = path.relative(UPLOADS_DIR, filePath).replace(/\\/g, '/');
  const url = `/uploads/${relativePath}`;
  
  logger.info({ filePath, url }, 'File saved locally');
  return url;
};

// Delete local file
export const deleteLocalFile = async (urlPath: string): Promise<void> => {
  try {
    const relativePath = urlPath.replace('/uploads/', '');
    const filePath = path.join(UPLOADS_DIR, relativePath);
    
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
      logger.info({ filePath }, 'Local file deleted');
    }
  } catch (error) {
    logger.error({ error, urlPath }, 'Failed to delete local file');
  }
};

// Get file buffer from local storage
export const getLocalFile = async (urlPath: string): Promise<Buffer | null> => {
  try {
    const relativePath = urlPath.replace('/uploads/', '');
    const filePath = path.join(UPLOADS_DIR, relativePath);
    
    if (fs.existsSync(filePath)) {
      return await fs.promises.readFile(filePath);
    }
    return null;
  } catch (error) {
    logger.error({ error, urlPath }, 'Failed to read local file');
    return null;
  }
};

export default {
  ensureUploadsDir,
  saveFileLocally,
  deleteLocalFile,
  getLocalFile,
};
