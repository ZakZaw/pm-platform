using Application.Authorization;
using Application.Common;
using Application.Features.Tasks.Commands;
using Application.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Tasks.Queries;

/// <summary>
/// Look up a task by its display key (<c>"AT-247"</c>) within an org.
/// Used by the F2-18 chat <c>[[task:KEY]]</c> embed widget to resolve
/// the inline token to a live task summary. The caller must be a
/// member of the task's project — same gate as
/// <see cref="GetTaskQuery"/>.
/// </summary>
public record GetTaskByKeyQuery(string OrgSlug, string Key)
    : IRequest<Result<TaskDto>>;

public class GetTaskByKeyQueryHandler(
    IAppDbContext db, IAccessControl access)
    : IRequestHandler<GetTaskByKeyQuery, Result<TaskDto>>
{
    public async Task<Result<TaskDto>> Handle(GetTaskByKeyQuery request, CancellationToken ct)
    {
        if (access.CurrentPrincipal() is not { } principal)
            return Result.Failure<TaskDto>(AuthErrors.NotAuthenticated);

        // Parse "PROJKEY-NUM". Tolerant of whitespace + case so chat
        // body can write `at-247` or ` AT-247 ` without surprises.
        var raw = (request.Key ?? string.Empty).Trim();
        var dash = raw.LastIndexOf('-');
        if (dash <= 0 || dash == raw.Length - 1)
            return Result.Failure<TaskDto>(TaskErrors.NotFound);
        var projectKey = raw[..dash].ToUpperInvariant();
        if (!int.TryParse(raw[(dash + 1)..], out var keyNum) || keyNum <= 0)
            return Result.Failure<TaskDto>(TaskErrors.NotFound);

        var org = await db.Organizations
            .Where(o => o.Slug == request.OrgSlug)
            .Select(o => o.Id)
            .FirstOrDefaultAsync(ct);
        if (org == Guid.Empty)
            return Result.Failure<TaskDto>(OrgErrors.NotFound);

        var project = await db.Projects
            .Where(p => p.OrganizationId == org && p.Key == projectKey)
            .Select(p => new { p.Id, p.Key })
            .FirstOrDefaultAsync(ct);
        if (project is null)
            return Result.Failure<TaskDto>(TaskErrors.NotFound);

        // The route only proves org membership; the task itself is
        // project-scoped. Answer "not found" rather than 403 so keys of
        // projects the caller can't see aren't confirmed to exist.
        var canRead = await access.CheckProjectAsync(
            principal, project.Id, Domain.Enums.ProjectRole.Viewer, ct);
        if (!canRead.IsSuccess)
            return Result.Failure<TaskDto>(TaskErrors.NotFound);

        var task = await db.Tasks
            .FirstOrDefaultAsync(t => t.ProjectId == project.Id && t.KeyNum == keyNum, ct);
        if (task is null)
            return Result.Failure<TaskDto>(TaskErrors.NotFound);

        return Result.Success(CreateTaskCommandHandler.ToDto(task, project.Key));
    }
}
