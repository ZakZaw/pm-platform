using Domain.Enums;

namespace Application.Interfaces;

/// <summary>
/// Looks up the <see cref="IProjectTypeProvider"/> for a given project
/// type. One registry per app — backed by DI so adding a new type means
/// adding a new provider class, no registry edits.
/// </summary>
public interface IProjectTypeRegistry
{
    IProjectTypeProvider Get(ProjectType type);
    IReadOnlyList<IProjectTypeProvider> All { get; }
}
