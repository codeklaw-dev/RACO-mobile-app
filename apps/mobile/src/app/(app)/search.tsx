import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronRightIcon, ICONS, PathIcon } from '@/components/icons';
import { EmptyState, ListRow, SearchField, SectionTitle, TextButton, goBack } from '@/components/ui';
import { listChats, listProjects, listTasks, matches, relativeDate, useFocusData } from '@/lib/data';
import { useTheme } from '@/theme';

const LIMIT = 5;

/** Search across chats, projects and tasks. */
export default function Search() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const all = useFocusData(async () => {
    const [chats, projects, tasks] = await Promise.all([listChats(), listProjects(), listTasks()]);
    return { chats, projects, tasks };
  });

  const results = useMemo(() => {
    if (!all.data || !query.trim()) return null;
    const projectName = new Map(all.data.projects.map((p) => [p.id, p.name]));
    return {
      projectName,
      chats: all.data.chats.filter((c) => matches(query, c.title)),
      projects: all.data.projects.filter((p) => matches(query, p.name, p.description)),
      tasks: all.data.tasks.filter((x) => matches(query, x.title, x.notes)),
    };
  }, [all.data, query]);

  const none = results && !results.chats.length && !results.projects.length && !results.tasks.length;

  return (
    <View style={{ flex: 1, backgroundColor: t.background, paddingTop: insets.top + 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 12 }}>
        <View style={{ flex: 1 }}>
          <SearchField value={query} onChangeText={setQuery} placeholder="Search chats, projects and tasks" autoFocus />
        </View>
        <TextButton label="Cancel" onPress={goBack} />
      </View>
      <ScrollView keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 24, gap: 8 }}>
        {!results ? (
          <EmptyState title="Find anything" body="Search the titles of your chats, your projects and your tasks." />
        ) : none ? (
          <EmptyState title="No results" body={`Nothing matches “${query}”.`} />
        ) : (
          <>
            {results.chats.length ? <SectionTitle>Chats</SectionTitle> : null}
            {results.chats.slice(0, LIMIT).map((c) => (
              <ListRow
                key={c.id}
                title={c.title}
                detail={relativeDate(c.updatedAt)}
                leading={<PathIcon d={ICONS.chats} color={t.text} size={20} />}
                trailing={<ChevronRightIcon color={t.faint} />}
                onPress={() => router.push({ pathname: '/chat/[id]', params: { id: c.id } })}
              />
            ))}
            {results.projects.length ? <SectionTitle>Projects</SectionTitle> : null}
            {results.projects.slice(0, LIMIT).map((p) => (
              <ListRow
                key={p.id}
                title={p.name}
                detail={p.description || undefined}
                leading={<PathIcon d={ICONS.projects} color={t.text} size={20} />}
                trailing={<ChevronRightIcon color={t.faint} />}
                onPress={() => router.push({ pathname: '/project/[id]', params: { id: p.id } })}
              />
            ))}
            {results.tasks.length ? <SectionTitle>Tasks</SectionTitle> : null}
            {results.tasks.slice(0, LIMIT).map((x) => (
              <ListRow
                key={x.id}
                title={x.title}
                detail={[x.doneAt ? 'Done' : 'To do', x.projectId ? results.projectName.get(x.projectId) : null].filter(Boolean).join(' · ')}
                muted={!!x.doneAt}
                leading={<PathIcon d={ICONS.tasks} color={t.text} size={20} />}
                trailing={<ChevronRightIcon color={t.faint} />}
                onPress={() => router.push({ pathname: '/task/[id]', params: { id: x.id } })}
              />
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}
