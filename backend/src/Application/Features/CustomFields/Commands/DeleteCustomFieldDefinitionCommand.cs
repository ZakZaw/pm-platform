using Application.Common;
using Application.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.CustomFields.Commands;

/// <summary>
/// Soft-deletes a custom-field definition. Existing
/// <see cref="Domain.Entities.CustomFieldValue"/> rows are left alone —
/// they remain queryable for audit/history but no longer show up in
/// TaskForm or the settings page.
/// </summary>
public record DeleteCustomFieldDefinitionCommand(Guid Id) : IRequest<Result>;

public class DeleteCustomFieldDefinitionCommandHandler(IAppDbContext db)
    : IRequestHandler<DeleteCustomFieldDefinitionCommand, Result>
{
    public async Task<Result> Handle(DeleteCustomFieldDefinitionCommand request, CancellationToken ct)
    {
        var def = await db.CustomFieldDefinitions
            .FirstOrDefaultAsync(d => d.Id == request.Id && d.DeletedAt == null, ct);
        if (def is null) return Result.Failure(CustomFieldErrors.NotFound);

        def.DeletedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
