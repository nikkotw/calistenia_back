import {
  DifficultyLevel,
  SubscriptionLevel,
  SubmissionStatus,
} from '@prisma/client'

// Challenge related types
export interface ChallengeResponse {
  id: string
  name: string
  description: string
  instructions: string
  difficulty: DifficultyLevel
  duration?: number // in days
  maxScore: number
  thumbnailUrl?: string
  requiredLevel: SubscriptionLevel
  isActive: boolean
  allowMultipleSubmissions: boolean
  submissionDeadline?: Date
  createdAt: Date
  updatedAt: Date

  // Additional info for users
  userSubmission?: ChallengeSubmissionResponse
  totalSubmissions?: number
  averageScore?: number
}

export interface CreateChallengeRequest {
  name: string
  description: string
  instructions: string
  difficulty: DifficultyLevel
  duration?: number
  maxScore?: number
  thumbnailUrl?: string
  requiredLevel?: SubscriptionLevel
  allowMultipleSubmissions?: boolean
  submissionDeadline?: Date
}

export interface UpdateChallengeRequest {
  name?: string
  description?: string
  instructions?: string
  difficulty?: DifficultyLevel
  duration?: number
  maxScore?: number
  thumbnailUrl?: string
  requiredLevel?: SubscriptionLevel
  isActive?: boolean
  allowMultipleSubmissions?: boolean
  submissionDeadline?: Date
}

export interface ChallengeSubmissionResponse {
  id: string
  userId: string
  challengeId: string
  videoUrl: string
  description?: string
  status: SubmissionStatus
  score?: number
  feedback?: string
  reviewedBy?: string
  reviewedAt?: Date
  createdAt: Date
  updatedAt: Date

  // Additional user info
  user?: {
    id: string
    name: string
    profileImage?: string
  }

  // Challenge info
  challenge?: {
    id: string
    name: string
    maxScore: number
  }
}

export interface CreateSubmissionRequest {
  videoUrl: string
  description?: string
}

export interface ReviewSubmissionRequest {
  score: number // 0 to challenge.maxScore
  feedback?: string
  status: 'APPROVED' | 'REJECTED'
}

export interface ChallengeFilters {
  difficulty?: DifficultyLevel
  requiredLevel?: SubscriptionLevel
  isActive?: boolean
  hasDeadline?: boolean
  allowMultipleSubmissions?: boolean
}

export interface ChallengeQueryParams extends ChallengeFilters {
  page?: number
  limit?: number
  search?: string
  sortBy?: 'name' | 'difficulty' | 'createdAt' | 'submissionDeadline'
  sortOrder?: 'asc' | 'desc'
  includeSubmission?: boolean // Include user's submission if exists
}

export interface SubmissionFilters {
  status?: SubmissionStatus
  challengeId?: string
  userId?: string
  reviewedBy?: string
  minScore?: number
  maxScore?: number
}

export interface SubmissionQueryParams extends SubmissionFilters {
  page?: number
  limit?: number
  sortBy?: 'createdAt' | 'score' | 'reviewedAt'
  sortOrder?: 'asc' | 'desc'
}

// Challenge statistics
export interface ChallengeStats {
  id: string
  name: string
  totalSubmissions: number
  pendingSubmissions: number
  approvedSubmissions: number
  rejectedSubmissions: number
  averageScore: number
  highestScore: number
  submissionRate: number // percentage of users who submitted
  completionRate: number // percentage of approved submissions
}

export interface UserChallengeStats {
  totalSubmissions: number
  approvedSubmissions: number
  rejectedSubmissions: number
  pendingSubmissions: number
  averageScore: number
  highestScore: number
  totalChallengesParticipated: number
  successRate: number // percentage of approved submissions
  lastSubmissionDate?: Date
  favoriteChallengeDifficulty?: DifficultyLevel
}

// Leaderboard
export interface LeaderboardEntry {
  rank: number
  user: {
    id: string
    name: string
    profileImage?: string
  }
  score: number
  submissionDate: Date
  isCurrentUser?: boolean
}

export interface ChallengeLeaderboard {
  challengeId: string
  challengeName: string
  entries: LeaderboardEntry[]
  userRank?: number
  totalParticipants: number
}

// Global leaderboard
export interface GlobalLeaderboardEntry {
  rank: number
  user: {
    id: string
    name: string
    profileImage?: string
  }
  totalScore: number
  totalSubmissions: number
  averageScore: number
  badges: string[] // Achievement badges
  isCurrentUser?: boolean
}
