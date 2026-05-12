import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Avatar } from '@/components/ui';
import { orgsApi } from '@/api/orgs.api';
import './OrgHomePage.css';

export function OrgHomePage() {
  const { slug } = useParams();
  // key={slug} on the parent route resets these on slug change.
  const [org, setOrg] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    orgsApi
      .get(slug)
      .then((data) => {
        if (!cancelled) setOrg(data);
      })
      .catch((err) => {
        if (cancelled) return;
        const detail = err.response?.data?.detail ?? 'Could not load organization.';
        setError(detail);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (error) {
    return <p className="org-home__placeholder">{error}</p>;
  }
  if (!org) {
    return <p className="org-home__placeholder">Loading…</p>;
  }

  return (
    <div>
      <div className="org-home__header">
        <Avatar src={org.logoUrl} name={org.name} size="xl" />
        <div>
          <div className="org-home__title">{org.name}</div>
          <div className="org-home__slug">/{org.slug}</div>
        </div>
      </div>
      <p className="org-home__placeholder">
        Org home placeholder. Real overview lands later in Phase 1.
      </p>
    </div>
  );
}
