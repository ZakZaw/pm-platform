using Application.Common;
using Application.Features.CustomFields.Queries;
using Application.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.CustomFields.Commands;

/// <summary>
/// Updates a custom-field definition. The field type cannot be changed
/// after creation — saved values would no longer match the schema. To
/// "change" a type, delete the field and create a new one.
/// </summary>
public record UpdateCustomFieldDefinitionCommand(
    Guid Id,
    string Name,
    IReadOnlyList<string>? Options,
    bool Required,
    int? SortOrder) : IRequest<Result<CustomFieldDefinitionDto>>;

public class UpdateCustomFieldDefinitionCommandHandler(IAppDbContext db)
    : IRequestHandler<UpdateCustomFieldDefinitionCommand, Result<CustomFieldDefinitionDto>>
{
    public async Task<Result<CustomFieldDefinitionDto>> Handle(
        UpdateCustomFieldDefinitionCommand request, CancellationToken ct)
    {
        var def = await db.CustomFieldDefinitions
            .FirstOrDefaultAsync(d => d.Id == request.Id && d.DeletedAt == null, ct);
        if (def is null) return Result.Failure<CustomFieldDefinitionDto>(CustomFieldErrors.NotFound);

        var name = request.Name?.Trim() ?? string.Empty;
        if (name.Length is < 1 or > 120)
            return Result.Failure<CustomFieldDefinitionDto>(CustomFieldErrors.InvalidName);

        // Name uniqueness check — exclude self.
        if (!string.Equals(name, def.Name, StringComparison.Ordinal))
        {
            var taken = await db.CustomFieldDefinitions
                .AnyAsync(d => d.ProjectId == def.ProjectId
                    && d.DeletedAt == null
                    && d.Id != def.Id
                    && d.Name == name, ct);
            if (taken) return Result.Failure<CustomFieldDefinitionDto>(CustomFieldErrors.DuplicateName);
        }

        var optionsResult = CustomFieldValidator.ValidateOptions(def.FieldType, request.Options);
        if (!optionsResult.IsSuccess) return Result.Failure<CustomFieldDefinitionDto>(optionsResult.Error!);

        def.Name = name;
        def.OptionsJson = optionsResult.Value;
        def.Required = request.Required;
        if (request.SortOrder.HasValue) def.SortOrder = request.SortOrder.Value;

        await db.SaveChangesAsync(ct);

        return Result.Success(new CustomFieldDefinitionDto(
            def.Id, def.ProjectId, def.Name, def.FieldType.ToString(),
            CustomFieldOptions.Parse(def.OptionsJson),
            def.Required, def.SortOrder, def.CreatedAt));
    }
}
