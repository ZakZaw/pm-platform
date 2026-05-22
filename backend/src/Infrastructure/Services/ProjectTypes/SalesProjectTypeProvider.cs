using Application.Interfaces;
using Domain.Enums;

namespace Infrastructure.Services.ProjectTypes;

// F1.5-02 ships the Sales work model (Account / Lead / Deal / Stage)
// and a Sales-specific AI prompt. Until then the provider exists so
// the registry resolves, and falls back to the engineering prompt.
public class SalesProjectTypeProvider : IProjectTypeProvider
{
    public ProjectType Type => ProjectType.Sales;
    public string DisplayName => "Sales";
    public string ShortDescription => "Accounts, leads, deals — a CRM-style pipeline.";
    public string AIGenerationPromptKey => "ProjectGeneration";
}
