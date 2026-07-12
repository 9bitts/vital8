"use client";

import { Fragment, useCallback, useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  listAppointmentsAction,
  rescheduleAppointmentAction,
} from "@/modules/scheduling/actions/appointment.actions";
import {
  listProfessionalsAction,
  listRoomsAction,
  listServicesAction,
} from "@/modules/scheduling/actions/catalog.actions";
import { STATUS_COLORS, STATUS_LABELS } from "@/modules/scheduling/lib/labels";
import { AppointmentFormDialog } from "./appointment-form-dialog";

type AppointmentRow = Awaited<
  ReturnType<typeof listAppointmentsAction>
>[number];

type Props = {
  initialDate: string;
  initialView: "day" | "week" | "month";
};

const HOURS = Array.from({ length: 12 }, (_, i) => i + 7);

function formatDateKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function AgendaView({ initialDate, initialView }: Props) {
  const [view, setView] = useState(initialView);
  const [date, setDate] = useState(new Date(initialDate));
  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [professionals, setProfessionals] = useState<
    Awaited<ReturnType<typeof listProfessionalsAction>>
  >([]);
  const [rooms, setRooms] = useState<
    Awaited<ReturnType<typeof listRoomsAction>>
  >([]);
  const [services, setServices] = useState<
    Awaited<ReturnType<typeof listServicesAction>>
  >([]);
  const [filterProf, setFilterProf] = useState<string[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalSlot, setModalSlot] = useState<{
    startsAt: Date;
    professionalId?: string;
  } | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const load = useCallback(() => {
    startTransition(async () => {
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = addDays(start, view === "month" ? 31 : view === "week" ? 7 : 1);

      const [appts, profs, rms, svcs] = await Promise.all([
        listAppointmentsAction({
          start,
          end,
          professionalIds: filterProf.length ? filterProf : undefined,
        }),
        listProfessionalsAction(),
        listRoomsAction(),
        listServicesAction(),
      ]);

      setAppointments(appts);
      setProfessionals(profs.filter((p) => p.isActive));
      setRooms(rms);
      setServices(svcs);
      if (filterProf.length === 0) {
        setFilterProf(profs.filter((p) => p.isActive).map((p) => p.id));
      }
    });
  }, [date, view, filterProf]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "t" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setDate(new Date());
      }
      if (e.key === "ArrowLeft") setDate((d) => addDays(d, -1));
      if (e.key === "ArrowRight") setDate((d) => addDays(d, 1));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const visibleProfs = professionals.filter((p) => filterProf.includes(p.id));

  function handleDrop(
    e: React.DragEvent,
    targetProfId: string,
    hour: number,
    minute: number,
  ) {
    e.preventDefault();
    const id = e.dataTransfer.getData("appointmentId") || dragId;
    if (!id) return;

    const appt = appointments.find((a) => a.id === id);
    if (!appt) return;

    const newStart = new Date(date);
    newStart.setHours(hour, minute, 0, 0);

    if (
      !confirm(
        `Remarcar ${appt.patient.fullName} para ${newStart.toLocaleString("pt-BR")}?`,
      )
    ) {
      return;
    }

    startTransition(async () => {
      const result = await rescheduleAppointmentAction({
        appointmentId: id,
        startsAt: newStart,
        professionalId: targetProfId,
      });
      if (!result.success) {
        alert(result.error);
        return;
      }
      load();
    });
  }

  if (view !== "day") {
    return (
      <div className="space-y-4">
        <AgendaToolbar
          view={view}
          setView={setView}
          date={date}
          setDate={setDate}
          pending={pending}
          onToday={() => setDate(new Date())}
        />
        <p className="text-sm text-zinc-500">
          Visão {view === "week" ? "semanal" : "mensal"} — {appointments.length}{" "}
          agendamentos no período.
        </p>
        <div className="grid gap-2">
          {appointments.map((a) => (
            <div
              key={a.id}
              className={`rounded border p-2 text-sm ${STATUS_COLORS[a.status]}`}
            >
              <span className="font-medium">
                {a.startsAt.toLocaleString("pt-BR", {
                  dateStyle: "short",
                  timeStyle: "short",
                })}
              </span>{" "}
              — {a.patient.socialName || a.patient.fullName} ·{" "}
              {a.professional.displayName} · {a.service.name} ·{" "}
              {STATUS_LABELS[a.status]}
            </div>
          ))}
        </div>
        <AppointmentFormDialog
          open={modalOpen}
          onOpenChange={setModalOpen}
          slot={modalSlot}
          professionals={professionals}
          services={services}
          rooms={rooms}
          onSaved={load}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <AgendaToolbar
        view={view}
        setView={setView}
        date={date}
        setDate={setDate}
        pending={pending}
        onToday={() => setDate(new Date())}
      />

      <div className="flex flex-wrap gap-2">
        {professionals.map((p) => (
          <label key={p.id} className="flex items-center gap-1 text-xs">
            <input
              type="checkbox"
              checked={filterProf.includes(p.id)}
              onChange={(e) =>
                setFilterProf((prev) =>
                  e.target.checked
                    ? [...prev, p.id]
                    : prev.filter((x) => x !== p.id),
                )
              }
            />
            <span
              className="inline-block h-3 w-3 rounded-full"
              style={{ backgroundColor: p.color }}
            />
            {p.displayName}
          </label>
        ))}
      </div>

      <div
        className="overflow-x-auto rounded border"
        style={{
          display: "grid",
          gridTemplateColumns: `60px repeat(${visibleProfs.length}, minmax(160px, 1fr))`,
        }}
      >
        <div className="border-b bg-zinc-50 p-2 text-xs font-medium">Hora</div>
        {visibleProfs.map((p) => (
          <div
            key={p.id}
            className="border-b border-l bg-zinc-50 p-2 text-xs font-medium"
            style={{ borderTopColor: p.color, borderTopWidth: 3 }}
          >
            {p.displayName}
          </div>
        ))}

        {HOURS.map((hour) => (
          <Fragment key={`row-${hour}`}>
            <div className="border-b p-1 text-xs text-zinc-500">
              {String(hour).padStart(2, "0")}:00
            </div>
            {visibleProfs.map((prof) => {
              const cellAppts = appointments.filter(
                (a) =>
                  a.professionalId === prof.id &&
                  a.startsAt.getHours() === hour &&
                  formatDateKey(a.startsAt) === formatDateKey(date),
              );

              return (
                <div
                  key={`${prof.id}-${hour}`}
                  className="relative min-h-[64px] border-b border-l p-1"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => handleDrop(e, prof.id, hour, 0)}
                  onDoubleClick={() => {
                    const startsAt = new Date(date);
                    startsAt.setHours(hour, 0, 0, 0);
                    setModalSlot({ startsAt, professionalId: prof.id });
                    setModalOpen(true);
                  }}
                >
                  {cellAppts.map((a) => (
                    <div
                      key={a.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData("appointmentId", a.id);
                        setDragId(a.id);
                      }}
                      className={`mb-1 cursor-grab rounded border px-1 py-0.5 text-[11px] ${STATUS_COLORS[a.status]}`}
                      title={`${a.patient.fullName} — ${a.service.name}`}
                    >
                      {(a.patient.socialName || a.patient.fullName).split(" ")[0]}{" "}
                      · {a.startsAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  ))}
                </div>
              );
            })}
          </Fragment>
        ))}
      </div>

      <AppointmentFormDialog
        open={modalOpen}
        onOpenChange={setModalOpen}
        slot={modalSlot}
        professionals={professionals}
        services={services}
        rooms={rooms}
        onSaved={load}
      />
    </div>
  );
}

function AgendaToolbar({
  view,
  setView,
  date,
  setDate,
  pending,
  onToday,
}: {
  view: "day" | "week" | "month";
  setView: (v: "day" | "week" | "month") => void;
  date: Date;
  setDate: (d: Date) => void;
  pending: boolean;
  onToday: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" size="sm" onClick={onToday}>
        Hoje
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setDate(addDays(date, -1))}
      >
        ←
      </Button>
      <span className="text-sm font-medium">
        {date.toLocaleDateString("pt-BR", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        })}
      </span>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setDate(addDays(date, 1))}
      >
        →
      </Button>
      <div className="flex gap-1">
        {(["day", "week", "month"] as const).map((v) => (
          <Button
            key={v}
            size="sm"
            variant={view === v ? "default" : "outline"}
            onClick={() => setView(v)}
          >
            {v === "day" ? "Dia" : v === "week" ? "Semana" : "Mês"}
          </Button>
        ))}
      </div>
      {pending && <Badge variant="warning">Atualizando…</Badge>}
      <span className="text-xs text-zinc-400">Ctrl+T = hoje</span>
    </div>
  );
}
