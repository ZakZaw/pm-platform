using Domain.Entities;

namespace Application.Features.Sprints;

internal static class SprintMapper
{
    public static SprintDto ToDto(Sprint s, int taskCount, int totalPts, int donePts) => new(
        s.Id, s.ProjectId, s.Name,
        s.StartDate, s.EndDate, s.ActualStartDate, s.VelocityTarget,
        s.Status.ToString(), s.FinalVelocity,
        taskCount, totalPts, donePts,
        s.CreatedAt, s.ClosedAt);
}
