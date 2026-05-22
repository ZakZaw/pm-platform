using Application.Common;
using Application.Interfaces;
using Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Support.Queries;

public record GetCustomerQuery(Guid CustomerId) : IRequest<Result<CustomerDto>>;

public class GetCustomerQueryHandler(IAppDbContext db)
    : IRequestHandler<GetCustomerQuery, Result<CustomerDto>>
{
    public async Task<Result<CustomerDto>> Handle(GetCustomerQuery request, CancellationToken ct)
    {
        var customer = await db.Customers.FirstOrDefaultAsync(c => c.Id == request.CustomerId, ct);
        if (customer is null) return Result.Failure<CustomerDto>(SupportErrors.CustomerNotFound);

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
