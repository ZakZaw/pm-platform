using Application.Common;
using Application.Interfaces;
using Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.AI.Queries;

/// <summary>
/// F1.5-08 — org-level AI inbox. Returns the union of AI suggestions across
/// every non-personal, non-archived project in the org that the caller can
/// see (a project member, or an org Owner/Admin), grouped by project type via
/// the pure <see cref="SuggestionInbox.GroupByType{T}"/>. Each card keeps its
/// <c>ProjectType</c> + <c>Category</c> so the page colours and filters it
/// without any per-type branching.
/// </summary>
public record ListOrgSuggestionsQuery(string Slug, bool IncludeActed = false)
    : IRequest<Result<OrgSuggestionInboxDto>>;

public class ListOrgSuggestionsQueryHandler(IAppDbContext db, ICurrentUser currentUser)
    : IRequestHandler<ListOrgSuggestionsQuery, Result<OrgSuggestionInboxDto>>
{
    // Bound the payload — the newest suggestions win.
    private const int MaxSuggestions = 200;

    public async Task<Result<OrgSuggestionInboxDto>> Handle(ListOrgSuggestionsQuery request, CancellationToken ct)
    {
        if (currentUser.UserId is not { } userId)
            return Result.Failure<OrgSuggestionInboxDto>(AuthErrors.NotAuthenticated);

        var orgId = await db.Organizations
            .Where(o => o.Slug == request.Slug)
            .Select(o => (Guid?)o.Id)
            .FirstOrDefaultAsync(ct);
        if (orgId is null)
            return Result.Failure<OrgSuggestionInboxDto>(OrgErrors.NotFound);

        var isOrgAdmin = await db.OrgMemberships.AnyAsync(m =>
            m.OrganizationId == orgId && m.UserId == userId && m.RemovedAt == null
            && (m.Role == OrgRole.Owner || m.Role == OrgRole.Admin), ct);

        var projects = db.Projects.Where(p =>
            p.OrganizationId == orgId
            && !p.IsPersonal
            && p.Status != ProjectStatus.Archived
            && (isOrgAdmin || p.Memberships.Any(m => m.UserId == userId)));

        var suggestions = db.AISuggestions.AsQueryable();
        if (!request.IncludeActed)
            suggestions = suggestions.Where(s => s.Status == "Open");

        var rows = await suggestions
            .Join(projects, s => s.ProjectId, p => p.Id, (s, p) => new { s, p })
            .OrderByDescending(x => x.s.CreatedAt)
            .Take(MaxSuggestions)
            .Select(x => new OrgSuggestionDto(
                new AISuggestionDto(
                    x.s.Id, x.s.ProjectId, x.p.Type.ToString(),
                    x.s.Kind, x.s.Title, x.s.Body, x.s.PayloadJson,
                    x.s.Status, x.s.CreatedAt, x.s.ActedAt, x.s.Provider),
                x.p.Name,
                x.p.Slug))
            .ToListAsync(ct);

        var groups = SuggestionInbox
            .GroupByType(rows, r => r.Suggestion.ProjectType, r => r.Suggestion.CreatedAt)
            .Select(g => new SuggestionTypeGroupDto(g.ProjectType, g.Items.Count, g.Items))
            .ToList();

        return Result.Success(new OrgSuggestionInboxDto(rows.Count, groups));
    }
}
