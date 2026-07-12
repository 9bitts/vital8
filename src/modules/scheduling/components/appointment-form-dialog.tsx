"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createAppointmentAction } from "@/modules/scheduling/actions/appointment.actions";
import { createQuickPatientAction, listPatientsAction } from "@/modules/patients/actions/patient.actions";

type Professional = { id: string; displayName: string };
type Service = { id: string; name: string; durationMinutes: number };
type Room = { id: string; name: string };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slot: { startsAt: Date; professionalId?: string } | null;
  professionals: Professional[];
  services: Service[];
  rooms: Room[];
  onSaved: () => void;
};

export function AppointmentFormDialog({
  open,
  onOpenChange,
  slot,
  professionals,
  services,
  rooms,
  onSaved,
}: Props) {
  const [patientQuery, setPatientQuery] = useState("");
  const [patients, setPatients] = useState<
    { id: string; fullName: string; socialName: string | null }[]
  >([]);
  const [patientId, setPatientId] = useState("");
  const [professionalId, setProfessionalId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [roomId, setRoomId] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [isPrivate, setIsPrivate] = useState(true);
  const [isSqueeze, setIsSqueeze] = useState(false);
  const [showQuick, setShowQuick] = useState(false);
  const [quickName, setQuickName] = useState("");
  const [quickPhone, setQuickPhone] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (slot) {
      setProfessionalId(slot.professionalId ?? "");
      setStartsAt(slot.startsAt.toISOString().slice(0, 16));
    }
  }, [slot]);

  useEffect(() => {
    if (patientQuery.length < 2) {
      setPatients([]);
      return;
    }
    const t = setTimeout(async () => {
      const result = await listPatientsAction({ query: patientQuery, page: 1 });
      if (result.success && result.data?.items) {
        setPatients(
          result.data.items.map((p) => ({
            id: p.id,
            fullName: p.fullName,
            socialName: p.socialName,
          })),
        );
      }
    }, 300);
    return () => clearTimeout(t);
  }, [patientQuery]);

  function handleSubmit() {
    setError("");
    startTransition(async () => {
      const result = await createAppointmentAction({
        patientId,
        professionalId,
        serviceId,
        roomId: roomId || null,
        startsAt: new Date(startsAt),
        isPrivate,
        isSqueeze,
        sendConfirmation: true,
        confirmationChannel: "WHATSAPP",
      });

      if (!result.success) {
        setError(result.error);
        return;
      }

      onOpenChange(false);
      onSaved();
    });
  }

  function handleQuickPatient() {
    startTransition(async () => {
      const result = await createQuickPatientAction({
        fullName: quickName,
        phone: quickPhone,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setPatientId(result.data!.id);
      setShowQuick(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Novo agendamento</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label>Paciente</Label>
            <Input
              placeholder="Buscar paciente..."
              value={patientQuery}
              onChange={(e) => setPatientQuery(e.target.value)}
            />
            {patients.length > 0 && (
              <ul className="mt-1 max-h-32 overflow-auto rounded border text-sm">
                {patients.map((p) => (
                  <li
                    key={p.id}
                    className={`cursor-pointer px-2 py-1 hover:bg-zinc-100 ${patientId === p.id ? "bg-blue-50" : ""}`}
                    onClick={() => {
                      setPatientId(p.id);
                      setPatientQuery(p.socialName || p.fullName);
                      setPatients([]);
                    }}
                  >
                    {p.socialName || p.fullName}
                  </li>
                ))}
              </ul>
            )}
            <Button
              type="button"
              variant="link"
              size="sm"
              className="px-0"
              onClick={() => setShowQuick(!showQuick)}
            >
              Cadastro rápido
            </Button>
            {showQuick && (
              <div className="space-y-2 rounded border p-2">
                <Input
                  placeholder="Nome completo"
                  value={quickName}
                  onChange={(e) => setQuickName(e.target.value)}
                />
                <Input
                  placeholder="Telefone"
                  value={quickPhone}
                  onChange={(e) => setQuickPhone(e.target.value)}
                />
                <Button size="sm" onClick={handleQuickPatient} disabled={pending}>
                  Criar paciente
                </Button>
              </div>
            )}
          </div>

          <div>
            <Label>Profissional</Label>
            <Select value={professionalId} onValueChange={setProfessionalId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {professionals.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Serviço</Label>
            <Select value={serviceId} onValueChange={setServiceId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {services.filter((s) => s).map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name} ({s.durationMinutes} min)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Sala</Label>
            <Select value={roomId} onValueChange={setRoomId}>
              <SelectTrigger>
                <SelectValue placeholder="Opcional" />
              </SelectTrigger>
              <SelectContent>
                {rooms.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Início</Label>
            <Input
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
            />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isPrivate}
              onChange={(e) => setIsPrivate(e.target.checked)}
            />
            Particular
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isSqueeze}
              onChange={(e) => setIsSqueeze(e.target.checked)}
            />
            Encaixe (requer ADMIN)
          </label>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <Button onClick={handleSubmit} disabled={pending || !patientId}>
            Agendar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
