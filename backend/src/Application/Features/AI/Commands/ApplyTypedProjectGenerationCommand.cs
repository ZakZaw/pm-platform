using System.Text.Json;
using Application.Common;
using Application.Features.Marketing;
using Application.Features.Operations;
using Application.Features.Projects;
using Application.Interfaces;
using Domain.Entities;
using Domain.Enums;
using Domain.ValueObjects;
using MediatR;
using Microsoft.EntityFrameworkCore;
using WorkflowEntity = Domain.Entities.Workflow;

namespace Application.Features.AI.Commands;

/// <summary>
/// F1.5-07 — apply step for typed (non-Engineering) AI drafts. Reads the
/// stored preview JSON, dispatches to a per-type materialiser, and
/// creates the project + entities atomically. Engineering continues to
/// use <see cref="ApplyProjectGenerationCommand"/>.
/// </summary>
public record ApplyTypedProjectGenerationCommand(
    Guid RequestId,
    string ProjectName) : IRequest<Result<ProjectDto>>;

public class ApplyTypedProjectGenerationCommandHandler(
    IAppDbContext db,
    ICurrentUser currentUser,
    IProjectTypeRegistry projectTypes)
    : IRequestHandler<ApplyTypedProjectGenerationCommand, Result<ProjectDto>>
{
    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web);

    public async Task<Result<ProjectDto>> Handle(
        ApplyTypedProjectGenerationCommand request, CancellationToken ct)
    {
        if (currentUser.UserId is not { } userId)
            return Result.Failure<ProjectDto>(AuthErrors.NotAuthenticated);

        var name = (request.ProjectName ?? string.Empty).Trim();
        if (name.Length is < 2 or > 120 || SlugGenerator.From(name).Length == 0)
            return Result.Failure<ProjectDto>(AIErrors.InvalidProjectName);

        var generationRequest = await db.AIGenerationRequests
            .FirstOrDefaultAsync(r => r.Id == request.RequestId, ct);
        if (generationRequest is null)
            return Result.Failure<ProjectDto>(AIErrors.RequestNotFound);
        if (generationRequest.Status != "Draft")
            return Result.Failure<ProjectDto>(AIErrors.RequestAlreadyApplied);

        if (!Enum.TryParse<ProjectType>(generationRequest.Type, ignoreCase: true, out var projectType))
            return Result.Failure<ProjectDto>(ProjectErrors.InvalidType);
        if (projectType == ProjectType.Engineering)
            return Result.Failure<ProjectDto>(AIErrors.InvalidPayload);

        AIGenerationPreviewDto? preview;
        try
        {
            preview = JsonSerializer.Deserialize<AIGenerationPreviewDto>(
                generationRequest.PreviewJson, JsonOpts);
        }
        catch (JsonException)
        {
            return Result.Failure<ProjectDto>(AIErrors.InvalidPayload);
        }
        if (preview is null) return Result.Failure<ProjectDto>(AIErrors.InvalidPayload);

        var orgSlug = await db.Organizations
            .Where(o => o.Id == generationRequest.OrganizationId)
            .Select(o => o.Slug)
            .FirstAsync(ct);

        var slug = await ResolveUniqueSlugAsync(generationRequest.OrganizationId, SlugGenerator.From(name), ct);
        var key = await ResolveUniqueKeyAsync(generationRequest.OrganizationId, ProjectKeyGenerator.From(name), ct);

        var project = new Project
        {
            OrganizationId = generationRequest.OrganizationId,
            Name = name,
            Slug = slug,
            Key = key,
            Type = projectType,
            Status = ProjectStatus.Active,
            AIControlMode = AIControlMode.Suggest,
            CreatedBy = userId,
        };
        db.Projects.Add(project);
        db.ProjectMemberships.Add(new ProjectMembership
        {
            ProjectId = project.Id,
            UserId = userId,
            Role = ProjectRole.PM,
        });

        // Default-seed (e.g. Support default queues) runs before the AI
        // draft is materialised. The AI draft is allowed to add more on top
        // of or instead of the default seed — duplicate-name handling is
        // each type's responsibility.
        await projectTypes.Get(projectType).SeedNewProjectAsync(db, project.Id, userId, ct);

        var summary = projectType switch
        {
            ProjectType.Sales => ApplySales(project.Id, userId, preview.Sales),
            ProjectType.Support => ApplySupport(project.Id, userId, preview.Support),
            ProjectType.Marketing => ApplyMarketing(project.Id, userId, preview.Marketing),
            ProjectType.Operations => ApplyOperations(project.Id, userId, preview.Operations),
            ProjectType.Generic => ApplyGeneric(project.Id, userId, preview.Generic),
            _ => "(none)",
        };

        generationRequest.Status = "Applied";
        generationRequest.AppliedAt = DateTime.UtcNow;
        generationRequest.AppliedProjectId = project.Id;

        db.AIAuditLogs.Add(new AIAuditLog
        {
            ActionType = "project.generate.typed.apply",
            UserId = userId,
            ProjectId = project.Id,
            Prompt = generationRequest.Description,
            Response = generationRequest.PreviewJson,
            AfterStateJson = JsonSerializer.Serialize(new
            {
                projectId = project.Id,
                projectType = projectType.ToString(),
                summary,
            }, JsonOpts),
            Applied = true,
            AppliedAt = DateTime.UtcNow,
            Provider = "n/a",
            Model = "n/a",
        });

        await db.SaveChangesAsync(ct);

        return Result.Success(new ProjectDto(
            project.Id, project.OrganizationId, orgSlug,
            project.Name, project.Slug, project.Key,
            project.Type.ToString(),
            project.Status.ToString(),
            project.TargetDate,
            project.AIControlMode.ToString(),
            project.CreatedBy, project.CreatedAt,
            project.IsPersonal));
    }

    // ---------- Per-type materialisers ----------

    private string ApplySales(Guid projectId, Guid userId, AISalesProjectDraft? draft)
    {
        if (draft is null) return "sales:empty";

        // Default stages have already been queued by SalesProjectTypeProvider's
        // SeedNewProjectAsync. Keep them and only add AI-suggested stages
        // whose name doesn't collide — that lets the AI extend the default
        // pipeline rather than overwrite it (mirrors Support's merge).
        var seededStages = db.DealStages.Local
            .Where(s => s.ProjectId == projectId)
            .ToList();
        var stageByName = seededStages.ToDictionary(s => s.Name, StringComparer.OrdinalIgnoreCase);
        var nextOrder = seededStages.Count == 0 ? 0 : seededStages.Max(s => s.Order) + 1;
        foreach (var s in draft.Stages.OrderBy(x => x.Order))
        {
            var name = TrimOrDefault(s.Name, $"Stage {nextOrder + 1}");
            if (stageByName.ContainsKey(name)) continue;
            var stage = new DealStage
            {
                ProjectId = projectId,
                Name = name,
                Order = nextOrder++,
                DefaultProbability = s.DefaultProbability,
            };
            db.DealStages.Add(stage);
            stageByName[name] = stage;
        }

        var accountByName = new Dictionary<string, Account>(StringComparer.OrdinalIgnoreCase);
        foreach (var a in draft.Accounts)
        {
            var acct = new Account
            {
                ProjectId = projectId,
                Name = TrimOrDefault(a.Name, "Untitled account"),
                Domain = a.Domain,
                Industry = a.Industry,
                OwnerId = userId,
            };
            db.Accounts.Add(acct);
            accountByName[acct.Name] = acct;
        }

        var fallbackStage = stageByName.Values
            .OrderBy(s => s.Order)
            .FirstOrDefault();
        foreach (var d in draft.Deals)
        {
            if (fallbackStage is null) break;
            // Deal.AccountId is required — skip if the AI named an account
            // we didn't materialise.
            if (d.AccountName is null
                || !accountByName.TryGetValue(d.AccountName, out var acct)) continue;
            var stage = (d.StageName is not null && stageByName.TryGetValue(d.StageName, out var st))
                ? st : fallbackStage;
            db.Deals.Add(new Deal
            {
                ProjectId = projectId,
                Name = TrimOrDefault(d.Name, "Untitled deal"),
                AccountId = acct.Id,
                Value = d.Value ?? 0,
                Currency = (d.Currency ?? "USD").ToUpperInvariant(),
                StageId = stage.Id,
                Probability = d.Probability ?? stage.DefaultProbability,
                ExpectedClose = d.ExpectedClose,
                OwnerId = userId,
                Status = DealStatus.Open,
            });
        }

        return $"sales:{draft.Stages.Count}s/{draft.Accounts.Count}a/{draft.Deals.Count}d";
    }

    private string ApplySupport(Guid projectId, Guid userId, AISupportProjectDraft? draft)
    {
        if (draft is null) return "support:empty";

        // Combine: keep the default seeded queues unless the AI proposed
        // one with the same name. Otherwise add the AI's queues.
        var seededQueues = db.Queues.Local
            .Where(q => q.ProjectId == projectId)
            .ToList();
        var queueByName = seededQueues.ToDictionary(q => q.Name, StringComparer.OrdinalIgnoreCase);
        var nextOrder = seededQueues.Count == 0 ? 0 : seededQueues.Max(q => q.Order) + 1;
        foreach (var q in draft.Queues)
        {
            var name = TrimOrDefault(q.Name, "Queue");
            if (queueByName.ContainsKey(name)) continue;
            var queue = new Queue
            {
                ProjectId = projectId,
                Name = name,
                Order = nextOrder++,
                SlaMinutes = q.SlaMinutes,
            };
            db.Queues.Add(queue);
            queueByName[name] = queue;
        }

        var customerByName = new Dictionary<string, Customer>(StringComparer.OrdinalIgnoreCase);
        foreach (var c in draft.Customers)
        {
            var cust = new Customer
            {
                ProjectId = projectId,
                Name = TrimOrDefault(c.Name, "Customer"),
                Email = c.Email,
                Company = c.Company,
                Tier = c.Tier,
            };
            db.Customers.Add(cust);
            customerByName[cust.Name] = cust;
        }

        var fallbackQueue = queueByName.Values
            .OrderBy(q => q.Order)
            .FirstOrDefault();
        var now = DateTime.UtcNow;
        foreach (var t in draft.Tickets)
        {
            if (fallbackQueue is null) break;
            // Tickets require a customer; skip if the AI named one we
            // didn't materialise.
            if (t.CustomerName is null
                || !customerByName.TryGetValue(t.CustomerName, out var cust)) continue;
            var queue = (t.QueueName is not null && queueByName.TryGetValue(t.QueueName, out var q))
                ? q : fallbackQueue;
            db.Tickets.Add(new Ticket
            {
                ProjectId = projectId,
                CustomerId = cust.Id,
                QueueId = queue.Id,
                Subject = TrimOrDefault(t.Subject, "(no subject)"),
                BodyMd = t.BodyMd,
                Status = TicketStatus.New,
                Priority = ParsePriority(t.Priority),
                AssigneeId = null,
                OpenedAt = now,
                SlaDueAt = now.AddMinutes(queue.SlaMinutes),
            });
        }

        return $"support:{draft.Queues.Count}q/{draft.Customers.Count}c/{draft.Tickets.Count}t";
    }

    private string ApplyMarketing(Guid projectId, Guid userId, AIMarketingProjectDraft? draft)
    {
        if (draft is null) return "marketing:empty";
        var assetCount = 0;
        var taskCount = 0;
        foreach (var c in draft.Campaigns)
        {
            var campaign = new Campaign
            {
                ProjectId = projectId,
                Name = TrimOrDefault(c.Name, "Campaign"),
                Channel = Enum.TryParse<MarketingChannel>(c.Channel, ignoreCase: true, out var ch)
                    ? ch : MarketingChannel.Other,
                GoalMd = c.GoalMd,
                StartDate = c.StartDate,
                EndDate = c.EndDate,
                Status = CampaignStatus.Planning,
                OwnerId = userId,
            };
            db.Campaigns.Add(campaign);

            var assetByTitle = new Dictionary<string, Asset>(StringComparer.OrdinalIgnoreCase);
            foreach (var a in c.Assets)
            {
                var asset = new Asset
                {
                    CampaignId = campaign.Id,
                    Title = TrimOrDefault(a.Title, "Asset"),
                    Type = Enum.TryParse<AssetType>(a.Type, ignoreCase: true, out var at)
                        ? at : AssetType.Other,
                    PublishDate = a.PublishDate,
                    Status = AssetStatus.Draft,
                };
                db.Assets.Add(asset);
                assetByTitle[asset.Title] = asset;
                assetCount++;
            }

            foreach (var t in c.Tasks)
            {
                Guid? assetId = null;
                if (t.AssetTitle is not null && assetByTitle.TryGetValue(t.AssetTitle, out var a))
                    assetId = a.Id;
                db.MarketingTasks.Add(new MarketingTask
                {
                    CampaignId = campaign.Id,
                    AssetId = assetId,
                    Title = TrimOrDefault(t.Title, "Task"),
                    DueDate = t.DueDate,
                    Status = MarketingTaskStatus.ToDo,
                });
                taskCount++;
            }
        }
        return $"marketing:{draft.Campaigns.Count}c/{assetCount}a/{taskCount}t";
    }

    private string ApplyOperations(Guid projectId, Guid userId, AIOperationsProjectDraft? draft)
    {
        if (draft is null) return "operations:empty";
        foreach (var w in draft.Workflows)
        {
            var templateItems = w.Checklist
                .Select((i, idx) => new ChecklistTemplateItemDto(
                    TrimOrDefault(i.Title, $"Step {idx + 1}"), idx + 1, i.Sequential))
                .ToList();

            var rule = w.RecurrenceRule;
            if (!string.IsNullOrWhiteSpace(rule) && !RecurrenceRuleHelper.TryParse(rule, out _))
                rule = null; // discard junk so the workflow still saves

            db.Workflows.Add(new WorkflowEntity
            {
                ProjectId = projectId,
                Name = TrimOrDefault(w.Name, "Workflow"),
                Description = w.Description,
                RecurrenceRule = rule,
                OwnerId = userId,
                TemplateJson = RunMaterializer.SerializeTemplate(templateItems),
            });
        }
        return $"operations:{draft.Workflows.Count}w";
    }

    private string ApplyGeneric(Guid projectId, Guid userId, AIGenericProjectDraft? draft)
    {
        if (draft is null) return "generic:empty";
        var order = 1;
        var keyNum = 0;
        var priorityOrder = 0;
        var taskCount = 0;
        foreach (var l in draft.Lists)
        {
            var list = new TaskList
            {
                ProjectId = projectId,
                Name = TrimOrDefault(l.Name, $"List {order}"),
                Order = order++,
            };
            db.TaskLists.Add(list);

            foreach (var t in l.Tasks)
            {
                db.Tasks.Add(new Domain.Entities.Task
                {
                    ProjectId = projectId,
                    KeyNum = ++keyNum,
                    TaskListId = list.Id,
                    Title = TrimOrDefault(t.Title, "Task"),
                    Description = t.Description,
                    Priority = ParsePriority(t.Priority),
                    Status = Domain.Enums.TaskStatus.Backlog,
                    PriorityOrder = ++priorityOrder,
                    ReporterId = userId,
                    CreatedByAi = true,
                });
                taskCount++;
            }
        }
        return $"generic:{draft.Lists.Count}l/{taskCount}t";
    }

    // ---------- helpers ----------

    private static string TrimOrDefault(string? s, string fallback)
    {
        var t = s?.Trim();
        return string.IsNullOrEmpty(t) ? fallback : t;
    }

    private static Priority ParsePriority(string? raw)
        => Enum.TryParse<Priority>(raw, ignoreCase: true, out var p) ? p : Priority.Medium;

    private async Task<string> ResolveUniqueSlugAsync(Guid orgId, string baseSlug, CancellationToken ct)
    {
        if (string.IsNullOrEmpty(baseSlug)) baseSlug = "project";
        var slug = baseSlug;
        var suffix = 2;
        while (await db.Projects.AnyAsync(p => p.OrganizationId == orgId && p.Slug == slug, ct))
        {
            slug = $"{baseSlug}-{suffix++}";
            if (suffix > 1000)
                slug = $"{baseSlug}-{Guid.NewGuid():N}".Substring(0, Math.Min(baseSlug.Length + 9, 60));
        }
        return slug;
    }

    private async Task<string> ResolveUniqueKeyAsync(Guid orgId, string baseKey, CancellationToken ct)
    {
        var key = baseKey;
        var suffix = 1;
        while (await db.Projects.AnyAsync(p => p.OrganizationId == orgId && p.Key == key, ct))
        {
            suffix++;
            key = ProjectKeyGenerator.WithSuffix(baseKey, suffix);
            if (suffix > 999)
                key = baseKey + Guid.NewGuid().ToString("N").Substring(0, 4).ToUpperInvariant();
        }
        return key;
    }
}
