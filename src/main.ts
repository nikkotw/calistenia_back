import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import multipart from '@fastify/multipart'
import { PrismaClient } from '@prisma/client'
import { env } from './config/env.js'
import { authRoutes } from './routes/auth.js'
import { routineRoutes } from './routes/routines.js'
import { challengeRoutes } from './routes/challenges.js'
import { adminRoutes } from './routes/admin.js'
import { bookRoutes } from './routes/books.js'

// Global error type
interface CustomError extends Error {
  statusCode?: number
  validation?: any[]
}

// Extend Fastify instance with Prisma
declare module 'fastify' {
  export interface FastifyInstance {
    prisma: PrismaClient
  }
}

// Initialize Prisma client
const prisma = new PrismaClient()

// Create Fastify instance
const fastify: FastifyInstance = Fastify({
  logger: {
    level: env.NODE_ENV === 'production' ? 'info' : 'debug',
    transport:
      env.NODE_ENV === 'development'
        ? {
            target: 'pino-pretty',
            options: {
              colorize: true,
            },
          }
        : undefined,
  },
})

// Register plugins
async function registerPlugins() {
  try {
    // CORS Plugin
    await fastify.register(cors, {
      origin: [
        'http://localhost:5173', // Vite dev server
        'http://localhost:3000', // Alternative frontend port
        env.FRONTEND_URL,
      ].filter(Boolean),
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })

    // JWT Plugin
    await fastify.register(jwt, {
      secret: env.JWT_SECRET,
      sign: {
        algorithm: 'HS256',
        expiresIn: env.JWT_EXPIRES_IN || '7d',
      },
      verify: {
        algorithms: ['HS256'],
      },
    })

    // Multipart Plugin for file uploads
    await fastify.register(multipart, {
      limits: {
        fileSize: 50 * 1024 * 1024, // 50MB max file size
        files: 1,
      },
    })

    // Add Prisma to Fastify instance
    fastify.decorate('prisma', prisma)

    // Register routes
    await fastify.register(authRoutes, { prefix: '/api/auth' })
    await fastify.register(routineRoutes, { prefix: '/api/routines' })
    await fastify.register(challengeRoutes, { prefix: '/api/challenges' })
    await fastify.register(adminRoutes, { prefix: '/api/admin' })
    await fastify.register(bookRoutes, { prefix: '/api/books' })

    fastify.log.info('All plugins registered successfully')
  } catch (error) {
    fastify.log.error({ err: error }, 'Error registering plugins')
    throw error
  }
}

// Health check endpoint
fastify.get('/health', async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`

    return reply.code(200).send({
      status: 'OK',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: 'connected',
      environment: env.NODE_ENV,
    })
  } catch (error) {
    fastify.log.error({ err: error }, 'Health check failed')
    return reply.code(503).send({
      status: 'ERROR',
      timestamp: new Date().toISOString(),
      database: 'disconnected',
      error: 'Database connection failed',
    })
  }
})

// Global error handler
fastify.setErrorHandler(
  async (error: CustomError, request: FastifyRequest, reply: FastifyReply) => {
    const statusCode = error.statusCode || 500

    // Log error details
    fastify.log.error({
      error: error.message,
      stack: error.stack,
      statusCode,
      url: request.url,
      method: request.method,
      ip: request.ip,
    })

    // Prisma error handling
    if (error.message?.includes('Unique constraint')) {
      return reply.code(409).send({
        success: false,
        error: 'Resource already exists',
        message: 'A record with this information already exists',
      })
    }

    if (error.message?.includes('Record to update not found')) {
      return reply.code(404).send({
        success: false,
        error: 'Resource not found',
        message: 'The requested resource was not found',
      })
    }

    // JWT error handling
    if (error.message?.includes('jwt') || error.message?.includes('token')) {
      return reply.code(401).send({
        success: false,
        error: 'Authentication failed',
        message: 'Invalid or expired token',
      })
    }

    // Validation errors
    if (error.validation) {
      return reply.code(400).send({
        success: false,
        error: 'Validation error',
        message: 'Invalid input data',
        details: error.validation,
      })
    }

    // Generic error response
    const message =
      statusCode >= 500
        ? 'Internal server error'
        : error.message || 'An error occurred'

    return reply.code(statusCode).send({
      success: false,
      error: error.name || 'Error',
      message,
      ...(env.NODE_ENV === 'development' && { stack: error.stack }),
    })
  },
)

// Not found handler
fastify.setNotFoundHandler(
  async (request: FastifyRequest, reply: FastifyReply) => {
    return reply.code(404).send({
      success: false,
      error: 'Not Found',
      message: `Route ${request.method}:${request.url} not found`,
    })
  },
)

// Graceful shutdown
async function gracefulShutdown(signal: string) {
  fastify.log.info(`Received ${signal}, shutting down gracefully...`)

  try {
    await fastify.close()
    await prisma.$disconnect()
    fastify.log.info('Server closed successfully')
    process.exit(0)
  } catch (error) {
    fastify.log.error({ err: error }, 'Error during shutdown')
    process.exit(1)
  }
}

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
process.on('SIGINT', () => gracefulShutdown('SIGINT'))

// Start server
async function start() {
  try {
    // Register all plugins and routes
    await registerPlugins()

    // Connect to database
    await prisma.$connect()
    fastify.log.info('Connected to database successfully')

    // Start listening
    const address = await fastify.listen({
      host: env.HOST || '0.0.0.0',
      port: env.PORT || 3000,
    })

    fastify.log.info(`🚀 Server running at ${address}`)
    fastify.log.info(`📖 Environment: ${env.NODE_ENV}`)
    fastify.log.info(`🔗 Health check: ${address}/health`)
  } catch (error) {
    fastify.log.error({ err: error }, 'Error starting server')
    await prisma.$disconnect()
    process.exit(1)
  }
}

// Start the server
start()
