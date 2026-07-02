import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Play, Square, Calendar as CalendarIcon, Clock, FileText, Pencil, Save, X, Archive, History } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Gerenciador de Tarefas" },
      {
        name: "description",
        content:
          "Gerencie suas tarefas com status, datas agendadas e controle de tempo de início e fim.",
      },
      { property: "og:title", content: "Gerenciador de Tarefas" },
      {
        property: "og:description",
        content:
          "Gerencie suas tarefas com status, datas agendadas e controle de tempo de início e fim.",
      },
    ],
  }),
  component: Index,
});

import {
  loadTasks,
  loadArchive,
  formatDateTime,
  durationBetween,
  STORAGE_KEY,
  ARCHIVE_KEY,
  NOTES_STORAGE_KEY,
  type Task,
  type Status,
} from "@/lib/task-storage";



type Note = {
  id: string;
  date: string; // YYYY-MM-DD
  content: string;
  createdAt: string;
  updatedAt: string;
};

function loadNotes(): Note[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(NOTES_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Note[]) : [];
  } catch {
    return [];
  }
}

function todayISODate() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

function formatDateLabel(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}


const statusVariant: Record<Status, { label: string; className: string }> = {
  pendente: {
    label: "Pendente",
    className: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/30",
  },
  agendado: {
    label: "Agendado",
    className: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30",
  },
  concluido: {
    label: "Concluído",
    className: "bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30",
  },
};

function Index() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [archive, setArchive] = useState<Task[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<Status>("pendente");
  const [scheduledFor, setScheduledFor] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [notes, setNotes] = useState<Note[]>([]);
  const [noteDate, setNoteDate] = useState<string>(todayISODate());
  const [noteDraft, setNoteDraft] = useState("");
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);

  useEffect(() => {
    setTasks(loadTasks());
    setArchive(loadArchive());
    setNotes(loadNotes());
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  }, [tasks, loaded]);

  useEffect(() => {
    if (!loaded) return;
    window.localStorage.setItem(ARCHIVE_KEY, JSON.stringify(archive));
  }, [archive, loaded]);

  useEffect(() => {
    if (!loaded) return;
    window.localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(notes));
  }, [notes, loaded]);

  function endDay() {
    const done = tasks.filter((t) => t.status === "concluido");
    const remaining = tasks.filter((t) => t.status !== "concluido");
    if (done.length === 0) {
      alert("Nenhuma tarefa concluída para arquivar. Tarefas pendentes e agendadas permanecem na lista.");
      return;
    }
    if (!confirm(`Arquivar ${done.length} tarefa(s) concluída(s)? As pendentes e agendadas permanecem na lista.`)) return;
    const now = new Date().toISOString();
    const archived = done.map((t) => ({ ...t, archivedAt: now }));
    setArchive((prev) => [...archived, ...prev]);
    setTasks(remaining);
  }



  const stats = useMemo(() => {
    return {
      total: tasks.length,
      pendente: tasks.filter((t) => t.status === "pendente").length,
      agendado: tasks.filter((t) => t.status === "agendado").length,
      concluido: tasks.filter((t) => t.status === "concluido").length,
    };
  }, [tasks]);

  const report = useMemo(() => {
    const days = 14;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const buckets = new Map<string, { date: Date; concluidas: number; minutos: number }>();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      buckets.set(d.toISOString().slice(0, 10), { date: d, concluidas: 0, minutos: 0 });
    }
    for (const t of [...tasks, ...archive]) {
      if (t.status !== "concluido") continue;
      const reference = t.closedAt ?? t.archivedAt ?? t.createdAt;
      if (!reference) continue;
      const key = new Date(reference).toISOString().slice(0, 10);
      const bucket = buckets.get(key);
      if (!bucket) continue;
      bucket.concluidas += 1;
      if (t.openedAt && t.closedAt) {
        const ms = new Date(t.closedAt).getTime() - new Date(t.openedAt).getTime();
        if (ms > 0) bucket.minutos += Math.floor(ms / 60000);
      }
    }

    const series = Array.from(buckets.values()).map((b) => ({
      key: b.date.toISOString().slice(0, 10),
      label: b.date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      full: b.date.toLocaleDateString("pt-BR", {
        weekday: "short",
        day: "2-digit",
        month: "2-digit",
      }),
      concluidas: b.concluidas,
      minutos: b.minutos,
    }));
    const top = [...series]
      .filter((s) => s.concluidas > 0)
      .sort((a, b) => b.concluidas - a.concluidas || b.minutos - a.minutos)
      .slice(0, 5);
    const totalConcluidas = series.reduce((a, s) => a + s.concluidas, 0);
    const totalMinutos = series.reduce((a, s) => a + s.minutos, 0);
    return { series, top, totalConcluidas, totalMinutos };
  }, [tasks, archive]);


  function formatMinutes(min: number) {
    if (!min) return "0min";
    const h = Math.floor(min / 60);
    const m = min % 60;
    if (h === 0) return `${m}min`;
    return `${h}h ${m}min`;
  }

  const chartConfig = {
    concluidas: { label: "Concluídas", color: "hsl(var(--primary))" },
  } satisfies ChartConfig;

  function addTask(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    const now = new Date().toISOString();
    const newTask: Task = {
      id: crypto.randomUUID(),
      title: trimmed.slice(0, 120),
      description: description.trim().slice(0, 500) || undefined,
      status,
      scheduledFor: status === "agendado" && scheduledFor ? scheduledFor : undefined,
      openedAt: status === "concluido" ? now : undefined,
      closedAt: status === "concluido" ? now : undefined,
      createdAt: now,
    };
    setTasks((prev) => [newTask, ...prev]);
    setTitle("");
    setDescription("");
    setStatus("pendente");
    setScheduledFor("");
  }

  function removeTask(id: string) {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }

  function updateTask(id: string, patch: Partial<Task>) {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }

  function changeStatus(task: Task, next: Status) {
    const patch: Partial<Task> = { status: next };
    if (next === "concluido" && !task.closedAt) {
      patch.closedAt = new Date().toISOString();
      if (!task.openedAt) patch.openedAt = task.openedAt ?? task.createdAt;
    }
    updateTask(task.id, patch);
  }

  function startTask(task: Task) {
    updateTask(task.id, {
      openedAt: new Date().toISOString(),
      closedAt: undefined,
      status: task.status === "concluido" ? "pendente" : task.status,
    });
  }

  function stopTask(task: Task) {
    updateTask(task.id, {
      closedAt: new Date().toISOString(),
      status: "concluido",
    });
  }

  function saveNote() {
    const content = noteDraft.trim();
    if (!content) return;
    const now = new Date().toISOString();
    if (editingNoteId) {
      setNotes((prev) =>
        prev.map((n) =>
          n.id === editingNoteId ? { ...n, content, date: noteDate, updatedAt: now } : n,
        ),
      );
      setEditingNoteId(null);
    } else {
      const newNote: Note = {
        id: crypto.randomUUID(),
        date: noteDate,
        content,
        createdAt: now,
        updatedAt: now,
      };
      setNotes((prev) => [newNote, ...prev]);
    }
    setNoteDraft("");
  }

  function editNote(note: Note) {
    setEditingNoteId(note.id);
    setNoteDate(note.date);
    setNoteDraft(note.content);
  }

  function cancelEditNote() {
    setEditingNoteId(null);
    setNoteDraft("");
    setNoteDate(todayISODate());
  }

  function removeNote(id: string) {
    setNotes((prev) => prev.filter((n) => n.id !== id));
    if (editingNoteId === id) cancelEditNote();
  }

  const sortedNotes = useMemo(
    () => [...notes].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.updatedAt.localeCompare(a.updatedAt))),
    [notes],
  );


  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:py-12">
        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Gerenciador de Tarefas
            </h1>
            <p className="mt-2 text-muted-foreground">
              Adicione tarefas, defina status e controle quando você começou e terminou cada uma.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link to="/tarefas-passadas">
                <History /> Ver tarefas passadas
              </Link>
            </Button>
            <Button variant="secondary" onClick={endDay} title="Arquivar concluídas e limpar a lista">
              <Archive /> Encerrar dia
            </Button>
          </div>
        </header>


        <section className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Total", value: stats.total },
            { label: "Pendentes", value: stats.pendente },
            { label: "Agendadas", value: stats.agendado },
            { label: "Concluídas", value: stats.concluido },
          ].map((s) => (
            <Card key={s.label}>
              <CardContent className="p-4">
                <div className="text-xs uppercase text-muted-foreground">{s.label}</div>
                <div className="mt-1 text-2xl font-semibold">{s.value}</div>
              </CardContent>
            </Card>
          ))}
        </section>

        <Card className="mb-8">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Dashboard de atividade</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Tarefas concluídas nos últimos 14 dias
              </p>
            </div>
            <div className="text-right text-sm">
              <div className="text-muted-foreground">14 dias</div>
              <div className="font-semibold">
                {report.totalConcluidas} concluídas · {formatMinutes(report.totalMinutos)}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {report.totalConcluidas === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Ainda não há tarefas concluídas para gerar o relatório.
              </p>
            ) : (
              <div className="grid gap-6 lg:grid-cols-3">
                <div className="lg:col-span-2">
                  <ChartContainer config={chartConfig} className="h-[260px] w-full">
                    <BarChart data={report.series}>
                      <CartesianGrid vertical={false} strokeDasharray="3 3" />
                      <XAxis
                        dataKey="label"
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                      />
                      <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={28} />
                      <ChartTooltip
                        cursor={false}
                        content={
                          <ChartTooltipContent
                            labelFormatter={(_v, payload) =>
                              (payload?.[0]?.payload as { full?: string })?.full ?? ""
                            }
                          />
                        }
                      />
                      <Bar dataKey="concluidas" fill="var(--color-concluidas)" radius={4} />
                    </BarChart>
                  </ChartContainer>
                </div>
                <div>
                  <div className="mb-2 text-sm font-medium">Dias com mais atividade</div>
                  {report.top.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Sem registros.</p>
                  ) : (
                    <ol className="space-y-2">
                      {report.top.map((d, i) => (
                        <li
                          key={d.key}
                          className="flex items-center justify-between rounded-md border p-2 text-sm"
                        >
                          <div className="flex items-center gap-2">
                            <span className="inline-flex size-6 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                              {i + 1}
                            </span>
                            <span className="capitalize">{d.full}</span>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold">{d.concluidas}</div>
                            <div className="text-xs text-muted-foreground">
                              {formatMinutes(d.minutos)}
                            </div>
                          </div>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Nova tarefa</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={addTask} className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-medium">Título</label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex: Estudar TanStack Router"
                  maxLength={120}
                  required
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-medium">Descrição (opcional)</label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Detalhes da tarefa"
                  maxLength={500}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Status</label>
                <Select value={status} onValueChange={(v) => setStatus(v as Status)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="agendado">Agendado para</SelectItem>
                    <SelectItem value="concluido">Concluído</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">
                  <CalendarIcon className="mr-1 inline size-4" />
                  Agendado para
                </label>
                <Input
                  type="datetime-local"
                  value={scheduledFor}
                  onChange={(e) => setScheduledFor(e.target.value)}
                  disabled={status !== "agendado"}
                />
              </div>
              <div className="sm:col-span-2">
                <Button type="submit" className="w-full sm:w-auto">
                  <Plus /> Adicionar tarefa
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Suas tarefas</CardTitle>
          </CardHeader>
          <CardContent>
            {tasks.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Nenhuma tarefa ainda. Adicione a primeira acima.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tarefa</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Agendada</TableHead>
                    <TableHead>Início</TableHead>
                    <TableHead>Fim</TableHead>
                    <TableHead>Duração</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tasks.map((task) => {
                    const v = statusVariant[task.status];
                    return (
                      <TableRow key={task.id}>
                        <TableCell className="max-w-[260px]">
                          <div className="font-medium">{task.title}</div>
                          {task.description && (
                            <div className="text-xs text-muted-foreground line-clamp-2">
                              {task.description}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Select
                            value={task.status}
                            onValueChange={(val) => changeStatus(task, val as Status)}
                          >
                            <SelectTrigger className="h-8 w-[140px]">
                              <SelectValue>
                                <Badge variant="outline" className={v.className}>
                                  {v.label}
                                </Badge>
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pendente">Pendente</SelectItem>
                              <SelectItem value="agendado">Agendado</SelectItem>
                              <SelectItem value="concluido">Concluído</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm">
                          <Input
                            type="datetime-local"
                            className="h-8 w-[200px]"
                            value={task.scheduledFor ?? ""}
                            onChange={(e) =>
                              updateTask(task.id, {
                                scheduledFor: e.target.value || undefined,
                              })
                            }
                          />
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm">
                          {formatDateTime(task.openedAt)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm">
                          {formatDateTime(task.closedAt)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm">
                          <Clock className="mr-1 inline size-3.5 text-muted-foreground" />
                          {durationBetween(task.openedAt, task.closedAt)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {!task.openedAt || task.closedAt ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => startTask(task)}
                                title="Iniciar (registrar hora de abertura)"
                              >
                                <Play /> Iniciar
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => stopTask(task)}
                                title="Finalizar (registrar hora de fechamento)"
                              >
                                <Square /> Finalizar
                              </Button>
                            )}
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => removeTask(task.id)}
                              title="Remover tarefa"
                            >
                              <Trash2 />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="size-5" /> Bloco de notas — relatórios diários
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-[200px_1fr]">
              <div>
                <label className="mb-1 block text-sm font-medium">Data do relatório</label>
                <Input
                  type="date"
                  value={noteDate}
                  onChange={(e) => setNoteDate(e.target.value || todayISODate())}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">
                  {editingNoteId ? "Editando nota" : "Nova nota"}
                </label>
                <Textarea
                  value={noteDraft}
                  onChange={(e) => setNoteDraft(e.target.value)}
                  placeholder="Escreva aqui o relatório do dia: o que fez, bloqueios, próximos passos..."
                  className="min-h-[140px]"
                />
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <Button onClick={saveNote} disabled={!noteDraft.trim()}>
                {editingNoteId ? <><Save /> Salvar alterações</> : <><Plus /> Adicionar nota</>}
              </Button>
              {editingNoteId && (
                <Button variant="outline" onClick={cancelEditNote}>
                  <X /> Cancelar
                </Button>
              )}
            </div>

            <div className="mt-6 space-y-3">
              {sortedNotes.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  Nenhuma nota ainda. Comece registrando o relatório de hoje.
                </p>
              ) : (
                sortedNotes.map((n) => (
                  <div key={n.id} className="rounded-md border p-4">
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <div>
                        <div className="text-sm font-semibold capitalize">
                          {formatDateLabel(n.date)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Atualizado em {formatDateTime(n.updatedAt)}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => editNote(n)}
                          title="Editar nota"
                        >
                          <Pencil />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => removeNote(n.id)}
                          title="Remover nota"
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    </div>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">{n.content}</p>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
