using Application.Common;
using Application.Interfaces;
using Domain.ValueObjects;
using MediatR;
using Microsoft.EntityFrameworkCore;
using WorkflowEntity = Domain.Entities.Workflow;

namespace Application.Features.Operations.Commands;

public record CreateWorkflowCommand(
    Guid ProjectId,
    string Name,
    string? Description,
    string? RecurrenceRule,
    Guid? OwnerId,
    IReadOnlyList<ChecklistTemplateItemDto>? Template) : IRequest<Result<WorkflowDto>>;

public class CreateWorkflowCommandHandler(IAppDbContext db)
    : IRequestHandler<CreateWorkflowCommand, Result<WorkflowDto>>
{
    public async Task<Result<WorkflowDto>> Handle(CreateWorkflowCommand request, CancellationToken ct)
    {
        var name = request.Name?.Trim() ?? string.Empty;
        if (name.Length is < 1 or > 200)
            return Result.Failure<WorkflowDto>(OperationsErrors.InvalidWorkflowName);

        if (!string.IsNullOrWhiteSpace(request.RecurrenceRule)
            && !RecurrenceRuleHelper.TryParse(request.RecurrenceRule, out _))
            return Result.Failure<WorkflowDto>(OperationsErrors.InvalidRecurrence);

        var template = NormaliseTemplate(request.Template);
        if (template is null)
            return Result.Failure<WorkflowDto>(OperationsErrors.InvalidTemplate);

        var projectExists = await db.Projects.AnyAsync(p => p.Id == request.ProjectId, ct);
        if (!projectExists) return Result.Failure<WorkflowDto>(ProjectErrors.NotFound);

        var workflow = new WorkflowEntity
        {
            ProjectId = request.ProjectId,
            Name = name,
            Description = request.Description,
            RecurrenceRule = string.IsNullOrWhiteSpace(request.RecurrenceRule) ? null : request.RecurrenceRule!.Trim(),
            OwnerId = request.OwnerId,
            TemplateJson = RunMaterializer.SerializeTemplate(template),
        };
        db.Workflows.Add(workflow);
        await db.SaveChangesAsync(ct);

        // Materialise the first week of runs straight away so the workflow
        // appears with a real "next run" right after creation.
        await RunMaterializer.EnsureUpcomingRunsAsync(db, request.ProjectId, DateTime.UtcNow, ct: ct);

        return Result.Success(new WorkflowDto(
            workflow.Id, workflow.ProjectId, workflow.Name, workflow.Description,
            workflow.RecurrenceRule, workflow.OwnerId, template,
            workflow.CreatedAt, workflow.ArchivedAt,
            NextRunAt: null, LastCompletedAt: null, LastRunStatus: null,
            PendingRunCount: 0, OverdueRunCount: 0));
    }

    internal static IReadOnlyList<ChecklistTemplateItemDto>? NormaliseTemplate(
        IReadOnlyList<ChecklistTemplateItemDto>? raw)
    {
        if (raw is null) return [];
        var cleaned = new List<ChecklistTemplateItemDto>();
        var order = 1;
        foreach (var item in raw)
        {
            var t = item.Title?.Trim();
            if (string.IsNullOrEmpty(t)) return null;
            if (t.Length > 300) return null;
            cleaned.Add(new ChecklistTemplateItemDto(t, order++, item.Sequential));
        }
        return cleaned;
    }
}
