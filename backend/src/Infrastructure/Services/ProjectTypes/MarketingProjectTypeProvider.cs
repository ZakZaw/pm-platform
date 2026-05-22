using Application.Interfaces;
using Domain.Enums;

namespace Infrastructure.Services.ProjectTypes;

// F1.5-04 ships the Marketing work model (Campaign / Asset / Content Calendar).
public class MarketingProjectTypeProvider : IProjectTypeProvider
{
    public ProjectType Type => ProjectType.Marketing;
    public string DisplayName => "Marketing";
    public string ShortDescription => "Campaigns, assets, content calendar.";
    public string AIGenerationPromptKey => "ProjectGeneration";

    public Task SeedNewProjectAsync(
        IAppDbContext db, Guid projectId, Guid createdByUserId, CancellationToken ct)
        => Task.CompletedTask;
}
