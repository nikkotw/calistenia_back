import { FastifyInstance, FastifyPluginOptions, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import {
  authenticateJWT,
  requireAdmin,
  requireTrainerOrAdmin,
  optionalAuth,
} from '../middleware/auth.js'

const challengeSchema = z.object({
  name: z.string().min(2).max(200),
  description: z.string().min(10),
  instructions: z.string().min(10),
  difficulty: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT']),
  duration: z.number().int().positive().optional(),
  maxScore: z.number().int().positive().default(100),
  thumbnailUrl: z.string().url().optional().or(z.literal('')),
  requiredLevel: z.enum(['FREE', 'BASIC', 'PREMIUM', 'VIP']).default('FREE'),
  accessType: z.enum(['FREE', 'SUBSCRIPTION', 'ONE_TIME']).default('FREE'),
  price: z.number().positive().optional().nullable(),
  isActive: z.boolean().default(true),
  allowMultipleSubmissions: z.boolean().default(false),
  submissionDeadline: z.string().datetime().optional().nullable(),
})

export async function challengeRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
): Promise<void> {
  // ── GET / — list accessible challenges (optional auth) ────────────────────
  fastify.get(
    '/',
    { preHandler: [optionalAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const query = request.query as Record<string, any>
        const page = parseInt(query.page) || 1
        const limit = Math.min(parseInt(query.limit) || 12, 50)
        const skip = (page - 1) * limit

        // Determine accessible levels for subscribed user
        const userId = request.user?.id ?? null
        let accessibleLevels: string[] = ['FREE']
        let purchasedIds: string[] = []

        if (userId) {
          // Get active subscriptions
          const activeSubs = await fastify.prisma.userSubscription.findMany({
            where: { userId, isActive: true },
            include: { plan: { select: { level: true } } },
          })
          const userLevel = activeSubs.reduce((best, sub) => {
            const order = ['FREE', 'BASIC', 'PREMIUM', 'VIP']
            return order.indexOf(sub.plan.level) > order.indexOf(best) ? sub.plan.level : best
          }, 'FREE' as string)

          const levelOrder = ['FREE', 'BASIC', 'PREMIUM', 'VIP']
          const idx = levelOrder.indexOf(userLevel)
          accessibleLevels = levelOrder.slice(0, idx + 1)

          // Get one-time purchased challenges
          const purchases = await fastify.prisma.userPurchase.findMany({
            where: { userId, itemType: 'CHALLENGE' },
            select: { itemId: true },
          })
          purchasedIds = purchases.map(p => p.itemId)
        }

        const baseWhere: any = { isActive: true }
        if (query.difficulty) baseWhere.difficulty = query.difficulty
        if (query.search) {
          baseWhere.OR = [
            { name: { contains: query.search } },
            { description: { contains: query.search } },
          ]
        }

        // Build access filter
        const accessFilter: any[] = [
          { accessType: 'FREE' },
          {
            accessType: 'SUBSCRIPTION',
            requiredLevel: { in: accessibleLevels },
          },
        ]
        if (purchasedIds.length > 0) {
          accessFilter.push({ accessType: 'ONE_TIME', id: { in: purchasedIds } })
        }

        const where = { ...baseWhere, OR: accessFilter }

        const [challenges, total] = await Promise.all([
          fastify.prisma.challenge.findMany({
            where,
            skip,
            take: limit,
            orderBy: { createdAt: 'desc' },
            include: { _count: { select: { submissions: true } } },
          }),
          fastify.prisma.challenge.count({ where }),
        ])

        return reply.send({
          success: true,
          data: challenges,
          pagination: {
            page, limit, total,
            totalPages: Math.ceil(total / limit),
            hasNext: page * limit < total,
            hasPrev: page > 1,
          },
        })
      } catch (err) {
        return reply.code(500).send({ success: false, error: String(err) })
      }
    },
  )

  // ── GET /admin/all — all challenges incl. inactive (trainer/admin) ─────────
  fastify.get(
    '/admin/all',
    { preHandler: [authenticateJWT, requireTrainerOrAdmin] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const query = request.query as Record<string, any>
        const page = parseInt(query.page) || 1
        const limit = Math.min(parseInt(query.limit) || 20, 100)
        const skip = (page - 1) * limit

        const where: any = {}
        if (query.search) {
          where.OR = [
            { name: { contains: query.search } },
            { description: { contains: query.search } },
          ]
        }

        const [challenges, total] = await Promise.all([
          fastify.prisma.challenge.findMany({
            where,
            skip,
            take: limit,
            orderBy: { createdAt: 'desc' },
            include: { _count: { select: { submissions: true } } },
          }),
          fastify.prisma.challenge.count({ where }),
        ])

        return reply.send({
          success: true,
          data: challenges,
          pagination: {
            page, limit, total,
            totalPages: Math.ceil(total / limit),
            hasNext: page * limit < total,
            hasPrev: page > 1,
          },
        })
      } catch (err) {
        return reply.code(500).send({ success: false, error: String(err) })
      }
    },
  )

  // ── GET /admin/pending — pending submissions (trainer/admin) ──────────────
  fastify.get(
    '/admin/pending',
    { preHandler: [authenticateJWT, requireTrainerOrAdmin] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const submissions = await fastify.prisma.challengeSubmission.findMany({
          where: { status: 'PENDING' },
          orderBy: { createdAt: 'asc' },
          include: {
            user: { select: { id: true, name: true, email: true } },
            challenge: { select: { id: true, name: true } },
          },
        })
        return reply.send({ success: true, data: submissions })
      } catch (err) {
        return reply.code(500).send({ success: false, error: String(err) })
      }
    },
  )

  // ── PUT /admin/submissions/:subId/review — review submission ──────────────
  fastify.put(
    '/admin/submissions/:subId/review',
    { preHandler: [authenticateJWT, requireTrainerOrAdmin] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { subId } = request.params as { subId: string }
      try {
        const { score, feedback, status } = request.body as {
          score: number
          feedback?: string
          status: 'APPROVED' | 'REJECTED'
        }
        const submission = await fastify.prisma.challengeSubmission.update({
          where: { id: subId },
          data: {
            score,
            feedback,
            status,
            reviewedBy: request.user!.id,
            reviewedAt: new Date(),
          },
        })
        return reply.send({ success: true, data: submission })
      } catch (err) {
        return reply.code(400).send({ success: false, error: String(err) })
      }
    },
  )

  // ── GET /:id — single challenge detail ────────────────────────────────────
  fastify.get(
    '/:id',
    { preHandler: [optionalAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string }
      try {
        const challenge = await fastify.prisma.challenge.findUnique({
          where: { id },
          include: { _count: { select: { submissions: true } } },
        })
        if (!challenge) {
          return reply.code(404).send({ success: false, error: 'Desafío no encontrado' })
        }
        return reply.send({ success: true, data: challenge })
      } catch (err) {
        return reply.code(500).send({ success: false, error: String(err) })
      }
    },
  )

  // ── POST / — create challenge (trainer/admin) ─────────────────────────────
  fastify.post(
    '/',
    { preHandler: [authenticateJWT, requireTrainerOrAdmin] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const data = challengeSchema.parse(request.body)
        const challenge = await fastify.prisma.challenge.create({
          data: {
            ...data,
            thumbnailUrl: data.thumbnailUrl || null,
            submissionDeadline: data.submissionDeadline
              ? new Date(data.submissionDeadline)
              : null,
          },
        })
        return reply.code(201).send({
          success: true,
          message: 'Desafío creado exitosamente',
          data: challenge,
        })
      } catch (err) {
        return reply.code(400).send({ success: false, error: String(err) })
      }
    },
  )

  // ── PUT /:id — update challenge (trainer/admin) ───────────────────────────
  fastify.put(
    '/:id',
    { preHandler: [authenticateJWT, requireTrainerOrAdmin] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string }
      try {
        const data = challengeSchema.partial().parse(request.body)
        const challenge = await fastify.prisma.challenge.update({
          where: { id },
          data: {
            ...data,
            submissionDeadline:
              data.submissionDeadline !== undefined
                ? data.submissionDeadline
                  ? new Date(data.submissionDeadline)
                  : null
                : undefined,
          },
        })
        return reply.send({ success: true, data: challenge })
      } catch (err) {
        return reply.code(400).send({ success: false, error: String(err) })
      }
    },
  )

  // ── DELETE /:id — delete challenge (admin) ────────────────────────────────
  fastify.delete(
    '/:id',
    { preHandler: [authenticateJWT, requireAdmin] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string }
      try {
        await fastify.prisma.challenge.delete({ where: { id } })
        return reply.send({ success: true, message: 'Desafío eliminado' })
      } catch (err) {
        return reply.code(400).send({ success: false, error: String(err) })
      }
    },
  )

  // ── POST /:id/purchase — buy one-time challenge (auth required) ──────────
  fastify.post(
    '/:id/purchase',
    { preHandler: [authenticateJWT] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string }
      try {
        const challenge = await fastify.prisma.challenge.findUnique({ where: { id } })
        if (!challenge) return reply.code(404).send({ success: false, error: 'Desafío no encontrado' })
        if (challenge.accessType !== 'ONE_TIME') {
          return reply.code(400).send({ success: false, error: 'Este desafío no es de pago único' })
        }

        // Check if already purchased
        const existing = await fastify.prisma.userPurchase.findUnique({
          where: { userId_itemId_itemType: { userId: request.user!.id, itemId: id, itemType: 'CHALLENGE' } },
        })
        if (existing) return reply.code(409).send({ success: false, error: 'Ya adquiriste este desafío' })

        const purchase = await fastify.prisma.userPurchase.create({
          data: {
            userId: request.user!.id,
            itemId: id,
            itemType: 'CHALLENGE',
            pricePaid: challenge.price ?? 0,
          },
        })
        return reply.code(201).send({ success: true, data: purchase })
      } catch (err) {
        return reply.code(400).send({ success: false, error: String(err) })
      }
    },
  )

  // ── POST /:id/submit — submit to challenge (auth required) ───────────────
  fastify.post(
    '/:id/submit',
    { preHandler: [authenticateJWT] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string }
      try {
        const { videoUrl, description } = request.body as {
          videoUrl: string
          description?: string
        }
        const submission = await fastify.prisma.challengeSubmission.create({
          data: {
            userId: request.user!.id,
            challengeId: id,
            videoUrl,
            description,
          },
        })
        return reply.code(201).send({ success: true, data: submission })
      } catch (err) {
        return reply.code(400).send({ success: false, error: String(err) })
      }
    },
  )
}

