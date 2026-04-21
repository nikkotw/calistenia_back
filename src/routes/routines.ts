import { FastifyInstance, FastifyPluginOptions } from 'fastify'

export async function routineRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
): Promise<void> {
  fastify.get('/', async () => {
    return {
      success: true,
      message: 'Routines endpoint is active',
      data: [],
    }
  })
}
