// ts-server/src/utils/cloudinary.ts
// Cloudinary configuration and upload utilities

import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { Readable } from 'stream';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export interface CloudinaryUploadResult {
  public_id: string;
  secure_url: string;
  duration?: number;
  format?: string;
  resource_type?: string;
  width?: number;
  height?: number;
}

export interface UploadOptions {
  folder?: string;
  resource_type?: 'auto' | 'image' | 'video' | 'raw';
  transformation?: any[];
  eager?: any[];
}

// Upload file from buffer
export const uploadToCloudinary = async (
  file: Express.Multer.File,
  options: UploadOptions = {}
): Promise<CloudinaryUploadResult> => {
  return new Promise((resolve, reject) => {
    const uploadOptions = {
      folder: options.folder || 'lms-uploads',
      resource_type: options.resource_type || 'auto',
      ...options
    };

    // Create a readable stream from buffer
    const stream = cloudinary.uploader.upload_stream(
      uploadOptions,
      (error, result) => {
        if (error) {
          reject(new Error(`Cloudinary upload failed: ${error.message}`));
        } else if (result) {
          resolve({
            public_id: result.public_id,
            secure_url: result.secure_url,
            duration: result.duration,
            format: result.format,
            resource_type: result.resource_type,
            width: result.width,
            height: result.height,
          });
        } else {
          reject(new Error('Cloudinary upload failed: No result returned'));
        }
      }
    );

    // Convert buffer to stream and pipe to cloudinary
    const bufferStream = new Readable();
    bufferStream.push(file.buffer);
    bufferStream.push(null);
    bufferStream.pipe(stream);
  });
};

// Delete file from Cloudinary
export const deleteFromCloudinary = async (
  publicId: string,
  resourceType: string = 'image'
): Promise<boolean> => {
  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType as any,
    });
    return result.result === 'ok';
  } catch (error) {
    console.error('Cloudinary deletion error:', error);
    return false;
  }
};

// Upload video with specific transformations
export const uploadVideoToCloudinary = async (
  file: Express.Multer.File,
  folder: string = 'lms-videos'
): Promise<CloudinaryUploadResult> => {
  return uploadToCloudinary(file, {
    folder,
    resource_type: 'video',
    eager: [
      { streaming_profile: 'hd', format: 'm3u8' },
      { format: 'mp4', transformation: [{ quality: 'auto' }] }
    ],
  });
};

// Upload image with optimizations
export const uploadImageToCloudinary = async (
  file: Express.Multer.File,
  folder: string = 'lms-images'
): Promise<CloudinaryUploadResult> => {
  return uploadToCloudinary(file, {
    folder,
    resource_type: 'image',
    transformation: [
      { quality: 'auto:best' },
      { fetch_format: 'auto' }
    ],
  });
};

export default cloudinary;