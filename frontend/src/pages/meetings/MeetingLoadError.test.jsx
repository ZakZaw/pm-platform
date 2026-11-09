import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ToastProvider } from '@/components/ui';

vi.mock('@/api/meetings.api', () => ({
  meetingsApi: {
    get: vi.fn(),
    getSummary: vi.fn(),
    listActionItems: vi.fn(),
  },
}));
vi.mock('@/api/projects.api', () => ({ projectsApi: { listMembers: vi.fn() } }));

const { meetingsApi } = await import('@/api/meetings.api');
const { MeetingDetailPage } = await import('./MeetingDetailPage');
const { MeetingSummaryPage } = await import('./MeetingSummaryPage');

const httpError = (status) => Object.assign(new Error(`Request failed with status code ${status}`), { response: { status } });

function renderAt(path, element) {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/:slug/projects/:projectSlug/meetings/:meetingId" element={element} />
          <Route path="/:slug/projects/:projectSlug/meetings/:meetingId/summary" element={element} />
          <Route path="/:slug/projects/:projectSlug/meetings" element={<p>Meetings list</p>} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>,
  );
}

describe('meeting pages with a bad meeting id', () => {
  beforeEach(() => vi.clearAllMocks());

  it('detail page shows "not found" with a way back instead of throwing', async () => {
    meetingsApi.get.mockRejectedValue(httpError(404));
    renderAt('/acme/projects/eng/meetings/not-a-meeting', <MeetingDetailPage />);

    expect(await screen.findByText('Meeting not found')).toBeTruthy();
    expect(screen.queryByText('Try again')).toBeNull();
    fireEvent.click(screen.getByText('Back to meetings'));
    expect(await screen.findByText('Meetings list')).toBeTruthy();
  });

  it('summary page offers a retry on a server error and recovers', async () => {
    meetingsApi.get.mockRejectedValueOnce(httpError(500));
    meetingsApi.getSummary.mockResolvedValue({
      summaryMd: null, processedAt: null, decisions: [], openQuestions: [], blockers: [],
    });
    meetingsApi.listActionItems.mockResolvedValue([]);
    renderAt('/acme/projects/eng/meetings/m1/summary', <MeetingSummaryPage />);

    expect(await screen.findByText("Couldn't load this meeting")).toBeTruthy();

    meetingsApi.get.mockResolvedValue({ id: 'm1', title: 'Planning', projectId: 'p1' });
    fireEvent.click(screen.getByText('Try again'));
    expect(await screen.findByText('AI summary & action items')).toBeTruthy();
  });
});
