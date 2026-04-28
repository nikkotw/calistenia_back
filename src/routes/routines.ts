import { FastifyInstance, FastifyPluginOptions, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { RoutineService } from '../services/routineService.js'
import {
  authenticateJWT,
  requireTrainerOrAdmin,
  requireAdmin,
  optionalAuth,
} from '../middleware/auth.js'

// ── Shared validation schemas ─────────────────────────────────────────────────

const stepSchema = z.object({
  stepNumber: z.number().int().positive(),
  name: z.string().min(2),
  description: z.string().optional(),
  reps: z.number().int().positive().optional(),
  sets: z.number().int().positive().optional(),
  duration: z.number().int().positive().optional(),
  restTime: z.number().int().positive().optional(),
  videoUrl: z.string().url().optional().or(z.literal('')),
  imageUrl: z.string().url().optional().or(z.literal('')),
  tips: z.array(z.string()).optional(),
})

const daySchema = z.object({
  dayNumber: z.number().int().positive(),
  name: z.string().min(2),
  description: z.string().optional(),
  steps: z.array(stepSchema).optional(),
})

const routineCreateSchema = z.object({
  name: z.string().min(2).max(200),
  description: z.string().min(10),
  level: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT']),
  type: z.enum(['STRENGTH', 'CARDIO', 'FLEXIBILITY', 'CALISTHENICS', 'HIIT', 'YOGA', 'PILATES']),
  duration: z.number().int().positive(),
  estimatedCalories: z.number().int().positive().optional(),
  thumbnailUrl: z.string().url().optional().or(z.literal('')),
  videoPreviewUrl: z.string().url().optional().or(z.literal('')),
  requiredLevel: z.enum(['FREE', 'BASIC', 'PREMIUM', 'VIP']).optional(),
  accessType: z.enum(['FREE', 'SUBSCRIPTION', 'ONE_TIME']).optional(),
  price: z.number().positive().optional().nullable(),
  isPublished: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  equipment: z.array(z.string()).optional(),
  days: z.array(daySchema).optional(),
})

const routineUpdateSchema = routineCreateSchema.extend({
  name: z.string().min(2).max(200).optional(),
  description: z.string().min(10).optional(),
  level: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT']).optional(),
  type: z.enum(['STRENGTH', 'CARDIO', 'FLEXIBILITY', 'CALISTHENICS', 'HIIT', 'YOGA', 'PILATES']).optional(),
  duration: z.number().int().positive().optional(),
})

// ── Route handler ─────────────────────────────────────────────────────────────

export async function routineRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
): Promise<void> {
  const routineService = new RoutineService(fastify.prisma)

  // ── GET / — list routines (optional auth, filtered by subscription) ─────────
  fastify.get(
    '/',
    { preHandler: [optionalAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const query = request.query as Record<string, any>
        const page = query.page ? parseInt(query.page) : 1
        const limit = Math.min(query.limit ? parseInt(query.limit) : 12, 50)

        const result = await routineService.getRoutines(request.user?.id, {
          page,
          limit,
          search: query.search,
          type: query.type,
          level: query.level,
          minDuration: query.minDuration ? parseInt(query.minDuration) : undefined,
          maxDuration: query.maxDuration ? parseInt(query.maxDuration) : undefined,
          sortBy: query.sortBy,
          sortOrder: query.sortOrder,
          includeProgress: query.includeProgress === 'true',
        })

        return reply.code(200).send({
          success: true,
          data: result.routines,
          pagination: {
            page,
            limit,
            total: result.total,
            totalPages: Math.ceil(result.total / limit),
            hasNext: page * limit < result.total,
            hasPrev: page > 1,
          },
        })
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error'
        return reply.code(500).send({ success: false, error: msg })
      }
    },
  )

  // ── GET /user/progress — user progress stats (auth required) ────────────────
  fastify.get(
    '/user/progress',
    { preHandler: [authenticateJWT] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const stats = await routineService.getUserProgressStats(request.user!.id)
        return reply.code(200).send({ success: true, data: stats })
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error'
        return reply.code(500).send({ success: false, error: msg })
      }
    },
  )

  // ── GET /:id — routine detail with days + steps ──────────────────────────────
  fastify.get(
    '/:id',
    { preHandler: [optionalAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string }
      try {
        const routine = await routineService.getRoutineDetail(id, request.user?.id)
        return reply.code(200).send({ success: true, data: routine })
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error'
        const status = msg.includes('not found') ? 404 : msg.includes('Subscription') ? 403 : 500
        return reply.code(status).send({ success: false, error: msg })
      }
    },
  )

  // ── POST / — create routine (trainer / admin) ───────────────────────────────
  fastify.post(
    '/',
    { preHandler: [authenticateJWT, requireTrainerOrAdmin] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const data = routineCreateSchema.parse(request.body)
        const routine = await routineService.createRoutine(data as any, request.user!.id)
        return reply.code(201).send({
          success: true,
          message: 'Rutina creada exitosamente',
          data: routine,
        })
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error'
        return reply.code(400).send({ success: false, error: msg })
      }
    },
  )

  // ── PUT /:id — update routine metadata (trainer / admin) ────────────────────
  fastify.put(
    '/:id',
    { preHandler: [authenticateJWT, requireTrainerOrAdmin] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string }
      try {
        const data = routineUpdateSchema.parse(request.body)
        const routine = await routineService.updateRoutine(id, data as any)
        return reply.code(200).send({ success: true, data: routine })
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error'
        return reply.code(400).send({ success: false, error: msg })
      }
    },
  )

  // ── DELETE /:id — delete routine (admin) ─────────────────────────────────────
  fastify.delete(
    '/:id',
    { preHandler: [authenticateJWT, requireAdmin] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string }
      try {
        await routineService.deleteRoutine(id)
        return reply.code(200).send({ success: true, message: 'Rutina eliminada' })
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error'
        const status = msg.includes('not found') ? 404 : 400
        return reply.code(status).send({ success: false, error: msg })
      }
    },
  )

  // ── POST /:id/complete — mark routine as complete (auth) ─────────────────────
  fastify.post(
    '/:id/complete',
    { preHandler: [authenticateJWT] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string }
      try {
        const progress = await routineService.completeRoutine(
          request.user!.id,
          id,
          (request.body as any) || {},
        )
        return reply.code(200).send({ success: true, data: progress })
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error'
        return reply.code(400).send({ success: false, error: msg })
      }
    },
  )

  // ── Days management ───────────────────────────────────────────────────────────

  // POST /:id/days — add a day to a routine (trainer/admin)
  fastify.post(
    '/:id/days',
    { preHandler: [authenticateJWT, requireTrainerOrAdmin] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string }
      try {
        const data = daySchema.parse(request.body) as import('../types/routine.js').CreateRoutineDayRequest
        const day = await routineService.createDay(id, data)
        return reply.code(201).send({ success: true, data: day })
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error'
        return reply.code(400).send({ success: false, error: msg })
      }
    },
  )

  // PUT /:id/days/:dayId — update a day (trainer/admin)
  fastify.put(
    '/:id/days/:dayId',
    { preHandler: [authenticateJWT, requireTrainerOrAdmin] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { dayId } = request.params as { id: string; dayId: string }
      try {
        const day = await routineService.updateDay(dayId, request.body as any)
        return reply.code(200).send({ success: true, data: day })
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error'
        return reply.code(400).send({ success: false, error: msg })
      }
    },
  )

  // DELETE /:id/days/:dayId — delete a day (admin)
  fastify.delete(
    '/:id/days/:dayId',
    { preHandler: [authenticateJWT, requireAdmin] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { dayId } = request.params as { id: string; dayId: string }
      try {
        await routineService.deleteDay(dayId)
        return reply.code(200).send({ success: true, message: 'Día eliminado' })
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error'
        return reply.code(400).send({ success: false, error: msg })
      }
    },
  )

  // ── Steps management ──────────────────────────────────────────────────────────

  // POST /:id/days/:dayId/steps — add a step to a day (trainer/admin)
  fastify.post(
    '/:id/days/:dayId/steps',
    { preHandler: [authenticateJWT, requireTrainerOrAdmin] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { dayId } = request.params as { id: string; dayId: string }
      try {
        const data = stepSchema.parse(request.body) as import('../types/routine.js').CreateRoutineStepRequest
        const step = await routineService.createStep(dayId, data)
        return reply.code(201).send({ success: true, data: step })
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error'
        return reply.code(400).send({ success: false, error: msg })
      }
    },
  )

  // PUT /:id/days/:dayId/steps/:stepId — update a step (trainer/admin)
  fastify.put(
    '/:id/days/:dayId/steps/:stepId',
    { preHandler: [authenticateJWT, requireTrainerOrAdmin] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { stepId } = request.params as { id: string; dayId: string; stepId: string }
      try {
        const step = await routineService.updateStep(stepId, request.body as any)
        return reply.code(200).send({ success: true, data: step })
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error'
        return reply.code(400).send({ success: false, error: msg })
      }
    },
  )

  // DELETE /:id/days/:dayId/steps/:stepId — delete a step (admin)
  fastify.delete(
    '/:id/days/:dayId/steps/:stepId',
    { preHandler: [authenticateJWT, requireAdmin] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { stepId } = request.params as { id: string; dayId: string; stepId: string }
      try {
        await routineService.deleteStep(stepId)
        return reply.code(200).send({ success: true, message: 'Ejercicio eliminado' })
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error'
        return reply.code(400).send({ success: false, error: msg })
      }
    },
  )
}

