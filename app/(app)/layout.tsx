import { redirect } from 'next/navigation';
import AppShell from '@/components/AppShell';
import { getSession } from '@/lib/auth';
import { getEnvInfo } from '@/lib/env-info';

export default async function Layout({ children }: { children: React.ReactNode }) {
  const me = await getSession();
  if (!me) redirect('/login');
  return <AppShell me={me} env={getEnvInfo()}>{children}</AppShell>;
}
