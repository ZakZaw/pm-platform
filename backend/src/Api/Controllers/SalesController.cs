using Api.Authorization;
using Application.Common;
using Application.Features.Sales;
using Application.Features.Sales.Commands;
using Application.Features.Sales.Queries;
using Domain.Enums;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Api.Controllers;

[ApiController]
[Authorize]
public class SalesController(ISender mediator) : ControllerBase
{
    // ---------- Pipeline / stages ----------

    [HttpGet("api/v1/projects/{projectId:guid}/pipeline")]
    [RequireProjectRole(ProjectRole.Viewer)]
    public async Task<ActionResult<PipelineDto>> GetPipeline(Guid projectId, CancellationToken ct)
    {
        var result = await mediator.Send(new GetPipelineQuery(projectId), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpGet("api/v1/projects/{projectId:guid}/deal-stages")]
    [RequireProjectRole(ProjectRole.Viewer)]
    public async Task<ActionResult<IReadOnlyList<DealStageDto>>> ListStages(
        Guid projectId, CancellationToken ct)
    {
        var result = await mediator.Send(new ListDealStagesQuery(projectId), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpPost("api/v1/projects/{projectId:guid}/deal-stages")]
    [RequireProjectRole(ProjectRole.TeamLead)]
    public async Task<ActionResult<DealStageDto>> CreateStage(
        Guid projectId, [FromBody] CreateStageBodyDto body, CancellationToken ct)
    {
        var result = await mediator.Send(new CreateDealStageCommand(
            projectId, body.Name ?? string.Empty,
            body.DefaultProbability, body.IsTerminalWon, body.IsTerminalLost), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpPatch("api/v1/deal-stages/{stageId:guid}")]
    public async Task<ActionResult<DealStageDto>> UpdateStage(
        Guid stageId, [FromBody] UpdateStageBodyDto body, CancellationToken ct)
    {
        var result = await mediator.Send(new UpdateDealStageCommand(
            stageId, body.Name, body.DefaultProbability,
            body.IsTerminalWon, body.IsTerminalLost), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpPost("api/v1/projects/{projectId:guid}/deal-stages/reorder")]
    [RequireProjectRole(ProjectRole.TeamLead)]
    public async Task<IActionResult> ReorderStages(
        Guid projectId, [FromBody] ReorderStagesBodyDto body, CancellationToken ct)
    {
        var result = await mediator.Send(new ReorderDealStagesCommand(
            projectId, body.OrderedIds ?? []), ct);
        return result.IsSuccess ? NoContent() : ToProblem(result.Error!);
    }

    [HttpDelete("api/v1/deal-stages/{stageId:guid}")]
    public async Task<IActionResult> DeleteStage(Guid stageId, CancellationToken ct)
    {
        var result = await mediator.Send(new DeleteDealStageCommand(stageId), ct);
        return result.IsSuccess ? NoContent() : ToProblem(result.Error!);
    }

    // ---------- Accounts ----------

    [HttpGet("api/v1/projects/{projectId:guid}/accounts")]
    [RequireProjectRole(ProjectRole.Viewer)]
    public async Task<ActionResult<IReadOnlyList<AccountDto>>> ListAccounts(
        Guid projectId,
        [FromQuery] bool includeArchived = false,
        CancellationToken ct = default)
    {
        var result = await mediator.Send(new ListAccountsQuery(projectId, includeArchived), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpGet("api/v1/accounts/{accountId:guid}")]
    public async Task<ActionResult<AccountDto>> GetAccount(Guid accountId, CancellationToken ct)
    {
        var result = await mediator.Send(new GetAccountQuery(accountId), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpPost("api/v1/projects/{projectId:guid}/accounts")]
    [RequireProjectRole(ProjectRole.Contributor)]
    public async Task<ActionResult<AccountDto>> CreateAccount(
        Guid projectId, [FromBody] CreateAccountBodyDto body, CancellationToken ct)
    {
        var result = await mediator.Send(new CreateAccountCommand(
            projectId, body.Name ?? string.Empty,
            body.Domain, body.Industry, body.OwnerId, body.Notes), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpPatch("api/v1/accounts/{accountId:guid}")]
    public async Task<ActionResult<AccountDto>> UpdateAccount(
        Guid accountId, [FromBody] UpdateAccountBodyDto body, CancellationToken ct)
    {
        var result = await mediator.Send(new UpdateAccountCommand(
            accountId, body.Name, body.Domain, body.Industry,
            body.OwnerId, body.Notes, body.Archive), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    // ---------- Deals ----------

    [HttpGet("api/v1/deals/{dealId:guid}")]
    public async Task<ActionResult<DealDto>> GetDeal(Guid dealId, CancellationToken ct)
    {
        var result = await mediator.Send(new GetDealQuery(dealId), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpPost("api/v1/projects/{projectId:guid}/deals")]
    [RequireProjectRole(ProjectRole.Contributor)]
    public async Task<ActionResult<DealDto>> CreateDeal(
        Guid projectId, [FromBody] CreateDealBodyDto body, CancellationToken ct)
    {
        var result = await mediator.Send(new CreateDealCommand(
            projectId, body.AccountId, body.Name ?? string.Empty,
            body.Value, body.Currency, body.StageId, body.Probability,
            body.ExpectedClose, body.OwnerId), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpPatch("api/v1/deals/{dealId:guid}")]
    public async Task<ActionResult<DealDto>> UpdateDeal(
        Guid dealId, [FromBody] UpdateDealBodyDto body, CancellationToken ct)
    {
        var result = await mediator.Send(new UpdateDealCommand(
            dealId, body.Name, body.Value, body.Currency, body.Probability,
            body.ExpectedClose, body.OwnerId, body.WonNote), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpPost("api/v1/deals/{dealId:guid}/change-stage")]
    public async Task<ActionResult<DealDto>> ChangeDealStage(
        Guid dealId, [FromBody] ChangeStageBodyDto body, CancellationToken ct)
    {
        var result = await mediator.Send(new ChangeDealStageCommand(
            dealId, body.ToStageId, body.Reason), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    // ---------- Activities ----------

    [HttpGet("api/v1/deals/{dealId:guid}/activities")]
    public async Task<ActionResult<IReadOnlyList<ActivityDto>>> ListActivities(
        Guid dealId, CancellationToken ct)
    {
        var result = await mediator.Send(new ListDealActivitiesQuery(dealId), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpPost("api/v1/deals/{dealId:guid}/activities")]
    public async Task<ActionResult<ActivityDto>> CreateActivity(
        Guid dealId, [FromBody] CreateActivityBodyDto body, CancellationToken ct)
    {
        var result = await mediator.Send(new CreateActivityCommand(
            dealId, body.Type ?? "Note", body.Summary ?? string.Empty, body.OccurredAt), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    // ---------- Leads ----------

    [HttpGet("api/v1/projects/{projectId:guid}/leads")]
    [RequireProjectRole(ProjectRole.Viewer)]
    public async Task<ActionResult<IReadOnlyList<LeadDto>>> ListLeads(
        Guid projectId, [FromQuery] string? status, CancellationToken ct)
    {
        var result = await mediator.Send(new ListLeadsQuery(projectId, status), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpPost("api/v1/projects/{projectId:guid}/leads")]
    [RequireProjectRole(ProjectRole.Contributor)]
    public async Task<ActionResult<LeadDto>> CreateLead(
        Guid projectId, [FromBody] CreateLeadBodyDto body, CancellationToken ct)
    {
        var result = await mediator.Send(new CreateLeadCommand(
            projectId, body.Name ?? string.Empty,
            body.Email, body.Phone, body.Source,
            body.AccountId, body.OwnerId), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpPatch("api/v1/leads/{leadId:guid}")]
    public async Task<ActionResult<LeadDto>> UpdateLead(
        Guid leadId, [FromBody] UpdateLeadBodyDto body, CancellationToken ct)
    {
        var result = await mediator.Send(new UpdateLeadCommand(
            leadId, body.Name, body.Email, body.Phone, body.Source,
            body.Status, body.AccountId, body.OwnerId), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpPost("api/v1/leads/{leadId:guid}/convert")]
    public async Task<ActionResult<DealDto>> ConvertLead(
        Guid leadId, [FromBody] ConvertLeadBodyDto body, CancellationToken ct)
    {
        var result = await mediator.Send(new ConvertLeadCommand(
            leadId, body.AccountName, body.DealName ?? string.Empty,
            body.Value, body.Currency, body.StageId), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    private ObjectResult ToProblem(Error error)
    {
        var status = error.Code switch
        {
            "Auth.NotAuthenticated" => StatusCodes.Status401Unauthorized,
            "Project.NotFound" => StatusCodes.Status404NotFound,
            "Project.NotAMember" => StatusCodes.Status403Forbidden,
            "Project.InsufficientRole" => StatusCodes.Status403Forbidden,
            "Sales.AccountNotFound" => StatusCodes.Status404NotFound,
            "Sales.DealNotFound" => StatusCodes.Status404NotFound,
            "Sales.StageNotFound" => StatusCodes.Status404NotFound,
            "Sales.LeadNotFound" => StatusCodes.Status404NotFound,
            "Sales.ActivityNotFound" => StatusCodes.Status404NotFound,
            "Sales.AccountNotInProject" => StatusCodes.Status422UnprocessableEntity,
            "Sales.StageNotInProject" => StatusCodes.Status422UnprocessableEntity,
            "Sales.LostReasonRequired" => StatusCodes.Status422UnprocessableEntity,
            "Sales.CannotDeleteStageWithDeals" => StatusCodes.Status409Conflict,
            "Sales.LeadAlreadyConverted" => StatusCodes.Status409Conflict,
            "Sales.InvalidAccountName" => StatusCodes.Status422UnprocessableEntity,
            "Sales.InvalidDealName" => StatusCodes.Status422UnprocessableEntity,
            "Sales.InvalidDealValue" => StatusCodes.Status422UnprocessableEntity,
            "Sales.InvalidProbability" => StatusCodes.Status422UnprocessableEntity,
            "Sales.InvalidCurrency" => StatusCodes.Status422UnprocessableEntity,
            "Sales.InvalidStageName" => StatusCodes.Status422UnprocessableEntity,
            "Sales.InvalidLeadName" => StatusCodes.Status422UnprocessableEntity,
            "Sales.InvalidActivityType" => StatusCodes.Status422UnprocessableEntity,
            "Sales.InvalidActivitySummary" => StatusCodes.Status422UnprocessableEntity,
            _ => StatusCodes.Status400BadRequest,
        };
        return Problem(title: error.Code, detail: error.Message, statusCode: status);
    }
}

public record CreateStageBodyDto(string? Name, int? DefaultProbability, bool IsTerminalWon, bool IsTerminalLost);
public record UpdateStageBodyDto(string? Name, int? DefaultProbability, bool? IsTerminalWon, bool? IsTerminalLost);
public record ReorderStagesBodyDto(IReadOnlyList<Guid>? OrderedIds);

public record CreateAccountBodyDto(string? Name, string? Domain, string? Industry, Guid? OwnerId, string? Notes);
public record UpdateAccountBodyDto(string? Name, string? Domain, string? Industry, Guid? OwnerId, string? Notes, bool? Archive);

public record CreateDealBodyDto(
    Guid AccountId, string? Name, decimal Value, string? Currency,
    Guid? StageId, int? Probability, DateTime? ExpectedClose, Guid? OwnerId);

public record UpdateDealBodyDto(
    string? Name, decimal? Value, string? Currency, int? Probability,
    DateTime? ExpectedClose, Guid? OwnerId, string? WonNote);

public record ChangeStageBodyDto(Guid ToStageId, string? Reason);

public record CreateActivityBodyDto(string? Type, string? Summary, DateTime? OccurredAt);

public record CreateLeadBodyDto(
    string? Name, string? Email, string? Phone, string? Source,
    Guid? AccountId, Guid? OwnerId);

public record UpdateLeadBodyDto(
    string? Name, string? Email, string? Phone, string? Source,
    string? Status, Guid? AccountId, Guid? OwnerId);

public record ConvertLeadBodyDto(
    string? AccountName, string? DealName, decimal Value,
    string? Currency, Guid? StageId);
