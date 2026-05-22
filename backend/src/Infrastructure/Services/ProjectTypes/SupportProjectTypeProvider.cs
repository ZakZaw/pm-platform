using Application.Interfaces;
using Domain.Enums;

namespace Infrastructure.Services.ProjectTypes;

// F1.5-03 ships the Support work model (Customer / Ticket / Queue / SLA)
// and seeds the default queues here.
public class SupportProjectTypeProvider : IProjectTypeProvider
{
    public ProjectType Type => ProjectType.Support;
    public string DisplayName => "Support";
    public string ShortDescription => "Tickets, queues, SLAs, customer view.";
    public string AIGenerationPromptKey => "ProjectGeneration";

    public Task SeedNewProjectAsync(
        IAppDbContext db, Guid projectId, Guid createdByUserId, CancellationToken ct)
        => Task.CompletedTask;
}
