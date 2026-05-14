import { useEffect } from 'react';
import { useOrgStore } from '@/store/orgStore';

// Role strings come from the backend OrgRole enum (Owner | Admin | Member | Guest).
// Role enforcement is server-side — these helpers exist purely to hide UI a user
// can't act on, never to gate security.
export function useOrgRole(slug) {
  const orgs = useOrgStore((s) => s.orgs);
  const loaded = useOrgStore((s) => s.loaded);
  const refresh = useOrgStore((s) => s.refresh);

  useEffect(() => {
    if (!loaded) {
      refresh().catch(() => {});
    }
  }, [loaded, refresh]);

  const role = orgs.find((o) => o.slug === slug)?.role ?? null;

  return {
    role,
    loaded,
    isOwner: role === 'Owner',
    isAdminOrAbove: role === 'Owner' || role === 'Admin',
    isMemberOrAbove: role === 'Owner' || role === 'Admin' || role === 'Member',
  };
}
