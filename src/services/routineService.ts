import {
  PrismaClient,
  SubscriptionLevel,
  DifficultyLevel,
  RoutineType,
  Prisma,
} from '@prisma/client'
import {
  RoutineResponse,
  RoutineDetailResponse,
  CreateRoutineRequest,
  UpdateRoutineRequest,
  CompleteRoutineRequest,
  RoutineQueryParams,
  UserProgressStats,
  RoutineRecommendation,
  RoutineProgressInfo,
} from '../types/routine.js'

export class RoutineService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Get routines with filtering and pagination
   */
  async getRoutines(
    userId: string,
    params: RoutineQueryParams = {},
  ): Promise<{ routines: RoutineResponse[]; total: number }> {
    try {
      // Get user's subscription level
      const userSubscription = await this.getUserSubscriptionLevel(userId)

      const {
        page = 1,
        limit = 10,
        search,
        type,
        level,
        minDuration,
        maxDuration,
        tags,
        equipment,
        sortBy = 'createdAt',
        sortOrder = 'desc',
        includeProgress = false,
      } = params

      // Build where clause
      const where: Prisma.RoutineWhereInput = {
        isPublished: true,
        requiredLevel: {
          in: this.getAccessibleLevels(userSubscription),
        },
        ...(search && {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } },
            { tags: { hasSome: [search] } },
          ],
        }),
        ...(type && { type }),
        ...(level && { level }),
        ...(minDuration && { duration: { gte: minDuration } }),
        ...(maxDuration && { duration: { lte: maxDuration } }),
        ...(tags &&
          tags.length > 0 && {
            tags: { hasSome: tags },
          }),
        ...(equipment &&
          equipment.length > 0 && {
            equipment: { hasSome: equipment },
          }),
      }

      // Count total results
      const total = await this.prisma.routine.count({ where })

      // Get routines
      const routines = await this.prisma.routine.findMany({
        where,
        include: {
          creator: {
            select: { id: true, name: true },
          },
          steps: {
            select: { id: true },
          },
          ...(includeProgress && {
            userProgress: {
              where: { userId },
              select: {
                id: true,
                completedSteps: true,
                totalSteps: true,
                completionRate: true,
                isCompleted: true,
                lastCompletedStep: true,
                completedAt: true,
                createdAt: true,
                updatedAt: true,
              },
            },
          }),
        },
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      })

      return {
        routines: routines.map((routine) =>
          this.formatRoutineResponse(routine, includeProgress),
        ),
        total,
      }
    } catch (error) {
      throw new Error(
        `Failed to get routines: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      )
    }
  }

  /**
   * Get routine detail by ID
   */
  async getRoutineDetail(
    routineId: string,
    userId?: string,
  ): Promise<RoutineDetailResponse> {
    try {
      const routine = await this.prisma.routine.findUnique({
        where: { id: routineId },
        include: {
          creator: {
            select: { id: true, name: true },
          },
          steps: {
            orderBy: { stepNumber: 'asc' },
          },
          ...(userId && {
            userProgress: {
              where: { userId },
              select: {
                id: true,
                completedSteps: true,
                totalSteps: true,
                completionRate: true,
                timeSpent: true,
                caloriesBurned: true,
                difficulty: true,
                satisfaction: true,
                isCompleted: true,
                lastCompletedStep: true,
                completedAt: true,
                createdAt: true,
                updatedAt: true,
              },
            },
          }),
        },
      })

      if (!routine) {
        throw new Error('Routine not found')
      }

      if (!routine.isPublished) {
        throw new Error('Routine is not published')
      }

      // Check if user has access to this routine
      if (userId) {
        const userSubscription = await this.getUserSubscriptionLevel(userId)
        const accessibleLevels = this.getAccessibleLevels(userSubscription)

        if (!accessibleLevels.includes(routine.requiredLevel)) {
          throw new Error('Subscription level required to access this routine')
        }
      }

      return {
        ...this.formatRoutineResponse(routine, !!userId),
        steps: routine.steps.map((step) => ({
          id: step.id,
          stepNumber: step.stepNumber,
          name: step.name,
          description: step.description,
          reps: step.reps,
          sets: step.sets,
          duration: step.duration,
          restTime: step.restTime,
          videoUrl: step.videoUrl,
          imageUrl: step.imageUrl,
          tips: step.tips,
        })),
      }
    } catch (error) {
      if (error instanceof Error) {
        throw error
      }
      throw new Error('Failed to get routine detail')
    }
  }

  /**
   * Create new routine (admin/trainer only)
   */
  async createRoutine(
    data: CreateRoutineRequest,
    creatorId: string,
  ): Promise<RoutineResponse> {
    try {
      const routine = await this.prisma.routine.create({
        data: {
          name: data.name,
          description: data.description,
          level: data.level,
          type: data.type,
          duration: data.duration,
          estimatedCalories: data.estimatedCalories,
          thumbnailUrl: data.thumbnailUrl,
          videoPreviewUrl: data.videoPreviewUrl,
          requiredLevel: data.requiredLevel || SubscriptionLevel.FREE,
          tags: data.tags || [],
          equipment: data.equipment || [],
          creatorId,
          steps: {
            create: data.steps.map((step) => ({
              stepNumber: step.stepNumber,
              name: step.name,
              description: step.description,
              reps: step.reps,
              sets: step.sets,
              duration: step.duration,
              restTime: step.restTime,
              videoUrl: step.videoUrl,
              imageUrl: step.imageUrl,
              tips: step.tips || [],
            })),
          },
        },
        include: {
          creator: {
            select: { id: true, name: true },
          },
          steps: {
            select: { id: true },
          },
        },
      })

      return this.formatRoutineResponse(routine)
    } catch (error) {
      throw new Error(
        `Failed to create routine: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      )
    }
  }

  /**
   * Update routine
   */
  async updateRoutine(
    routineId: string,
    data: UpdateRoutineRequest,
  ): Promise<RoutineResponse> {
    try {
      const routine = await this.prisma.routine.update({
        where: { id: routineId },
        data: {
          ...(data.name && { name: data.name }),
          ...(data.description && { description: data.description }),
          ...(data.level && { level: data.level }),
          ...(data.type && { type: data.type }),
          ...(data.duration && { duration: data.duration }),
          ...(data.estimatedCalories !== undefined && {
            estimatedCalories: data.estimatedCalories,
          }),
          ...(data.thumbnailUrl && { thumbnailUrl: data.thumbnailUrl }),
          ...(data.videoPreviewUrl && {
            videoPreviewUrl: data.videoPreviewUrl,
          }),
          ...(data.requiredLevel && { requiredLevel: data.requiredLevel }),
          ...(data.tags && { tags: data.tags }),
          ...(data.equipment && { equipment: data.equipment }),
          ...(data.isPublished !== undefined && {
            isPublished: data.isPublished,
          }),
          updatedAt: new Date(),
        },
        include: {
          creator: {
            select: { id: true, name: true },
          },
          steps: {
            select: { id: true },
          },
        },
      })

      return this.formatRoutineResponse(routine)
    } catch (error) {
      throw new Error(
        `Failed to update routine: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      )
    }
  }

  /**
   * Complete routine (mark as completed and update progress)
   */
  async completeRoutine(
    userId: string,
    routineId: string,
    data: CompleteRoutineRequest = {},
  ): Promise<RoutineProgressInfo> {
    try {
      // Get routine details
      const routine = await this.prisma.routine.findUnique({
        where: { id: routineId },
        include: { steps: true },
      })

      if (!routine) {
        throw new Error('Routine not found')
      }

      const totalSteps = routine.steps.length
      const completedSteps = data.completedSteps || totalSteps

      // Upsert progress record
      const progress = await this.prisma.routineProgress.upsert({
        where: {
          userId_routineId: {
            userId,
            routineId,
          },
        },
        update: {
          completedSteps,
          totalSteps,
          completionRate: (completedSteps / totalSteps) * 100,
          timeSpent: data.timeSpent,
          caloriesBurned: data.caloriesBurned,
          difficulty: data.difficulty,
          satisfaction: data.satisfaction,
          isCompleted: completedSteps >= totalSteps,
          lastCompletedStep: completedSteps,
          completedAt: completedSteps >= totalSteps ? new Date() : undefined,
          updatedAt: new Date(),
        },
        create: {
          userId,
          routineId,
          completedSteps,
          totalSteps,
          completionRate: (completedSteps / totalSteps) * 100,
          timeSpent: data.timeSpent,
          caloriesBurned: data.caloriesBurned,
          difficulty: data.difficulty,
          satisfaction: data.satisfaction,
          isCompleted: completedSteps >= totalSteps,
          lastCompletedStep: completedSteps,
          completedAt: completedSteps >= totalSteps ? new Date() : undefined,
        },
      })

      return {
        id: progress.id,
        completedSteps: progress.completedSteps,
        totalSteps: progress.totalSteps,
        completionRate: progress.completionRate,
        timeSpent: progress.timeSpent,
        caloriesBurned: progress.caloriesBurned,
        difficulty: progress.difficulty,
        satisfaction: progress.satisfaction,
        isCompleted: progress.isCompleted,
        lastCompletedStep: progress.lastCompletedStep,
        completedAt: progress.completedAt,
        createdAt: progress.createdAt,
        updatedAt: progress.updatedAt,
      }
    } catch (error) {
      if (error instanceof Error) {
        throw error
      }
      throw new Error('Failed to complete routine')
    }
  }

  /**
   * Get user progress statistics
   */
  async getUserProgressStats(userId: string): Promise<UserProgressStats> {
    try {
      const progressRecords = await this.prisma.routineProgress.findMany({
        where: { userId, isCompleted: true },
        include: {
          routine: {
            select: { type: true },
          },
        },
      })

      const totalRoutinesCompleted = progressRecords.length
      const totalTimeSpent = progressRecords.reduce(
        (sum, p) => sum + (p.timeSpent || 0),
        0,
      )
      const totalCaloriesBurned = progressRecords.reduce(
        (sum, p) => sum + (p.caloriesBurned || 0),
        0,
      )

      const avgDifficulty =
        progressRecords.length > 0
          ? progressRecords.reduce((sum, p) => sum + (p.difficulty || 0), 0) /
            progressRecords.length
          : 0

      const avgSatisfaction =
        progressRecords.length > 0
          ? progressRecords.reduce((sum, p) => sum + (p.satisfaction || 0), 0) /
            progressRecords.length
          : 0

      // Calculate progress by type
      const progressByType: {
        [key in RoutineType]?: {
          count: number
          totalTime: number
          avgDifficulty: number
        }
      } = {}

      progressRecords.forEach((p) => {
        const type = p.routine.type
        if (!progressByType[type]) {
          progressByType[type] = { count: 0, totalTime: 0, avgDifficulty: 0 }
        }
        progressByType[type].count++
        progressByType[type].totalTime += p.timeSpent || 0
        progressByType[type].avgDifficulty += p.difficulty || 0
      })

      // Calculate averages for each type
      Object.keys(progressByType).forEach((type) => {
        const typeKey = type as RoutineType
        if (progressByType[typeKey]) {
          progressByType[typeKey]!.avgDifficulty /= progressByType[
            typeKey
          ]!.count
        }
      })

      return {
        totalRoutinesCompleted,
        totalTimeSpent,
        totalCaloriesBurned,
        averageDifficulty: avgDifficulty,
        averageSatisfaction: avgSatisfaction,
        streakDays: 0, // TODO: Implement streak calculation
        lastWorkoutDate: progressRecords[0]?.completedAt,
        progressByType,
      }
    } catch (error) {
      throw new Error(
        `Failed to get user progress stats: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      )
    }
  }

  /**
   * Get user's subscription level
   */
  private async getUserSubscriptionLevel(
    userId: string,
  ): Promise<SubscriptionLevel> {
    const subscription = await this.prisma.userSubscription.findFirst({
      where: {
        userId,
        isActive: true,
        OR: [{ endDate: null }, { endDate: { gt: new Date() } }],
      },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    })

    return subscription?.plan.level || SubscriptionLevel.FREE
  }

  /**
   * Get accessible subscription levels based on user's level
   */
  private getAccessibleLevels(
    userLevel: SubscriptionLevel,
  ): SubscriptionLevel[] {
    const levels = [SubscriptionLevel.FREE]

    if (
      userLevel === SubscriptionLevel.BASIC ||
      userLevel === SubscriptionLevel.PREMIUM ||
      userLevel === SubscriptionLevel.VIP
    ) {
      levels.push(SubscriptionLevel.BASIC)
    }

    if (
      userLevel === SubscriptionLevel.PREMIUM ||
      userLevel === SubscriptionLevel.VIP
    ) {
      levels.push(SubscriptionLevel.PREMIUM)
    }

    if (userLevel === SubscriptionLevel.VIP) {
      levels.push(SubscriptionLevel.VIP)
    }

    return levels
  }

  /**
   * Format routine for API response
   */
  private formatRoutineResponse(
    routine: any,
    includeProgress: boolean = false,
  ): RoutineResponse {
    return {
      id: routine.id,
      name: routine.name,
      description: routine.description,
      level: routine.level,
      type: routine.type,
      duration: routine.duration,
      estimatedCalories: routine.estimatedCalories,
      thumbnailUrl: routine.thumbnailUrl,
      videoPreviewUrl: routine.videoPreviewUrl,
      requiredLevel: routine.requiredLevel,
      tags: routine.tags,
      equipment: routine.equipment,
      isPublished: routine.isPublished,
      createdAt: routine.createdAt,
      updatedAt: routine.updatedAt,
      creator: routine.creator,
      totalSteps: routine.steps?.length || 0,
      ...(includeProgress &&
        routine.userProgress?.[0] && {
          userProgress: routine.userProgress[0],
        }),
    }
  }
}
