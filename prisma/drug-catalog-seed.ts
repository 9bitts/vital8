import type { PrismaClient } from "../src/generated/prisma/client";

const BASE_DRUGS = [
  "Dipirona", "Paracetamol", "Ibuprofeno", "Omeprazol", "Losartana",
  "Metformina", "Sinvastatina", "Amoxicilina", "Azitromicina", "Cetirizina",
  "Loratadina", "Prednisona", "Dexametasona", "Captopril", "Enalapril",
  "Hidroclorotiazida", "Atenolol", "Propranolol", "Amlodipina", "Sertralina",
  "Fluoxetina", "Escitalopram", "Risperidona", "Quetiapina", "Clonazepam",
  "Diazepam", "Tramadol", "Codeína", "Rivotril", "Insulina NPH",
  "Glicazida", "Levotiroxina", "Salbutamol", "Budesonida", "Montelukaste",
  "Ranitidina", "Pantoprazol", "Esomeprazol", "Domperidona", "Metoclopramida",
  "Bromoprida", "Simeticona", "Lactulose", "Bisacodil", "Passiflora",
  "Melatonina", "Vitamina D3", "Vitamina B12", "Sulfato ferroso", "Ácido fólico",
];

const FORMS = ["comprimido", "cápsula", "solução oral", "suspensão", "injetável"];
const ROUTES = ["oral", "IV", "IM", "tópica", "sublingual"];
const CONCENTRATIONS = ["500mg", "250mg", "10mg", "20mg", "40mg", "850mg"];

export async function seedDrugCatalog(prisma: PrismaClient) {
  let count = 0;
  for (const base of BASE_DRUGS) {
    for (let v = 0; v < 4 && count < 200; v++) {
      const form = FORMS[v % FORMS.length];
      const name = `${base} ${CONCENTRATIONS[v % CONCENTRATIONS.length]} ${form}`;
      const existing = await prisma.drugCatalog.findFirst({ where: { name } });
      if (existing) continue;
      await prisma.drugCatalog.create({
        data: {
          name,
          activeIngredient: base,
          concentration: CONCENTRATIONS[v % CONCENTRATIONS.length],
          pharmaceuticalForm: form,
          route: ROUTES[v % ROUTES.length],
          isControlled: base === "Tramadol" || base === "Codeína" || base === "Rivotril",
        },
      });
      count++;
    }
  }
}
