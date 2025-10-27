import { getCurrentUserRole } from '@/lib/permissions';
import NavTabs from './NavTabs';

export default async function NavTabsServer() {
  const role = await getCurrentUserRole();
  return <NavTabs showNfc={role !== 'user'} />;
}
