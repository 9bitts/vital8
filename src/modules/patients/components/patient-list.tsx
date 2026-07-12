"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatPhone } from "@/lib/crypto/search-hash";
import { createQuickPatientAction } from "@/modules/patients/actions/patient.actions";
import type { PatientListItem } from "@/modules/patients/actions/patient.actions";

type Props = {
  initialData: {
    items: PatientListItem[];
    total: number;
    page: number;
    totalPages: number;
  };
  tags: string[];
  insurers: string[];
  initialQuery?: string;
  initialTag?: string;
  initialInsurer?: string;
  initialIncludeInactive?: boolean;
  initialSortBy?: string;
  initialSortOrder?: string;
};

export function PatientList({
  initialData,
  tags,
  insurers,
  initialQuery = "",
  initialTag = "",
  initialInsurer = "",
  initialIncludeInactive = false,
  initialSortBy = "fullName",
  initialSortOrder = "asc",
}: Props) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [tag, setTag] = useState(initialTag);
  const [insurer, setInsurer] = useState(initialInsurer);
  const [includeInactive, setIncludeInactive] = useState(initialIncludeInactive);
  const [sortBy, setSortBy] = useState(initialSortBy);
  const [sortOrder, setSortOrder] = useState(initialSortOrder);
  const [quickName, setQuickName] = useState("");
  const [quickPhone, setQuickPhone] = useState("");
  const [quickError, setQuickError] = useState("");
  const [quickOpen, setQuickOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function applyFilters() {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (tag) params.set("tag", tag);
    if (insurer) params.set("insurer", insurer);
    if (includeInactive) params.set("inativos", "1");
    if (sortBy !== "fullName") params.set("sort", sortBy);
    if (sortOrder !== "asc") params.set("order", sortOrder);
    router.push(`/app/pacientes?${params.toString()}`);
  }

  function handleQuickCreate(e: React.FormEvent) {
    e.preventDefault();
    setQuickError("");
    startTransition(async () => {
      const result = await createQuickPatientAction({
        fullName: quickName,
        phone: quickPhone,
      });
      if (!result.success) {
        setQuickError(result.error);
        return;
      }
      setQuickOpen(false);
      setQuickName("");
      setQuickPhone("");
      router.push(`/app/pacientes/${result.data!.id}/editar`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[200px]">
          <Label htmlFor="search">Buscar</Label>
          <Input
            id="search"
            placeholder="Nome, CPF, telefone ou carteirinha..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applyFilters()}
          />
        </div>
        <div className="w-40">
          <Label htmlFor="tag">Tag</Label>
          <select
            id="tag"
            className="flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm"
            value={tag}
            onChange={(e) => setTag(e.target.value)}
          >
            <option value="">Todas</option>
            {tags.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div className="w-44">
          <Label htmlFor="insurer">Convênio</Label>
          <select
            id="insurer"
            className="flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm"
            value={insurer}
            onChange={(e) => setInsurer(e.target.value)}
          >
            <option value="">Todos</option>
            {insurers.map((i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-2 pb-2 text-sm">
          <input
            type="checkbox"
            checked={includeInactive}
            onChange={(e) => setIncludeInactive(e.target.checked)}
          />
          Inativos
        </label>
        <div className="w-36">
          <Label htmlFor="sort">Ordenar</Label>
          <select
            id="sort"
            className="flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm"
            value={`${sortBy}-${sortOrder}`}
            onChange={(e) => {
              const [sb, so] = e.target.value.split("-");
              setSortBy(sb!);
              setSortOrder(so!);
            }}
          >
            <option value="fullName-asc">Nome A-Z</option>
            <option value="fullName-desc">Nome Z-A</option>
            <option value="createdAt-desc">Mais recentes</option>
            <option value="birthDate-asc">Nascimento</option>
          </select>
        </div>
        <Button onClick={applyFilters} disabled={isPending}>
          Filtrar
        </Button>
        <Dialog open={quickOpen} onOpenChange={setQuickOpen}>
          <DialogTrigger asChild>
            <Button variant="outline">Cadastro rápido</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cadastro rápido</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleQuickCreate} className="space-y-3">
              <div>
                <Label htmlFor="quickName">Nome</Label>
                <Input
                  id="quickName"
                  value={quickName}
                  onChange={(e) => setQuickName(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="quickPhone">Telefone</Label>
                <Input
                  id="quickPhone"
                  value={quickPhone}
                  onChange={(e) => setQuickPhone(e.target.value)}
                  required
                />
              </div>
              {quickError && (
                <p className="text-sm text-red-600">{quickError}</p>
              )}
              <DialogFooter>
                <Button type="submit" disabled={isPending}>
                  {isPending ? "Salvando..." : "Cadastrar"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
        <Button asChild>
          <Link href="/app/pacientes/novo">Novo paciente</Link>
        </Button>
      </div>

      <div className="rounded-lg border border-zinc-200">
        <table className="w-full text-sm">
          <thead className="border-b bg-zinc-50 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Nome</th>
              <th className="px-4 py-3 font-medium">Telefone</th>
              <th className="px-4 py-3 font-medium">Convênio</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {initialData.items.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-zinc-500">
                  Nenhum paciente encontrado
                </td>
              </tr>
            ) : (
              initialData.items.map((patient) => (
                <tr key={patient.id} className="border-b last:border-0">
                  <td className="px-4 py-3">
                    <div className="font-medium">{patient.fullName}</div>
                    {patient.socialName && (
                      <div className="text-xs text-zinc-500">
                        {patient.socialName}
                      </div>
                    )}
                    {patient.tags.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {patient.tags.map((t) => (
                          <Badge key={t} variant="secondary" className="text-[10px]">
                            {t}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {patient.phones[0]
                      ? formatPhone(patient.phones[0].number)
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {patient.primaryInsurance?.insurerName ?? "Particular"}
                  </td>
                  <td className="px-4 py-3">
                    {patient.isIncomplete ? (
                      <Badge variant="warning">Incompleto</Badge>
                    ) : patient.isActive ? (
                      <Badge variant="secondary">Ativo</Badge>
                    ) : (
                      <Badge variant="outline">Inativo</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/app/pacientes/${patient.id}`}>Abrir</Link>
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-zinc-600">
        <span>
          {initialData.total} paciente(s) — página {initialData.page} de{" "}
          {initialData.totalPages || 1}
        </span>
        <div className="flex gap-2">
          {initialData.page > 1 && (
            <Button variant="outline" size="sm" asChild>
              <Link
                href={`/app/pacientes?page=${initialData.page - 1}${query ? `&q=${query}` : ""}`}
              >
                Anterior
              </Link>
            </Button>
          )}
          {initialData.page < initialData.totalPages && (
            <Button variant="outline" size="sm" asChild>
              <Link
                href={`/app/pacientes?page=${initialData.page + 1}${query ? `&q=${query}` : ""}`}
              >
                Próxima
              </Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
