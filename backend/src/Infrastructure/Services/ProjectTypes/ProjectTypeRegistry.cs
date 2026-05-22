using Application.Interfaces;
using Domain.Enums;

namespace Infrastructure.Services.ProjectTypes;

/// <summary>
/// Default <see cref="IProjectTypeRegistry"/>. Indexes the DI-registered
/// providers by their <see cref="IProjectTypeProvider.Type"/>; throws on
/// lookup of an unregistered type so a missing provider fails loudly
/// instead of silently degrading.
/// </summary>
public class ProjectTypeRegistry : IProjectTypeRegistry
{
    private readonly Dictionary<ProjectType, IProjectTypeProvider> _byType;

    public ProjectTypeRegistry(IEnumerable<IProjectTypeProvider> providers)
    {
        _byType = providers.ToDictionary(p => p.Type);
        All = _byType.Values.OrderBy(p => (int)p.Type).ToList();
    }

    public IProjectTypeProvider Get(ProjectType type)
    {
        if (_byType.TryGetValue(type, out var provider)) return provider;
        throw new InvalidOperationException(
            $"No IProjectTypeProvider registered for ProjectType.{type}. " +
            $"Add the provider in Infrastructure DI and re-run.");
    }

    public IReadOnlyList<IProjectTypeProvider> All { get; }
}
