using Application.Common;
using Application.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Sales.Queries;

public record ListLeadsQuery(Guid ProjectId, string? Status)
    : IRequest<Result<IReadOnlyList<LeadDto>>>;

public class ListLeadsQueryHandler(IAppDbContext db)
    : IRequestHandler<ListLeadsQuery, Result<IReadOnlyList<LeadDto>>>
{
    public async Task<Result<IReadOnlyList<LeadDto>>> Handle(
        ListLeadsQuery request, CancellationToken ct)
    {
        var q = db.Leads.Where(l => l.ProjectId == request.ProjectId);
        if (!string.IsNullOrWhiteSpace(request.Status))
        {
            if (Enum.TryParse<Domain.Enums.LeadStatus>(request.Status, ignoreCase: true, out var status))
                q = q.Where(l => l.Status == status);
        }

        var rows = await q
            .OrderByDescending(l => l.CreatedAt)
            .Select(l => new LeadDto(
                l.Id, l.ProjectId, l.AccountId, l.Name,
                l.Email, l.Phone, l.Source, l.Status.ToString(),
                l.OwnerId, l.ConvertedDealId, l.CreatedAt, l.ConvertedAt))
            .ToListAsync(ct);
        return Result.Success<IReadOnlyList<LeadDto>>(rows);
    }
}
