namespace Application.Authorization;

/// <summary>
/// The kind of entity a route id refers to when an endpoint is
/// authorised against the entity's owning project. The resolver
/// (<see cref="IAccessControl.ResolveProjectIdAsync"/>) maps every value
/// to that entity's <c>ProjectId</c>, so endpoints addressed by a child
/// id (<c>/tasks/{id}</c>, <c>/deals/{dealId}</c>, ...) get the same
/// project-membership + role gate as <c>/projects/{projectId}/...</c>.
/// </summary>
public enum ProjectScope
{
    Project,
    Task,
    Epic,
    Sprint,
    Subtask,
    Attachment,
    Comment,
    Label,
    TaskList,
    TimeLog,
    PokerSession,
    Campaign,
    Asset,
    MarketingTask,
    Workflow,
    WorkflowRun,
    ChecklistItem,
    DealStage,
    Account,
    Deal,
    Lead,
    Queue,
    Customer,
    Ticket,
    Meeting,
    MeetingGuestLink,
    MeetingActionItem,
    Integration,
    AISuggestion,
}

/// <summary>
/// How an org-scoped endpoint identifies its organization. <see cref="Slug"/>
/// is the classic <c>/orgs/{slug}</c> route; the others resolve the org
/// from an entity id.
/// </summary>
public enum OrgScope
{
    Slug,
    Organization,
    Channel,
    Message,
    ApiKey,
    AIGenerationRequest,
}

/// <summary>
/// Who is asking. <see cref="ApiKeyOrgId"/> is set when the request was
/// authenticated with an org API key: such a principal may only touch
/// resources inside that org, whatever the key creator's own memberships.
/// </summary>
public readonly record struct AccessPrincipal(Guid UserId, Guid? ApiKeyOrgId);
