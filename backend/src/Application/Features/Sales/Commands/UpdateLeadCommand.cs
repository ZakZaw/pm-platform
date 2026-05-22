using Application.Common;
using Application.Interfaces;
using Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Sales.Commands;

public record UpdateLeadCommand(
    Guid LeadId,
    string? Name,
    string? Email,
    string? Phone,
    string? Source,
    string? Status,
    Guid? AccountId,
    Guid? OwnerId) : IRequest<Result<LeadDto>>;

public class UpdateLeadCommandHandler(IAppDbContext db)
    : IRequestHandler<UpdateLeadCommand, Result<LeadDto>>
{
    public async Task<Result<LeadDto>> Handle(UpdateLeadCommand request, CancellationToken ct)
    {
        var lead = await db.Leads.FirstOrDefaultAsync(l => l.Id == request.LeadId, ct);
        if (lead is null) return Result.Failure<LeadDto>(SalesErrors.LeadNotFound);

        if (request.Name is not null)
        {
            var n = request.Name.Trim();
            if (n.Length is < 1 or > 200)
                return Result.Failure<LeadDto>(SalesErrors.InvalidLeadName);
            lead.Name = n;
        }
        if (request.Email is not null) lead.Email = request.Email.Trim();
        if (request.Phone is not null) lead.Phone = request.Phone.Trim();
        if (request.Source is not null) lead.Source = request.Source.Trim();
        if (request.AccountId.HasValue) lead.AccountId = request.AccountId;
        if (request.OwnerId.HasValue) lead.OwnerId = request.OwnerId;

        if (request.Status is not null)
        {
            if (!Enum.TryParse<LeadStatus>(request.Status, ignoreCase: true, out var status))
                return Result.Failure<LeadDto>(SalesErrors.LeadNotFound);
            lead.Status = status;
        }

        await db.SaveChangesAsync(ct);

        return Result.Success(new LeadDto(
            lead.Id, lead.ProjectId, lead.AccountId, lead.Name,
            lead.Email, lead.Phone, lead.Source, lead.Status.ToString(),
            lead.OwnerId, lead.ConvertedDealId, lead.CreatedAt, lead.ConvertedAt));
    }
}
