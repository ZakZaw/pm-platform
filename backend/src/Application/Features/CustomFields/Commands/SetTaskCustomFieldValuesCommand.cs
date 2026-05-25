using System.Text.Json;
using Application.Common;
using Application.Features.CustomFields.Queries;
using Application.Interfaces;
using Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.CustomFields.Commands;

/// <summary>
/// Writes (or clears) a batch of custom-field values for a single task.
/// Pass a null/undefined JsonElement to clear a field. Each entry is
/// validated against the corresponding definition's type and option set.
/// </summary>
public record SetTaskCustomFieldValuesCommand(
    Guid TaskId,
    IReadOnlyList<CustomFieldValueInput> Values)
    : IRequest<Result<IReadOnlyList<CustomFieldValueDto>>>;

public record CustomFieldValueInput(Guid DefinitionId, JsonElement? Value);

public class SetTaskCustomFieldValuesCommandHandler(IAppDbContext db)
    : IRequestHandler<SetTaskCustomFieldValuesCommand, Result<IReadOnlyList<CustomFieldValueDto>>>
{
    public async Task<Result<IReadOnlyList<CustomFieldValueDto>>> Handle(
        SetTaskCustomFieldValuesCommand request, CancellationToken ct)
    {
        var task = await db.Tasks
            .Where(t => t.Id == request.TaskId)
            .Select(t => new { t.Id, t.ProjectId })
            .FirstOrDefaultAsync(ct);
        if (task is null) return Result.Failure<IReadOnlyList<CustomFieldValueDto>>(TaskErrors.NotFound);

        // Load every live definition for the project up-front; we need them
        // both for per-field validation and for the required-field check below.
        var defs = await db.CustomFieldDefinitions
            .Where(d => d.ProjectId == task.ProjectId && d.DeletedAt == null)
            .ToDictionaryAsync(d => d.Id, ct);

        // Validate every incoming value first — fail the whole batch if any
        // is bad. This keeps the task's data internally consistent.
        var normalized = new Dictionary<Guid, string?>();
        foreach (var input in request.Values)
        {
            if (!defs.TryGetValue(input.DefinitionId, out var def))
                return Result.Failure<IReadOnlyList<CustomFieldValueDto>>(CustomFieldErrors.NotFound);

            var v = CustomFieldValidator.ValidateValue(def.FieldType, def.OptionsJson, input.Value);
            if (!v.IsSuccess) return Result.Failure<IReadOnlyList<CustomFieldValueDto>>(v.Error!);
            normalized[input.DefinitionId] = v.Value;
        }

        // Load existing rows so we know what to update vs insert.
        var existing = await db.CustomFieldValues
            .Where(v => v.TaskId == task.Id)
            .ToDictionaryAsync(v => v.DefinitionId, ct);

        var now = DateTime.UtcNow;
        foreach (var (defId, json) in normalized)
        {
            if (json is null)
            {
                if (existing.TryGetValue(defId, out var toRemove))
                    db.CustomFieldValues.Remove(toRemove);
                existing.Remove(defId);
                continue;
            }

            if (existing.TryGetValue(defId, out var row))
            {
                row.ValueJson = json;
                row.UpdatedAt = now;
            }
            else
            {
                var newRow = new CustomFieldValue
                {
                    TaskId = task.Id,
                    DefinitionId = defId,
                    ValueJson = json,
                    UpdatedAt = now,
                };
                db.CustomFieldValues.Add(newRow);
                existing[defId] = newRow;
            }
        }

        // Required-field gate: every required definition must have a non-null
        // value after the batch is applied. We pull the merged set from
        // `existing` (which we just mutated) so the check is in-memory only.
        var missing = defs.Values
            .Where(d => d.Required && !existing.ContainsKey(d.Id))
            .ToList();
        if (missing.Count > 0)
            return Result.Failure<IReadOnlyList<CustomFieldValueDto>>(CustomFieldErrors.RequiredMissing);

        await db.SaveChangesAsync(ct);

        var dtos = existing.Values
            .Select(v => new CustomFieldValueDto(v.DefinitionId, v.ValueJson, v.UpdatedAt))
            .ToList();
        return Result.Success<IReadOnlyList<CustomFieldValueDto>>(dtos);
    }
}
