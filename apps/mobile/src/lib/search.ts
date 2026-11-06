import type { ConversationSummary, Project, Task } from '@raco/shared';
import { useMemo } from 'react';
import { listChats, listProjects, listTasks, matches, useFocusData } from './data';

export interface SearchResults {
  chats: ConversationSummary[];
  projects: Project[];
  tasks: Task[];
  /** Project names by id, for showing which project a task is in. */
  projectName: Map<string, string>;
}

/** Loads chats, projects and tasks once, and filters them by `query` (null while the query is empty). */
export function useSearch(query: string): { results: SearchResults | null; loading: boolean } {
  const all = useFocusData(async () => {
    const [chats, projects, tasks] = await Promise.all([listChats(), listProjects(), listTasks()]);
    return { chats, projects, tasks };
  });

  const results = useMemo(() => {
    if (!all.data || !query.trim()) return null;
    return {
      projectName: new Map(all.data.projects.map((p) => [p.id, p.name])),
      chats: all.data.chats.filter((c) => matches(query, c.title)),
      projects: all.data.projects.filter((p) => matches(query, p.name, p.description)),
      tasks: all.data.tasks.filter((x) => matches(query, x.title, x.notes)),
    };
  }, [all.data, query]);

  return { results, loading: !all.data };
}

export const isEmpty = (r: SearchResults) => !r.chats.length && !r.projects.length && !r.tasks.length;
