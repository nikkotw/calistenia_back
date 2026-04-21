import { FastifyRequest, FastifyReply } from 'fastify'
import { AuthService } from '../services/authService.js'
import {
  CreateUserRequest,
  LoginRequest,
  UpdateUserRequest,
  ChangePasswordRequest,
  ApiResponse,
} from '../types/user.js'
import { z } from 'zod'

export class AuthController {
  constructor(private authService: AuthService) {}

  /**
   * Register a new user
   */
  async register(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      // Validation schema
      const schema = z.object({
        email: z.string().email('Invalid email format'),
        password: z.string().min(8, 'Password must be at least 8 characters'),
        name: z.string().min(2, 'Name must be at least 2 characters').max(100),
        phone: z.string().optional(),
      })

      const validatedData = schema.parse(request.body)

      const user = await this.authService.register(validatedData)

      const response: ApiResponse = {
        success: true,
        message: 'User registered successfully',
        data: user,
      }

      return reply.code(201).send(response)
    } catch (error) {
      const statusCode = error instanceof z.ZodError ? 400 : 500
      const message =
        error instanceof z.ZodError
          ? 'Validation error'
          : error instanceof Error
          ? error.message
          : 'Registration failed'

      const response: ApiResponse = {
        success: false,
        message,
        error:
          error instanceof z.ZodError
            ? 'Validation Error'
            : 'Registration Error',
        ...(error instanceof z.ZodError && { details: error.errors }),
      }

      return reply.code(statusCode).send(response)
    }
  }

  /**
   * Login user
   */
  async login(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      // Validation schema
      const schema = z.object({
        email: z.string().email('Invalid email format'),
        password: z.string().min(1, 'Password is required'),
      })

      const validatedData = schema.parse(request.body)

      const loginResponse = await this.authService.login(validatedData)

      return reply.code(200).send(loginResponse)
    } catch (error) {
      const statusCode =
        error instanceof z.ZodError
          ? 400
          : error instanceof Error && error.message.includes('Invalid')
          ? 401
          : 500

      const message =
        error instanceof z.ZodError
          ? 'Validation error'
          : error instanceof Error
          ? error.message
          : 'Login failed'

      const response: ApiResponse = {
        success: false,
        message,
        error:
          error instanceof z.ZodError
            ? 'Validation Error'
            : 'Authentication Error',
        ...(error instanceof z.ZodError && { details: error.errors }),
      }

      return reply.code(statusCode).send(response)
    }
  }

  /**
   * Get current user profile
   */
  async getProfile(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    try {
      if (!request.user) {
        return reply.code(401).send({
          success: false,
          error: 'Authentication required',
          message: 'User not authenticated',
        })
      }

      const user = await this.authService.getProfile(request.user.id)

      const response: ApiResponse = {
        success: true,
        message: 'Profile retrieved successfully',
        data: user,
      }

      return reply.code(200).send(response)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to get profile'

      const response: ApiResponse = {
        success: false,
        message,
        error: 'Profile Error',
      }

      return reply.code(500).send(response)
    }
  }

  /**
   * Update user profile
   */
  async updateProfile(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    try {
      if (!request.user) {
        return reply.code(401).send({
          success: false,
          error: 'Authentication required',
          message: 'User not authenticated',
        })
      }

      // Validation schema
      const schema = z.object({
        name: z.string().min(2).max(100).optional(),
        phone: z.string().optional(),
        profileImage: z.string().url().optional(),
      })

      const validatedData = schema.parse(request.body)

      const user = await this.authService.updateProfile(
        request.user.id,
        validatedData,
      )

      const response: ApiResponse = {
        success: true,
        message: 'Profile updated successfully',
        data: user,
      }

      return reply.code(200).send(response)
    } catch (error) {
      const statusCode = error instanceof z.ZodError ? 400 : 500
      const message =
        error instanceof z.ZodError
          ? 'Validation error'
          : error instanceof Error
          ? error.message
          : 'Failed to update profile'

      const response: ApiResponse = {
        success: false,
        message,
        error:
          error instanceof z.ZodError ? 'Validation Error' : 'Profile Error',
        ...(error instanceof z.ZodError && { details: error.errors }),
      }

      return reply.code(statusCode).send(response)
    }
  }

  /**
   * Change user password
   */
  async changePassword(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    try {
      if (!request.user) {
        return reply.code(401).send({
          success: false,
          error: 'Authentication required',
          message: 'User not authenticated',
        })
      }

      // Validation schema
      const schema = z
        .object({
          currentPassword: z.string().min(1, 'Current password is required'),
          newPassword: z
            .string()
            .min(8, 'New password must be at least 8 characters'),
          confirmPassword: z
            .string()
            .min(1, 'Password confirmation is required'),
        })
        .refine((data) => data.newPassword === data.confirmPassword, {
          message: 'New passwords do not match',
          path: ['confirmPassword'],
        })

      const validatedData = schema.parse(request.body)

      await this.authService.changePassword(request.user.id, validatedData)

      const response: ApiResponse = {
        success: true,
        message: 'Password changed successfully',
      }

      return reply.code(200).send(response)
    } catch (error) {
      const statusCode =
        error instanceof z.ZodError
          ? 400
          : error instanceof Error && error.message.includes('Current password')
          ? 400
          : 500

      const message =
        error instanceof z.ZodError
          ? 'Validation error'
          : error instanceof Error
          ? error.message
          : 'Failed to change password'

      const response: ApiResponse = {
        success: false,
        message,
        error:
          error instanceof z.ZodError ? 'Validation Error' : 'Password Error',
        ...(error instanceof z.ZodError && { details: error.errors }),
      }

      return reply.code(statusCode).send(response)
    }
  }

  /**
   * Deactivate user account
   */
  async deactivateAccount(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    try {
      if (!request.user) {
        return reply.code(401).send({
          success: false,
          error: 'Authentication required',
          message: 'User not authenticated',
        })
      }

      await this.authService.deactivateAccount(request.user.id)

      const response: ApiResponse = {
        success: true,
        message: 'Account deactivated successfully',
      }

      return reply.code(200).send(response)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to deactivate account'

      const response: ApiResponse = {
        success: false,
        message,
        error: 'Account Error',
      }

      return reply.code(500).send(response)
    }
  }

  /**
   * Verify JWT token (for debugging/validation)
   */
  async verifyToken(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    try {
      // Validation schema
      const schema = z.object({
        token: z.string().min(1, 'Token is required'),
      })

      const { token } = schema.parse(request.body)

      const user = await this.authService.verifyToken(token)

      const response: ApiResponse = {
        success: true,
        message: 'Token is valid',
        data: {
          valid: true,
          user,
        },
      }

      return reply.code(200).send(response)
    } catch (error) {
      const statusCode = error instanceof z.ZodError ? 400 : 401
      const message =
        error instanceof z.ZodError
          ? 'Validation error'
          : 'Invalid or expired token'

      const response: ApiResponse = {
        success: false,
        message,
        error: 'Token Error',
        data: { valid: false },
        ...(error instanceof z.ZodError && { details: error.errors }),
      }

      return reply.code(statusCode).send(response)
    }
  }

  /**
   * Refresh JWT token
   */
  async refreshToken(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    try {
      if (!request.user) {
        return reply.code(401).send({
          success: false,
          error: 'Authentication required',
          message: 'User not authenticated',
        })
      }

      // Generate new token with current user info
      const { JWTUtil } = await import('../utils/jwt.js')
      const newToken = JWTUtil.generateToken({
        id: request.user.id,
        email: request.user.email,
        role: request.user.role,
        name: request.user.name,
      })

      const response: ApiResponse = {
        success: true,
        message: 'Token refreshed successfully',
        data: {
          token: newToken,
          user: request.user,
        },
      }

      return reply.code(200).send(response)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to refresh token'

      const response: ApiResponse = {
        success: false,
        message,
        error: 'Token Error',
      }

      return reply.code(500).send(response)
    }
  }
}
