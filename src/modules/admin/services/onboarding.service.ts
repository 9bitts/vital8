import { adminPrisma } from "@/lib/db/admin-client";

export type OnboardingStep =
  | "clinic_data"
  | "first_branch"
  | "professionals"
  | "services"
  | "schedule"
  | "team_invite"
  | "import_patients"
  | "tour";

const STEP_ORDER: OnboardingStep[] = [
  "clinic_data",
  "first_branch",
  "professionals",
  "services",
  "schedule",
  "team_invite",
  "import_patients",
  "tour",
];

export async function getOnboardingProgress(organizationId: string) {
  return adminPrisma.onboardingProgress.upsert({
    where: { organizationId },
    create: { organizationId, steps: {} },
    update: {},
  });
}

export async function completeOnboardingStep(organizationId: string, step: OnboardingStep) {
  const progress = await getOnboardingProgress(organizationId);
  const steps = { ...(progress.steps as Record<string, boolean>), [step]: true };
  const allDone = STEP_ORDER.every((s) => steps[s]);
  return adminPrisma.onboardingProgress.update({
    where: { organizationId },
    data: {
      steps,
      completedAt: allDone ? new Date() : null,
      updatedAt: new Date(),
    },
  });
}

export function onboardingChecklist(steps: Record<string, boolean>) {
  return STEP_ORDER.map((step) => ({
    step,
    done: !!steps[step],
    label: {
      clinic_data: "Dados da clínica",
      first_branch: "Primeira unidade",
      professionals: "Profissionais",
      services: "Serviços e preços",
      schedule: "Grade de agenda",
      team_invite: "Convidar equipe",
      import_patients: "Importar pacientes",
      tour: "Tour guiado",
    }[step],
  }));
}

export { STEP_ORDER };
