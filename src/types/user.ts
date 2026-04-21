import { UserRole, SubscriptionLevel } from '@prisma/client'

// User related types
export interface CreateUserRequest {
  email: string
  password: string
  name: string
  phone?: string
}

export interface LoginRequest {
  email: string
  password: string
}

export interface LoginResponse {
  success: boolean
  user: UserProfile
  token: string
  subscription?: UserSubscriptionInfo
}

export interface UserProfile {
  id: string
  email: string
  name: string
  phone?: string
  profileImage?: string
  role: UserRole
  isActive: boolean
  createdAt: Date
}

export interface UserSubscriptionInfo {
  id: string
  planName: string
  level: SubscriptionLevel
  isActive: boolean
  startDate: Date
  endDate?: Date
  features: string[]
}

export interface UpdateUserRequest {
  name?: string
  phone?: string
  profileImage?: string
}

export interface ChangePasswordRequest {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

// JWT Payload
export interface JWTPayload {
  id: string
  email: string
  role: UserRole
  name: string
  iat?: number
  exp?: number
}

// Authentication responses
export interface AuthResponse {
  success: boolean
  message: string
  user?: UserProfile
  token?: string
}

export interface ApiResponse<T = any> {
  success: boolean
  message: string
  data?: T
  error?: string
  details?: any
}

// Pagination types
export interface PaginationQuery {
  page?: number
  limit?: number
  search?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface PaginatedResponse<T> {
  success: boolean
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}

// File upload types
export interface FileUploadRequest {
  filename: string
  contentType: string
  folder?: 'videos' | 'images' | 'profiles' | 'routines' | 'challenges'
}

export interface FileUploadResponse {
  success: boolean
  uploadUrl: string
  key: string
  publicUrl: string
  expiresIn: number
}
