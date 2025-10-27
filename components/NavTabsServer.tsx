import { getCurrentUserRole, isRoleUser } from '@/lib/permissions';
import NavTabs from './NavTabs';

export default async function NavTabsServer() {
  const role = await getCurrentUserRole();
  return <NavTabs showNfc={!isRoleUser(role)} />;
}
