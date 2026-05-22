using Domain.Enums;

namespace Application.Interfaces;

public interface IProjectTypeSeeder
{
    // Type-specific seeding applied right after a new project is added to
    // the context (before SaveChanges). Engineering is a no-op; Sales
    // seeds default deal stages; Support will seed default queues; etc.
    Task SeedNewProjectAsync(
        IAppDbContext db,
        Guid projectId,
        Guid createdByUserId,
        CancellationToken ct);
}

/// <summary>
/// Per-type configuration registered in one place rather than branched
/// across the app. Each <see cref="Domain.Enums.ProjectType"/> registers
/// one provider in DI; consumers resolve via <see cref="IProjectTypeRegistry"/>.
///
/// Phase 1.5-01 scaffolds the interface + Engineering's real config and
/// stubs for Sales/Support/Marketing/Operations/Generic. The stub fields
/// (entity sets, default views, default workflow statuses, default
/// dashboard widgets) are filled in by F1.5-02..F1.5-06 as each type's
/// work model lands.
/// </summary>
public interface IProjectTypeProvider : IProjectTypeSeeder
{
    ProjectType Type { get; }

    /// <summary>Human-readable name shown in the UI. Mirrors the frontend
    /// PROJECT_TYPES constant so backend-rendered surfaces (emails, audit
    /// logs) read the same way.</summary>
    string DisplayName { get; }

    /// <summary>One-line summary used by the project create flow and the
    /// AI prompt context (so the model knows what kind of project it's
    /// generating for).</summary>
    string ShortDescription { get; }

    /// <summary>Prompt key looked up in PromptLibrary for AI project
    /// generation. F1.5-07 swaps in per-type prompts; until then all
    /// types map to the existing engineering prompt.</summary>
    string AIGenerationPromptKey { get; }
}
