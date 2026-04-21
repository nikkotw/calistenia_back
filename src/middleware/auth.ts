import { FastifyRequest, FastifyReply, HookHandlerDoneFunction } from 'fastify'
import { UserRole } from '@prisma/client'

// Extend Fastify request interface to include user
declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      id: string
      email: string
      role: UserRole
      name: string
    }
  }
}

// JWT authentication middleware
export async function authenticateJWT(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    // Check for Authorization header
    const authHeader = request.headers.authorization

    if (!authHeader) {
      return reply.code(401).send({
        success: false,
        error: 'Authorization required',
        message: 'No authorization header provided',
      })
    }

    // Check for Bearer token format
    if (!authHeader.startsWith('Bearer ')) {
      return reply.code(401).send({
        success: false,
        error: 'Invalid authorization format',
        message: 'Authorization header must start with Bearer',
      })
    }

    // Extract token
    const token = authHeader.substring(7)

    if (!token) {
      return reply.code(401).send({
        success: false,
        error: 'Token required',
        message: 'No token provided',
      })
    }

    try {
      // Verify JWT token using Fastify JWT plugin
      const decoded = await request.jwtVerify()

      // Add user info to request object
      request.user = {
        id: decoded.id,
        email: decoded.email,
        role: decoded.role,
        name: decoded.name,
      }
    } catch (jwtError) {
      return reply.code(401).send({
        success: false,
        error: 'Invalid token',
        message: 'Token verification failed',
      })
    }
  } catch (error) {
    request.log.error('Authentication error:', error)
    return reply.code(500).send({
      success: false,
      error: 'Authentication error',
      message: 'Internal server error during authentication',
    })
  }
}

// Role-based authorization middleware factory
export function requireRole(requiredRoles: UserRole | UserRole[]) {
  return async function (
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    // Ensure user is authenticated first
    if (!request.user) {
      return reply.code(401).send({
        success: false,
        error: 'Authentication required',
        message: 'User not authenticated',
      })
    }

    const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles]

    if (!roles.includes(request.user.role)) {
      return reply.code(403).send({
        success: false,
        error: 'Insufficient permissions',
        message: `Required role(s): ${roles.join(', ')}`,
      })
    }
  }
}

// Admin only middleware
export const requireAdmin = requireRole(UserRole.ADMIN)

// Trainer or Admin middleware
export const requireTrainerOrAdmin = requireRole([
  UserRole.TRAINER,
  UserRole.ADMIN,
])

// Optional authentication middleware (doesn't fail if no token)
export async function optionalAuth(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    const authHeader = request.headers.authorization

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7)

      try {
        const decoded = await request.jwtVerify()
        request.user = {
          id: decoded.id,
          email: decoded.email,
          role: decoded.role,
          name: decoded.name,
        }
      } catch (jwtError) {
        // Ignore JWT errors in optional auth
        request.log.debug('Optional auth failed:', jwtError)
      }
    }
  } catch (error) {
    // Ignore errors in optional auth
    request.log.debug('Optional auth error:', error)
  }
}

// Middleware to check user's own resource access
export async function requireOwnershipOrAdmin(
  request: FastifyRequest,
  reply: FastifyReply,
  resourceUserId: string,
): Promise<boolean> {
  if (!request.user) {
    reply.code(401).send({
      success: false,
      error: 'Authentication required',
      message: 'User not authenticated',
    })
    return false
  }

  // Admin can access any resource
  if (request.user.role === UserRole.ADMIN) {
    return true
  }

  // User can only access their own resources
  if (request.user.id !== resourceUserId) {
    reply.code(403).send({
      success: false,
      error: 'Access denied',
      message: 'You can only access your own resources',
    })
    return false
  }

  return true
}
