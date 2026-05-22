using Api.Authorization;
using Application.Common;
using Application.Features.Marketing;
using Application.Features.Marketing.Commands;
using Application.Features.Marketing.Queries;
using Domain.Enums;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Api.Controllers;

[ApiController]
[Authorize]
public class MarketingController(ISender mediator) : ControllerBase
{
    // ---------- Campaigns ----------

    [HttpGet("api/v1/projects/{projectId:guid}/campaigns")]
    [RequireProjectRole(ProjectRole.Viewer)]
    public async Task<ActionResult<IReadOnlyList<CampaignDto>>> ListCampaigns(
        Guid projectId,
        [FromQuery] bool includeArchived = false,
        CancellationToken ct = default)
    {
        var result = await mediator.Send(new ListCampaignsQuery(projectId, includeArchived), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpGet("api/v1/campaigns/{campaignId:guid}")]
    public async Task<ActionResult<CampaignDetailDto>> GetCampaign(
        Guid campaignId, CancellationToken ct)
    {
        var result = await mediator.Send(new GetCampaignQuery(campaignId), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpPost("api/v1/projects/{projectId:guid}/campaigns")]
    [RequireProjectRole(ProjectRole.Contributor)]
    public async Task<ActionResult<CampaignDto>> CreateCampaign(
        Guid projectId, [FromBody] CreateCampaignBodyDto body, CancellationToken ct)
    {
        var result = await mediator.Send(new CreateCampaignCommand(
            projectId, body.Name ?? string.Empty, body.Channel,
            body.StartDate, body.EndDate, body.GoalMd,
            body.BudgetAmount, body.BudgetCurrency, body.OwnerId), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpPatch("api/v1/campaigns/{campaignId:guid}")]
    public async Task<ActionResult<CampaignDto>> UpdateCampaign(
        Guid campaignId, [FromBody] UpdateCampaignBodyDto body, CancellationToken ct)
    {
        var result = await mediator.Send(new UpdateCampaignCommand(
            campaignId, body.Name, body.Channel,
            body.StartDate, body.ClearStartDate,
            body.EndDate, body.ClearEndDate,
            body.Status, body.GoalMd,
            body.BudgetAmount, body.ClearBudgetAmount,
            body.BudgetCurrency, body.ClearBudgetCurrency,
            body.OwnerId, body.ClearOwner,
            body.Archive), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpDelete("api/v1/campaigns/{campaignId:guid}")]
    public async Task<IActionResult> DeleteCampaign(Guid campaignId, CancellationToken ct)
    {
        var result = await mediator.Send(new DeleteCampaignCommand(campaignId), ct);
        return result.IsSuccess ? NoContent() : ToProblem(result.Error!);
    }

    // ---------- Content calendar ----------

    [HttpGet("api/v1/projects/{projectId:guid}/content-calendar")]
    [RequireProjectRole(ProjectRole.Viewer)]
    public async Task<ActionResult<ContentCalendarDto>> GetCalendar(
        Guid projectId,
        [FromQuery] DateTime from,
        [FromQuery] DateTime to,
        CancellationToken ct)
    {
        var result = await mediator.Send(new GetContentCalendarQuery(projectId, from, to), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    // ---------- Assets ----------

    [HttpGet("api/v1/assets/{assetId:guid}")]
    public async Task<ActionResult<AssetDto>> GetAsset(Guid assetId, CancellationToken ct)
    {
        var result = await mediator.Send(new GetAssetQuery(assetId), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpPost("api/v1/campaigns/{campaignId:guid}/assets")]
    public async Task<ActionResult<AssetDto>> CreateAsset(
        Guid campaignId, [FromBody] CreateAssetBodyDto body, CancellationToken ct)
    {
        var result = await mediator.Send(new CreateAssetCommand(
            campaignId, body.Type, body.Title ?? string.Empty,
            body.PublishDate, body.OwnerId, body.FileUrl, body.BodyMd), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpPatch("api/v1/assets/{assetId:guid}")]
    public async Task<ActionResult<AssetDto>> UpdateAsset(
        Guid assetId, [FromBody] UpdateAssetBodyDto body, CancellationToken ct)
    {
        var result = await mediator.Send(new UpdateAssetCommand(
            assetId, body.Type, body.Title,
            body.PublishDate, body.ClearPublishDate,
            body.OwnerId, body.ClearOwner,
            body.FileUrl, body.ClearFileUrl,
            body.BodyMd), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpPost("api/v1/assets/{assetId:guid}/status")]
    public async Task<ActionResult<AssetDto>> ChangeAssetStatus(
        Guid assetId, [FromBody] ChangeAssetStatusBodyDto body, CancellationToken ct)
    {
        var result = await mediator.Send(new ChangeAssetStatusCommand(
            assetId, body.To ?? string.Empty, body.Reason), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpPost("api/v1/assets/{assetId:guid}/reschedule")]
    public async Task<ActionResult<AssetDto>> RescheduleAsset(
        Guid assetId, [FromBody] RescheduleAssetBodyDto body, CancellationToken ct)
    {
        var result = await mediator.Send(new RescheduleAssetCommand(assetId, body.PublishDate), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpDelete("api/v1/assets/{assetId:guid}")]
    public async Task<IActionResult> DeleteAsset(Guid assetId, CancellationToken ct)
    {
        var result = await mediator.Send(new DeleteAssetCommand(assetId), ct);
        return result.IsSuccess ? NoContent() : ToProblem(result.Error!);
    }

    // ---------- Marketing tasks ----------

    [HttpPost("api/v1/campaigns/{campaignId:guid}/tasks")]
    public async Task<ActionResult<MarketingTaskDto>> CreateTask(
        Guid campaignId, [FromBody] CreateMarketingTaskBodyDto body, CancellationToken ct)
    {
        var result = await mediator.Send(new CreateMarketingTaskCommand(
            campaignId, body.AssetId, body.Title ?? string.Empty,
            body.AssigneeId, body.DueDate), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpPatch("api/v1/marketing-tasks/{taskId:guid}")]
    public async Task<ActionResult<MarketingTaskDto>> UpdateTask(
        Guid taskId, [FromBody] UpdateMarketingTaskBodyDto body, CancellationToken ct)
    {
        var result = await mediator.Send(new UpdateMarketingTaskCommand(
            taskId, body.Title, body.Status,
            body.AssetId, body.ClearAsset,
            body.AssigneeId, body.ClearAssignee,
            body.DueDate, body.ClearDueDate), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpDelete("api/v1/marketing-tasks/{taskId:guid}")]
    public async Task<IActionResult> DeleteTask(Guid taskId, CancellationToken ct)
    {
        var result = await mediator.Send(new DeleteMarketingTaskCommand(taskId), ct);
        return result.IsSuccess ? NoContent() : ToProblem(result.Error!);
    }

    private ObjectResult ToProblem(Error error)
    {
        var status = error.Code switch
        {
            "Auth.NotAuthenticated" => StatusCodes.Status401Unauthorized,
            "Project.NotFound" => StatusCodes.Status404NotFound,
            "Project.NotAMember" => StatusCodes.Status403Forbidden,
            "Project.InsufficientRole" => StatusCodes.Status403Forbidden,
            "Marketing.CampaignNotFound" => StatusCodes.Status404NotFound,
            "Marketing.AssetNotFound" => StatusCodes.Status404NotFound,
            "Marketing.TaskNotFound" => StatusCodes.Status404NotFound,
            "Marketing.CampaignNotInProject" => StatusCodes.Status422UnprocessableEntity,
            "Marketing.AssetNotInCampaign" => StatusCodes.Status422UnprocessableEntity,
            "Marketing.InvalidAssetTransition" => StatusCodes.Status422UnprocessableEntity,
            "Marketing.RejectionReasonRequired" => StatusCodes.Status422UnprocessableEntity,
            "Marketing.InvalidCampaignName" => StatusCodes.Status422UnprocessableEntity,
            "Marketing.InvalidChannel" => StatusCodes.Status422UnprocessableEntity,
            "Marketing.InvalidCampaignStatus" => StatusCodes.Status422UnprocessableEntity,
            "Marketing.InvalidBudget" => StatusCodes.Status422UnprocessableEntity,
            "Marketing.InvalidCurrency" => StatusCodes.Status422UnprocessableEntity,
            "Marketing.InvalidDateRange" => StatusCodes.Status422UnprocessableEntity,
            "Marketing.InvalidAssetTitle" => StatusCodes.Status422UnprocessableEntity,
            "Marketing.InvalidAssetType" => StatusCodes.Status422UnprocessableEntity,
            "Marketing.InvalidAssetStatus" => StatusCodes.Status422UnprocessableEntity,
            "Marketing.InvalidTaskTitle" => StatusCodes.Status422UnprocessableEntity,
            "Marketing.InvalidTaskStatus" => StatusCodes.Status422UnprocessableEntity,
            _ => StatusCodes.Status400BadRequest,
        };
        return Problem(title: error.Code, detail: error.Message, statusCode: status);
    }
}

public record CreateCampaignBodyDto(
    string? Name, string? Channel,
    DateTime? StartDate, DateTime? EndDate,
    string? GoalMd, decimal? BudgetAmount, string? BudgetCurrency, Guid? OwnerId);

public record UpdateCampaignBodyDto(
    string? Name, string? Channel,
    DateTime? StartDate, bool ClearStartDate,
    DateTime? EndDate, bool ClearEndDate,
    string? Status, string? GoalMd,
    decimal? BudgetAmount, bool ClearBudgetAmount,
    string? BudgetCurrency, bool ClearBudgetCurrency,
    Guid? OwnerId, bool ClearOwner,
    bool? Archive);

public record CreateAssetBodyDto(
    string? Type, string? Title,
    DateTime? PublishDate, Guid? OwnerId,
    string? FileUrl, string? BodyMd);

public record UpdateAssetBodyDto(
    string? Type, string? Title,
    DateTime? PublishDate, bool ClearPublishDate,
    Guid? OwnerId, bool ClearOwner,
    string? FileUrl, bool ClearFileUrl,
    string? BodyMd);

public record ChangeAssetStatusBodyDto(string? To, string? Reason);
public record RescheduleAssetBodyDto(DateTime? PublishDate);

public record CreateMarketingTaskBodyDto(
    Guid? AssetId, string? Title, Guid? AssigneeId, DateTime? DueDate);

public record UpdateMarketingTaskBodyDto(
    string? Title, string? Status,
    Guid? AssetId, bool ClearAsset,
    Guid? AssigneeId, bool ClearAssignee,
    DateTime? DueDate, bool ClearDueDate);
