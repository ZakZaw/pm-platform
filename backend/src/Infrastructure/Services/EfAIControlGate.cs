using Application.Interfaces;
using Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Services;

/// <summary>EF-backed implementation of <see cref="IAIControlGate"/>.
/// Reads the mode column on the Project row. Missing projects resolve to
/// <see cref="AIControlMode.Off"/> so a bug elsewhere can't accidentally
/// open the gate.</summary>
public class EfAIControlGate(IAppDbContext db) : IAIControlGate
{
    public async Task<AIControlMode> GetModeAsync(Guid projectId, CancellationToken ct = default)
    {
        var mode = await db.Projects
            .Where(p => p.Id == projectId)
            .Select(p => (AIControlMode?)p.AIControlMode)
            .FirstOrDefaultAsync(ct);
        return mode ?? AIControlMode.Off;
    }

    public async Task<bool> IsAllowedAsync(Guid projectId, CancellationToken ct = default)
    {
        var mode = await GetModeAsync(projectId, ct);
        return mode != AIControlMode.Off;
    }
}
