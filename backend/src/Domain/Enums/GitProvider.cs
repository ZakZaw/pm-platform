namespace Domain.Enums;

/// <summary>
/// F2-23 — the source-control provider behind an <see cref="Entities.Integration"/>.
/// Only GitHub ships in F2-23; the enum leaves room for GitLab /
/// Bitbucket adapters without a schema change.
/// </summary>
public enum GitProvider
{
    GitHub = 0,
}
