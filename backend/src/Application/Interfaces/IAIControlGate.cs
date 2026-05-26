using Domain.Enums;

namespace Application.Interfaces;

/// <summary>
/// Per-project gate for AI writes. Command handlers consult this before
/// touching the AI provider so the Off mode short-circuits before any
/// (expensive) external call happens, and so future automated triggers
/// (F2-09+ Task→Done, Blocked cascade, velocity drop) can pick between
/// "silently apply" and "queue an inbox card" based on the project's
/// chosen mode.
///
/// The four modes map to:
/// <list type="bullet">
///   <item><c>Off</c> — every AI write blocked; the gate returns false.</item>
///   <item><c>Suggest</c> — writes allowed; automation should land in the AI inbox.</item>
///   <item><c>AskMeFirst</c> — writes allowed but automation should be flagged
///     blocking (UI shows modal instead of inbox card).</item>
///   <item><c>Autopilot</c> — writes allowed; automation may apply silently +
///     audit-log, with a 24h undo window.</item>
/// </list>
/// </summary>
public interface IAIControlGate
{
    Task<AIControlMode> GetModeAsync(Guid projectId, CancellationToken ct = default);

    /// <summary>True when the project's mode is anything other than Off.</summary>
    Task<bool> IsAllowedAsync(Guid projectId, CancellationToken ct = default);
}
