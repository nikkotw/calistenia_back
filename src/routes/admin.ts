import { FastifyInstance, FastifyPluginOptions, FastifyRequest, FastifyReply } from 'fastify'
import { authenticateJWT, requireAdmin, requireTrainerOrAdmin } from '../middleware/auth.js'

export async function adminRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
): Promise<void> {
  // GET /api/admin/stats — dashboard overview
  fastify.get(
    '/stats',
    { preHandler: [authenticateJWT, requireTrainerOrAdmin] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const [
          totalUsers,
          totalRoutines,
          publishedRoutines,
          totalChallenges,
          activeSubscriptions,
          pendingSubmissions,
          recentRoutines,
        ] = await Promise.all([
          fastify.prisma.user.count({ where: { isActive: true } }),
          fastify.prisma.routine.count(),
          fastify.prisma.routine.count({ where: { isPublished: true } }),
          fastify.prisma.challenge.count(),
          fastify.prisma.userSubscription.count({ where: { isActive: true } }),
          fastify.prisma.challengeSubmission.count({ where: { status: 'PENDING' } }),
          fastify.prisma.routine.findMany({
            take: 6,
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              name: true,
              type: true,
              level: true,
              isPublished: true,
              requiredLevel: true,
              duration: true,
              createdAt: true,
            },
          }),
        ])

        return reply.send({
          success: true,
          data: {
            totalUsers,
            totalRoutines,
            publishedRoutines,
            totalChallenges,
            activeSubscriptions,
            pendingSubmissions,
            recentRoutines,
          },
        })
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error'
        return reply.code(500).send({ success: false, error: msg })
      }
    },
  )

  // GET /api/admin/users — paginated user list
  fastify.get(
    '/users',
    { preHandler: [authenticateJWT, requireAdmin] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const query = request.query as Record<string, any>
        const page = parseInt(query.page) || 1
        const limit = Math.min(parseInt(query.limit) || 20, 100)
        const skip = (page - 1) * limit

        const [users, total] = await Promise.all([
          fastify.prisma.user.findMany({
            skip,
            take: limit,
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              email: true,
              name: true,
              role: true,
              isActive: true,
              createdAt: true,
              subscriptions: {
                where: { isActive: true },
                include: { plan: { select: { name: true, level: true } } },
              },
            },
          }),
          fastify.prisma.user.count(),
        ])

        return reply.send({
          success: true,
          data: users,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
            hasNext: page * limit < total,
            hasPrev: page > 1,
          },
        })
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error'
        return reply.code(500).send({ success: false, error: msg })
      }
    },
  )

  // GET /api/admin/routines — all routines including drafts
  fastify.get(
    '/routines',
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
        if (query.type) where.type = query.type
        if (query.level) where.level = query.level
        if (query.isPublished !== undefined) where.isPublished = query.isPublished === 'true'

        const [routines, total] = await Promise.all([
          fastify.prisma.routine.findMany({
            where,
            skip,
            take: limit,
            orderBy: { createdAt: 'desc' },
            include: {
              _count: { select: { days: true, userProgress: true } },
              creator: { select: { id: true, name: true } },
            },
          }),
          fastify.prisma.routine.count({ where }),
        ])

        return reply.send({
          success: true,
          data: routines,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
            hasNext: page * limit < total,
            hasPrev: page > 1,
          },
        })
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error'
        return reply.code(500).send({ success: false, error: msg })
      }
    },
  )

  // GET /api/admin/routines/:id — full routine detail with days+steps (no access restrictions)
  fastify.get(
    '/routines/:id',
    { preHandler: [authenticateJWT, requireTrainerOrAdmin] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string }
      try {
        const routine = await fastify.prisma.routine.findUnique({
          where: { id },
          include: {
            creator: { select: { id: true, name: true } },
            days: {
              orderBy: { dayNumber: 'asc' },
              include: {
                steps: { orderBy: { stepNumber: 'asc' } },
              },
            },
            _count: { select: { days: true, userProgress: true } },
          },
        })
        if (!routine) return reply.code(404).send({ success: false, error: 'Routine not found' })
        return reply.send({ success: true, data: routine })
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error'
        return reply.code(500).send({ success: false, error: msg })
      }
    },
  )

  // PATCH /api/admin/routines/:id/publish — toggle publish
  fastify.patch(
    '/routines/:id/publish',
    { preHandler: [authenticateJWT, requireTrainerOrAdmin] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string }
      try {
        const { isPublished } = request.body as { isPublished: boolean }
        const routine = await fastify.prisma.routine.update({
          where: { id },
          data: { isPublished },
        })
        return reply.send({ success: true, data: routine })
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error'
        return reply.code(400).send({ success: false, error: msg })
      }
    },
  )
}
