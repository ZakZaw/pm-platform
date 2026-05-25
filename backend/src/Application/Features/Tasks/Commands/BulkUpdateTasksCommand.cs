using Application.Common;
using MediatR;

namespace Application.Features.Tasks.Commands;

/// <summary>
/// Apply the same operation to many tasks at once. Each task is dispatched
/// through MediatR independently so per-task validation (e.g. status
/// transition rules) runs unchanged — and a single failure doesn't roll back
/// the whole batch. The response reports each row's outcome separately so
/// the spreadsheet UI can flag the failed ones inline.
/// </summary>
public record BulkUpdateTasksCommand(
    Guid ProjectId,
    IReadOnlyList<Guid> TaskIds,
    string Operation,
    BulkOperationPayload? Payload)
    : IRequest<Result<BulkUpdateTasksResult>>;

public record BulkOperationPayload(
    string? Status,
    string? Reason,
    Guid? AssigneeId,
    bool ClearAssignee);

public record BulkUpdateTasksResult(
    IReadOnlyList<Guid> Succeeded,
    IReadOnlyList<BulkRowError> Failed);

public record BulkRowError(Guid TaskId, string Code, string Message);

public class BulkUpdateTasksCommandHandler(ISender mediator)
    : IRequestHandler<BulkUpdateTasksCommand, Result<BulkUpdateTasksResult>>
{
    public async Task<Result<BulkUpdateTasksResult>> Handle(BulkUpdateTasksCommand request, CancellationToken ct)
    {
        if (request.TaskIds.Count == 0)
            return Result.Failure<BulkUpdateTasksResult>(
                new Error("Bulk.NoTaskIds", "At least one task id is required."));

        if (request.TaskIds.Count > 500)
            return Result.Failure<BulkUpdateTasksResult>(
                new Error("Bulk.TooManyTasks", "Bulk operations are capped at 500 tasks per call."));

        var op = request.Operation?.Trim().ToLowerInvariant();
        var succeeded = new List<Guid>();
        var failed = new List<BulkRowError>();

        foreach (var taskId in request.TaskIds)
        {
            try
            {
                var rowResult = op switch
                {
                    "status" => await ApplyStatus(taskId, request.Payload, ct),
                    "assignee" => await ApplyAssignee(taskId, request.Payload, ct),
                    "delete" => await ApplyDelete(taskId, ct),
                    _ => Result.Failure(new Error("Bulk.UnknownOperation",
                        $"Unknown operation '{request.Operation}'. Valid: status, assignee, delete.")),
                };
                if (rowResult.IsSuccess) succeeded.Add(taskId);
                else failed.Add(new BulkRowError(taskId, rowResult.Error!.Code, rowResult.Error.Message));
            }
            catch (Exception ex)
            {
                failed.Add(new BulkRowError(taskId, "Bulk.UnhandledError", ex.Message));
            }
        }

        return Result.Success(new BulkUpdateTasksResult(succeeded, failed));
    }

    private async Task<Result> ApplyStatus(Guid taskId, BulkOperationPayload? payload, CancellationToken ct)
    {
        if (payload is null || string.IsNullOrWhiteSpace(payload.Status))
            return Result.Failure(new Error("Bulk.MissingStatus", "Status value is required."));

        var inner = await mediator.Send(
            new UpdateTaskStatusCommand(taskId, payload.Status, payload.Reason), ct);
        return inner.IsSuccess ? Result.Success() : Result.Failure(inner.Error!);
    }

    private async Task<Result> ApplyAssignee(Guid taskId, BulkOperationPayload? payload, CancellationToken ct)
    {
        var inner = await mediator.Send(
            new UpdateTaskCommand(
                taskId,
                Title: null, Description: null, Priority: null, StoryPoints: null,
                EpicId: null, ClearEpic: false,
                SprintId: null, ClearSprint: false,
                AssigneeId: payload?.AssigneeId,
                ClearAssignee: payload?.ClearAssignee ?? (payload?.AssigneeId is null),
                ReviewerId: null, ClearReviewer: false,
                DueDate: null, ClearDueDate: false,
                TimeLoggedMinutes: null, PrUrl: null,
                AcceptanceCriteria: null),
            ct);
        return inner.IsSuccess ? Result.Success() : Result.Failure(inner.Error!);
    }

    private async Task<Result> ApplyDelete(Guid taskId, CancellationToken ct)
    {
        var inner = await mediator.Send(new DeleteTaskCommand(taskId), ct);
        return inner.IsSuccess ? Result.Success() : Result.Failure(inner.Error!);
    }
}
