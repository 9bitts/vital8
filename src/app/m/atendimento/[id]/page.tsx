"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import {
  getEncounterAction,
  searchDrugsAction,
  signEncounterAction,
  updateSectionAction,
} from "@/modules/emr/actions/emr.actions";
import { MobileVoiceInput } from "@/modules/mobile/components/mobile-voice-input";
import { MobileSkeleton } from "@/modules/mobile/components/mobile-skeleton";

export default function MobileAtendimentoPage({
  params,
}: {
  params: { id: string };
}) {
  const encounterId = params.id;
  const [soapContent, setSoapContent] = useState("");
  const [soapSectionId, setSoapSectionId] = useState<string | null>(null);
  const [drugQuery, setDrugQuery] = useState("");
  const [drugs, setDrugs] = useState<Awaited<ReturnType<typeof searchDrugsAction>>>([]);
  const [offline, setOffline] = useState(false);
  const [patientName, setPatientName] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [pending, startTransition] = useTransition();

  const load = useCallback(() => {
    if (!navigator.onLine) {
      setOffline(true);
      setLoaded(true);
      return;
    }
    setOffline(false);
    startTransition(async () => {
      const data = await getEncounterAction(encounterId);
      if ("metadataOnly" in data) {
        setLoaded(true);
        return;
      }
      const soap = data.sections.find((s) => s.sectionType === "EVOLUCAO_SOAP");
      if (soap && "content" in soap) {
        setSoapSectionId(soap.id);
        setSoapContent(soap.content ?? "");
      }
      setPatientName(data.encounter.patient?.fullName ?? null);
      setLoaded(true);
    });
  }, [encounterId]);

  useEffect(() => {
    load();
  }, [load]);

  if (!loaded && pending) return <MobileSkeleton rows={5} />;

  if (offline) {
    return (
      <div className="space-y-4">
        <h2 className="font-medium">Atendimento indisponível offline</h2>
        <p className="text-sm text-zinc-500">
          Conteúdo clínico exige conexão e assinatura no servidor.
        </p>
        <Link href="/m/hoje" className="text-sm text-blue-600">
          Voltar
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Link href="/m/hoje" className="text-sm text-blue-600">
        ← Hoje
      </Link>
      <h2 className="font-medium">{patientName ?? "Atendimento"}</h2>

      <section className="space-y-2">
        <h3 className="text-sm font-medium">Evolução SOAP</h3>
        <MobileVoiceInput
          value={soapContent}
          onChange={setSoapContent}
          placeholder="Subjetivo, objetivo, avaliação e plano…"
        />
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-medium">Prescrição — autocomplete</h3>
        <input
          value={drugQuery}
          onChange={(e) => setDrugQuery(e.target.value)}
          placeholder="Buscar medicamento"
          className="min-h-11 w-full rounded-md border px-3 dark:border-zinc-700"
          onBlur={() =>
            startTransition(async () => {
              if (drugQuery.length >= 2) setDrugs(await searchDrugsAction(drugQuery));
            })
          }
        />
        <ul className="text-sm">
          {drugs.slice(0, 5).map((d) => (
            <li key={d.id}>{d.name}</li>
          ))}
        </ul>
      </section>

      <button
        type="button"
        disabled={pending || !soapSectionId}
        className="min-h-11 w-full rounded-md bg-blue-600 text-sm font-medium text-white disabled:opacity-50"
        onClick={() =>
          startTransition(async () => {
            if (!soapSectionId) return;
            await updateSectionAction({
              encounterId,
              sectionId: soapSectionId,
              content: soapContent,
            });
            await signEncounterAction({ encounterId });
          })
        }
      >
        Salvar e assinar
      </button>
    </div>
  );
}
