using Application.Interfaces;
using Domain.Enums;

namespace Infrastructure.Services.ProjectTypes;

// F1.5-06: Generic projects reuse the existing Task + Subtask entities
// and add a lightweight TaskList grouping (see Domain.Entities.TaskList).
// No seeding needed — a new project starts empty and the user creates
// lists as they go.
public class GenericProjectTypeProvider : IProjectTypeProvider
{
    public ProjectType Type => ProjectType.Generic;
    public string DisplayName => "Generic";
    public string ShortDescription => "Lightweight tasks in lists. No epics or sprints.";
    public string AIGenerationPromptKey => "ProjectGeneration";

    public Task SeedNewProjectAsync(
        IAppDbContext db, Guid projectId, Guid createdByUserId, CancellationToken ct)
        => Task.CompletedTask;
}
