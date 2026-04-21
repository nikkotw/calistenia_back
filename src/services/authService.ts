import { PrismaClient, User, UserRole } from '@prisma/client'
import { HashUtil } from '../utils/hash.js'
import { JWTUtil } from '../utils/jwt.js'
import {
  CreateUserRequest,
  LoginRequest,
  LoginResponse,
  UserProfile,
  ChangePasswordRequest,
  UpdateUserRequest,
} from '../types/user.js'

export class AuthService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Register a new user
   */
  async register(data: CreateUserRequest): Promise<UserProfile> {
    try {
      // Check if user already exists
      const existingUser = await this.prisma.user.findUnique({
        where: { email: data.email.toLowerCase() },
      })

      if (existingUser) {
        throw new Error('User with this email already exists')
      }

      // Hash password
      const hashedPassword = await HashUtil.hashPassword(data.password)

      // Create user
      const user = await this.prisma.user.create({
        data: {
          email: data.email.toLowerCase(),
          password: hashedPassword,
          name: data.name.trim(),
          phone: data.phone?.trim(),
          role: UserRole.USER,
        },
      })

      // Create default free subscription
      const freePlan = await this.prisma.subscriptionPlan.findFirst({
        where: { level: 'FREE' },
      })

      if (freePlan) {
        await this.prisma.userSubscription.create({
          data: {
            userId: user.id,
            planId: freePlan.id,
            isActive: true,
          },
        })
      }

      return this.formatUserProfile(user)
    } catch (error) {
      if (error instanceof Error) {
        throw error
      }
      throw new Error('Failed to register user')
    }
  }

  /**
   * Login user
   */
  async login(data: LoginRequest): Promise<LoginResponse> {
    try {
      // Find user by email
      const user = await this.prisma.user.findUnique({
        where: { email: data.email.toLowerCase() },
        include: {
          subscriptions: {
            where: { isActive: true },
            include: { plan: true },
            orderBy: { createdAt: 'desc' },
          },
        },
      })

      if (!user) {
        throw new Error('Invalid email or password')
      }

      // Check if user is active
      if (!user.isActive) {
        throw new Error('Account is deactivated. Please contact support.')
      }

      // Verify password
      const isPasswordValid = await HashUtil.comparePassword(
        data.password,
        user.password,
      )

      if (!isPasswordValid) {
        throw new Error('Invalid email or password')
      }

      // Generate JWT token
      const token = JWTUtil.generateToken({
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
      })

      // Get current subscription info
      const currentSubscription = user.subscriptions[0]
      const subscriptionInfo = currentSubscription
        ? {
            id: currentSubscription.id,
            planName: currentSubscription.plan.name,
            level: currentSubscription.plan.level,
            isActive: currentSubscription.isActive,
            startDate: currentSubscription.startDate,
            endDate: currentSubscription.endDate,
            features: currentSubscription.plan.features,
          }
        : undefined

      return {
        success: true,
        user: this.formatUserProfile(user),
        token,
        subscription: subscriptionInfo,
      }
    } catch (error) {
      if (error instanceof Error) {
        throw error
      }
      throw new Error('Login failed')
    }
  }

  /**
   * Get user profile by ID
   */
  async getProfile(userId: string): Promise<UserProfile> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      })

      if (!user) {
        throw new Error('User not found')
      }

      if (!user.isActive) {
        throw new Error('Account is deactivated')
      }

      return this.formatUserProfile(user)
    } catch (error) {
      if (error instanceof Error) {
        throw error
      }
      throw new Error('Failed to get user profile')
    }
  }

  /**
   * Update user profile
   */
  async updateProfile(
    userId: string,
    data: UpdateUserRequest,
  ): Promise<UserProfile> {
    try {
      const user = await this.prisma.user.update({
        where: { id: userId },
        data: {
          ...(data.name && { name: data.name.trim() }),
          ...(data.phone && { phone: data.phone.trim() }),
          ...(data.profileImage && { profileImage: data.profileImage }),
          updatedAt: new Date(),
        },
      })

      return this.formatUserProfile(user)
    } catch (error) {
      if (error instanceof Error) {
        throw error
      }
      throw new Error('Failed to update profile')
    }
  }

  /**
   * Change user password
   */
  async changePassword(
    userId: string,
    data: ChangePasswordRequest,
  ): Promise<void> {
    try {
      // Verify passwords match
      if (data.newPassword !== data.confirmPassword) {
        throw new Error('New passwords do not match')
      }

      // Get current user
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      })

      if (!user) {
        throw new Error('User not found')
      }

      // Verify current password
      const isCurrentPasswordValid = await HashUtil.comparePassword(
        data.currentPassword,
        user.password,
      )

      if (!isCurrentPasswordValid) {
        throw new Error('Current password is incorrect')
      }

      // Hash new password
      const hashedNewPassword = await HashUtil.hashPassword(data.newPassword)

      // Update password
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          password: hashedNewPassword,
          updatedAt: new Date(),
        },
      })
    } catch (error) {
      if (error instanceof Error) {
        throw error
      }
      throw new Error('Failed to change password')
    }
  }

  /**
   * Deactivate user account
   */
  async deactivateAccount(userId: string): Promise<void> {
    try {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          isActive: false,
          updatedAt: new Date(),
        },
      })
    } catch (error) {
      throw new Error('Failed to deactivate account')
    }
  }

  /**
   * Verify JWT token and return user
   */
  async verifyToken(token: string): Promise<UserProfile> {
    try {
      const decoded = JWTUtil.verifyToken(token)
      return await this.getProfile(decoded.id)
    } catch (error) {
      throw new Error('Invalid or expired token')
    }
  }

  /**
   * Check if user has required role
   */
  async hasRole(userId: string, requiredRole: UserRole): Promise<boolean> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { role: true, isActive: true },
      })

      if (!user || !user.isActive) {
        return false
      }

      // Admin has access to everything
      if (user.role === UserRole.ADMIN) {
        return true
      }

      return user.role === requiredRole
    } catch (error) {
      return false
    }
  }

  /**
   * Format user data for API response (remove sensitive info)
   */
  private formatUserProfile(user: User): UserProfile {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      profileImage: user.profileImage,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
    }
  }
}
