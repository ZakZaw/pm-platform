using Application.Common;
using Application.Interfaces;
using Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Support.Commands;

public record UpdateCustomerCommand(
    Guid CustomerId,
    string? Name,
    string? Email,
    string? Company,
    string? Tier) : IRequest<Result<CustomerDto>>;

public class UpdateCustomerCommandHandler(IAppDbContext db)
    : IRequestHandler<UpdateCustomerCommand, Result<CustomerDto>>
{
    public async Task<Result<CustomerDto>> Handle(UpdateCustomerCommand request, CancellationToken ct)
    {
        var customer = await db.Customers.FirstOrDefaultAsync(c => c.Id == request.CustomerId, ct);
        if (customer is null) return Result.Failure<CustomerDto>(SupportErrors.CustomerNotFound);

        if (request.Name is not null)
        {
            var n = request.Name.Trim();
            if (n.Length is < 1 or > 200)
                return Result.Failure<CustomerDto>(SupportErrors.InvalidCustomerName);
            customer.Name = n;
        }
        if (request.Email is not null) customer.Email = request.Email.Trim();
        if (request.Company is not null) customer.Company = request.Company.Trim();
        if (request.Tier is not null) customer.Tier = request.Tier.Trim();

        await db.SaveChangesAsync(ct);

        var statuses = await db.Tickets
            .Where(t => t.CustomerId == customer.Id)
            .Select(t => t.Status)
            .ToListAsync(ct);

        return Result.Success(new CustomerDto(
            customer.Id, customer.ProjectId, customer.Name,
            customer.Email, customer.Company, customer.Tier, customer.CreatedAt,
            statuses.Count(s => s != TicketStatus.Resolved && s != TicketStatus.Closed),
            statuses.Count));
    }
}
