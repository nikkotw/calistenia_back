import { DifficultyLevel, RoutineType, SubscriptionLevel } from '@prisma/client'

// Routine related types
export interface RoutineResponse {
  id: string
  name: string
  description: string
  level: DifficultyLevel
  type: RoutineType
  duration: number
  estimatedCalories?: number
  thumbnailUrl?: string
  videoPreviewUrl?: string
  requiredLevel: SubscriptionLevel
  tags: string[]
  equipment: string[]
  isPublished: boolean
  createdAt: Date
  updatedAt: Date
  creator?: {
    id: string
    name: string
  }
  totalSteps?: number
  userProgress?: RoutineProgressInfo
}

export interface RoutineDetailResponse extends RoutineResponse {
  steps: RoutineStepResponse[]
}

export interface RoutineStepResponse {
  id: string
  stepNumber: number
  name: string
  description?: string
  reps?: number
  sets?: number
  duration?: number
  restTime?: number
  videoUrl?: string
  imageUrl?: string
  tips: string[]
}

export interface CreateRoutineRequest {
  name: string
  description: string
  level: DifficultyLevel
  type: RoutineType
  duration: number
  estimatedCalories?: number
  thumbnailUrl?: string
  videoPreviewUrl?: string
  requiredLevel?: SubscriptionLevel
  tags?: string[]
  equipment?: string[]
  steps: CreateRoutineStepRequest[]
}

export interface CreateRoutineStepRequest {
  stepNumber: number
  name: string
  description?: string
  reps?: number
  sets?: number
  duration?: number
  restTime?: number
  videoUrl?: string
  imageUrl?: string
  tips?: string[]
}

export interface UpdateRoutineRequest {
  name?: string
  description?: string
  level?: DifficultyLevel
  type?: RoutineType
  duration?: number
  estimatedCalories?: number
  thumbnailUrl?: string
  videoPreviewUrl?: string
  requiredLevel?: SubscriptionLevel
  tags?: string[]
  equipment?: string[]
  isPublished?: boolean
}

export interface RoutineProgressInfo {
  id: string
  completedSteps: number
  totalSteps: number
  completionRate: number
  timeSpent?: number
  caloriesBurned?: number
  difficulty?: number
  satisfaction?: number
  isCompleted: boolean
  lastCompletedStep?: number
  completedAt?: Date
  createdAt: Date
  updatedAt: Date
}

export interface CompleteRoutineRequest {
  timeSpent?: number
  caloriesBurned?: number
  difficulty?: number // 1-5 scale
  satisfaction?: number // 1-5 scale
  completedSteps?: number
}

export interface RoutineFilters {
  type?: RoutineType
  level?: DifficultyLevel
  minDuration?: number
  maxDuration?: number
  requiredLevel?: SubscriptionLevel
  tags?: string[]
  equipment?: string[]
  creatorId?: string
}

export interface RoutineQueryParams extends RoutineFilters {
  page?: number
  limit?: number
  search?: string
  sortBy?: 'name' | 'duration' | 'level' | 'createdAt' | 'type'
  sortOrder?: 'asc' | 'desc'
  includeProgress?: boolean
}

// Progress tracking
export interface UserProgressStats {
  totalRoutinesCompleted: number
  totalTimeSpent: number // in minutes
  totalCaloriesBurned: number
  averageDifficulty: number
  averageSatisfaction: number
  streakDays: number
  lastWorkoutDate?: Date
  favoriteRoutineType?: RoutineType
  progressByType: {
    [key in RoutineType]?: {
      count: number
      totalTime: number
      avgDifficulty: number
    }
  }
}

export interface WeeklyProgress {
  week: string // YYYY-WW format
  routinesCompleted: number
  totalTime: number
  caloriesBurned: number
}

export interface RoutineRecommendation {
  routine: RoutineResponse
  score: number // 0-100 recommendation score
  reasons: string[] // Why this routine is recommended
}
