import { PrismaClient } from '@prisma/client'
import { env } from './env.js'

// Prisma client singleton
class DatabaseService {
  private static instance: PrismaClient

  public static getInstance(): PrismaClient {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new PrismaClient({
        log:
          env.NODE_ENV === 'development'
            ? ['query', 'info', 'warn', 'error']
            : ['error'],
        errorFormat: 'pretty',
        datasources: {
          db: {
            url: env.DATABASE_URL,
          },
        },
      })

      // Add connection event handlers
      DatabaseService.instance.$on('beforeExit', async () => {
        console.log('📦 Disconnecting from database...')
      })
    }

    return DatabaseService.instance
  }

  // Test database connection
  public static async testConnection(): Promise<boolean> {
    try {
      const prisma = DatabaseService.getInstance()
      await prisma.$queryRaw`SELECT 1`
      console.log('✅ Database connection successful')
      return true
    } catch (error) {
      console.error('❌ Database connection failed:', error)
      return false
    }
  }

  // Close database connection
  public static async disconnect(): Promise<void> {
    try {
      if (DatabaseService.instance) {
        await DatabaseService.instance.$disconnect()
        console.log('📦 Database disconnected successfully')
      }
    } catch (error) {
      console.error('❌ Error disconnecting from database:', error)
    }
  }
}

// Export the singleton instance
export const prisma = DatabaseService.getInstance()

// Export the service class for advanced usage
export { DatabaseService }

// Database health check function
export async function healthCheck() {
  try {
    const startTime = Date.now()
    await prisma.$queryRaw`SELECT 1`
    const endTime = Date.now()

    return {
      status: 'healthy',
      responseTime: endTime - startTime,
      timestamp: new Date().toISOString(),
    }
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }
  }
}
