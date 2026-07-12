import type { PrismaClient } from "../src/generated/prisma/client";
import { reaisToCents, splitInstallments } from "../src/lib/money";

export async function seedFinance(
  prisma: PrismaClient,
  orgId: string,
  userId: string,
) {
  const services = await prisma.service.findMany({
    where: { organizationId: orgId },
    take: 5,
  });
  const professionals = await prisma.professional.findMany({
    where: { organizationId: orgId },
    take: 2,
  });
  const patients = await prisma.patient.findMany({
    where: { organizationId: orgId },
    take: 10,
  });

  if (services.length === 0 || patients.length === 0) return;

  const particular = await prisma.priceTable.create({
    data: {
      organizationId: orgId,
      name: "Particular",
      isDefault: true,
      items: {
        create: services.map((s) => ({
          organizationId: orgId,
          serviceId: s.id,
          priceCents: reaisToCents(Number(s.privatePrice)),
        })),
      },
    },
  });

  const convenio = await prisma.priceTable.create({
    data: {
      organizationId: orgId,
      name: "Unimed",
      insurerName: "Unimed",
      items: {
        create: services.map((s) => ({
          organizationId: orgId,
          serviceId: s.id,
          priceCents: Math.round(reaisToCents(Number(s.privatePrice)) * 0.8),
        })),
      },
    },
  });
  void particular;
  void convenio;

  const receita = await prisma.financialCategory.create({
    data: {
      organizationId: orgId,
      name: "Receitas clínicas",
      type: "RECEITA",
      children: {
        create: [
          {
            organizationId: orgId,
            name: "Consultas",
            type: "RECEITA",
          },
          {
            organizationId: orgId,
            name: "Procedimentos",
            type: "RECEITA",
          },
        ],
      },
    },
    include: { children: true },
  });

  const despesaPai = await prisma.financialCategory.create({
    data: {
      organizationId: orgId,
      name: "Despesas operacionais",
      type: "DESPESA",
      children: {
        create: [
          {
            organizationId: orgId,
            name: "Aluguel",
            type: "DESPESA",
          },
          {
            organizationId: orgId,
            name: "Materiais",
            type: "DESPESA",
          },
        ],
      },
    },
    include: { children: true },
  });

  const supplier = await prisma.supplier.create({
    data: {
      organizationId: orgId,
      name: "Fornecedor Lab XYZ",
      email: "lab@example.local",
    },
  });

  if (professionals[0]) {
    await prisma.commissionRule.create({
      data: {
        organizationId: orgId,
        professionalId: professionals[0].id,
        ruleType: "PERCENTUAL",
        value: 3000,
        base: "FATURADO",
        isPrivate: true,
      },
    });
    if (professionals[1]) {
      await prisma.commissionRule.create({
        data: {
          organizationId: orgId,
          professionalId: professionals[1].id,
          ruleType: "FIXO",
          value: 5000,
          base: "RECEBIDO",
        },
      });
    }
  }

  const pkg = await prisma.package.create({
    data: {
      organizationId: orgId,
      name: "Pacote 10 sessões fisioterapia",
      serviceId: services[0]?.id,
      sessionCount: 10,
      priceCents: 150000,
    },
  });

  const cashRegister = await prisma.cashRegister.create({
    data: {
      organizationId: orgId,
      userId,
      status: "FECHADO",
      openingAmountCents: 10000,
      closingExpectedCents: 10000,
      closingCountedCents: 10000,
      closingDifferenceCents: 0,
      closedAt: new Date(),
    },
  });

  let salesCreated = 0;

  for (let i = 0; i < 20 && i < patients.length; i++) {
    const patient = patients[i];
    const service = services[i % services.length];
    const prof = professionals[i % professionals.length];
    const priceCents = reaisToCents(Number(service.privatePrice));
    const discount = i % 5 === 0 ? 2000 : 0;
    const total = priceCents - discount;
    const daysAgo = 25 - i;

    const createdAt = new Date();
    createdAt.setDate(createdAt.getDate() - daysAgo);

    const sale = await prisma.sale.create({
      data: {
        organizationId: orgId,
        patientId: patient.id,
        professionalId: prof?.id,
        status: "CONFIRMADA",
        subtotalCents: priceCents,
        discountCents: discount,
        totalCents: total,
        createdByUserId: userId,
        createdAt,
        items: {
          create: {
            organizationId: orgId,
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

    const installments = i % 4 === 0 ? 3 : 1;
    const parts = splitInstallments(total, installments);

    for (let p = 0; p < parts.length; p++) {
      const dueDate = new Date(createdAt);
      dueDate.setDate(dueDate.getDate() + p * 30);
      const isOverdue = dueDate < new Date() && p === 0 && i % 7 === 0;

      const paidAmount =
        p === 0 && !isOverdue && i % 3 !== 0 ? parts[p] : p === 0 && i % 3 === 0 ? Math.floor(parts[p] / 2) : 0;

      const recv = await prisma.receivable.create({
        data: {
          organizationId: orgId,
          patientId: patient.id,
          saleId: sale.id,
          description: `Venda ${sale.id.slice(-6)} ${p + 1}/${installments}`,
          totalCents: parts[p],
          paidCents: paidAmount,
          status:
            paidAmount >= parts[p]
              ? "PAGO"
              : paidAmount > 0
                ? "PARCIAL"
                : isOverdue
                  ? "VENCIDO"
                  : "ABERTO",
          installmentNumber: p + 1,
          installmentCount: installments,
          dueDate,
          createdAt,
        },
      });

      if (paidAmount > 0) {
        await prisma.payment.create({
          data: {
            organizationId: orgId,
            patientId: patient.id,
            receivableId: recv.id,
            saleId: sale.id,
            amountCents: paidAmount,
            netAmountCents: paidAmount,
            method: i % 2 === 0 ? "PIX" : "DINHEIRO",
            cashRegisterId: cashRegister.id,
            createdByUserId: userId,
            createdAt,
          },
        });
      }
    }

    salesCreated++;
  }

  const packagePatient = patients[0];
  const packageSale = await prisma.sale.create({
    data: {
      organizationId: orgId,
      patientId: packagePatient.id,
      status: "CONFIRMADA",
      subtotalCents: pkg.priceCents,
      totalCents: pkg.priceCents,
      createdByUserId: userId,
      items: {
        create: {
          organizationId: orgId,
          itemType: "PACKAGE",
          packageId: pkg.id,
          description: pkg.name,
          quantity: 1,
          unitPriceCents: pkg.priceCents,
          totalCents: pkg.priceCents,
        },
      },
    },
  });

  const purchase = await prisma.packagePurchase.create({
    data: {
      organizationId: orgId,
      patientId: packagePatient.id,
      packageId: pkg.id,
      saleId: packageSale.id,
      sessionsTotal: pkg.sessionCount,
      sessionsUsed: 3,
      status: "ATIVO",
    },
  });

  for (let s = 0; s < 3; s++) {
    await prisma.packageSessionConsumption.create({
      data: {
        organizationId: orgId,
        purchaseId: purchase.id,
        consumedAt: new Date(),
      },
    });
  }

  await prisma.payable.create({
    data: {
      organizationId: orgId,
      supplierId: supplier.id,
      categoryId: despesaPai.children[0]?.id,
      description: "Aluguel clínica",
      amountCents: 850000,
      competenceDate: new Date(),
      dueDate: new Date(Date.now() + 7 * 86400000),
      isRecurring: true,
      recurringDay: 5,
    },
  });

  await prisma.payable.create({
    data: {
      organizationId: orgId,
      categoryId: receita.children[0]?.id,
      description: "Material descartável",
      amountCents: 45000,
      competenceDate: new Date(),
      dueDate: new Date(),
      status: "PAGO",
      paidAt: new Date(),
    },
  });

  console.log(
    `  Financeiro: ${salesCreated} vendas, tabelas particular/convênio, pacote, categorias`,
  );
}
