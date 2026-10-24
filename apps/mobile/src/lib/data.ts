/**
 * Reads and writes for chats, projects and tasks. The app talks to Supabase
 * directly; row level security keeps each user to their own rows.
 */
import type { ConversationSummary, Project, Task } from '@raco/shared';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from './supabase';

function check<T>({ data, error }: { data: T | null; error: { message: string } | null }): T {
  if (error) throw new Error(error.message);
  return data as T;
}

// Chats ---------------------------------------------------------------------

export async function listChats(projectId?: string): Promise<ConversationSummary[]> {
  let q = supabase.from('conversations').select('id, title, updated_at, project_id').order('updated_at', { ascending: false }).limit(200);
  if (projectId) q = q.eq('project_id', projectId);
  return check(await q).map((c) => ({ id: c.id, title: c.title, updatedAt: c.updated_at, projectId: c.project_id ?? null }));
}

export async function deleteChat(id: string): Promise<void> {
  check(await supabase.from('conversations').delete().eq('id', id));
}

// Projects ------------------------------------------------------------------

const toProject = (r: { id: string; name: string; description: string; updated_at: string }): Project => ({
  id: r.id,
  name: r.name,
  description: r.description,
  updatedAt: r.updated_at,
});

export async function listProjects(): Promise<Project[]> {
  return check(await supabase.from('projects').select('id, name, description, updated_at').order('updated_at', { ascending: false })).map(toProject);
}

export async function getProject(id: string): Promise<Project | null> {
  const row = check(await supabase.from('projects').select('id, name, description, updated_at').eq('id', id).maybeSingle());
  return row ? toProject(row) : null;
}

export async function createProject(name: string, description: string): Promise<Project> {
  return toProject(check(await supabase.from('projects').insert({ name, description }).select('id, name, description, updated_at').single()));
}

export async function updateProject(id: string, patch: { name?: string; description?: string }): Promise<void> {
  check(await supabase.from('projects').update(patch).eq('id', id));
}

export async function deleteProject(id: string): Promise<void> {
  check(await supabase.from('projects').delete().eq('id', id));
}

// Tasks ---------------------------------------------------------------------

type TaskRow = { id: string; title: string; notes: string; project_id: string | null; done_at: string | null; created_at: string };
const TASK_COLUMNS = 'id, title, notes, project_id, done_at, created_at';
const toTask = (r: TaskRow): Task => ({
  id: r.id,
  title: r.title,
  notes: r.notes,
  projectId: r.project_id,
  doneAt: r.done_at,
  createdAt: r.created_at,
});

export async function listTasks(projectId?: string): Promise<Task[]> {
  let q = supabase.from('tasks').select(TASK_COLUMNS).order('created_at', { ascending: false });
  if (projectId) q = q.eq('project_id', projectId);
  return check(await q).map(toTask);
}

export async function getTask(id: string): Promise<Task | null> {
  const row = check(await supabase.from('tasks').select(TASK_COLUMNS).eq('id', id).maybeSingle());
  return row ? toTask(row) : null;
}

export async function createTask(title: string, projectId: string | null = null): Promise<Task> {
  return toTask(check(await supabase.from('tasks').insert({ title, project_id: projectId }).select(TASK_COLUMNS).single()));
}

export async function updateTask(id: string, patch: { title?: string; notes?: string; projectId?: string | null; done?: boolean }): Promise<void> {
  const row: Partial<TaskRow> = {};
  if (patch.title !== undefined) row.title = patch.title;
  if (patch.notes !== undefined) row.notes = patch.notes;
  if (patch.projectId !== undefined) row.project_id = patch.projectId;
  if (patch.done !== undefined) row.done_at = patch.done ? new Date().toISOString() : null;
  check(await supabase.from('tasks').update(row).eq('id', id));
}

export async function deleteTask(id: string): Promise<void> {
  check(await supabase.from('tasks').delete().eq('id', id));
}

// Loading -------------------------------------------------------------------

/**
 * Loads data whenever the screen comes into focus, so lists stay current after
 * editing elsewhere. `set` lets a screen update the list optimistically.
 */
export function useFocusData<T>(load: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });

  const reload = useCallback(async () => {
    try {
      setData(await loadRef.current());
      setError(null);
    } catch {
      setError("Couldn't load. Pull down to try again.");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  return { data, error, reload, set: setData };
}

/** Case-insensitive match on any of the given fields. */
export function matches(query: string, ...fields: (string | null | undefined)[]): boolean {
  const q = query.trim().toLowerCase();
  return !q || fields.some((f) => f?.toLowerCase().includes(q));
}

export function relativeDate(iso: string): string {
  const d = new Date(iso);
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days < 1) return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (days < 7) return d.toLocaleDateString([], { weekday: 'long' });
  return d.toLocaleDateString([], { day: 'numeric', month: 'short' });
}
