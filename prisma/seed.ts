import { PrismaClient, UserRole, SubscriptionLevel } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Iniciando seed...')

  // ─── Planes de suscripción ────────────────────────────────────────────────
  const plans = await Promise.all([
    prisma.subscriptionPlan.upsert({
      where: { level: SubscriptionLevel.FREE },
      update: {},
      create: {
        name: 'Free',
        description: 'Acceso básico para empezar',
        price: 0,
        level: SubscriptionLevel.FREE,
        features: ['5 rutinas básicas', 'Comunidad pública', 'Videos introductorios'],
        maxRoutines: 5,
      },
    }),
    prisma.subscriptionPlan.upsert({
      where: { level: SubscriptionLevel.BASIC },
      update: {},
      create: {
        name: 'Basic',
        description: 'Para quienes empiezan en serio',
        price: 15,
        level: SubscriptionLevel.BASIC,
        features: ['20 rutinas', 'Seguimiento de progreso', 'Acceso a retos mensuales', 'Soporte por email'],
        maxRoutines: 20,
      },
    }),
    prisma.subscriptionPlan.upsert({
      where: { level: SubscriptionLevel.PREMIUM },
      update: {},
      create: {
        name: 'Premium',
        description: 'El plan más popular',
        price: 35,
        level: SubscriptionLevel.PREMIUM,
        features: [
          'Rutinas ilimitadas',
          'Coach IA 24/7',
          'Planes de nutrición',
          'Retos exclusivos',
          'Videos HD sin límite',
          'Soporte prioritario',
        ],
        maxRoutines: null,
      },
    }),
    prisma.subscriptionPlan.upsert({
      where: { level: SubscriptionLevel.VIP },
      update: {},
      create: {
        name: 'VIP',
        description: 'Experiencia total con coach personal',
        price: 65,
        level: SubscriptionLevel.VIP,
        features: [
          'Todo de Premium',
          'Coach personal asignado',
          'Sesiones 1:1 mensuales',
          'Plan de skills avanzados',
          'Acceso anticipado a novedades',
          'Descuentos en merchandise',
        ],
        maxRoutines: null,
      },
    }),
  ])

  console.log(`✅ Planes creados: ${plans.map((p) => p.name).join(', ')}`)

  // ─── Usuario Admin ────────────────────────────────────────────────────────
  const adminPassword = await bcrypt.hash('Admin123!', 10)
  const admin = await prisma.user.upsert({
    where: { email: 'admin@entheoscalistenia.com' },
    update: {},
    create: {
      email: 'admin@entheoscalistenia.com',
      password: adminPassword,
      name: 'Diego Lopez',
      role: UserRole.ADMIN,
      isActive: true,
    },
  })

  console.log(`✅ Admin creado: ${admin.email}`)

  // ─── Usuario de prueba (multi-suscripción) ────────────────────────────────
  const testPassword = await bcrypt.hash('Test123!', 10)
  const testUser = await prisma.user.upsert({
    where: { email: 'test@entheoscalistenia.com' },
    update: {},
    create: {
      email: 'test@entheoscalistenia.com',
      password: testPassword,
      name: 'Test User',
      role: UserRole.USER,
      isActive: true,
    },
  })

  console.log(`✅ Usuario de prueba creado: ${testUser.email}`)

  // Suscripciones para el usuario de prueba: BASIC + PREMIUM activos
  const basicPlan = plans.find((p) => p.level === SubscriptionLevel.BASIC)!
  const premiumPlan = plans.find((p) => p.level === SubscriptionLevel.PREMIUM)!

  await Promise.all([
    prisma.userSubscription.upsert({
      where: { userId_planId: { userId: testUser.id, planId: basicPlan.id } },
      update: {},
      create: {
        userId: testUser.id,
        planId: basicPlan.id,
        isActive: true,
        startDate: new Date(),
      },
    }),
    prisma.userSubscription.upsert({
      where: { userId_planId: { userId: testUser.id, planId: premiumPlan.id } },
      update: {},
      create: {
        userId: testUser.id,
        planId: premiumPlan.id,
        isActive: true,
        startDate: new Date(),
      },
    }),
  ])

  console.log(`✅ Suscripciones asignadas: BASIC + PREMIUM`)

  // ─── Rutina para usuario BASIC ────────────────────────────────────────────
  await prisma.routine.upsert({
    where: { id: 'seed-routine-basic-001' },
    update: {},
    create: {
      id: 'seed-routine-basic-001',
      name: 'Fuerza y Control — Nivel BASIC',
      description: 'Rutina de calistenia para construir fuerza base. Dominadas, fondos y core progresivo. Ideal para consolidar técnica antes de avanzar a skills avanzados.',
      level: 'INTERMEDIATE',
      type: 'CALISTHENICS',
      duration: 50,
      estimatedCalories: 400,
      accessType: 'SUBSCRIPTION',
      requiredLevel: 'BASIC',
      isPublished: true,
      tags: ['fuerza', 'básico', 'calistenia', 'upper body', 'core'],
      equipment: ['barra de dominadas', 'paralelas', 'anillas (opcional)'],
      thumbnailUrl: 'https://images.unsplash.com/photo-1598971639058-a94c2c3f38e4?w=800&auto=format',
      days: {
        create: [
          {
            dayNumber: 1,
            name: 'Día 1 — Empuje',
            description: 'Fondos, flexiones y press para pecho y tríceps.',
            steps: {
              create: [
                {
                  stepNumber: 1,
                  name: 'Calentamiento articular',
                  description: 'Círculos de hombros, muñecas y cuello. 5 minutos.',
                  duration: 300,
                  tips: '',
                },
                {
                  stepNumber: 2,
                  name: 'Fondos en paralelas',
                  description: 'Baja hasta que los hombros estén por debajo de los codos. Mantén el torso ligeramente inclinado.',
                  sets: 4,
                  reps: 10,
                  restTime: 90,
                  tips: 'Contrae el core y evitá balancear las piernas.',
                },
                {
                  stepNumber: 3,
                  name: 'Flexiones diamante',
                  description: 'Manos juntas formando un diamante bajo el pecho. Énfasis en tríceps.',
                  sets: 3,
                  reps: 12,
                  restTime: 60,
                  tips: 'Bajá lento (3 seg) para mayor activación.',
                },
                {
                  stepNumber: 4,
                  name: 'Flexiones arqueras',
                  description: 'Desplaza el peso a un lado en cada rep para prepararte para la flexión a un brazo.',
                  sets: 3,
                  reps: 8,
                  restTime: 75,
                  tips: 'El brazo extendido actúa como apoyo estabilizador.',
                },
              ],
            },
          },
          {
            dayNumber: 2,
            name: 'Día 2 — Jale',
            description: 'Dominadas y remo para espalda y bíceps.',
            steps: {
              create: [
                {
                  stepNumber: 1,
                  name: 'Calentamiento de hombros',
                  description: 'Band pull-aparts y activación de espalda. 5 minutos.',
                  duration: 300,
                  tips: '',
                },
                {
                  stepNumber: 2,
                  name: 'Dominadas supinas (chin-up)',
                  description: 'Agarre con las palmas hacia vos. Sube hasta el mentón sobre la barra.',
                  sets: 4,
                  reps: 8,
                  restTime: 90,
                  tips: 'Iniciá el movimiento apretando los omóplatos, no los brazos.',
                },
                {
                  stepNumber: 3,
                  name: 'Dominadas neutras',
                  description: 'Agarre paralelo. Activa los omóplatos antes de tirar.',
                  sets: 3,
                  reps: 8,
                  restTime: 90,
                  tips: 'Mantené el pecho arriba durante todo el recorrido.',
                },
                {
                  stepNumber: 4,
                  name: 'Remo en anillas o mesa',
                  description: 'Cuerpo recto, tira hasta que el pecho toque la barra o las anillas.',
                  sets: 3,
                  reps: 12,
                  restTime: 60,
                  tips: 'Cuanto más inclinado, más difícil. Ajustá la dificultad con la posición del cuerpo.',
                },
              ],
            },
          },
          {
            dayNumber: 3,
            name: 'Día 3 — Core y piernas',
            description: 'Trabajo abdominal, sentadillas y glúteos.',
            steps: {
              create: [
                {
                  stepNumber: 1,
                  name: 'Sentadillas con peso corporal',
                  description: 'Profundidad completa, rodillas alineadas con los pies.',
                  sets: 4,
                  reps: 20,
                  restTime: 60,
                  tips: 'Talones apoyados, mirada al frente, no curves la espalda.',
                },
                {
                  stepNumber: 2,
                  name: 'Zancadas caminando',
                  description: '10 pasos por lado, mantén el torso erguido.',
                  sets: 3,
                  reps: 10,
                  restTime: 60,
                  tips: 'La rodilla trasera casi toca el suelo.',
                },
                {
                  stepNumber: 3,
                  name: 'L-sit en paralelas',
                  description: 'Mantén las piernas paralelas al suelo el mayor tiempo posible.',
                  sets: 4,
                  duration: 20,
                  restTime: 60,
                  tips: 'Si no podés mantener ambas piernas, intentalo con una doblada.',
                },
                {
                  stepNumber: 4,
                  name: 'Dragon flag negativo',
                  description: 'Baja lentamente desde la posición vertical manteniendo el cuerpo recto.',
                  sets: 3,
                  reps: 6,
                  restTime: 90,
                  tips: 'La bajada debe durar 4-5 segundos. Controlá cada centímetro.',
                },
              ],
            },
          },
        ],
      },
    },
  })

  console.log('✅ Rutina BASIC creada: Fuerza y Control — Nivel BASIC')

  // ─── Resumen ──────────────────────────────────────────────────────────────
  console.log('\n📋 Credenciales de prueba:')
  console.log('────────────────────────────────────────────')
  console.log('Admin:')
  console.log('  Email:    admin@entheoscalistenia.com')
  console.log('  Password: Admin123!')
  console.log('  Rol:      ADMIN')
  console.log('')
  console.log('Usuario de prueba:')
  console.log('  Email:    test@entheoscalistenia.com')
  console.log('  Password: Test123!')
  console.log('  Rol:      USER')
  console.log('  Planes:   BASIC + PREMIUM activos')
  console.log('────────────────────────────────────────────')
  console.log('\n🎉 Seed completado!')
}

main()
  .catch((e) => {
    console.error('❌ Error en seed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
