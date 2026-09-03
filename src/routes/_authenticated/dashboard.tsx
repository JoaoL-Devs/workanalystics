import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Clock, Trophy, CalendarDays, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { fetchTasks, type Task } from "@/lib/task-storage";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard completo — Gerenciador de Tarefas" },
      {
        name: "description",
        content:
          "Relatório completo de desempenho com todas as atividades concluídas, incluindo as já arquivadas no histórico.",
      },
      { property: "og:title", content: "Dashboard completo de atividades" },
      {
        property: "og:description",
        content: "Veja seu desempenho histórico: tarefas concluídas por dia, mês, dia da semana e horário.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FullDashboard,
});

const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

function formatMinutes(min: number) {
  if (!min) return "0min";
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}min`;
  return `${h}h ${m}min`;
}

function refDate(t: Task) {
  return t.closedAt ?? t.archivedAt ?? t.createdAt;
}

function minutesOf(t: Task) {
  if (!t.openedAt || !t.closedAt) return 0;
  const ms = new Date(t.closedAt).getTime() - new Date(t.openedAt).getTime();
  return ms > 0 ? Math.floor(ms / 60000) : 0;
}

function FullDashboard() {
  const [all, setAll] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTasks()
      .then((r) => setAll([...r.tasks, ...r.archive]))
      .finally(() => setLoading(false));
  }, []);

  const done = useMemo(() => all.filter((t) => t.status === "concluido" && refDate(t)), [all]);

  const data = useMemo(() => {
    const byDay = new Map<string, { concluidas: number; minutos: number }>();
    const byMonth = new Map<string, { concluidas: number; minutos: number }>();
    const byWeekday = Array.from({ length: 7 }, () => 0);
    const byHour = Array.from({ length: 24 }, () => 0);
    let totalMin = 0;

    for (const t of done) {
      const d = new Date(refDate(t)!);
      const dayKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const monthKey = dayKey.slice(0, 7);
      const min = minutesOf(t);
      totalMin += min;

      const day = byDay.get(dayKey) ?? { concluidas: 0, minutos: 0 };
      day.concluidas += 1;
      day.minutos += min;
      byDay.set(dayKey, day);

      const month = byMonth.get(monthKey) ?? { concluidas: 0, minutos: 0 };
      month.concluidas += 1;
      month.minutos += min;
      byMonth.set(monthKey, month);

      byWeekday[d.getDay()] += 1;
      byHour[d.getHours()] += 1;
    }

    // fill every day between first and last activity
    const keys = Array.from(byDay.keys()).sort();
    const daily: { key: string; label: string; full: string; concluidas: number; minutos: number }[] = [];
    if (keys.length) {
      const start = new Date(keys[0] + "T00:00:00");
      const end = new Date(keys[keys.length - 1] + "T00:00:00");
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        const v = byDay.get(key) ?? { concluidas: 0, minutos: 0 };
        daily.push({
          key,
          label: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
          full: d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" }),
          ...v,
        });
      }
    }

    const monthly = Array.from(byMonth.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, v]) => ({
        key,
        label: new Date(key + "-01T00:00:00").toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }),
        ...v,
      }));

    const weekday = byWeekday.map((concluidas, i) => ({ key: WEEKDAYS[i], label: WEEKDAYS[i].slice(0, 3), concluidas }));
    const hourly = byHour.map((concluidas, i) => ({ key: `${i}h`, label: `${String(i).padStart(2, "0")}h`, concluidas }));

    const ranking = [...daily].filter((d) => d.concluidas > 0).sort((a, b) => b.concluidas - a.concluidas || b.minutos - a.minutos);
    const activeDays = ranking.length;

    // longest streak of consecutive active days
    let streak = 0;
    let current = 0;
    for (const d of daily) {
      if (d.concluidas > 0) {
        current += 1;
        streak = Math.max(streak, current);
      } else current = 0;
    }

    return {
      daily,
      monthly,
      weekday,
      hourly,
      ranking,
      activeDays,
      streak,
      totalMin,
      total: done.length,
      first: keys[0],
      last: keys[keys.length - 1],
    };
  }, [done]);

  const chartConfig = {
    concluidas: { label: "Concluídas", color: "hsl(var(--primary))" },
    minutos: { label: "Minutos", color: "hsl(var(--primary))" },
  } satisfies ChartConfig;

  const kpis = [
    { label: "Atividades concluídas", value: String(data.total), icon: ListChecks },
    { label: "Tempo total registrado", value: formatMinutes(data.totalMin), icon: Clock },
    {
      label: "Média por dia ativo",
      value: data.activeDays ? (data.total / data.activeDays).toFixed(1) : "0",
      icon: CalendarDays,
    },
    { label: "Maior sequência de dias", value: `${data.streak} dia(s)`, icon: Trophy },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:py-12">
        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Dashboard completo</h1>
            <p className="mt-2 text-muted-foreground">
              Todas as atividades concluídas — inclusive as já arquivadas em “Tarefas passadas”.
              {data.first && (
                <> {" "}Período: {new Date(data.first + "T00:00:00").toLocaleDateString("pt-BR")} a {new Date(data.last + "T00:00:00").toLocaleDateString("pt-BR")}.</>
              )}
            </p>
          </div>
          <Button asChild variant="outline"><Link to="/"><ArrowLeft /> Voltar</Link></Button>
        </header>

        {loading ? (
          <Card><CardContent className="py-16 text-center text-sm text-muted-foreground">Carregando dados…</CardContent></Card>
        ) : data.total === 0 ? (
          <Card><CardContent className="py-16 text-center text-sm text-muted-foreground">Nenhuma atividade concluída registrada ainda.</CardContent></Card>
        ) : (
          <div className="space-y-8">
            <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {kpis.map((k) => (
                <Card key={k.label}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 text-xs uppercase text-muted-foreground">
                      <k.icon className="size-3.5" /> {k.label}
                    </div>
                    <div className="mt-1 text-2xl font-semibold">{k.value}</div>
                  </CardContent>
                </Card>
              ))}
            </section>

            <Card>
              <CardHeader>
                <CardTitle>Atividades concluídas por dia</CardTitle>
                <p className="text-sm text-muted-foreground">Histórico completo, dia a dia.</p>
              </CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} className="h-[300px] w-full">
                  <BarChart data={data.daily}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} interval="preserveStartEnd" minTickGap={16} />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={28} />
                    <ChartTooltip cursor={false} content={<ChartTooltipContent labelFormatter={(_v, p) => (p?.[0]?.payload as { full?: string })?.full ?? ""} />} />
                    <Bar dataKey="concluidas" fill="var(--color-concluidas)" radius={4} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>

            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader><CardTitle>Evolução por mês</CardTitle></CardHeader>
                <CardContent>
                  <ChartContainer config={chartConfig} className="h-[240px] w-full">
                    <LineChart data={data.monthly}>
                      <CartesianGrid vertical={false} strokeDasharray="3 3" />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
                      <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={28} />
                      <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                      <Line dataKey="concluidas" stroke="var(--color-concluidas)" strokeWidth={2} dot />
                    </LineChart>
                  </ChartContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Por dia da semana</CardTitle></CardHeader>
                <CardContent>
                  <ChartContainer config={chartConfig} className="h-[240px] w-full">
                    <BarChart data={data.weekday}>
                      <CartesianGrid vertical={false} strokeDasharray="3 3" />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
                      <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={28} />
                      <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                      <Bar dataKey="concluidas" fill="var(--color-concluidas)" radius={4} />
                    </BarChart>
                  </ChartContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Por horário de conclusão</CardTitle></CardHeader>
                <CardContent>
                  <ChartContainer config={chartConfig} className="h-[240px] w-full">
                    <BarChart data={data.hourly}>
                      <CartesianGrid vertical={false} strokeDasharray="3 3" />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} interval={2} />
                      <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={28} />
                      <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                      <Bar dataKey="concluidas" fill="var(--color-concluidas)" radius={4} />
                    </BarChart>
                  </ChartContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Dias mais produtivos</CardTitle></CardHeader>
                <CardContent>
                  <ol className="space-y-2">
                    {data.ranking.slice(0, 10).map((d, i) => (
                      <li key={d.key} className="flex items-center justify-between rounded-md border p-2 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex size-6 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{i + 1}</span>
                          <span className="capitalize">{d.full}</span>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold">{d.concluidas}</div>
                          <div className="text-xs text-muted-foreground">{formatMinutes(d.minutos)}</div>
                        </div>
                      </li>
                    ))}
                  </ol>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
