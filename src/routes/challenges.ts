import { FastifyInstance, FastifyPluginOptions } from 'fastify'

export async function challengeRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
): Promise<void> {
  fastify.get('/', async () => {
    return {
      success: true,
      message: 'Challenges endpoint is active',
      data: [],
    }
  })
}
