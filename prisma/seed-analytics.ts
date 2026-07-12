import type { PrismaClient, AppointmentStatus, PaymentMethod } from "../src/generated/prisma/client";
import { reprocessMetricsRange } from "../src/modules/analytics/services/aggregation.service";
import { reaisToCents } from "../src/lib/money";

function seeded(seed: number): number {
  const x = Math.sin(seed * 9999) * 10000;
  return x - Math.floor(x);
}

/** Gera ~6 meses de histórico determinístico e agrega métricas. */
export async function seedAnalytics(prisma: PrismaClient, organizationId: string) {
  const [patients, professionals, services, rooms, ownerMembership, cashRegister] =
    await Promise.all([
      prisma.patient.findMany({ where: { organizationId }, take: 12 }),
      prisma.professional.findMany({ where: { organizationId, isActive: true } }),
      prisma.service.findMany({ where: { organizationId }, take: 4 }),
      prisma.room.findMany({ where: { organizationId }, take: 2 }),
      prisma.membership.findFirst({
        where: { organizationId, role: "OWNER", isActive: true },
      }),
      prisma.cashRegister.findFirst({ where: { organizationId } }),
    ]);

  if (patients.length === 0 || professionals.length === 0 || services.length === 0) {
    console.log("  ⚠ Analytics seed skipped (dados base insuficientes)");
    return;
  }

  const userId = ownerMembership?.userId ?? (await prisma.user.findFirst())!.id;
  const roomId = rooms[0]?.id;
  const now = new Date();
  let apptSeq = 0;

  for (let dayOffset = -180; dayOffset <= 0; dayOffset++) {
    const day = new Date(now);
    day.setDate(day.getDate() + dayOffset);
    const dow = day.getDay();
    if (dow === 0) continue;

    const dailyCount = 2 + Math.floor(seeded(dayOffset) * 4);
    for (let i = 0; i < dailyCount; i++) {
      apptSeq += 1;
      const hour = 8 + (i % 8);
      const startsAt = new Date(day);
      startsAt.setHours(hour, (i % 2) * 30, 0, 0);

      const isPast = dayOffset < 0;
      const roll = seeded(apptSeq);
      let status: AppointmentStatus = isPast
        ? roll < 0.72
          ? "FINALIZADO"
          : roll < 0.85
            ? "FALTOU"
            : "CANCELADO"
        : roll < 0.5
          ? "AGENDADO"
          : "CONFIRMADO";

      if (dayOffset === 0 && roll < 0.3) status = "AGUARDANDO";

      const patient = patients[apptSeq % patients.length]!;
      const prof = professionals[apptSeq % professionals.length]!;
      const service = services[apptSeq % services.length]!;
      const endsAt = new Date(startsAt.getTime() + service.durationMinutes * 60_000);
      const origins = ["RECEPCAO", "TELEFONE", "ONLINE"] as const;

      const appt = await prisma.appointment.create({
        data: {
          organizationId,
          patientId: patient.id,
          professionalId: prof.id,
          serviceId: service.id,
          roomId: roomId ?? null,
          startsAt,
          endsAt,
          status,
          origin: origins[apptSeq % 3]!,
          isPrivate: true,
          expectedAmount: service.privatePrice,
          arrivedAt:
            status === "AGUARDANDO" || status === "FINALIZADO"
              ? new Date(startsAt.getTime() - 12 * 60_000)
              : null,
          startedAt:
            status === "FINALIZADO" ? new Date(startsAt.getTime() + 8 * 60_000) : null,
          finishedAt: status === "FINALIZADO" ? endsAt : null,
          queueNumber: status === "AGUARDANDO" ? i + 1 : null,
        },
      });

      if (status === "FINALIZADO" && isPast && apptSeq % 3 !== 0 && cashRegister) {
        const priceCents = reaisToCents(Number(service.privatePrice));
        const discount = apptSeq % 11 === 0 ? 1500 : 0;
        const total = priceCents - discount;
        const createdAt = new Date(startsAt.getTime() + 30 * 60_000);
        const methods: PaymentMethod[] = ["PIX", "DINHEIRO", "DEBITO", "CREDITO"];

        const sale = await prisma.sale.create({
          data: {
            organizationId,
            patientId: patient.id,
            professionalId: prof.id,
            status: "CONFIRMADA",
            subtotalCents: priceCents,
            discountCents: discount,
            totalCents: total,
            createdByUserId: userId,
            createdAt,
            items: {
              create: {
                organizationId,
                itemType: "SERVICE",
                serviceId: service.id,
                description: service.name,
                quantity: 1,
                unitPriceCents: priceCents,
                totalCents: priceCents,
              },
            },
          },
        });

        await prisma.payment.create({
          data: {
            organizationId,
            patientId: patient.id,
            saleId: sale.id,
            amountCents: total,
            netAmountCents: total,
            method: methods[apptSeq % methods.length]!,
            cashRegisterId: cashRegister.id,
            createdByUserId: userId,
            createdAt,
          },
        });
      }

      void appt;
    }
  }

  for (let n = 0; n < 40; n++) {
    const respondedAt = new Date(now);
    respondedAt.setDate(respondedAt.getDate() - n * 4);
    const patient = patients[n % patients.length]!;
    const survey = await prisma.npsSurvey.create({
      data: {
        organizationId,
        patientId: patient.id,
        token: `seed-nps-hist-${n}`,
        expiresAt: new Date(Date.now() + 86400_000),
      },
    });
    await prisma.npsResponse.create({
      data: {
        organizationId,
        surveyId: survey.id,
        score: 6 + Math.floor(seeded(n) * 5),
        respondedAt,
        createdAt: respondedAt,
      },
    });
  }

  await prisma.performanceGoal.upsert({
    where: { id: `${organizationId}-goal-revenue` },
    create: {
      id: `${organizationId}-goal-revenue`,
      organizationId,
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      goalType: "REVENUE",
      targetValue: 5000000,
    },
    update: {},
  });

  await prisma.scheduledReport.upsert({
    where: { id: `${organizationId}-weekly-summary` },
    create: {
      id: `${organizationId}-weekly-summary`,
      organizationId,
      reportKey: "executive-summary",
      cronDayOfWeek: 1,
      cronHour: 7,
      recipientRole: "OWNER",
      isActive: true,
    },
    update: {},
  });

  const from = new Date(now);
  from.setMonth(from.getMonth() - 6);
  const result = await reprocessMetricsRange(organizationId, from, now);
  console.log(`  ✓ Analytics (${result.daysProcessed} dias agregados, histórico ~6 meses)`);
}
