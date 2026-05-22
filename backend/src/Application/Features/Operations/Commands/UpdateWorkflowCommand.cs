using Application.Common;
using Application.Interfaces;
using Domain.ValueObjects;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Operations.Commands;

public record UpdateWorkflowCommand(
    Guid WorkflowId,
    string? Name,
    string? Description,
    string? RecurrenceRule,
    bool ClearRecurrence,
    Guid? OwnerId,
    bool ClearOwner,
    IReadOnlyList<ChecklistTemplateItemDto>? Template,
    bool? Archive) : IRequest<Result<WorkflowDto>>;

public class UpdateWorkflowCommandHandler(IAppDbContext db)
    : IRequestHandler<UpdateWorkflowCommand, Result<WorkflowDto>>
{
    public async Task<Result<WorkflowDto>> Handle(UpdateWorkflowCommand request, CancellationToken ct)
    {
        var w = await db.Workflows.FirstOrDefaultAsync(x => x.Id == request.WorkflowId, ct);
        if (w is null) return Result.Failure<WorkflowDto>(OperationsErrors.WorkflowNotFound);

        if (request.Name is not null)
        {
            var n = request.Name.Trim();
            if (n.Length is < 1 or > 200)
                return Result.Failure<WorkflowDto>(OperationsErrors.InvalidWorkflowName);
            w.Name = n;
        }

        if (request.Description is not null) w.Description = request.Description;

        if (request.ClearRecurrence) w.RecurrenceRule = null;
        else if (request.RecurrenceRule is not null)
        {
            if (!RecurrenceRuleHelper.TryParse(request.RecurrenceRule, out _))
                return Result.Failure<WorkflowDto>(OperationsErrors.InvalidRecurrence);
            w.RecurrenceRule = request.RecurrenceRule.Trim();
        }

        if (request.ClearOwner) w.OwnerId = null;
        else if (request.OwnerId.HasValue) w.OwnerId = request.OwnerId;

        if (request.Template is not null)
        {
            var normalised = CreateWorkflowCommandHandler.NormaliseTemplate(request.Template);
            if (normalised is null)
                return Result.Failure<WorkflowDto>(OperationsErrors.InvalidTemplate);
            w.TemplateJson = RunMaterializer.SerializeTemplate(normalised);
        }

        if (request.Archive.HasValue)
            w.ArchivedAt = request.Archive.Value ? DateTime.UtcNow : null;

        await db.SaveChangesAsync(ct);

        var template = RunMaterializer.ParseTemplate(w.TemplateJson);
        return Result.Success(new WorkflowDto(
            w.Id, w.ProjectId, w.Name, w.Description, w.RecurrenceRule, w.OwnerId,
            template, w.CreatedAt, w.ArchivedAt,
            NextRunAt: null, LastCompletedAt: null, LastRunStatus: null,
            PendingRunCount: 0, OverdueRunCount: 0));
    }
}
