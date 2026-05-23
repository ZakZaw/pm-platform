namespace Application.Features.AI;

/// <summary>
/// Per-type AI generation drafts (F1.5-07). Engineering keeps using the
/// existing <see cref="AIGeneratedProject"/> shape so its byte-for-byte
/// behaviour is unchanged. The other five types each get a dedicated
/// shape tuned to their work model — sales returns deals + stages,
/// support returns queues + seed tickets, etc.
///
/// All shapes return a <c>SuggestedName</c> alongside the entities so
/// the wizard's project-name field stays type-agnostic.
/// </summary>
public abstract record AITypedProjectDraft(string Type, string SuggestedName);

// ---------- Sales ----------

public record AISalesProjectDraft(
    string SuggestedName,
    IReadOnlyList<AISalesStageDraft> Stages,
    IReadOnlyList<AISalesAccountDraft> Accounts,
    IReadOnlyList<AISalesDealDraft> Deals)
    : AITypedProjectDraft("Sales", SuggestedName);

public record AISalesStageDraft(string Name, int Order, int DefaultProbability);

public record AISalesAccountDraft(
    string Name,
    string? Domain,
    string? Industry);

public record AISalesDealDraft(
    string Name,
    string? AccountName,      // matched to AISalesAccountDraft.Name on apply
    decimal? Value,
    string? Currency,
    string? StageName,        // matched to AISalesStageDraft.Name on apply
    int? Probability,
    DateTime? ExpectedClose);

// ---------- Support ----------

public record AISupportProjectDraft(
    string SuggestedName,
    IReadOnlyList<AISupportQueueDraft> Queues,
    IReadOnlyList<AISupportCustomerDraft> Customers,
    IReadOnlyList<AISupportTicketDraft> Tickets)
    : AITypedProjectDraft("Support", SuggestedName);

public record AISupportQueueDraft(string Name, int SlaMinutes);

public record AISupportCustomerDraft(
    string Name,
    string? Email,
    string? Company,
    string? Tier);

public record AISupportTicketDraft(
    string Subject,
    string? BodyMd,
    string? QueueName,
    string? CustomerName,
    string? Priority);

// ---------- Marketing ----------

public record AIMarketingProjectDraft(
    string SuggestedName,
    IReadOnlyList<AIMarketingCampaignDraft> Campaigns)
    : AITypedProjectDraft("Marketing", SuggestedName);

public record AIMarketingCampaignDraft(
    string Name,
    string Channel,
    string? GoalMd,
    DateTime? StartDate,
    DateTime? EndDate,
    IReadOnlyList<AIMarketingAssetDraft> Assets,
    IReadOnlyList<AIMarketingTaskDraft> Tasks);

public record AIMarketingAssetDraft(
    string Title,
    string Type,
    DateTime? PublishDate);

public record AIMarketingTaskDraft(
    string Title,
    string? AssetTitle,
    DateTime? DueDate);

// ---------- Operations ----------

public record AIOperationsProjectDraft(
    string SuggestedName,
    IReadOnlyList<AIOperationsWorkflowDraft> Workflows)
    : AITypedProjectDraft("Operations", SuggestedName);

public record AIOperationsWorkflowDraft(
    string Name,
    string? Description,
    string? RecurrenceRule,
    IReadOnlyList<AIOperationsChecklistItemDraft> Checklist);

public record AIOperationsChecklistItemDraft(string Title, bool Sequential);

// ---------- Generic ----------

public record AIGenericProjectDraft(
    string SuggestedName,
    IReadOnlyList<AIGenericListDraft> Lists)
    : AITypedProjectDraft("Generic", SuggestedName);

public record AIGenericListDraft(
    string Name,
    IReadOnlyList<AIGenericTaskDraft> Tasks);

public record AIGenericTaskDraft(
    string Title,
    string? Description,
    string? Priority);
