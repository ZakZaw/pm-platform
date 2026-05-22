using Application.Common;
using Application.Interfaces;
using Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Support.Queries;

public record ListCustomersQuery(Guid ProjectId, string? Search)
    : IRequest<Result<IReadOnlyList<CustomerDto>>>;

public class ListCustomersQueryHandler(IAppDbContext db)
    : IRequestHandler<ListCustomersQuery, Result<IReadOnlyList<CustomerDto>>>
{
    public async Task<Result<IReadOnlyList<CustomerDto>>> Handle(
        ListCustomersQuery request, CancellationToken ct)
    {
        var q = db.Customers.Where(c => c.ProjectId == request.ProjectId);
        var search = request.Search?.Trim();
        if (!string.IsNullOrEmpty(search))
        {
            var s = search.ToLower();
            q = q.Where(c => c.Name.ToLower().Contains(s)
                || (c.Email != null && c.Email.ToLower().Contains(s))
                || (c.Company != null && c.Company.ToLower().Contains(s)));
        }

        var customers = await q.OrderBy(c => c.Name).ToListAsync(ct);

        var ids = customers.Select(c => c.Id).ToList();
        var tickets = await db.Tickets
            .Where(t => ids.Contains(t.CustomerId))
            .Select(t => new { t.CustomerId, t.Status })
            .ToListAsync(ct);

        var grouped = tickets
            .GroupBy(t => t.CustomerId)
            .ToDictionary(g => g.Key, g => (
                Total: g.Count(),
                Open: g.Count(t => t.Status != TicketStatus.Resolved && t.Status != TicketStatus.Closed)));

        var dtos = customers.Select(c =>
        {
            var (total, open) = grouped.GetValueOrDefault(c.Id);
            return new CustomerDto(
                c.Id, c.ProjectId, c.Name, c.Email, c.Company, c.Tier, c.CreatedAt,
                open, total);
        }).ToList();

        return Result.Success<IReadOnlyList<CustomerDto>>(dtos);
    }
}
