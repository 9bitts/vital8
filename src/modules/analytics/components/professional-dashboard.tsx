"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatBRL } from "@/lib/money";

type Data = Awaited<
  ReturnType<
    typeof import("../services/dashboard.service").getProfessionalDashboard
  >
>;

type Props = { data: Data };

export function ProfessionalDashboard({ data }: Props) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardHeader><CardTitle className="text-sm">Atendimentos</CardTitle></CardHeader><CardContent><p className="text-2xl font-semibold">{data.completed}</p></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">No-show</CardTitle></CardHeader><CardContent><p className="text-2xl font-semibold">{data.noShowRate}%</p></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">Ocupação</CardTitle></CardHeader><CardContent><p className="text-2xl font-semibold">{data.occupationPct}%</p></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">Repasse</CardTitle></CardHeader><CardContent><p className="text-2xl font-semibold">{formatBRL(data.commissionCents)}</p></CardContent></Card>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Produção diária</CardTitle></CardHeader>
        <CardContent className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.weekly}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="completed" fill="#7c3aed" name="Atendimentos" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
