using Application.Common;
using Application.Interfaces;
using Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Marketing.Commands;

public record UpdateMarketingTaskCommand(
    Guid TaskId,
    string? Title,
    string? Status,
    Guid? AssetId,
    bool ClearAsset,
    Guid? AssigneeId,
    bool ClearAssignee,
    DateTime? DueDate,
    bool ClearDueDate) : IRequest<Result<MarketingTaskDto>>;

public class UpdateMarketingTaskCommandHandler(IAppDbContext db)
    : IRequestHandler<UpdateMarketingTaskCommand, Result<MarketingTaskDto>>
{
    public async Task<Result<MarketingTaskDto>> Handle(UpdateMarketingTaskCommand request, CancellationToken ct)
    {
        var task = await db.MarketingTasks.FirstOrDefaultAsync(t => t.Id == request.TaskId, ct);
        if (task is null) return Result.Failure<MarketingTaskDto>(MarketingErrors.MarketingTaskNotFound);

        if (request.Title is not null)
        {
            var t = request.Title.Trim();
            if (t.Length is < 1 or > 200)
                return Result.Failure<MarketingTaskDto>(MarketingErrors.InvalidTaskTitle);
            task.Title = t;
        }
        if (request.Status is not null)
        {
            if (!Enum.TryParse<MarketingTaskStatus>(request.Status, ignoreCase: true, out var st))
                return Result.Failure<MarketingTaskDto>(MarketingErrors.InvalidTaskStatus);
            task.Status = st;
        }

        if (request.ClearAsset) task.AssetId = null;
        else if (request.AssetId.HasValue)
        {
            var asset = await db.Assets
                .Where(a => a.Id == request.AssetId.Value)
                .Select(a => new { a.CampaignId })
                .FirstOrDefaultAsync(ct);
            if (asset is null) return Result.Failure<MarketingTaskDto>(MarketingErrors.AssetNotFound);
            if (asset.CampaignId != task.CampaignId)
                return Result.Failure<MarketingTaskDto>(MarketingErrors.AssetNotInCampaign);
            task.AssetId = request.AssetId;
        }

        if (request.ClearAssignee) task.AssigneeId = null;
        else if (request.AssigneeId.HasValue) task.AssigneeId = request.AssigneeId;

        if (request.ClearDueDate) task.DueDate = null;
        else if (request.DueDate.HasValue) task.DueDate = request.DueDate;

        await db.SaveChangesAsync(ct);

        var campaign = await db.Campaigns.Where(c => c.Id == task.CampaignId)
            .Select(c => c.Name).FirstAsync(ct);
        string? assetTitle = null;
        if (task.AssetId is { } aid)
        {
            assetTitle = await db.Assets.Where(a => a.Id == aid)
                .Select(a => (string?)a.Title).FirstOrDefaultAsync(ct);
        }

        return Result.Success(new MarketingTaskDto(
            task.Id, task.CampaignId, campaign, task.AssetId, assetTitle,
            task.Title, task.Status.ToString(), task.AssigneeId, task.DueDate, task.CreatedAt));
    }
}
