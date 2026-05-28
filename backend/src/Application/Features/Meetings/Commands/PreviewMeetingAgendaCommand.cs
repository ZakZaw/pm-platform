using Application.Common;
using Application.Features.AI;
using Application.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Meetings.Commands;

/// <summary>
/// F2-19 — draft a meeting agenda from project context. Standalone
/// preview command (doesn't persist) so the CreateMeetingPage can
/// iterate on the AI draft before saving. The handler resolves the
/// active sprint name, recent blocker titles, and attendee names so
/// the model has enough context to fit the agenda to the team.
/// </summary>
public record PreviewMeetingAgendaCommand(
    Guid ProjectId,
    string MeetingType,
    string MeetingTitle,
    int DurationMinutes,
    IReadOnlyList<Guid> AttendeeUserIds,
    string? OrganiserNotes) : IRequest<Result<AIMeetingAgenda>>;

public class PreviewMeetingAgendaCommandHandler(
    IAppDbContext db,
    ICurrentUser currentUser,
    IAIService ai)
    : IRequestHandler<PreviewMeetingAgendaCommand, Result<AIMeetingAgenda>>
{
    public async Task<Result<AIMeetingAgenda>> Handle(PreviewMeetingAgendaCommand request, CancellationToken ct)
    {
        if (currentUser.UserId is not { } userId)
            return Result.Failure<AIMeetingAgenda>(AuthErrors.NotAuthenticated);

        if (MeetingValidation.ValidateDuration(request.DurationMinutes) is { } durErr)
            return Result.Failure<AIMeetingAgenda>(durErr);
        var typeResult = MeetingValidation.ParseType(request.MeetingType);
        if (!typeResult.IsSuccess)
            return Result.Failure<AIMeetingAgenda>(typeResult.Error!);

        if (!ai.IsConfigured)
            return Result.Failure<AIMeetingAgenda>(AIErrors.NotConfigured);

        var project = await db.Projects
            .Where(p => p.Id == request.ProjectId)
            .Select(p => new { p.Id, p.Name })
            .FirstOrDefaultAsync(ct);
        if (project is null)
            return Result.Failure<AIMeetingAgenda>(ProjectErrors.NotFound);

        var isMember = await db.ProjectMemberships
            .AnyAsync(m => m.ProjectId == project.Id && m.UserId == userId, ct);
        if (!isMember)
            return Result.Failure<AIMeetingAgenda>(ProjectErrors.NotFound);

        // Active sprint name (most recent non-closed sprint). Optional —
        // if there's no active sprint the AI just skips that hook.
        var activeSprintName = await db.Sprints
            .Where(s => s.ProjectId == project.Id && s.ClosedAt == null)
            .OrderByDescending(s => s.StartDate)
            .Select(s => s.Name)
            .FirstOrDefaultAsync(ct);

        // Recent blockers from in-flight tasks — surfaces the team's
        // actual headaches in the standup/planning agenda.
        var blockedTitles = await db.Tasks
            .Where(t => t.ProjectId == project.Id
                     && t.Status == Domain.Enums.TaskStatus.Blocked)
            .OrderByDescending(t => t.CreatedAt)
            .Select(t => t.Title)
            .Take(5)
            .ToListAsync(ct);

        var attendeeIds = (request.AttendeeUserIds ?? []).Distinct().ToList();
        var attendeeNames = attendeeIds.Count == 0
            ? new List<string>()
            : await db.Users
                .Where(u => attendeeIds.Contains(u.Id))
                .Select(u => u.FullName)
                .ToListAsync(ct);

        var input = new AIMeetingAgendaInput(
            typeResult.Value.ToString(),
            request.MeetingTitle?.Trim() ?? string.Empty,
            request.DurationMinutes,
            project.Name,
            activeSprintName,
            blockedTitles,
            attendeeNames,
            request.OrganiserNotes?.Trim());

        try
        {
            var agenda = await ai.GenerateMeetingAgendaAsync(input, ct);
            return Result.Success(agenda);
        }
        catch
        {
            // The Infrastructure layer logs the cause. The Application
            // layer can't reference the typed exception, so we surface
            // the shared "provider failed" error.
            return Result.Failure<AIMeetingAgenda>(AIErrors.ProviderFailed);
        }
    }
}
