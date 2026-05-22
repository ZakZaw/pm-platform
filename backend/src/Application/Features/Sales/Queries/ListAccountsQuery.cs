using Application.Common;
using Application.Interfaces;
using Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Sales.Queries;

public record ListAccountsQuery(Guid ProjectId, bool IncludeArchived = false)
    : IRequest<Result<IReadOnlyList<AccountDto>>>;

public class ListAccountsQueryHandler(IAppDbContext db)
    : IRequestHandler<ListAccountsQuery, Result<IReadOnlyList<AccountDto>>>
{
    public async Task<Result<IReadOnlyList<AccountDto>>> Handle(
        ListAccountsQuery request, CancellationToken ct)
    {
        var accountsQuery = db.Accounts.Where(a => a.ProjectId == request.ProjectId);
        if (!request.IncludeArchived) accountsQuery = accountsQuery.Where(a => a.ArchivedAt == null);

        var accounts = await accountsQuery
            .OrderBy(a => a.Name)
            .ToListAsync(ct);

        var ids = accounts.Select(a => a.Id).ToList();
        var openDeals = await db.Deals
            .Where(d => ids.Contains(d.AccountId) && d.Status == DealStatus.Open)
            .Select(d => new { d.AccountId, d.Value })
            .ToListAsync(ct);

        var grouped = openDeals
            .GroupBy(d => d.AccountId)
            .ToDictionary(g => g.Key, g => (Count: g.Count(), Total: g.Sum(d => d.Value)));

        var dtos = accounts.Select(a =>
        {
            var (count, total) = grouped.GetValueOrDefault(a.Id);
            return new AccountDto(
                a.Id, a.ProjectId, a.Name, a.Domain, a.Industry,
                a.OwnerId, a.Notes, a.CreatedAt, a.ArchivedAt,
                count, total);
        }).ToList();

        return Result.Success<IReadOnlyList<AccountDto>>(dtos);
    }
}
