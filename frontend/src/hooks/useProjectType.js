import { useParams } from 'react-router-dom';
import { useProjectStore } from '@/store/projectStore';
import { findProjectType, DEFAULT_PROJECT_TYPE_ID } from '@/constants/projectTypes';

// Derives the active project's type from the URL (org slug + project slug)
// and looks up its config in PROJECT_TYPES. Returns null when no project
// is in scope (e.g. on org-level pages). Components that need the config
// regardless can fall back to `findProjectType(DEFAULT_PROJECT_TYPE_ID)`.
export function useProjectType() {
  const { slug, projectSlug } = useParams();
  const projects = useProjectStore((s) => s.byOrg[slug] ?? []);
  const project = projects.find((p) => p.slug === projectSlug);
  if (!project) return null;
  return {
    project,
    type: findProjectType(project.type ?? DEFAULT_PROJECT_TYPE_ID),
  };
}
