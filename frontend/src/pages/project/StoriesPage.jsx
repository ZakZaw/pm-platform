import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Badge, Button, Card, Input, Select, useToast } from '@/components/ui';
import { projectsApi } from '@/api/projects.api';
import { epicsApi } from '@/api/epics.api';
import { storiesApi } from '@/api/stories.api';
import './StoriesPage.css';

const PRIORITY_OPTIONS = [
  { value: 'Low', label: 'Low' },
  { value: 'Medium', label: 'Medium' },
  { value: 'High', label: 'High' },
  { value: 'Urgent', label: 'Urgent' },
];

export function StoriesPage() {
  const { slug: orgSlug, projectSlug } = useParams();
  const toast = useToast();

  const [project, setProject] = useState(null);
  const [stories, setStories] = useState([]);
  const [epics, setEpics] = useState([]);
  const [filterEpic, setFilterEpic] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState(null);

  // Inline create form
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('Medium');
  const [storyPoints, setStoryPoints] = useState('');
  const [epicId, setEpicId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const p = project ?? (await projectsApi.getBySlug(orgSlug, projectSlug));
        if (cancelled) return;
        setProject(p);
        const [es, ss] = await Promise.all([
          epicsApi.listForProject(p.id),
          storiesApi.listForProject(p.id, { epicId: filterEpic || undefined }),
        ]);
        if (cancelled) return;
        setEpics(es);
        setStories(ss);
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.detail ?? 'Could not load stories.');
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgSlug, projectSlug, filterEpic, refreshKey]);

  const epicOptions = useMemo(
    () => [
      { value: '', label: 'No epic' },
      ...epics.map((e) => ({ value: e.id, label: e.title })),
    ],
    [epics],
  );

  if (error) return <p className="stories-page__placeholder">{error}</p>;
  if (!project) return <p className="stories-page__placeholder">Loading…</p>;

  async function submitNew(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await storiesApi.create(project.id, {
        title: title.trim(),
        description: description.trim() || null,
        priority,
        storyPoints: storyPoints === '' ? null : Number(storyPoints),
        epicId: epicId || null,
      });
      toast.show({ tone: 'success', message: 'Story created.' });
      setTitle('');
      setDescription('');
      setStoryPoints('');
      setEpicId('');
      setPriority('Medium');
      setCreating(false);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      toast.show({
        tone: 'danger',
        message: err.response?.data?.detail ?? 'Could not create story.',
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="stories-page">
      <header className="stories-page__header">
        <h1 className="stories-page__title">Stories</h1>
        <div className="stories-page__actions">
          <Select
            label="Epic"
            options={[{ value: '', label: 'All epics' }, ...epics.map((e) => ({ value: e.id, label: e.title }))]}
            value={filterEpic}
            onChange={(e) => setFilterEpic(e.target.value)}
          />
          <Button onClick={() => setCreating((v) => !v)}>{creating ? 'Cancel' : 'New story'}</Button>
        </div>
      </header>

      {creating && (
        <Card className="stories-page__form" title="New story">
          <form onSubmit={submitNew} className="stories-page__form-grid">
            <Input
              label="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              autoComplete="off"
              placeholder="e.g. Reset password via email"
            />
            <Select
              label="Priority"
              options={PRIORITY_OPTIONS}
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
            />
            <Input
              label="Story points"
              type="number"
              min="0"
              value={storyPoints}
              onChange={(e) => setStoryPoints(e.target.value)}
              placeholder="—"
            />
            <Select
              label="Epic"
              options={epicOptions}
              value={epicId}
              onChange={(e) => setEpicId(e.target.value)}
            />
            <label className="stories-page__field">
              <span className="stories-page__label">Description</span>
              <textarea
                className="stories-page__textarea"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </label>

            <div className="stories-page__form-actions">
              <Button type="submit" disabled={submitting || title.trim().length < 2}>
                {submitting ? 'Saving…' : 'Create'}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {stories.length === 0 ? (
        <p className="stories-page__placeholder">No stories yet.</p>
      ) : (
        <Card>
          <ul className="stories-page__list">
            {stories.map((s) => (
              <li key={s.id}>
                <Link
                  to={`/${orgSlug}/projects/${projectSlug}/stories/${s.id}`}
                  className="stories-page__link"
                >
                  <span className="stories-page__link-title">{s.title}</span>
                  <span className="stories-page__link-meta">
                    <Badge tone="neutral">{s.status}</Badge>
                    <Badge tone="info">{s.priority}</Badge>
                    {s.storyPoints != null && <Badge tone="purple">{s.storyPoints} pts</Badge>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
