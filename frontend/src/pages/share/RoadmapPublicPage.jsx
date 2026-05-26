import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { Button, Segmented, Skeleton } from '@/components/ui';
import { RoadmapView } from '@/components/roadmap/RoadmapView';
import { publicShareApi } from '@/api/roadmap.api';
import './RoadmapPublicPage.css';

const EPIC_PALETTE = [
  '#5B6AF0', '#4FD1E0', '#7A6BFF', '#C77BFF',
  '#3FB984', '#E0A23A', '#E5484D', '#4F9EFF',
];

function toRoadmapShape(payload) {
  const bars = payload.epics
    .filter((e) => e.startDate && e.endDate)
    .map((e, i) => ({
      id: e.id,
      label: e.title,
      start: e.startDate,
      end: e.endDate,
      color: e.color ?? EPIC_PALETTE[i % EPIC_PALETTE.length],
      sublabel: e.status ?? null,
      ownerId: null,
      ownerName: e.ownerName,
      riskFlag: e.riskFlag,
    }));

  const points = (payload.milestones ?? []).map((m) => ({
    id: m.id,
    label: m.title,
    at: m.date,
    color: m.color ?? 'var(--accent)',
    kind: 'milestone',
    epicId: m.epicId,
    editable: false,
  }));

  const undated = payload.epics
    .filter((e) => !e.startDate || !e.endDate)
    .map((e) => ({ id: e.id, title: e.title }));

  return {
    bars,
    points,
    range: { from: payload.from, to: payload.to },
    dependencies: payload.epics.flatMap((e) =>
      (e.dependsOn ?? []).map((depId) => ({ from: depId, to: e.id }))),
    undated,
    editable: false,
  };
}

export function RoadmapPublicPage() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [zoom, setZoom] = useState('q');
  const [password, setPassword] = useState('');
  const [passwordSubmitted, setPasswordSubmitted] = useState('');
  const [needsPassword, setNeedsPassword] = useState(false);

  const load = useCallback(async (pwd) => {
    setLoading(true);
    setError(null);
    try {
      const payload = await publicShareApi.getRoadmap(token, pwd);
      setData(payload);
      setNeedsPassword(false);
    } catch (err) {
      const code = err.response?.data?.title;
      if (code === 'RoadmapShare.PasswordRequired') {
        setNeedsPassword(true);
        setError(null);
      } else if (code === 'RoadmapShare.InvalidPassword') {
        setNeedsPassword(true);
        setError('That password is incorrect. Try again.');
      } else if (code === 'RoadmapShare.Expired') {
        setError('This link has expired. Ask the sender for a fresh one.');
      } else if (code === 'RoadmapShare.Revoked') {
        setError('This link has been revoked. Ask the sender for a fresh one.');
      } else if (code === 'RoadmapShare.NotFound') {
        setError('This link does not exist or has been removed.');
      } else {
        setError(err.response?.data?.detail ?? 'Could not load this roadmap.');
      }
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const roadmapData = useMemo(() => (data ? toRoadmapShape(data) : null), [data]);

  function submitPassword(e) {
    e?.preventDefault?.();
    setPasswordSubmitted(password);
    load(password);
  }

  return (
    <div className="public-roadmap">
      <header className="public-roadmap__header">
        <div className="public-roadmap__brand">
          <span className="public-roadmap__logo" aria-hidden="true">✦</span>
          <span className="muted">Read-only roadmap</span>
        </div>
        {data && (
          <Segmented
            value={zoom}
            onChange={setZoom}
            options={[
              { value: 'w', label: 'Week' },
              { value: 'm', label: 'Month' },
              { value: 'q', label: 'Quarter' },
            ]}
            size="sm"
            ariaLabel="Timeline scale"
          />
        )}
      </header>

      <main className="public-roadmap__main">
        {needsPassword && !data ? (
          <div className="public-roadmap__gate">
            <div className="public-roadmap__gate-card">
              <div className="public-roadmap__gate-icon" aria-hidden="true">
                <Lock size={20} />
              </div>
              <h1>Password required</h1>
              <p className="muted">
                Whoever shared this link added a password. Enter it to view the
                roadmap.
              </p>
              <form onSubmit={submitPassword} className="col gap-3 public-roadmap__gate-form">
                <input
                  type="password"
                  className="input"
                  value={password}
                  autoFocus
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  aria-label="Password"
                />
                {error && <p className="public-roadmap__gate-error">{error}</p>}
                <Button type="submit" variant="primary" disabled={!password.trim()}>
                  Unlock
                </Button>
              </form>
            </div>
          </div>
        ) : error ? (
          <div className="public-roadmap__error">
            <h1>{error}</h1>
          </div>
        ) : loading ? (
          <Skeleton height={280} radius="lg" />
        ) : data ? (
          <>
            <div className="public-roadmap__title-row">
              <div>
                <div className="eyebrow">
                  {data.projectKey ? `${data.projectKey} · ` : ''}{data.projectType}
                </div>
                <h1 className="public-roadmap__title">{data.projectName}</h1>
              </div>
            </div>
            <RoadmapView
              data={roadmapData}
              loading={false}
              zoom={zoom}
              roleCanEdit={false}
            />
            {roadmapData.undated.length > 0 && (
              <div className="public-roadmap__undated">
                <span className="eyebrow">Not yet placed</span>
                <ul>
                  {roadmapData.undated.map((e) => (
                    <li key={e.id} className="muted">{e.title}</li>
                  ))}
                </ul>
              </div>
            )}
            <footer className="public-roadmap__footer">
              <span className="muted">
                This is a read-only window. Changes inside the project appear
                here automatically.
              </span>
            </footer>
          </>
        ) : null}
      </main>
    </div>
  );
}
