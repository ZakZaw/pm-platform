using Domain.Entities;

namespace Application.Features.Sprints;

internal static class SprintMapper
{
    public static SprintDto ToDto(Sprint s, int storyCount, int totalPts, int donePts) => new(
        s.Id, s.ProjectId, s.Name, s.Goal,
        s.StartDate, s.EndDate, s.VelocityTarget,
        s.Status.ToString(), s.FinalVelocity,
        storyCount, totalPts, donePts,
        s.CreatedAt, s.ClosedAt);
}
