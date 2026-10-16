namespace Application.Interfaces;

public interface ICurrentUser
{
    Guid? UserId { get; }
    bool IsAuthenticated { get; }

    /// <summary>
    /// Set when the request authenticated with an org API key: the org the
    /// key belongs to. API-key callers are confined to this org.
    /// </summary>
    Guid? ApiKeyOrgId { get; }
}
