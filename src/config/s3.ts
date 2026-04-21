import AWS from 'aws-sdk'
import { env } from './env.js'

// AWS S3 Configuration
const s3Config = {
  accessKeyId: env.AWS_ACCESS_KEY_ID,
  secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
  region: env.AWS_REGION,
  signatureVersion: 'v4' as const,
}

// Configure AWS
AWS.config.update(s3Config)

// S3 client instance
export const s3 = new AWS.S3(s3Config)

// S3 bucket configuration
export const S3_CONFIG = {
  bucketName: env.S3_BUCKET_NAME,
  region: env.S3_BUCKET_REGION || env.AWS_REGION,
  maxFileSize: env.MAX_FILE_SIZE,
  allowedFileTypes: env.ALLOWED_FILE_TYPES.split(',').map((type) =>
    type.trim(),
  ),
  // Folder structure
  folders: {
    videos: 'videos/',
    images: 'images/',
    profiles: 'profiles/',
    routines: 'routines/',
    challenges: 'challenges/',
  },
}

// File type validation
export function validateFileType(mimeType: string): boolean {
  return S3_CONFIG.allowedFileTypes.includes(mimeType)
}

// Generate S3 key (file path)
export function generateS3Key(
  folder: keyof typeof S3_CONFIG.folders,
  filename: string,
): string {
  const timestamp = Date.now()
  const randomString = Math.random().toString(36).substring(2, 15)
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_')

  return `${S3_CONFIG.folders[folder]}${timestamp}_${randomString}_${sanitizedFilename}`
}

// Get file extension from filename
export function getFileExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() || ''
}

// Generate public URL for S3 object
export function getS3PublicUrl(key: string): string {
  return `https://${S3_CONFIG.bucketName}.s3.${S3_CONFIG.region}.amazonaws.com/${key}`
}

// Test S3 connection
export async function testS3Connection(): Promise<boolean> {
  try {
    await s3.headBucket({ Bucket: S3_CONFIG.bucketName }).promise()
    console.log('✅ S3 connection successful')
    return true
  } catch (error) {
    console.error('❌ S3 connection failed:', error)
    return false
  }
}

// S3 service class with common operations
export class S3Service {
  // Generate presigned URL for file upload
  static async getPresignedUploadUrl(
    filename: string,
    contentType: string,
    folder: keyof typeof S3_CONFIG.folders = 'videos',
    expiresIn: number = 3600, // 1 hour
  ): Promise<{ uploadUrl: string; key: string; publicUrl: string }> {
    try {
      // Validate file type
      if (!validateFileType(contentType)) {
        throw new Error(`File type ${contentType} is not allowed`)
      }

      const key = generateS3Key(folder, filename)

      const params = {
        Bucket: S3_CONFIG.bucketName,
        Key: key,
        Expires: expiresIn,
        ContentType: contentType,
        ACL: 'public-read',
      }

      const uploadUrl = await s3.getSignedUrlPromise('putObject', params)
      const publicUrl = getS3PublicUrl(key)

      return {
        uploadUrl,
        key,
        publicUrl,
      }
    } catch (error) {
      throw new Error(
        `Failed to generate presigned URL: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      )
    }
  }

  // Generate presigned URL for file download
  static async getPresignedDownloadUrl(
    key: string,
    expiresIn: number = 3600, // 1 hour
  ): Promise<string> {
    try {
      const params = {
        Bucket: S3_CONFIG.bucketName,
        Key: key,
        Expires: expiresIn,
      }

      return await s3.getSignedUrlPromise('getObject', params)
    } catch (error) {
      throw new Error(
        `Failed to generate download URL: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      )
    }
  }

  // Delete file from S3
  static async deleteFile(key: string): Promise<boolean> {
    try {
      await s3
        .deleteObject({
          Bucket: S3_CONFIG.bucketName,
          Key: key,
        })
        .promise()

      return true
    } catch (error) {
      console.error(`Failed to delete file ${key}:`, error)
      return false
    }
  }

  // Check if file exists in S3
  static async fileExists(key: string): Promise<boolean> {
    try {
      await s3
        .headObject({
          Bucket: S3_CONFIG.bucketName,
          Key: key,
        })
        .promise()

      return true
    } catch (error) {
      return false
    }
  }
}
