using Application.Common;
using Application.Interfaces;
using Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.AI.Commands;

public record DismissSuggestionCommand(Guid Id) : IRequest<Result>;

public class DismissSuggestionCommandHandler(IAppDbContext db, ICurrentUser currentUser)
    : IRequestHandler<DismissSuggestionCommand, Result>
{
    public async Task<Result> Handle(DismissSuggestionCommand request, CancellationToken ct)
    {
        if (currentUser.UserId is not { } userId)
            return Result.Failure(AuthErrors.NotAuthenticated);

        var s = await db.AISuggestions.FirstOrDefaultAsync(x => x.Id == request.Id, ct);
        if (s is null || !await SuggestionAccess.CanActAsync(db, userId, s.ProjectId, ct))
            return Result.Failure(AIErrors.RequestNotFound);

        if (s.Status != "Open") return Result.Success();
        s.Status = "Dismissed";
        s.ActedAt = DateTime.UtcNow;
        s.ActedByUserId = userId;
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

public record AcceptSuggestionCommand(Guid Id) : IRequest<Result>;

public class AcceptSuggestionCommandHandler(IAppDbContext db, ICurrentUser currentUser)
    : IRequestHandler<AcceptSuggestionCommand, Result>
{
    public async Task<Result> Handle(AcceptSuggestionCommand request, CancellationToken ct)
    {
        if (currentUser.UserId is not { } userId)
            return Result.Failure(AuthErrors.NotAuthenticated);

        var s = await db.AISuggestions.FirstOrDefaultAsync(x => x.Id == request.Id, ct);
        if (s is null || !await SuggestionAccess.CanActAsync(db, userId, s.ProjectId, ct))
            return Result.Failure(AIErrors.RequestNotFound);

        if (s.Status != "Open") return Result.Success();
        s.Status = "Accepted";
        s.ActedAt = DateTime.UtcNow;
        s.ActedByUserId = userId;
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

/// <summary>
/// Who may accept or dismiss a suggestion: a non-Viewer member of its project,
/// or an Owner/Admin of the project's org (they see every project's cards in
/// the org-level inbox). Anyone else gets NotFound so ids don't leak.
/// </summary>
internal static class SuggestionAccess
{
    public static async Task<bool> CanActAsync(IAppDbContext db, Guid userId, Guid projectId, CancellationToken ct)
    {
        var isProjectActor = await db.ProjectMemberships.AnyAsync(m =>
            m.ProjectId == projectId && m.UserId == userId && m.Role != ProjectRole.Viewer, ct);
        if (isProjectActor) return true;

        return await db.Projects
            .Where(p => p.Id == projectId)
            .AnyAsync(p => db.OrgMemberships.Any(m =>
                m.OrganizationId == p.OrganizationId && m.UserId == userId && m.RemovedAt == null
                && (m.Role == OrgRole.Owner || m.Role == OrgRole.Admin)), ct);
    }
}
