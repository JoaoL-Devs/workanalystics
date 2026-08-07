import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Trash2, RotateCcw, Clock, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  fetchTasks,
  deleteTaskRow,
  formatDateTime,
  durationBetween,
  type Task,
} from "@/lib/task-storage";

export const Route = createFileRoute("/_authenticated/tarefas-passadas")({
  head: () => ({
    meta: [
      { title: "Tarefas passadas — Gerenciador de Tarefas" },
      { name: "description", content: "Histórico de tarefas concluídas com data e hora de resolução." },
    ],
  }),
  component: PastTasks,
});

function PastTasks() {
  const [archive, setArchive] = useState<Task[]>([]);

  useEffect(() => {
    fetchTasks().then((r) => setArchive(r.archive));
  }, []);

  const grouped = useMemo(() => {
    const sorted = [...archive].sort((a, b) => {
      const ax = a.closedAt ?? a.archivedAt ?? a.createdAt;
      const bx = b.closedAt ?? b.archivedAt ?? b.createdAt;
      return bx.localeCompare(ax);
    });
    const map = new Map<string, Task[]>();
    for (const t of sorted) {
      const ref = t.closedAt ?? t.archivedAt ?? t.createdAt;
      const key = new Date(ref).toISOString().slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    }
    return Array.from(map.entries());
  }, [archive]);

  async function removeOne(id: string) {
    await deleteTaskRow(id);
    setArchive((prev) => prev.filter((t) => t.id !== id));
  }

  async function clearAll() {
    if (!confirm("Apagar todo o histórico de tarefas passadas? Essa ação não pode ser desfeita.")) return;
    await Promise.all(archive.map((t) => deleteTaskRow(t.id)));
    setArchive([]);
  }

  async function exportPdf() {
    const { default: jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");

    const doc = new jsPDF({ orientation: "landscape" });
    const now = new Date();

    doc.setFontSize(16);
    doc.text("Relatório de atividades concluídas", 14, 16);
    doc.setFontSize(10);
    doc.text(`Gerado em ${now.toLocaleString("pt-BR")} — ${archive.length} atividade(s)`, 14, 22);

    let startY = 30;
    for (const [day, items] of grouped) {
      autoTable(doc, {
        startY,
        head: [[`${formatDayLabel(day)} (${items.length})`, "", "", "", ""]],
        body: [],
        theme: "plain",
        headStyles: { fontStyle: "bold", fontSize: 11 },
      });
      autoTable(doc, {
        startY: (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY,
        head: [["Tarefa", "Descrição", "Início", "Resolvida em", "Duração"]],
        body: items.map((t) => [
          t.title,
          t.description ?? "—",
          formatDateTime(t.openedAt),
          formatDateTime(t.closedAt),
          durationBetween(t.openedAt, t.closedAt),
        ]),
        styles: { fontSize: 9, cellPadding: 2 },
        headStyles: { fillColor: [40, 40, 45] },
        columnStyles: { 0: { cellWidth: 60 }, 1: { cellWidth: 80 } },
      });
      startY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
    }

    doc.save(`relatorio-atividades-${now.toISOString().slice(0, 10)}.pdf`);
  }



  function formatDayLabel(iso: string) {
    const d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:py-12">
        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Tarefas passadas</h1>
            <p className="mt-2 text-muted-foreground">Histórico de tarefas resolvidas, com a data e hora em que foram concluídas.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline"><Link to="/"><ArrowLeft /> Voltar</Link></Button>
            {archive.length > 0 && (
              <Button variant="destructive" onClick={clearAll}><RotateCcw /> Limpar histórico</Button>
            )}
          </div>
        </header>

        {archive.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center text-sm text-muted-foreground">
              Nenhuma tarefa arquivada ainda. Use "Encerrar dia" na tela inicial para arquivar as tarefas concluídas.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {grouped.map(([day, items]) => (
              <Card key={day}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <CardTitle className="capitalize">{formatDayLabel(day)}</CardTitle>
                  <Badge variant="outline">{items.length} {items.length === 1 ? "tarefa" : "tarefas"}</Badge>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tarefa</TableHead>
                        <TableHead>Início</TableHead>
                        <TableHead>Resolvida em</TableHead>
                        <TableHead>Duração</TableHead>
                        <TableHead>Arquivada em</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((t) => (
                        <TableRow key={t.id}>
                          <TableCell className="max-w-[260px]">
                            <div className="font-medium">{t.title}</div>
                            {t.description && <div className="text-xs text-muted-foreground line-clamp-2">{t.description}</div>}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-sm">{formatDateTime(t.openedAt)}</TableCell>
                          <TableCell className="whitespace-nowrap text-sm font-medium">{formatDateTime(t.closedAt)}</TableCell>
                          <TableCell className="whitespace-nowrap text-sm">
                            <Clock className="mr-1 inline size-3.5 text-muted-foreground" />{durationBetween(t.openedAt, t.closedAt)}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{formatDateTime(t.archivedAt)}</TableCell>
                          <TableCell className="text-right">
                            <Button size="icon" variant="ghost" onClick={() => removeOne(t.id)} title="Remover do histórico"><Trash2 /></Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
