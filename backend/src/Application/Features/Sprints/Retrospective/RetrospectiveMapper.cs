using System.Text.Json;
using Application.Features.AI;
using Domain.Entities;

namespace Application.Features.Sprints.Retrospective;

/// <summary>
/// Builds the read DTO. Splits draft hydration into a memory-only step
/// and a DB-backed step:
/// <list type="bullet">
///   <item><see cref="ToDto(SprintRetrospective, AIRetroNextSprintDraft?, IReadOnlyList{AIRetroBacklogCandidate})"/>
///     — used right after generate, when the candidates list is already
///     in memory and the AI draft hasn't been persisted+rehydrated yet.</item>
///   <item><see cref="ToDto(SprintRetrospective, IReadOnlyList{TaskKeyAndTitle})"/>
///     — used by the read query, which loads the draft from JSON on
///     the entity and joins backlog tasks for display.</item>
/// </list>
/// </summary>
internal static class RetrospectiveMapper
{
    private static readonly JsonSerializerOptions JsonOpts =
        new(JsonSerializerDefaults.Web);

    public record TaskKeyAndTitle(Guid TaskId, string Key, string Title, int Points);

    public static SprintRetrospectiveDto ToDto(
        SprintRetrospective entity,
        AIRetroNextSprintDraft? draft,
        IReadOnlyList<AIRetroBacklogCandidate> candidates)
    {
        NextSprintDraftDto? draftDto = null;
        if (draft is not null)
        {
            var byId = candidates.ToDictionary(c => c.TaskId);
            var picks = draft.Tasks
                .Where(p => byId.ContainsKey(p.TaskId))
                .Select(p =>
                {
                    var c = byId[p.TaskId];
                    return new NextSprintDraftPickDto(
                        p.TaskId, c.Key, c.Title, c.Points, p.Reasoning);
                })
                .ToList();
            draftDto = new NextSprintDraftDto(draft.Name, draft.Goal, picks);
        }
        return ToDtoCore(entity, draftDto);
    }

    public static SprintRetrospectiveDto ToDto(
        SprintRetrospective entity,
        IReadOnlyDictionary<Guid, TaskKeyAndTitle> taskLookup)
    {
        NextSprintDraftDto? draftDto = null;
        if (!string.IsNullOrWhiteSpace(entity.NextSprintDraftJson))
        {
            try
            {
                var parsed = JsonSerializer.Deserialize<AIRetroNextSprintDraft>(
                    entity.NextSprintDraftJson, JsonOpts);
                if (parsed is not null)
                {
                    var picks = parsed.Tasks
                        .Select(p =>
                        {
                            taskLookup.TryGetValue(p.TaskId, out var t);
                            return new NextSprintDraftPickDto(
                                p.TaskId,
                                t?.Key ?? "(unknown)",
                                t?.Title ?? "(task removed)",
                                t?.Points ?? 0,
                                p.Reasoning);
                        })
                        .ToList();
                    draftDto = new NextSprintDraftDto(parsed.Name, parsed.Goal, picks);
                }
            }
            catch (JsonException) { /* leave draft null */ }
        }
        return ToDtoCore(entity, draftDto);
    }

    /// <summary>Get the raw draft picks for the apply command — bypasses
    /// the read DTO's task-lookup join.</summary>
    public static AIRetroNextSprintDraft? ParseDraft(SprintRetrospective entity)
    {
        if (string.IsNullOrWhiteSpace(entity.NextSprintDraftJson)) return null;
        try
        {
            return JsonSerializer.Deserialize<AIRetroNextSprintDraft>(
                entity.NextSprintDraftJson, JsonOpts);
        }
        catch (JsonException) { return null; }
    }

    private static SprintRetrospectiveDto ToDtoCore(
        SprintRetrospective entity, NextSprintDraftDto? draftDto) =>
        new(
            entity.Id, entity.SprintId,
            entity.Summary, entity.WhatWentWell, entity.WhatDidnt, entity.Suggestions,
            draftDto,
            entity.GeneratedByUserId, entity.GeneratedAt,
            entity.AppliedByUserId, entity.AppliedAt, entity.AppliedSprintId,
            entity.Provider, entity.Model);
}
