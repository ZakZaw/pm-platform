using Application.Interfaces;
using Domain.Enums;

namespace Infrastructure.Services.ProjectTypes;

// F1.5-03 ships the Support work model (Customer / Ticket / Queue / SLA).
public class SupportProjectTypeProvider : IProjectTypeProvider
{
    public ProjectType Type => ProjectType.Support;
    public string DisplayName => "Support";
    public string ShortDescription => "Tickets, queues, SLAs, customer view.";
    public string AIGenerationPromptKey => "ProjectGeneration";
}
