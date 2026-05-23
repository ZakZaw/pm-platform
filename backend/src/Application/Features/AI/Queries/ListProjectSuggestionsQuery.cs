using Application.Common;
using Application.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.AI.Queries;

public record ListProjectSuggestionsQuery(
    Guid ProjectId,
    bool IncludeActed = false)
    : IRequest<Result<IReadOnlyList<AISuggestionDto>>>;

public class ListProjectSuggestionsQueryHandler(IAppDbContext db)
    : IRequestHandler<ListProjectSuggestionsQuery, Result<IReadOnlyList<AISuggestionDto>>>
{
    public async Task<Result<IReadOnlyList<AISuggestionDto>>> Handle(
        ListProjectSuggestionsQuery request, CancellationToken ct)
    {
        var q = db.AISuggestions.Where(s => s.ProjectId == request.ProjectId);
        if (!request.IncludeActed)
            q = q.Where(s => s.Status == "Open");

        var rows = await q
            .OrderByDescending(s => s.CreatedAt)
            .Join(db.Projects, s => s.ProjectId, p => p.Id,
                (s, p) => new AISuggestionDto(
                    s.Id, s.ProjectId, p.Type.ToString(),
                    s.Kind, s.Title, s.Body, s.PayloadJson,
                    s.Status, s.CreatedAt, s.ActedAt, s.Provider))
            .ToListAsync(ct);

        return Result.Success<IReadOnlyList<AISuggestionDto>>(rows);
    }
}
