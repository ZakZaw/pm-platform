using Application.Interfaces;
using Domain.Entities;
using Domain.Enums;
using SysTask = System.Threading.Tasks.Task;

namespace Infrastructure.Services.ProjectTypes;

public class SupportProjectTypeProvider : IProjectTypeProvider
{
    public ProjectType Type => ProjectType.Support;
    public string DisplayName => "Support";
    public string ShortDescription => "Tickets, queues, SLAs, customer view.";
    public string AIGenerationPromptKey => "ProjectGeneration";

    // Default set of queues on Support project creation. Editable after
    // via the queues endpoints. SLA is wall-clock minutes — production
    // workflows can switch to business-hours via the queue update later.
    private static readonly (string Name, int SlaMinutes)[] DefaultQueues =
    [
        ("General", 24 * 60),
        ("Billing",  8 * 60),
        ("Bugs",    48 * 60),
    ];

    public SysTask SeedNewProjectAsync(
        IAppDbContext db, Guid projectId, Guid createdByUserId, CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        for (var i = 0; i < DefaultQueues.Length; i++)
        {
            var (name, sla) = DefaultQueues[i];
            db.Queues.Add(new Queue
            {
                ProjectId = projectId,
                Name = name,
                Order = i,
                SlaMinutes = sla,
                CreatedAt = now,
            });
        }
        return SysTask.CompletedTask;
    }
}
