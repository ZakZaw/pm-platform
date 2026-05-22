using Application.Common;
using Application.Interfaces;
using Domain.Entities;
using Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Sales.Commands;

public record CreateLeadCommand(
    Guid ProjectId,
    string Name,
    string? Email,
    string? Phone,
    string? Source,
    Guid? AccountId,
    Guid? OwnerId) : IRequest<Result<LeadDto>>;

public class CreateLeadCommandHandler(IAppDbContext db)
    : IRequestHandler<CreateLeadCommand, Result<LeadDto>>
{
    public async Task<Result<LeadDto>> Handle(CreateLeadCommand request, CancellationToken ct)
    {
        var name = request.Name?.Trim() ?? string.Empty;
        if (name.Length is < 1 or > 200)
            return Result.Failure<LeadDto>(SalesErrors.InvalidLeadName);

        if (request.AccountId is { } accountId)
        {
            var accountInProject = await db.Accounts
                .AnyAsync(a => a.Id == accountId && a.ProjectId == request.ProjectId, ct);
            if (!accountInProject)
                return Result.Failure<LeadDto>(SalesErrors.AccountNotInProject);
        }

        var lead = new Lead
        {
            ProjectId = request.ProjectId,
            AccountId = request.AccountId,
            Name = name,
            Email = request.Email?.Trim(),
            Phone = request.Phone?.Trim(),
            Source = request.Source?.Trim(),
            Status = LeadStatus.New,
            OwnerId = request.OwnerId,
        };
        db.Leads.Add(lead);
        await db.SaveChangesAsync(ct);

        return Result.Success(new LeadDto(
            lead.Id, lead.ProjectId, lead.AccountId, lead.Name,
            lead.Email, lead.Phone, lead.Source, lead.Status.ToString(),
            lead.OwnerId, lead.ConvertedDealId, lead.CreatedAt, lead.ConvertedAt));
    }
}
