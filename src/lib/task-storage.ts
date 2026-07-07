import { supabase } from "@/integrations/supabase/client";

export type Status = "pendente" | "agendado" | "concluido";

export type Task = {
  id: string;
  title: string;
  description?: string;
  status: Status;
  scheduledFor?: string;
  openedAt?: string;
  closedAt?: string;
  createdAt: string;
  archivedAt?: string;
};

export type Note = {
  id: string;
  date: string;
  content: string;
  createdAt: string;
  updatedAt: string;
};

type TaskRow = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  status: string;
  scheduled_for: string | null;
  opened_at: string | null;
  closed_at: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

type NoteRow = {
  id: string;
  user_id: string;
  date: string;
  content: string;
  created_at: string;
  updated_at: string;
};

function rowToTask(r: TaskRow): Task {
  return {
    id: r.id,
    title: r.title,
    description: r.description ?? undefined,
    status: r.status as Status,
    scheduledFor: r.scheduled_for ?? undefined,
    openedAt: r.opened_at ?? undefined,
    closedAt: r.closed_at ?? undefined,
    archivedAt: r.archived_at ?? undefined,
    createdAt: r.created_at,
  };
}

function rowToNote(r: NoteRow): Note {
  return {
    id: r.id,
    date: r.date,
    content: r.content,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function fetchTasks(): Promise<{ tasks: Task[]; archive: Task[] }> {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  const all = (data as TaskRow[]).map(rowToTask);
  return {
    tasks: all.filter((t) => !t.archivedAt),
    archive: all.filter((t) => !!t.archivedAt),
  };
}

export async function insertTask(userId: string, t: Omit<Task, "id">): Promise<Task> {
  const { data, error } = await supabase
    .from("tasks")
    .insert({
      user_id: userId,
      title: t.title,
      description: t.description ?? null,
      status: t.status,
      scheduled_for: t.scheduledFor ?? null,
      opened_at: t.openedAt ?? null,
      closed_at: t.closedAt ?? null,
      archived_at: t.archivedAt ?? null,
      created_at: t.createdAt,
    })
    .select()
    .single();
  if (error) throw error;
  return rowToTask(data as TaskRow);
}

export async function updateTaskRow(id: string, patch: Partial<Task>): Promise<void> {
  const payload: Record<string, unknown> = {};
  if ("title" in patch) payload.title = patch.title;
  if ("description" in patch) payload.description = patch.description ?? null;
  if ("status" in patch) payload.status = patch.status;
  if ("scheduledFor" in patch) payload.scheduled_for = patch.scheduledFor ?? null;
  if ("openedAt" in patch) payload.opened_at = patch.openedAt ?? null;
  if ("closedAt" in patch) payload.closed_at = patch.closedAt ?? null;
  if ("archivedAt" in patch) payload.archived_at = patch.archivedAt ?? null;
  const { error } = await supabase.from("tasks").update(payload).eq("id", id);
  if (error) throw error;
}

export async function deleteTaskRow(id: string): Promise<void> {
  const { error } = await supabase.from("tasks").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchNotes(): Promise<Note[]> {
  const { data, error } = await supabase
    .from("notes")
    .select("*")
    .order("date", { ascending: false });
  if (error) throw error;
  return (data as NoteRow[]).map(rowToNote);
}

export async function insertNote(userId: string, date: string, content: string): Promise<Note> {
  const { data, error } = await supabase
    .from("notes")
    .insert({ user_id: userId, date, content })
    .select()
    .single();
  if (error) throw error;
  return rowToNote(data as NoteRow);
}

export async function updateNoteRow(id: string, date: string, content: string): Promise<Note> {
  const { data, error } = await supabase
    .from("notes")
    .update({ date, content })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return rowToNote(data as NoteRow);
}

export async function deleteNoteRow(id: string): Promise<void> {
  const { error } = await supabase.from("notes").delete().eq("id", id);
  if (error) throw error;
}

export function formatDateTime(value?: string) {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function durationBetween(a?: string, b?: string) {
  if (!a || !b) return "—";
  const ms = new Date(b).getTime() - new Date(a).getTime();
  if (isNaN(ms) || ms < 0) return "—";
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}min`;
  return `${h}h ${m}min`;
}
