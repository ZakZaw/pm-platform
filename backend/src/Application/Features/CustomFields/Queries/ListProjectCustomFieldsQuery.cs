using Application.Common;
using Application.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.CustomFields.Queries;

/// <summary>
/// Lists every live (non-deleted) custom-field definition for a project,
/// in sort order. Used by both the settings page (which lets PMs edit
/// the schema) and TaskForm/TaskDetail (which renders inputs per field).
/// </summary>
public record ListProjectCustomFieldsQuery(Guid ProjectId)
    : IRequest<Result<IReadOnlyList<CustomFieldDefinitionDto>>>;

public record CustomFieldDefinitionDto(
    Guid Id,
    Guid ProjectId,
    string Name,
    string FieldType,
    IReadOnlyList<string>? Options,
    bool Required,
    int SortOrder,
    DateTime CreatedAt);

public class ListProjectCustomFieldsQueryHandler(IAppDbContext db)
    : IRequestHandler<ListProjectCustomFieldsQuery, Result<IReadOnlyList<CustomFieldDefinitionDto>>>
{
    public async Task<Result<IReadOnlyList<CustomFieldDefinitionDto>>> Handle(
        ListProjectCustomFieldsQuery request, CancellationToken ct)
    {
        var rows = await db.CustomFieldDefinitions
            .Where(d => d.ProjectId == request.ProjectId && d.DeletedAt == null)
            .OrderBy(d => d.SortOrder).ThenBy(d => d.CreatedAt)
            .Select(d => new
            {
                d.Id, d.ProjectId, d.Name,
                FieldType = d.FieldType.ToString(),
                d.OptionsJson, d.Required, d.SortOrder, d.CreatedAt
            })
            .ToListAsync(ct);

        var dtos = rows
            .Select(r => new CustomFieldDefinitionDto(
                r.Id, r.ProjectId, r.Name, r.FieldType,
                CustomFieldOptions.Parse(r.OptionsJson),
                r.Required, r.SortOrder, r.CreatedAt))
            .ToList();

        return Result.Success<IReadOnlyList<CustomFieldDefinitionDto>>(dtos);
    }
}

internal static class CustomFieldOptions
{
    public static IReadOnlyList<string>? Parse(string? json)
    {
        if (string.IsNullOrEmpty(json)) return null;
        try
        {
            var arr = System.Text.Json.JsonSerializer.Deserialize<string[]>(json,
                new System.Text.Json.JsonSerializerOptions(System.Text.Json.JsonSerializerDefaults.Web));
            return arr;
        }
        catch
        {
            return null;
        }
    }
}
