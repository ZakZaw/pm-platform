using Application.Interfaces;
using Domain.Enums;

namespace Infrastructure.Services.ProjectTypes;

// F1.5-05: Operations projects own recurring workflows. New projects
// start empty — the user defines their own runbooks via the Workflows
// page; runs are materialised lazily from each workflow's recurrence
// rule on the first read after the schedule window opens (see
// Application.Features.Operations.RunMaterializer).
public class OperationsProjectTypeProvider : IProjectTypeProvider
{
    public ProjectType Type => ProjectType.Operations;
    public string DisplayName => "Operations";
    public string ShortDescription => "Recurring workflows, runbooks, checklists.";
    public string AIGenerationPromptKey => "ProjectGeneration";

    public Task SeedNewProjectAsync(
        IAppDbContext db, Guid projectId, Guid createdByUserId, CancellationToken ct)
        => Task.CompletedTask;
}
