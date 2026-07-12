import type { PrismaClient, AppointmentStatus } from "../src/generated/prisma/client";

export async function seedScheduling(
  prisma: PrismaClient,
  orgVidaPlenaId: string,
  orgDrTesteId: string,
) {
  async function setupOrg(orgId: string, prefix: string) {
    const patients = await prisma.patient.findMany({
      where: { organizationId: orgId },
      take: 8,
    });
    if (patients.length === 0) return;

    const prof1 = await prisma.professional.create({
      data: {
        organizationId: orgId,
        displayName: prefix === "vp" ? "Dra. Marina Silva" : "Dr. Carlos Teste",
        councilType: "CRM",
        councilNumber: prefix === "vp" ? "123456" : "654321",
        councilState: "SP",
        specialties: ["Clínica Geral"],
        color: prefix === "vp" ? "#3B82F6" : "#10B981",
      },
    });

    const prof2 = await prisma.professional.create({
      data: {
        organizationId: orgId,
        displayName: prefix === "vp" ? "Dr. Paulo Fisioterapeuta" : "Dra. Ana Psicóloga",
        councilType: prefix === "vp" ? "CREFITO" : "CRP",
        councilNumber: "789012",
        councilState: "SP",
        specialties: prefix === "vp" ? ["Fisioterapia"] : ["Psicologia"],
        color: prefix === "vp" ? "#F59E0B" : "#8B5CF6",
      },
    });

    const room1 = await prisma.room.create({
      data: { organizationId: orgId, name: "Sala 1" },
    });
    const room2 = await prisma.room.create({
      data: { organizationId: orgId, name: "Sala 2" },
    });

    const consulta = await prisma.service.create({
      data: {
        organizationId: orgId,
        name: "Consulta",
        category: "Consulta",
        durationMinutes: 30,
        privatePrice: 200,
      },
    });

    const retorno = await prisma.service.create({
      data: {
        organizationId: orgId,
        name: "Retorno",
        category: "Consulta",
        durationMinutes: 20,
        privatePrice: 120,
      },
    });

    const weekdays = ["SEGUNDA", "TERCA", "QUARTA", "QUINTA", "SEXTA"] as const;

    for (const prof of [prof1, prof2]) {
      for (const wd of weekdays) {
        await prisma.scheduleTemplate.create({
          data: {
            organizationId: orgId,
            professionalId: prof.id,
            weekday: wd,
            startTime: "08:00",
            endTime: "12:00",
            slotIntervalMinutes: 30,
            defaultRoomId: prof.id === prof1.id ? room1.id : room2.id,
          },
        });
        await prisma.scheduleTemplate.create({
          data: {
            organizationId: orgId,
            professionalId: prof.id,
            weekday: wd,
            startTime: "14:00",
            endTime: "18:00",
            slotIntervalMinutes: 30,
            defaultRoomId: prof.id === prof1.id ? room1.id : room2.id,
          },
        });
      }
    }

    await prisma.holiday.createMany({
      data: [
        { organizationId: orgId, date: new Date("2026-01-01"), name: "Confraternização Universal" },
        { organizationId: orgId, date: new Date("2026-04-21"), name: "Tiradentes" },
        { organizationId: orgId, date: new Date("2026-12-25"), name: "Natal" },
      ],
      skipDuplicates: true,
    });

    const now = new Date();
    const statusesPast: AppointmentStatus[] = [
      "FINALIZADO",
      "FINALIZADO",
      "FALTOU",
      "FINALIZADO",
      "CANCELADO",
    ];
    const statusesFuture: AppointmentStatus[] = [
      "AGENDADO",
      "CONFIRMADO",
      "AGUARDANDO",
      "AGENDADO",
      "CONFIRMADO",
    ];

    let apptCount = 0;

    for (let dayOffset = -14; dayOffset <= 14; dayOffset++) {
      if (dayOffset === 0 || dayOffset === 6 || dayOffset === -7) continue;

      const d = new Date(now);
      d.setDate(d.getDate() + dayOffset);
      d.setHours(9 + (apptCount % 6), (apptCount % 2) * 30, 0, 0);

      const isPast = dayOffset < 0;
      const statusList = isPast ? statusesPast : statusesFuture;
      const status = statusList[apptCount % statusList.length];
      const patient = patients[apptCount % patients.length];
      const prof = apptCount % 2 === 0 ? prof1 : prof2;
      const service = apptCount % 3 === 0 ? retorno : consulta;
      const endsAt = new Date(d.getTime() + service.durationMinutes * 60_000);

      const appt = await prisma.appointment.create({
        data: {
          organizationId: orgId,
          patientId: patient.id,
          professionalId: prof.id,
          serviceId: service.id,
          roomId: prof.id === prof1.id ? room1.id : room2.id,
          startsAt: d,
          endsAt,
          status,
          origin: apptCount % 3 === 0 ? "TELEFONE" : "RECEPCAO",
          isPrivate: true,
          expectedAmount: service.privatePrice,
          arrivedAt:
            status === "AGUARDANDO" || status === "FINALIZADO"
              ? new Date(d.getTime() - 15 * 60_000)
              : null,
          startedAt:
            status === "FINALIZADO"
              ? new Date(d.getTime() + 5 * 60_000)
              : null,
          finishedAt: status === "FINALIZADO" ? endsAt : null,
          queueNumber:
            status === "AGUARDANDO" ? apptCount + 1 : null,
        },
      });

      await prisma.appointmentStatusHistory.create({
        data: {
          organizationId: orgId,
          appointmentId: appt.id,
          fromStatus: null,
          toStatus: "AGENDADO",
        },
      });

      if (status !== "AGENDADO") {
        await prisma.appointmentStatusHistory.create({
          data: {
            organizationId: orgId,
            appointmentId: appt.id,
            fromStatus: "AGENDADO",
            toStatus: status,
          },
        });
      }

      apptCount++;
      if (apptCount >= (prefix === "vp" ? 20 : 10)) break;
    }
  }

  await setupOrg(orgVidaPlenaId, "vp");
  await setupOrg(orgDrTesteId, "dt");
}
