import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { AuthController } from '../controllers/authController.js'
import { AuthService } from '../services/authService.js'
import { authenticateJWT } from '../middleware/auth.js'

export async function authRoutes(fastify: FastifyInstance) {
  // Initialize services
  const authService = new AuthService(fastify.prisma)
  const authController = new AuthController(authService)

  // Public routes (no authentication required)

  /**
   * Register new user
   * POST /api/auth/register
   */
  fastify.post(
    '/register',
    {
      schema: {
        description: 'Register a new user account',
        tags: ['Authentication'],
        body: {
          type: 'object',
          required: ['email', 'password', 'name'],
          properties: {
            email: {
              type: 'string',
              format: 'email',
              description: 'User email address',
            },
            password: {
              type: 'string',
              minLength: 8,
              description: 'User password (min 8 characters)',
            },
            name: {
              type: 'string',
              minLength: 2,
              maxLength: 100,
              description: 'User full name',
            },
            phone: {
              type: 'string',
              description: 'User phone number (optional)',
            },
          },
        },
        response: {
          201: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' },
              data: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  email: { type: 'string' },
                  name: { type: 'string' },
                  phone: { type: 'string' },
                  profileImage: { type: 'string' },
                  role: { type: 'string' },
                  isActive: { type: 'boolean' },
                  createdAt: { type: 'string' },
                },
              },
            },
          },
          400: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' },
              error: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      return authController.register(request, reply)
    },
  )

  /**
   * Login user
   * POST /api/auth/login
   */
  fastify.post(
    '/login',
    {
      schema: {
        description: 'Authenticate user and return JWT token',
        tags: ['Authentication'],
        body: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: {
              type: 'string',
              format: 'email',
              description: 'User email address',
            },
            password: {
              type: 'string',
              description: 'User password',
            },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              user: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  email: { type: 'string' },
                  name: { type: 'string' },
                  role: { type: 'string' },
                },
              },
              token: { type: 'string' },
              subscription: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  planName: { type: 'string' },
                  level: { type: 'string' },
                  isActive: { type: 'boolean' },
                },
              },
            },
          },
          401: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' },
              error: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      return authController.login(request, reply)
    },
  )

  /**
   * Verify JWT token
   * POST /api/auth/verify
   */
  fastify.post(
    '/verify',
    {
      schema: {
        description: 'Verify JWT token validity',
        tags: ['Authentication'],
        body: {
          type: 'object',
          required: ['token'],
          properties: {
            token: {
              type: 'string',
              description: 'JWT token to verify',
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      return authController.verifyToken(request, reply)
    },
  )

  // Protected routes (authentication required)

  /**
   * Get current user profile
   * GET /api/auth/profile
   */
  fastify.get(
    '/profile',
    {
      preHandler: [authenticateJWT],
      schema: {
        description: 'Get current authenticated user profile',
        tags: ['Authentication'],
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' },
              data: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  email: { type: 'string' },
                  name: { type: 'string' },
                  phone: { type: 'string' },
                  profileImage: { type: 'string' },
                  role: { type: 'string' },
                  isActive: { type: 'boolean' },
                  createdAt: { type: 'string' },
                },
              },
            },
          },
          401: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              error: { type: 'string' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      return authController.getProfile(request, reply)
    },
  )

  /**
   * Update user profile
   * PUT /api/auth/profile
   */
  fastify.put(
    '/profile',
    {
      preHandler: [authenticateJWT],
      schema: {
        description: 'Update current user profile',
        tags: ['Authentication'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              minLength: 2,
              maxLength: 100,
              description: 'User full name',
            },
            phone: {
              type: 'string',
              description: 'User phone number',
            },
            profileImage: {
              type: 'string',
              format: 'uri',
              description: 'Profile image URL',
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      return authController.updateProfile(request, reply)
    },
  )

  /**
   * Change user password
   * POST /api/auth/change-password
   */
  fastify.post(
    '/change-password',
    {
      preHandler: [authenticateJWT],
      schema: {
        description: 'Change user password',
        tags: ['Authentication'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['currentPassword', 'newPassword', 'confirmPassword'],
          properties: {
            currentPassword: {
              type: 'string',
              description: 'Current user password',
            },
            newPassword: {
              type: 'string',
              minLength: 8,
              description: 'New password (min 8 characters)',
            },
            confirmPassword: {
              type: 'string',
              description: 'Confirm new password',
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      return authController.changePassword(request, reply)
    },
  )

  /**
   * Refresh JWT token
   * POST /api/auth/refresh
   */
  fastify.post(
    '/refresh',
    {
      preHandler: [authenticateJWT],
      schema: {
        description: 'Refresh JWT token',
        tags: ['Authentication'],
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' },
              data: {
                type: 'object',
                properties: {
                  token: { type: 'string' },
                  user: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      email: { type: 'string' },
                      name: { type: 'string' },
                      role: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      return authController.refreshToken(request, reply)
    },
  )

  /**
   * Deactivate account
   * DELETE /api/auth/account
   */
  fastify.delete(
    '/account',
    {
      preHandler: [authenticateJWT],
      schema: {
        description: 'Deactivate user account',
        tags: ['Authentication'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      return authController.deactivateAccount(request, reply)
    },
  )
}
