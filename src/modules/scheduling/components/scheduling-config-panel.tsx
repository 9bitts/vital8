"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  importNationalHolidaysAction,
  listHolidaysAction,
  listProfessionalsAction,
  listRoomsAction,
  listScheduleTemplatesAction,
  listServicesAction,
  saveHolidayAction,
  saveProfessionalAction,
  saveRoomAction,
  saveScheduleTemplateAction,
  saveSchedulingSettingsAction,
  saveServiceAction,
  getSchedulingSettingsAction,
  deleteScheduleTemplateAction,
} from "@/modules/scheduling/actions/catalog.actions";

export function SchedulingConfigPanel() {
  const [professionals, setProfessionals] = useState<
    Awaited<ReturnType<typeof listProfessionalsAction>>
  >([]);
  const [services, setServices] = useState<
    Awaited<ReturnType<typeof listServicesAction>>
  >([]);
  const [rooms, setRooms] = useState<
    Awaited<ReturnType<typeof listRoomsAction>>
  >([]);
  const [holidays, setHolidays] = useState<
    Awaited<ReturnType<typeof listHolidaysAction>>
  >([]);
  const [settings, setSettings] = useState({ receptionWaitLimitMinutes: 30, professionalCanViewOthers: true });
  const [selectedProf, setSelectedProf] = useState("");
  const [templates, setTemplates] = useState<
    Awaited<ReturnType<typeof listScheduleTemplatesAction>>
  >([]);
  const [pending, startTransition] = useTransition();

  const load = () => {
    startTransition(async () => {
      const [p, s, r, h, st] = await Promise.all([
        listProfessionalsAction(),
        listServicesAction(),
        listRoomsAction(),
        listHolidaysAction(),
        getSchedulingSettingsAction(),
      ]);
      setProfessionals(p);
      setServices(s);
      setRooms(r);
      setHolidays(h);
      setSettings({
        receptionWaitLimitMinutes: st.receptionWaitLimitMinutes ?? 30,
        professionalCanViewOthers: st.professionalCanViewOthers ?? true,
      });
    });
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!selectedProf) return;
    listScheduleTemplatesAction(selectedProf).then(setTemplates);
  }, [selectedProf]);

  return (
    <Tabs defaultValue="professionals">
      <TabsList>
        <TabsTrigger value="professionals">Profissionais</TabsTrigger>
        <TabsTrigger value="services">Serviços</TabsTrigger>
        <TabsTrigger value="rooms">Salas</TabsTrigger>
        <TabsTrigger value="schedule">Grade</TabsTrigger>
        <TabsTrigger value="holidays">Feriados</TabsTrigger>
        <TabsTrigger value="settings">Recepção</TabsTrigger>
      </TabsList>

      <TabsContent value="professionals" className="space-y-4">
        <ProfessionalForm onSaved={load} />
        <ul className="space-y-1 text-sm">
          {professionals.map((p) => (
            <li key={p.id} className="flex items-center gap-2">
              <span
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: p.color }}
              />
              {p.displayName}
              {p.councilType && (
                <span className="text-zinc-400">
                  {p.councilType} {p.councilNumber}/{p.councilState}
                </span>
              )}
            </li>
          ))}
        </ul>
      </TabsContent>

      <TabsContent value="services" className="space-y-4">
        <ServiceForm onSaved={load} />
        <ul className="text-sm">
          {services.map((s) => (
            <li key={s.id}>
              {s.name} — {s.durationMinutes} min — R$ {String(s.privatePrice)}
            </li>
          ))}
        </ul>
      </TabsContent>

      <TabsContent value="rooms" className="space-y-4">
        <RoomForm onSaved={load} />
        <ul className="text-sm">
          {rooms.map((r) => (
            <li key={r.id}>{r.name}</li>
          ))}
        </ul>
      </TabsContent>

      <TabsContent value="schedule" className="space-y-4">
        <div>
          <Label>Profissional</Label>
          <select
            className="w-full rounded border p-2 text-sm"
            value={selectedProf}
            onChange={(e) => setSelectedProf(e.target.value)}
          >
            <option value="">Selecione</option>
            {professionals.map((p) => (
              <option key={p.id} value={p.id}>
                {p.displayName}
              </option>
            ))}
          </select>
        </div>
        {selectedProf && (
          <>
            <ScheduleTemplateForm
              professionalId={selectedProf}
              rooms={rooms}
              onSaved={() =>
                listScheduleTemplatesAction(selectedProf).then(setTemplates)
              }
            />
            <ul className="text-sm">
              {templates.map((t) => (
                <li key={t.id} className="flex justify-between">
                  {t.weekday} {t.startTime}-{t.endTime} (intervalo{" "}
                  {t.slotIntervalMinutes} min)
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      startTransition(async () => {
                        await deleteScheduleTemplateAction(t.id);
                        listScheduleTemplatesAction(selectedProf).then(
                          setTemplates,
                        );
                      })
                    }
                  >
                    Remover
                  </Button>
                </li>
              ))}
            </ul>
          </>
        )}
      </TabsContent>

      <TabsContent value="holidays" className="space-y-4">
        <HolidayForm onSaved={load} />
        <Button
          variant="outline"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await importNationalHolidaysAction(2026);
              load();
            })
          }
        >
          Importar feriados nacionais 2026
        </Button>
        <ul className="text-sm">
          {holidays.map((h) => (
            <li key={h.id}>
              {new Date(h.date).toLocaleDateString("pt-BR")} — {h.name}
            </li>
          ))}
        </ul>
      </TabsContent>

      <TabsContent value="settings" className="space-y-4">
        <div>
          <Label>Limite de espera (minutos)</Label>
          <Input
            type="number"
            value={settings.receptionWaitLimitMinutes}
            onChange={(e) =>
              setSettings((s) => ({
                ...s,
                receptionWaitLimitMinutes: Number(e.target.value),
              }))
            }
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={settings.professionalCanViewOthers}
            onChange={(e) =>
              setSettings((s) => ({
                ...s,
                professionalCanViewOthers: e.target.checked,
              }))
            }
          />
          Profissional pode ver agenda de outros
        </label>
        <Button
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await saveSchedulingSettingsAction(settings);
            })
          }
        >
          Salvar
        </Button>
      </TabsContent>
    </Tabs>
  );
}

function ProfessionalForm({ onSaved }: { onSaved: () => void }) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("#3B82F6");
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-wrap gap-2 rounded border p-3">
      <Input placeholder="Nome" value={name} onChange={(e) => setName(e.target.value)} />
      <Input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-16" />
      <Button
        disabled={pending || !name}
        onClick={() =>
          startTransition(async () => {
            await saveProfessionalAction({ displayName: name, color, specialties: [] });
            setName("");
            onSaved();
          })
        }
      >
        Adicionar profissional
      </Button>
    </div>
  );
}

function ServiceForm({ onSaved }: { onSaved: () => void }) {
  const [name, setName] = useState("");
  const [duration, setDuration] = useState(30);
  const [price, setPrice] = useState(150);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-wrap gap-2 rounded border p-3">
      <Input placeholder="Nome" value={name} onChange={(e) => setName(e.target.value)} />
      <Input type="number" value={duration} onChange={(e) => setDuration(Number(e.target.value))} className="w-24" />
      <Input type="number" value={price} onChange={(e) => setPrice(Number(e.target.value))} className="w-28" />
      <Button
        disabled={pending || !name}
        onClick={() =>
          startTransition(async () => {
            await saveServiceAction({ name, durationMinutes: duration, privatePrice: price });
            setName("");
            onSaved();
          })
        }
      >
        Adicionar serviço
      </Button>
    </div>
  );
}

function RoomForm({ onSaved }: { onSaved: () => void }) {
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex gap-2 rounded border p-3">
      <Input placeholder="Nome da sala" value={name} onChange={(e) => setName(e.target.value)} />
      <Button
        disabled={pending || !name}
        onClick={() =>
          startTransition(async () => {
            await saveRoomAction({ name });
            setName("");
            onSaved();
          })
        }
      >
        Adicionar sala
      </Button>
    </div>
  );
}

function HolidayForm({ onSaved }: { onSaved: () => void }) {
  const [date, setDate] = useState("");
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-wrap gap-2 rounded border p-3">
      <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      <Input placeholder="Nome" value={name} onChange={(e) => setName(e.target.value)} />
      <Button
        disabled={pending || !date || !name}
        onClick={() =>
          startTransition(async () => {
            await saveHolidayAction({ date: new Date(date), name });
            setDate("");
            setName("");
            onSaved();
          })
        }
      >
        Adicionar feriado
      </Button>
    </div>
  );
}

function ScheduleTemplateForm({
  professionalId,
  rooms,
  onSaved,
}: {
  professionalId: string;
  rooms: { id: string; name: string }[];
  onSaved: () => void;
}) {
  const [weekday, setWeekday] = useState("SEGUNDA");
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("12:00");
  const [interval, setInterval] = useState(30);
  const [roomId, setRoomId] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <div className="grid gap-2 rounded border p-3 sm:grid-cols-2">
      <select className="rounded border p-2 text-sm" value={weekday} onChange={(e) => setWeekday(e.target.value)}>
        {["SEGUNDA", "TERCA", "QUARTA", "QUINTA", "SEXTA", "SABADO"].map((d) => (
          <option key={d} value={d}>{d}</option>
        ))}
      </select>
      <Input value={startTime} onChange={(e) => setStartTime(e.target.value)} placeholder="Início HH:MM" />
      <Input value={endTime} onChange={(e) => setEndTime(e.target.value)} placeholder="Fim HH:MM" />
      <Input type="number" value={interval} onChange={(e) => setInterval(Number(e.target.value))} />
      <select className="rounded border p-2 text-sm" value={roomId} onChange={(e) => setRoomId(e.target.value)}>
        <option value="">Sala padrão</option>
        {rooms.map((r) => (
          <option key={r.id} value={r.id}>{r.name}</option>
        ))}
      </select>
      <Button
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            await saveScheduleTemplateAction({
              professionalId,
              weekday,
              startTime,
              endTime,
              slotIntervalMinutes: interval,
              defaultRoomId: roomId || null,
            });
            onSaved();
          })
        }
      >
        Adicionar bloco
      </Button>
    </div>
  );
}
