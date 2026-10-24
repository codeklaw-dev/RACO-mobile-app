/** Projects group chats and tasks. */
export interface Project {
  id: string;
  name: string;
  description: string;
  updatedAt: string;
}

/** A to-do, optionally inside a project. */
export interface Task {
  id: string;
  title: string;
  notes: string;
  projectId: string | null;
  doneAt: string | null;
  createdAt: string;
}

export const PROJECT_NAME_MAX = 80;
export const TASK_TITLE_MAX = 200;
