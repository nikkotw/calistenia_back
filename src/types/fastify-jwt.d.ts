import { UserRole } from '@prisma/client'

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: {
      id: string
      email: string
      role: UserRole
      name: string
    }
    user: {
      id: string
      email: string
      role: UserRole
      name: string
    }
  }
}
