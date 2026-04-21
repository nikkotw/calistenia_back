import { S3Service as BaseS3Service } from '../config/s3.js'
import { FileUploadRequest, FileUploadResponse } from '../types/user.js'
import {
  validateFileType,
  generateS3Key,
  getS3PublicUrl,
} from '../config/s3.js'

export class S3Service extends BaseS3Service {
  /**
   * Generate presigned URL for file upload with validation
   */
  static async generateUploadUrl(
    request: FileUploadRequest,
    userId?: string,
  ): Promise<FileUploadResponse> {
    try {
      const { filename, contentType, folder = 'videos' } = request

      // Validate file type
      if (!validateFileType(contentType)) {
        throw new Error(
          `File type ${contentType} is not supported. Allowed types: video/mp4, video/webm, video/ogg, image/jpeg, image/jpg, image/png`,
        )
      }

      // Generate unique filename
      const key = generateS3Key(folder, filename)

      // Generate presigned URL with 1 hour expiration
      const { uploadUrl, publicUrl } = await super.getPresignedUploadUrl(
        filename,
        contentType,
        folder,
        3600, // 1 hour
      )

      return {
        success: true,
        uploadUrl,
        key,
        publicUrl,
        expiresIn: 3600,
      }
    } catch (error) {
      throw new Error(
        `Failed to generate upload URL: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      )
    }
  }

  /**
   * Generate presigned download URL for private files
   */
  static async generateDownloadUrl(
    key: string,
    expiresIn: number = 3600,
  ): Promise<string> {
    try {
      // Check if file exists
      const exists = await super.fileExists(key)
      if (!exists) {
        throw new Error('File not found')
      }

      return await super.getPresignedDownloadUrl(key, expiresIn)
    } catch (error) {
      throw new Error(
        `Failed to generate download URL: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      )
    }
  }

  /**
   * Delete file from S3
   */
  static async deleteFile(key: string): Promise<boolean> {
    try {
      return await super.deleteFile(key)
    } catch (error) {
      throw new Error(
        `Failed to delete file: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      )
    }
  }

  /**
   * Get public URL for a file (for public files)
   */
  static getPublicUrl(key: string): string {
    return getS3PublicUrl(key)
  }

  /**
   * Validate file before upload
   */
  static validateFile(
    filename: string,
    contentType: string,
    fileSize: number,
  ): { valid: boolean; error?: string } {
    // Check file type
    if (!validateFileType(contentType)) {
      return {
        valid: false,
        error: `File type ${contentType} is not supported`,
      }
    }

    // Check file size (50MB limit)
    const maxSize = 50 * 1024 * 1024 // 50MB
    if (fileSize > maxSize) {
      return {
        valid: false,
        error: `File size ${(fileSize / 1024 / 1024).toFixed(
          2,
        )}MB exceeds maximum allowed size of 50MB`,
      }
    }

    // Check filename
    if (!filename || filename.length === 0) {
      return {
        valid: false,
        error: 'Filename is required',
      }
    }

    if (filename.length > 255) {
      return {
        valid: false,
        error: 'Filename is too long (max 255 characters)',
      }
    }

    // Check for dangerous characters
    const dangerousChars = /[<>:"/\\|?*]/
    if (dangerousChars.test(filename)) {
      return {
        valid: false,
        error: 'Filename contains invalid characters',
      }
    }

    return { valid: true }
  }

  /**
   * Generate multiple upload URLs (batch upload)
   */
  static async generateBatchUploadUrls(
    requests: FileUploadRequest[],
  ): Promise<FileUploadResponse[]> {
    try {
      const results: FileUploadResponse[] = []

      for (const request of requests) {
        try {
          const result = await this.generateUploadUrl(request)
          results.push(result)
        } catch (error) {
          results.push({
            success: false,
            uploadUrl: '',
            key: '',
            publicUrl: '',
            expiresIn: 0,
          })
        }
      }

      return results
    } catch (error) {
      throw new Error(
        `Failed to generate batch upload URLs: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      )
    }
  }

  /**
   * Copy file within S3 bucket
   */
  static async copyFile(
    sourceKey: string,
    destinationKey: string,
  ): Promise<boolean> {
    try {
      const { s3, S3_CONFIG } = await import('../config/s3.js')

      await s3
        .copyObject({
          Bucket: S3_CONFIG.bucketName,
          CopySource: `${S3_CONFIG.bucketName}/${sourceKey}`,
          Key: destinationKey,
        })
        .promise()

      return true
    } catch (error) {
      console.error(
        `Failed to copy file from ${sourceKey} to ${destinationKey}:`,
        error,
      )
      return false
    }
  }

  /**
   * Get file metadata
   */
  static async getFileMetadata(
    key: string,
  ): Promise<{
    size: number
    lastModified: Date
    contentType: string
    etag: string
  } | null> {
    try {
      const { s3, S3_CONFIG } = await import('../config/s3.js')

      const result = await s3
        .headObject({
          Bucket: S3_CONFIG.bucketName,
          Key: key,
        })
        .promise()

      return {
        size: result.ContentLength || 0,
        lastModified: result.LastModified || new Date(),
        contentType: result.ContentType || '',
        etag: result.ETag || '',
      }
    } catch (error) {
      return null
    }
  }

  /**
   * List files in a folder
   */
  static async listFiles(
    folder: string,
    maxKeys: number = 100,
  ): Promise<
    Array<{
      key: string
      size: number
      lastModified: Date
      url: string
    }>
  > {
    try {
      const { s3, S3_CONFIG } = await import('../config/s3.js')

      const result = await s3
        .listObjectsV2({
          Bucket: S3_CONFIG.bucketName,
          Prefix: folder,
          MaxKeys: maxKeys,
        })
        .promise()

      return (result.Contents || []).map((object) => ({
        key: object.Key || '',
        size: object.Size || 0,
        lastModified: object.LastModified || new Date(),
        url: getS3PublicUrl(object.Key || ''),
      }))
    } catch (error) {
      throw new Error(
        `Failed to list files: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      )
    }
  }
}
