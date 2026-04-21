import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'
import { JWTPayload } from '../types/user.js'
import { UserRole } from '@prisma/client'

// JWT utility functions
export class JWTUtil {
  private static readonly SECRET = env.JWT_SECRET
  private static readonly EXPIRES_IN = env.JWT_EXPIRES_IN || '7d'

  /**
   * Generate JWT token for user
   */
  static generateToken(payload: {
    id: string
    email: string
    role: UserRole
    name: string
  }): string {
    try {
      const tokenPayload: JWTPayload = {
        id: payload.id,
        email: payload.email,
        role: payload.role,
        name: payload.name,
      }

      return jwt.sign(tokenPayload, this.SECRET, {
        expiresIn: this.EXPIRES_IN,
        algorithm: 'HS256',
        issuer: 'calistenia-app',
        audience: 'calistenia-users',
      })
    } catch (error) {
      throw new Error(
        `Failed to generate JWT token: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      )
    }
  }

  /**
   * Verify JWT token
   */
  static verifyToken(token: string): JWTPayload {
    try {
      const decoded = jwt.verify(token, this.SECRET, {
        algorithms: ['HS256'],
        issuer: 'calistenia-app',
        audience: 'calistenia-users',
      }) as JWTPayload

      return decoded
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('Invalid token')
      }
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('Token expired')
      }
      if (error instanceof jwt.NotBeforeError) {
        throw new Error('Token not active')
      }

      throw new Error(
        `Token verification failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      )
    }
  }

  /**
   * Decode JWT token without verification (for debugging)
   */
  static decodeToken(token: string): JWTPayload | null {
    try {
      const decoded = jwt.decode(token) as JWTPayload
      return decoded
    } catch (error) {
      return null
    }
  }

  /**
   * Check if token is expired
   */
  static isTokenExpired(token: string): boolean {
    try {
      const decoded = this.decodeToken(token)
      if (!decoded || !decoded.exp) {
        return true
      }

      const currentTime = Math.floor(Date.now() / 1000)
      return decoded.exp < currentTime
    } catch (error) {
      return true
    }
  }

  /**
   * Get token expiration time
   */
  static getTokenExpiration(token: string): Date | null {
    try {
      const decoded = this.decodeToken(token)
      if (!decoded || !decoded.exp) {
        return null
      }

      return new Date(decoded.exp * 1000)
    } catch (error) {
      return null
    }
  }

  /**
   * Generate refresh token (longer expiration)
   */
  static generateRefreshToken(payload: { id: string; email: string }): string {
    try {
      return jwt.sign(payload, this.SECRET, {
        expiresIn: '30d', // Refresh tokens last 30 days
        algorithm: 'HS256',
        issuer: 'calistenia-app',
        audience: 'calistenia-refresh',
      })
    } catch (error) {
      throw new Error(
        `Failed to generate refresh token: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      )
    }
  }

  /**
   * Verify refresh token
   */
  static verifyRefreshToken(token: string): { id: string; email: string } {
    try {
      const decoded = jwt.verify(token, this.SECRET, {
        algorithms: ['HS256'],
        issuer: 'calistenia-app',
        audience: 'calistenia-refresh',
      }) as { id: string; email: string }

      return decoded
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('Invalid refresh token')
      }
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('Refresh token expired')
      }

      throw new Error(
        `Refresh token verification failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      )
    }
  }
}
