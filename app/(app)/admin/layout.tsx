import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';

// Le pagine /admin/* sono solo per Admin All (le API verificano comunque il ruolo lato server)
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const me = await getSession();
  if (me?.role !== 'ADMIN') redirect('/azioni');
  return children;
}
