import type { PrismaClient } from "../src/generated/prisma/client";

const COMMON_CID10 = [
  { code: "J06.9", description: "Infecção aguda das vias aéreas superiores", chapter: "X" },
  { code: "I10", description: "Hipertensão essencial (primária)", chapter: "IX" },
  { code: "E11.9", description: "Diabetes mellitus tipo 2 sem complicações", chapter: "IV" },
  { code: "F41.1", description: "Ansiedade generalizada", chapter: "V" },
  { code: "M54.5", description: "Dor lombar baixa", chapter: "XIII" },
  { code: "J45.9", description: "Asma não especificada", chapter: "X" },
  { code: "K21.0", description: "Doença de refluxo gastroesofágico com esofagite", chapter: "XI" },
  { code: "N39.0", description: "Infecção do trato urinário", chapter: "XIV" },
  { code: "R51", description: "Cefaleia", chapter: "XVIII" },
  { code: "Z00.0", description: "Exame geral e investigação de pessoas sem queixas", chapter: "XXI" },
  { code: "J02.9", description: "Faringite aguda", chapter: "X" },
  { code: "A09", description: "Diarreia e gastroenterite", chapter: "I" },
  { code: "L30.9", description: "Dermatite não especificada", chapter: "XII" },
  { code: "H10.9", description: "Conjuntivite não especificada", chapter: "VII" },
  { code: "B34.9", description: "Infecção viral não especificada", chapter: "I" },
  { code: "F32.9", description: "Episódio depressivo não especificado", chapter: "V" },
  { code: "M25.5", description: "Dor articular", chapter: "XIII" },
  { code: "R10.4", description: "Dor abdominal e pélvica", chapter: "XVIII" },
  { code: "J03.9", description: "Amigdalite aguda", chapter: "X" },
  { code: "E78.5", description: "Hiperlipidemia não especificada", chapter: "IV" },
];

export async function seedCid10(prisma: PrismaClient) {
  for (const c of COMMON_CID10) {
    await prisma.cid10Code.upsert({
      where: { code: c.code },
      create: c,
      update: { description: c.description, chapter: c.chapter },
    });
  }
}
