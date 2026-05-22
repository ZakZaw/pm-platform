using Application.Interfaces;
using Domain.Entities;
using Domain.Enums;
using SysTask = System.Threading.Tasks.Task;

namespace Infrastructure.Services.ProjectTypes;

public class SalesProjectTypeProvider : IProjectTypeProvider
{
    public ProjectType Type => ProjectType.Sales;
    public string DisplayName => "Sales";
    public string ShortDescription => "Accounts, leads, deals — a CRM-style pipeline.";
    public string AIGenerationPromptKey => "ProjectGeneration";

    // Default pipeline applied on Sales project creation. Editable
    // afterwards via the deal-stages endpoints. The terminal flags drive
    // Deal.Status — moving to a terminal-won stage marks the deal Won;
    // terminal-lost requires a reason and marks it Lost.
    private static readonly (string Name, int Probability, bool Won, bool Lost)[]
        DefaultStages =
        [
            ("Discover",      10, false, false),
            ("Qualify",       25, false, false),
            ("Propose",       50, false, false),
            ("Negotiate",     75, false, false),
            ("Closed Won",   100, true,  false),
            ("Closed Lost",    0, false, true),
        ];

    public SysTask SeedNewProjectAsync(
        IAppDbContext db, Guid projectId, Guid createdByUserId, CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        for (var i = 0; i < DefaultStages.Length; i++)
        {
            var (name, prob, won, lost) = DefaultStages[i];
            db.DealStages.Add(new DealStage
            {
                ProjectId = projectId,
                Name = name,
                Order = i,
                DefaultProbability = prob,
                IsTerminalWon = won,
                IsTerminalLost = lost,
                CreatedAt = now,
            });
        }
        return SysTask.CompletedTask;
    }
}
