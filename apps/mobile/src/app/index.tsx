import { Redirect } from 'expo-router';
import { useSession } from '@/state/session';

/** Entry point: send people to the right flow for where they are. */
export default function Index() {
  const { session } = useSession();
  return <Redirect href={session ? '/home' : '/welcome'} />;
}
