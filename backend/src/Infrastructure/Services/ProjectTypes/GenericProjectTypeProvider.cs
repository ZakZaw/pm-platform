using Application.Interfaces;
using Domain.Enums;

namespace Infrastructure.Services.ProjectTypes;

// F1.5-06 wires up TaskList grouping. Generic projects reuse existing
// Task + Subtask entities so the schema lift is minimal.
public class GenericProjectTypeProvider : IProjectTypeProvider
{
    public ProjectType Type => ProjectType.Generic;
    public string DisplayName => "Generic";
    public string ShortDescription => "Lightweight tasks in lists. No epics or sprints.";
    public string AIGenerationPromptKey => "ProjectGeneration";
}
