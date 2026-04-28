import { FastifyInstance, FastifyPluginOptions, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { authenticateJWT, requireTrainerOrAdmin, optionalAuth } from '../middleware/auth.js'

const bookSchema = z.object({
  title: z.string().min(2).max(300),
  author: z.string().min(2).max(200),
  description: z.string().min(10),
  coverUrl: z.string().url().optional().or(z.literal('')),
  fileUrl: z.string().url().optional().or(z.literal('')),
  previewUrl: z.string().url().optional().or(z.literal('')),
  price: z.number().positive(),
  pages: z.number().int().positive().optional(),
  isbn: z.string().optional(),
  isPublished: z.boolean().optional(),
  featured: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
})

const bookUpdateSchema = bookSchema.partial()

export async function bookRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
): Promise<void> {

  // ── GET / — list published books (public) ─────────────────────────────────
  fastify.get('/', { preHandler: [optionalAuth] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { search, featured, page = 1, limit = 20 } = request.query as any
    const skip = (Number(page) - 1) * Number(limit)

    const where: any = { isPublished: true }
    if (search) where.OR = [
      { title: { contains: search } },
      { author: { contains: search } },
    ]
    if (featured === 'true' || featured === true) where.featured = true

    const [books, total] = await Promise.all([
      fastify.prisma.book.findMany({
        where,
        orderBy: [{ featured: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: Number(limit),
      }),
      fastify.prisma.book.count({ where }),
    ])

    return reply.send({
      success: true,
      data: books,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit)),
      },
    })
  })

  // ── GET /:id — book detail (public) ──────────────────────────────────────
  fastify.get('/:id', { preHandler: [optionalAuth] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string }
    const book = await fastify.prisma.book.findUnique({ where: { id } })
    if (!book || !book.isPublished) return reply.code(404).send({ success: false, error: 'Libro no encontrado' })
    return reply.send({ success: true, data: book })
  })

  // ── POST /purchase/:id — comprar libro ───────────────────────────────────
  fastify.post('/purchase/:id', { preHandler: [authenticateJWT] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string }
    const userId = (request as any).user?.userId

    const book = await fastify.prisma.book.findUnique({ where: { id } })
    if (!book || !book.isPublished) return reply.code(404).send({ success: false, error: 'Libro no encontrado' })

    // Check if already purchased
    const existing = await fastify.prisma.userPurchase.findUnique({
      where: { userId_itemId_itemType: { userId, itemId: id, itemType: 'BOOK' } },
    })
    if (existing) return reply.send({ success: true, message: 'Ya tienes este libro', data: existing })

    const purchase = await fastify.prisma.userPurchase.create({
      data: { userId, itemId: id, itemType: 'BOOK', pricePaid: book.price },
    })

    return reply.code(201).send({ success: true, data: purchase, fileUrl: book.fileUrl })
  })

  // ── GET /my/purchases — libros comprados ─────────────────────────────────
  fastify.get('/my/purchases', { preHandler: [authenticateJWT] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = (request as any).user?.userId
    const purchases = await fastify.prisma.userPurchase.findMany({
      where: { userId, itemType: 'BOOK' },
      orderBy: { createdAt: 'desc' },
    })
    const bookIds = purchases.map(p => p.itemId)
    const books = await fastify.prisma.book.findMany({ where: { id: { in: bookIds } } })
    return reply.send({ success: true, data: books })
  })

  // ── ADMIN: GET /admin/all ─────────────────────────────────────────────────
  fastify.get('/admin/all', { preHandler: [authenticateJWT, requireTrainerOrAdmin] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { search, page = 1, limit = 20 } = request.query as any
    const skip = (Number(page) - 1) * Number(limit)
    const where: any = {}
    if (search) where.OR = [{ title: { contains: search } }, { author: { contains: search } }]

    const [books, total] = await Promise.all([
      fastify.prisma.book.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: Number(limit) }),
      fastify.prisma.book.count({ where }),
    ])
    return reply.send({ success: true, data: books, pagination: { page: Number(page), limit: Number(limit), total, totalPages: Math.ceil(total / Number(limit)) } })
  })

  // ── ADMIN: POST / — crear libro ───────────────────────────────────────────
  fastify.post('/', { preHandler: [authenticateJWT, requireTrainerOrAdmin] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const data = bookSchema.parse(request.body)
      const book = await fastify.prisma.book.create({
        data: {
          ...data,
          coverUrl: data.coverUrl || null,
          fileUrl: data.fileUrl || null,
          previewUrl: data.previewUrl || null,
          tags: data.tags ?? [],
          isPublished: data.isPublished ?? false,
          featured: data.featured ?? false,
        },
      })
      return reply.code(201).send({ success: true, data: book })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error'
      return reply.code(400).send({ success: false, error: msg })
    }
  })

  // ── ADMIN: PUT /:id — actualizar libro ────────────────────────────────────
  fastify.put('/:id', { preHandler: [authenticateJWT, requireTrainerOrAdmin] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string }
    try {
      const data = bookUpdateSchema.parse(request.body)
      const book = await fastify.prisma.book.update({
        where: { id },
        data: {
          ...data,
          ...(data.coverUrl !== undefined && { coverUrl: data.coverUrl || null }),
          ...(data.fileUrl !== undefined && { fileUrl: data.fileUrl || null }),
          ...(data.previewUrl !== undefined && { previewUrl: data.previewUrl || null }),
          updatedAt: new Date(),
        },
      })
      return reply.send({ success: true, data: book })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error'
      return reply.code(400).send({ success: false, error: msg })
    }
  })

  // ── ADMIN: DELETE /:id ────────────────────────────────────────────────────
  fastify.delete('/:id', { preHandler: [authenticateJWT, requireTrainerOrAdmin] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string }
    await fastify.prisma.book.delete({ where: { id } })
    return reply.send({ success: true, message: 'Libro eliminado' })
  })
}
