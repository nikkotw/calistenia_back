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
  RoutineDayResponse,
  CreateRoutineRequest,
  CreateRoutineDayRequest,
  UpdateRoutineDayRequest,
  UpdateRoutineRequest,
  CompleteRoutineRequest,
  RoutineQueryParams,
  UserProgressStats,
  RoutineRecommendation,
  RoutineProgressInfo,
  RoutineStepResponse,
  CreateRoutineStepRequest,
} from '../types/routine.js'

export class RoutineService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Get routines with filtering and pagination
   */
  async getRoutines(
    userId: string | undefined,
    params: RoutineQueryParams = {},
  ): Promise<{ routines: RoutineResponse[]; total: number }> {
    try {
      // Get user's subscription level
      const userSubscription = userId
        ? await this.getUserSubscriptionLevel(userId)
        : SubscriptionLevel.FREE

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
      const accessibleLevels = this.getAccessibleLevels(userSubscription)

      // Get ONE_TIME purchased routine IDs for the user
      let purchasedRoutineIds: string[] = []
      if (userId) {
        const purchases = await this.prisma.userPurchase.findMany({
          where: { userId, itemType: 'ROUTINE' },
          select: { itemId: true },
        })
        purchasedRoutineIds = purchases.map((p) => p.itemId)
      }

      const accessFilter: Prisma.RoutineWhereInput[] = [
        { accessType: 'FREE' },
        { accessType: 'SUBSCRIPTION', requiredLevel: { in: accessibleLevels } },
      ]
      if (purchasedRoutineIds.length > 0) {
        accessFilter.push({ accessType: 'ONE_TIME', id: { in: purchasedRoutineIds } })
      }

      const where: Prisma.RoutineWhereInput = {
        isPublished: true,
        OR: accessFilter,
        ...(search && {
          AND: [{ OR: [{ name: { contains: search } }, { description: { contains: search } }] }],
        }),
        ...(type && { type }),
        ...(level && { level }),
        ...(minDuration && { duration: { gte: minDuration } }),
        ...(maxDuration && { duration: { lte: maxDuration } }),
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
          days: {
            include: {
              steps: {
                select: { id: true },
              },
            },
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
          days: {
            orderBy: { dayNumber: 'asc' as const },
            include: {
              steps: {
                orderBy: { stepNumber: 'asc' as const },
              },
            },
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
        if (routine.accessType === 'FREE') {
          // always accessible
        } else if (routine.accessType === 'SUBSCRIPTION') {
          const userSubscription = await this.getUserSubscriptionLevel(userId)
          const accessibleLevels = this.getAccessibleLevels(userSubscription)
          if (!accessibleLevels.includes(routine.requiredLevel)) {
            throw new Error('Subscription level required to access this routine')
          }
        } else if (routine.accessType === 'ONE_TIME') {
          const purchase = await this.prisma.userPurchase.findFirst({
            where: { userId, itemId: routine.id, itemType: 'ROUTINE' },
          })
          if (!purchase) {
            throw new Error('Purchase required to access this routine')
          }
        }
      }

      return {
        ...this.formatRoutineResponse(routine, !!userId),
        days: routine.days.map((day: any) => ({
          id: day.id,
          dayNumber: day.dayNumber,
          name: day.name,
          description: day.description || undefined,
          steps: day.steps.map((step: any) => ({
            id: step.id,
            stepNumber: step.stepNumber,
            name: step.name,
            description: step.description || undefined,
            reps: step.reps || undefined,
            sets: step.sets || undefined,
            duration: step.duration || undefined,
            restTime: step.restTime || undefined,
            videoUrl: step.videoUrl || undefined,
            imageUrl: step.imageUrl || undefined,
            tips: step.tips as string[],
          })),
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
          days: {
            create: (data.days || []).map((day) => ({
              dayNumber: day.dayNumber,
              name: day.name,
              description: day.description,
              steps: {
                create: (day.steps || []).map((step) => ({
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
            })),
          },
        },
        include: {
          creator: {
            select: { id: true, name: true },
          },
          days: {
            include: { steps: { select: { id: true } } },
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
      // 1. Update routine metadata
      await this.prisma.routine.update({
        where: { id: routineId },
        data: {
          ...(data.name !== undefined && { name: data.name }),
          ...(data.description !== undefined && { description: data.description }),
          ...(data.level !== undefined && { level: data.level }),
          ...(data.type !== undefined && { type: data.type }),
          ...(data.duration !== undefined && { duration: data.duration }),
          ...(data.estimatedCalories !== undefined && { estimatedCalories: data.estimatedCalories }),
          ...(data.thumbnailUrl !== undefined && { thumbnailUrl: data.thumbnailUrl || null }),
          ...(data.videoPreviewUrl !== undefined && { videoPreviewUrl: data.videoPreviewUrl || null }),
          ...(data.requiredLevel !== undefined && { requiredLevel: data.requiredLevel }),
          ...(data.tags !== undefined && { tags: data.tags }),
          ...(data.equipment !== undefined && { equipment: data.equipment }),
          ...(data.isPublished !== undefined && { isPublished: data.isPublished }),
          ...((data as any).accessType !== undefined && { accessType: (data as any).accessType }),
          ...((data as any).price !== undefined && { price: (data as any).price ?? null }),
          updatedAt: new Date(),
        },
      })

      // 2. If days provided: delete all existing days (cascade deletes steps) then recreate
      if (Array.isArray((data as any).days)) {
        await this.prisma.routineDay.deleteMany({ where: { routineId } })

        for (const day of (data as any).days) {
          await this.prisma.routineDay.create({
            data: {
              routineId,
              dayNumber: day.dayNumber,
              name: day.name || `Día ${day.dayNumber}`,
              description: day.description || null,
              steps: {
                create: (day.steps ?? []).map((step: any) => ({
                  stepNumber: step.stepNumber,
                  name: step.name,
                  description: step.description || null,
                  sets: step.sets || null,
                  reps: step.reps || null,
                  duration: step.duration || null,
                  restTime: step.restTime || null,
                  videoUrl: step.videoUrl || null,
                  imageUrl: step.imageUrl || null,
                  tips: step.tips ?? [],
                })),
              },
            },
          })
        }
      }

      // 3. Return full updated routine
      const routine = await this.prisma.routine.findUnique({
        where: { id: routineId },
        include: {
          creator: { select: { id: true, name: true } },
          days: {
            orderBy: { dayNumber: 'asc' as const },
            include: { steps: { orderBy: { stepNumber: 'asc' as const } } },
          },
        },
      })

      return this.formatRoutineResponse(routine!)
    } catch (error) {
      throw new Error(
        `Failed to update routine: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
        include: { days: { include: { steps: true } } },
      })

      if (!routine) {
        throw new Error('Routine not found')
      }

      const totalSteps = routine.days.reduce(
        (sum: number, day: any) => sum + day.steps.length,
        0,
      )
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
    // Get ALL active subscriptions — user may have multiple plans
    const subscriptions = await this.prisma.userSubscription.findMany({
      where: {
        userId,
        isActive: true,
        OR: [{ endDate: null }, { endDate: { gt: new Date() } }],
      },
      include: { plan: true },
    })

    if (subscriptions.length === 0) return SubscriptionLevel.FREE

    // Return the highest level among all active subscriptions
    const levelOrder = [
      SubscriptionLevel.FREE,
      SubscriptionLevel.BASIC,
      SubscriptionLevel.PREMIUM,
      SubscriptionLevel.VIP,
    ]
    return subscriptions.reduce<SubscriptionLevel>((highest, sub) => {
      const subIdx = levelOrder.indexOf(sub.plan.level as SubscriptionLevel)
      const highIdx = levelOrder.indexOf(highest)
      return subIdx > highIdx ? sub.plan.level as SubscriptionLevel : highest
    }, SubscriptionLevel.FREE)
  }

  /**
   * Get accessible subscription levels based on user's level
   */
  private getAccessibleLevels(
    userLevel: SubscriptionLevel,
  ): SubscriptionLevel[] {
    const levels: SubscriptionLevel[] = [SubscriptionLevel.FREE]

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
      accessType: routine.accessType,
      price: routine.price ?? undefined,
      tags: routine.tags,
      equipment: routine.equipment,
      isPublished: routine.isPublished,
      createdAt: routine.createdAt,
      updatedAt: routine.updatedAt,
      creator: routine.creator,
      totalSteps: routine.days?.reduce(
        (sum: number, d: any) => sum + (d.steps?.length || 0),
        0,
      ) || 0,
      totalDays: routine.days?.length || 0,
      ...(includeProgress &&
        routine.userProgress?.[0] && {
          userProgress: routine.userProgress[0],
        }),
    }
  }

  /**
   * Delete a routine (admin only)
   */
  async deleteRoutine(routineId: string): Promise<void> {
    const exists = await this.prisma.routine.findUnique({ where: { id: routineId } })
    if (!exists) throw new Error('Routine not found')
    await this.prisma.routine.delete({ where: { id: routineId } })
  }

  /**
   * Create a day within a routine (trainer/admin)
   */
  async createDay(
    routineId: string,
    data: CreateRoutineDayRequest,
  ): Promise<RoutineDayResponse> {
    const day = await this.prisma.routineDay.create({
      data: {
        routineId,
        dayNumber: data.dayNumber,
        name: data.name,
        description: data.description,
        steps: {
          create: (data.steps || []).map((step) => ({
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
      include: { steps: { orderBy: { stepNumber: 'asc' as const } } },
    })
    return this.formatDayResponse(day)
  }

  /**
   * Update a routine day (trainer/admin)
   */
  async updateDay(
    dayId: string,
    data: UpdateRoutineDayRequest,
  ): Promise<RoutineDayResponse> {
    const day = await this.prisma.routineDay.update({
      where: { id: dayId },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        updatedAt: new Date(),
      },
      include: { steps: { orderBy: { stepNumber: 'asc' as const } } },
    })
    return this.formatDayResponse(day)
  }

  /**
   * Delete a routine day (admin)
   */
  async deleteDay(dayId: string): Promise<void> {
    await this.prisma.routineDay.delete({ where: { id: dayId } })
  }

  /**
   * Create a step within a day (trainer/admin)
   */
  async createStep(
    dayId: string,
    data: CreateRoutineStepRequest,
  ): Promise<RoutineStepResponse> {
    const step = await this.prisma.routineStep.create({
      data: {
        dayId,
        stepNumber: data.stepNumber,
        name: data.name,
        description: data.description,
        reps: data.reps,
        sets: data.sets,
        duration: data.duration,
        restTime: data.restTime,
        videoUrl: data.videoUrl,
        imageUrl: data.imageUrl,
        tips: data.tips || [],
      },
    })
    return this.formatStepResponse(step)
  }

  /**
   * Update a step (trainer/admin)
   */
  async updateStep(
    stepId: string,
    data: Partial<CreateRoutineStepRequest>,
  ): Promise<RoutineStepResponse> {
    const step = await this.prisma.routineStep.update({
      where: { id: stepId },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.reps !== undefined && { reps: data.reps }),
        ...(data.sets !== undefined && { sets: data.sets }),
        ...(data.duration !== undefined && { duration: data.duration }),
        ...(data.restTime !== undefined && { restTime: data.restTime }),
        ...(data.videoUrl !== undefined && { videoUrl: data.videoUrl }),
        ...(data.imageUrl !== undefined && { imageUrl: data.imageUrl }),
        ...(data.tips !== undefined && { tips: data.tips }),
        updatedAt: new Date(),
      },
    })
    return this.formatStepResponse(step)
  }

  /**
   * Delete a step (admin)
   */
  async deleteStep(stepId: string): Promise<void> {
    await this.prisma.routineStep.delete({ where: { id: stepId } })
  }

  /**
   * Format a day for API response
   */
  private formatDayResponse(day: any): RoutineDayResponse {
    return {
      id: day.id,
      dayNumber: day.dayNumber,
      name: day.name,
      description: day.description || undefined,
      steps: (day.steps || []).map((s: any) => this.formatStepResponse(s)),
    }
  }

  /**
   * Format a step for API response
   */
  private formatStepResponse(step: any): RoutineStepResponse {
    return {
      id: step.id,
      stepNumber: step.stepNumber,
      name: step.name,
      description: step.description || undefined,
      reps: step.reps || undefined,
      sets: step.sets || undefined,
      duration: step.duration || undefined,
      restTime: step.restTime || undefined,
      videoUrl: step.videoUrl || undefined,
      imageUrl: step.imageUrl || undefined,
      tips: step.tips as string[],
    }
  }
}
