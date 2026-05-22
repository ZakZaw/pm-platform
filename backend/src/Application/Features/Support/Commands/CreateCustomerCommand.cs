using Application.Common;
using Application.Interfaces;
using Domain.Entities;
using MediatR;

namespace Application.Features.Support.Commands;

public record CreateCustomerCommand(
    Guid ProjectId,
    string Name,
    string? Email,
    string? Company,
    string? Tier) : IRequest<Result<CustomerDto>>;

public class CreateCustomerCommandHandler(IAppDbContext db)
    : IRequestHandler<CreateCustomerCommand, Result<CustomerDto>>
{
    public async Task<Result<CustomerDto>> Handle(CreateCustomerCommand request, CancellationToken ct)
    {
        var name = request.Name?.Trim() ?? string.Empty;
        if (name.Length is < 1 or > 200)
            return Result.Failure<CustomerDto>(SupportErrors.InvalidCustomerName);

        var customer = new Customer
        {
            ProjectId = request.ProjectId,
            Name = name,
            Email = request.Email?.Trim(),
            Company = request.Company?.Trim(),
            Tier = request.Tier?.Trim(),
        };
        db.Customers.Add(customer);
        await db.SaveChangesAsync(ct);

        return Result.Success(new CustomerDto(
            customer.Id, customer.ProjectId, customer.Name,
            customer.Email, customer.Company, customer.Tier, customer.CreatedAt,
            OpenTicketCount: 0, TotalTicketCount: 0));
    }
}
