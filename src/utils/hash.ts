import bcrypt from 'bcryptjs'

// Password hashing utilities
export class HashUtil {
  private static readonly SALT_ROUNDS = 10

  /**
   * Hash a password using bcrypt
   */
  static async hashPassword(password: string): Promise<string> {
    try {
      // Validate password strength
      this.validatePassword(password)

      // Generate salt and hash password
      const salt = await bcrypt.genSalt(this.SALT_ROUNDS)
      const hashedPassword = await bcrypt.hash(password, salt)

      return hashedPassword
    } catch (error) {
      throw new Error(
        `Failed to hash password: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      )
    }
  }

  /**
   * Compare a plain password with a hashed password
   */
  static async comparePassword(
    plainPassword: string,
    hashedPassword: string,
  ): Promise<boolean> {
    try {
      return await bcrypt.compare(plainPassword, hashedPassword)
    } catch (error) {
      throw new Error(
        `Failed to compare password: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      )
    }
  }

  /**
   * Validate password strength
   */
  static validatePassword(password: string): void {
    if (!password) {
      throw new Error('Password is required')
    }

    if (password.length < 8) {
      throw new Error('Password must be at least 8 characters long')
    }

    if (password.length > 128) {
      throw new Error('Password must be less than 128 characters long')
    }

    // Check for at least one letter
    if (!/[a-zA-Z]/.test(password)) {
      throw new Error('Password must contain at least one letter')
    }

    // Check for at least one number
    if (!/\d/.test(password)) {
      throw new Error('Password must contain at least one number')
    }

    // Check for common weak passwords
    const weakPasswords = [
      'password',
      'password123',
      '123456789',
      'qwerty123',
      'admin123',
      'letmein',
      'welcome123',
      'password1',
    ]

    if (weakPasswords.includes(password.toLowerCase())) {
      throw new Error(
        'Password is too common, please choose a stronger password',
      )
    }
  }

  /**
   * Generate a random password
   */
  static generateRandomPassword(length: number = 12): string {
    const charset =
      'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*'
    let password = ''

    // Ensure at least one character from each category
    const lowercase = 'abcdefghijklmnopqrstuvwxyz'
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    const numbers = '0123456789'
    const special = '!@#$%^&*'

    password += lowercase[Math.floor(Math.random() * lowercase.length)]
    password += uppercase[Math.floor(Math.random() * uppercase.length)]
    password += numbers[Math.floor(Math.random() * numbers.length)]
    password += special[Math.floor(Math.random() * special.length)]

    // Fill the rest randomly
    for (let i = 4; i < length; i++) {
      password += charset[Math.floor(Math.random() * charset.length)]
    }

    // Shuffle the password
    return password
      .split('')
      .sort(() => Math.random() - 0.5)
      .join('')
  }

  /**
   * Calculate password strength score (0-100)
   */
  static calculatePasswordStrength(
    password: string,
  ): {
    score: number
    level: 'Very Weak' | 'Weak' | 'Fair' | 'Good' | 'Strong'
    feedback: string[]
  } {
    let score = 0
    const feedback: string[] = []

    // Length scoring
    if (password.length >= 8) score += 20
    else feedback.push('Use at least 8 characters')

    if (password.length >= 12) score += 10
    else feedback.push('Consider using 12+ characters for better security')

    // Character variety scoring
    if (/[a-z]/.test(password)) score += 10
    else feedback.push('Include lowercase letters')

    if (/[A-Z]/.test(password)) score += 10
    else feedback.push('Include uppercase letters')

    if (/\d/.test(password)) score += 10
    else feedback.push('Include numbers')

    if (/[^a-zA-Z0-9]/.test(password)) score += 15
    else feedback.push('Include special characters (!@#$%^&*)')

    // Pattern complexity
    if (!/(.)\1{2,}/.test(password)) score += 10
    // No repeated characters
    else feedback.push('Avoid repeated characters')

    if (!/^(.+)\1+$/.test(password)) score += 10
    // No repeated patterns
    else feedback.push('Avoid repeated patterns')

    // Common password check
    const commonPasswords = ['password', '123456', 'qwerty', 'admin']
    const isCommon = commonPasswords.some((common) =>
      password.toLowerCase().includes(common),
    )

    if (!isCommon) score += 15
    else feedback.push('Avoid common words like "password" or "123456"')

    // Determine level
    let level: 'Very Weak' | 'Weak' | 'Fair' | 'Good' | 'Strong'
    if (score < 30) level = 'Very Weak'
    else if (score < 50) level = 'Weak'
    else if (score < 70) level = 'Fair'
    else if (score < 90) level = 'Good'
    else level = 'Strong'

    return { score, level, feedback }
  }

  /**
   * Hash any string (not just passwords)
   */
  static async hashString(input: string, rounds: number = 10): Promise<string> {
    try {
      const salt = await bcrypt.genSalt(rounds)
      return await bcrypt.hash(input, salt)
    } catch (error) {
      throw new Error(
        `Failed to hash string: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      )
    }
  }
}
