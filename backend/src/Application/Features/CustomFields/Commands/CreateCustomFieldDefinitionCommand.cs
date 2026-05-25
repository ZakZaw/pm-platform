using Application.Common;
using Application.Features.CustomFields.Queries;
using Application.Interfaces;
using Domain.Entities;
using Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.CustomFields.Commands;

public record CreateCustomFieldDefinitionCommand(
    Guid ProjectId,
    string Name,
    string FieldType,
    IReadOnlyList<string>? Options,
    bool Required) : IRequest<Result<CustomFieldDefinitionDto>>;

public class CreateCustomFieldDefinitionCommandHandler(
    IAppDbContext db,
    ICurrentUser currentUser)
    : IRequestHandler<CreateCustomFieldDefinitionCommand, Result<CustomFieldDefinitionDto>>
{
    public async Task<Result<CustomFieldDefinitionDto>> Handle(
        CreateCustomFieldDefinitionCommand request, CancellationToken ct)
    {
        if (currentUser.UserId is null)
            return Result.Failure<CustomFieldDefinitionDto>(AuthErrors.NotAuthenticated);

        var name = request.Name?.Trim() ?? string.Empty;
        if (name.Length is < 1 or > 120)
            return Result.Failure<CustomFieldDefinitionDto>(CustomFieldErrors.InvalidName);

        if (!Enum.TryParse<CustomFieldType>(request.FieldType, ignoreCase: true, out var fieldType))
            return Result.Failure<CustomFieldDefinitionDto>(CustomFieldErrors.InvalidType);

        var projectExists = await db.Projects.AnyAsync(p => p.Id == request.ProjectId, ct);
        if (!projectExists) return Result.Failure<CustomFieldDefinitionDto>(ProjectErrors.NotFound);

        var optionsResult = CustomFieldValidator.ValidateOptions(fieldType, request.Options);
        if (!optionsResult.IsSuccess) return Result.Failure<CustomFieldDefinitionDto>(optionsResult.Error!);

        // Name uniqueness check (live rows only — soft-deleted rows can share names).
        var nameTaken = await db.CustomFieldDefinitions
            .AnyAsync(d => d.ProjectId == request.ProjectId
                && d.DeletedAt == null
                && d.Name == name, ct);
        if (nameTaken) return Result.Failure<CustomFieldDefinitionDto>(CustomFieldErrors.DuplicateName);

        // Append at the end of the schema. The PM can drag to reorder later.
        var maxSort = await db.CustomFieldDefinitions
            .Where(d => d.ProjectId == request.ProjectId)
            .Select(d => (int?)d.SortOrder)
            .MaxAsync(ct);

        var def = new CustomFieldDefinition
        {
            ProjectId = request.ProjectId,
            Name = name,
            FieldType = fieldType,
            OptionsJson = optionsResult.Value,
            Required = request.Required,
            SortOrder = (maxSort ?? -1) + 1,
        };

        db.CustomFieldDefinitions.Add(def);
        await db.SaveChangesAsync(ct);

        return Result.Success(new CustomFieldDefinitionDto(
            def.Id, def.ProjectId, def.Name, def.FieldType.ToString(),
            CustomFieldOptions.Parse(def.OptionsJson),
            def.Required, def.SortOrder, def.CreatedAt));
    }
}
