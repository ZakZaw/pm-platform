using Application.Common;
using Application.Interfaces;
using Domain.Entities;
using MediatR;

namespace Application.Features.Sales.Commands;

public record CreateAccountCommand(
    Guid ProjectId,
    string Name,
    string? Domain,
    string? Industry,
    Guid? OwnerId,
    string? Notes) : IRequest<Result<AccountDto>>;

public class CreateAccountCommandHandler(IAppDbContext db)
    : IRequestHandler<CreateAccountCommand, Result<AccountDto>>
{
    public async Task<Result<AccountDto>> Handle(CreateAccountCommand request, CancellationToken ct)
    {
        var name = request.Name?.Trim() ?? string.Empty;
        if (name.Length is < 1 or > 200)
            return Result.Failure<AccountDto>(SalesErrors.InvalidAccountName);

        var account = new Account
        {
            ProjectId = request.ProjectId,
            Name = name,
            Domain = request.Domain?.Trim(),
            Industry = request.Industry?.Trim(),
            OwnerId = request.OwnerId,
            Notes = request.Notes,
        };
        db.Accounts.Add(account);
        await db.SaveChangesAsync(ct);

        return Result.Success(new AccountDto(
            account.Id, account.ProjectId, account.Name, account.Domain, account.Industry,
            account.OwnerId, account.Notes, account.CreatedAt, account.ArchivedAt,
            OpenDealCount: 0, OpenDealValue: 0m));
    }
}
