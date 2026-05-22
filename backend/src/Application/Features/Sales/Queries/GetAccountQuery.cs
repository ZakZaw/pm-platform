using Application.Common;
using Application.Interfaces;
using Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Sales.Queries;

public record GetAccountQuery(Guid AccountId) : IRequest<Result<AccountDto>>;

public class GetAccountQueryHandler(IAppDbContext db)
    : IRequestHandler<GetAccountQuery, Result<AccountDto>>
{
    public async Task<Result<AccountDto>> Handle(GetAccountQuery request, CancellationToken ct)
    {
        var account = await db.Accounts.FirstOrDefaultAsync(a => a.Id == request.AccountId, ct);
        if (account is null) return Result.Failure<AccountDto>(SalesErrors.AccountNotFound);

        var openDeals = await db.Deals
            .Where(d => d.AccountId == account.Id && d.Status == DealStatus.Open)
            .Select(d => d.Value)
            .ToListAsync(ct);

        return Result.Success(new AccountDto(
            account.Id, account.ProjectId, account.Name, account.Domain, account.Industry,
            account.OwnerId, account.Notes, account.CreatedAt, account.ArchivedAt,
            openDeals.Count, openDeals.Sum()));
    }
}
