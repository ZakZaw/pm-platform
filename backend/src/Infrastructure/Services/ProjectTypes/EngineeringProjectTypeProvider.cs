using Application.Interfaces;
using Domain.Enums;

namespace Infrastructure.Services.ProjectTypes;

public class EngineeringProjectTypeProvider : IProjectTypeProvider
{
    public ProjectType Type => ProjectType.Engineering;
    public string DisplayName => "Engineering";
    public string ShortDescription => "Epics, tasks, sprints, kanban — for software teams.";
    public string AIGenerationPromptKey => "ProjectGeneration";

    public Task SeedNewProjectAsync(
        IAppDbContext db, Guid projectId, Guid createdByUserId, CancellationToken ct)
        => Task.CompletedTask;
}
