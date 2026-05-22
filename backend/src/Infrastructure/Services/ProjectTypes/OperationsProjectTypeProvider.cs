using Application.Interfaces;
using Domain.Enums;

namespace Infrastructure.Services.ProjectTypes;

// F1.5-05 ships the Operations work model (Workflow / Run / Checklist).
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
