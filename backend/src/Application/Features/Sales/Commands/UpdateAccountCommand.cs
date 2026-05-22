using Application.Common;
using Application.Interfaces;
using Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Sales.Commands;

public record UpdateAccountCommand(
    Guid AccountId,
    string? Name,
    string? Domain,
    string? Industry,
    Guid? OwnerId,
    string? Notes,
    bool? Archive) : IRequest<Result<AccountDto>>;

public class UpdateAccountCommandHandler(IAppDbContext db)
    : IRequestHandler<UpdateAccountCommand, Result<AccountDto>>
{
    public async Task<Result<AccountDto>> Handle(UpdateAccountCommand request, CancellationToken ct)
    {
        var account = await db.Accounts.FirstOrDefaultAsync(a => a.Id == request.AccountId, ct);
        if (account is null) return Result.Failure<AccountDto>(SalesErrors.AccountNotFound);

        if (request.Name is not null)
        {
            var n = request.Name.Trim();
            if (n.Length is < 1 or > 200)
                return Result.Failure<AccountDto>(SalesErrors.InvalidAccountName);
            account.Name = n;
        }
        if (request.Domain is not null) account.Domain = request.Domain.Trim();
        if (request.Industry is not null) account.Industry = request.Industry.Trim();
        if (request.OwnerId.HasValue) account.OwnerId = request.OwnerId;
        if (request.Notes is not null) account.Notes = request.Notes;
        if (request.Archive.HasValue)
            account.ArchivedAt = request.Archive.Value ? DateTime.UtcNow : null;

        await db.SaveChangesAsync(ct);

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
