using Application.Common;
using Application.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.CustomFields.Queries;

/// <summary>
/// Returns every saved custom-field value for a task. Used by TaskDetail
/// to seed inline inputs. Pairs with <see cref="ListProjectCustomFieldsQuery"/>
/// — definitions describe the schema, this query supplies the values.
/// </summary>
public record GetTaskCustomFieldValuesQuery(Guid TaskId)
    : IRequest<Result<IReadOnlyList<CustomFieldValueDto>>>;

public record CustomFieldValueDto(
    Guid DefinitionId,
    string ValueJson,
    DateTime UpdatedAt);

public class GetTaskCustomFieldValuesQueryHandler(IAppDbContext db)
    : IRequestHandler<GetTaskCustomFieldValuesQuery, Result<IReadOnlyList<CustomFieldValueDto>>>
{
    public async Task<Result<IReadOnlyList<CustomFieldValueDto>>> Handle(
        GetTaskCustomFieldValuesQuery request, CancellationToken ct)
    {
        var rows = await db.CustomFieldValues
            .Where(v => v.TaskId == request.TaskId)
            .Select(v => new CustomFieldValueDto(v.DefinitionId, v.ValueJson, v.UpdatedAt))
            .ToListAsync(ct);

        return Result.Success<IReadOnlyList<CustomFieldValueDto>>(rows);
    }
}
