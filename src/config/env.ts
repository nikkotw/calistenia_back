import { z } from 'zod'

// Environment variables schema with validation
const envSchema = z.object({
  // Server configuration
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  HOST: z.string().default('localhost'),
  PORT: z.coerce.number().default(3000),

  // Database configuration
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // JWT configuration
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),

  // Frontend configuration
  FRONTEND_URL: z.string().url().optional(),

  // Storage mode
  STORAGE_PROVIDER: z.enum(['local', 's3']).default('local'),

  // AWS S3 configuration
  AWS_REGION: z.string().optional(),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  S3_BUCKET_NAME: z.string().optional(),
  S3_BUCKET_REGION: z.string().optional(),

  // Local upload storage
  LOCAL_UPLOAD_DIR: z.string().default('./uploads'),

  // File upload configuration
  MAX_FILE_SIZE: z.coerce.number().default(50 * 1024 * 1024), // 50MB
  ALLOWED_FILE_TYPES: z
    .string()
    .default('video/mp4,video/webm,video/ogg,image/jpeg,image/jpg,image/png'),

  // Email configuration (optional for future use)
  EMAIL_HOST: z.string().optional(),
  EMAIL_PORT: z.coerce.number().optional(),
  EMAIL_USER: z.string().optional(),
  EMAIL_PASS: z.string().optional(),

  // External API keys (optional)
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
})

// Parse and validate environment variables
const parseEnv = () => {
  try {
    return envSchema.parse(process.env)
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.errors.map(
        (err) => `${err.path.join('.')}: ${err.message}`,
      )

      console.error('❌ Environment validation failed:')
      errorMessages.forEach((msg) => console.error(`  - ${msg}`))
      console.error(
        '\nPlease check your .env file and ensure all required variables are set.',
      )

      process.exit(1)
    }
    throw error
  }
}

// Export validated environment variables
export const env = parseEnv()

// Type for environment variables
export type Env = z.infer<typeof envSchema>

// Helper function to check if we're in development
export const isDevelopment = env.NODE_ENV === 'development'

// Helper function to check if we're in production
export const isProduction = env.NODE_ENV === 'production'

// Helper function to check if we're in test
export const isTest = env.NODE_ENV === 'test'

// Log environment status (only in development)
if (isDevelopment) {
  console.log('🔧 Environment loaded successfully:')
  console.log(`  - NODE_ENV: ${env.NODE_ENV}`)
  console.log(`  - HOST: ${env.HOST}`)
  console.log(`  - PORT: ${env.PORT}`)
  console.log(`  - STORAGE_PROVIDER: ${env.STORAGE_PROVIDER}`)
  if (env.STORAGE_PROVIDER === 's3') {
    console.log(`  - AWS_REGION: ${env.AWS_REGION || 'not-set'}`)
    console.log(`  - S3_BUCKET_NAME: ${env.S3_BUCKET_NAME || 'not-set'}`)
  } else {
    console.log(`  - LOCAL_UPLOAD_DIR: ${env.LOCAL_UPLOAD_DIR}`)
  }
}
