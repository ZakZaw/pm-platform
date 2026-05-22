using Api.Authorization;
using Application.Common;
using Application.Features.Support;
using Application.Features.Support.Commands;
using Application.Features.Support.Queries;
using Domain.Enums;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Api.Controllers;

[ApiController]
[Authorize]
public class SupportController(ISender mediator) : ControllerBase
{
    // ---------- Queue view + queues ----------

    [HttpGet("api/v1/projects/{projectId:guid}/queue-view")]
    [RequireProjectRole(ProjectRole.Viewer)]
    public async Task<ActionResult<QueueViewResponseDto>> GetQueueView(
        Guid projectId, CancellationToken ct)
    {
        var result = await mediator.Send(new GetQueueViewQuery(projectId), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpGet("api/v1/projects/{projectId:guid}/queues")]
    [RequireProjectRole(ProjectRole.Viewer)]
    public async Task<ActionResult<IReadOnlyList<QueueDto>>> ListQueues(
        Guid projectId, CancellationToken ct)
    {
        var result = await mediator.Send(new ListQueuesQuery(projectId), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpPost("api/v1/projects/{projectId:guid}/queues")]
    [RequireProjectRole(ProjectRole.TeamLead)]
    public async Task<ActionResult<QueueDto>> CreateQueue(
        Guid projectId, [FromBody] CreateQueueBodyDto body, CancellationToken ct)
    {
        var result = await mediator.Send(new CreateQueueCommand(
            projectId, body.Name ?? string.Empty, body.SlaMinutes, body.DefaultAssigneeId), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpPatch("api/v1/queues/{queueId:guid}")]
    public async Task<ActionResult<QueueDto>> UpdateQueue(
        Guid queueId, [FromBody] UpdateQueueBodyDto body, CancellationToken ct)
    {
        var result = await mediator.Send(new UpdateQueueCommand(
            queueId, body.Name, body.SlaMinutes, body.DefaultAssigneeId), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpDelete("api/v1/queues/{queueId:guid}")]
    public async Task<IActionResult> DeleteQueue(Guid queueId, CancellationToken ct)
    {
        var result = await mediator.Send(new DeleteQueueCommand(queueId), ct);
        return result.IsSuccess ? NoContent() : ToProblem(result.Error!);
    }

    // ---------- Customers ----------

    [HttpGet("api/v1/projects/{projectId:guid}/customers")]
    [RequireProjectRole(ProjectRole.Viewer)]
    public async Task<ActionResult<IReadOnlyList<CustomerDto>>> ListCustomers(
        Guid projectId, [FromQuery] string? search, CancellationToken ct)
    {
        var result = await mediator.Send(new ListCustomersQuery(projectId, search), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpGet("api/v1/customers/{customerId:guid}")]
    public async Task<ActionResult<CustomerDto>> GetCustomer(Guid customerId, CancellationToken ct)
    {
        var result = await mediator.Send(new GetCustomerQuery(customerId), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpPost("api/v1/projects/{projectId:guid}/customers")]
    [RequireProjectRole(ProjectRole.Contributor)]
    public async Task<ActionResult<CustomerDto>> CreateCustomer(
        Guid projectId, [FromBody] CreateCustomerBodyDto body, CancellationToken ct)
    {
        var result = await mediator.Send(new CreateCustomerCommand(
            projectId, body.Name ?? string.Empty,
            body.Email, body.Company, body.Tier), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpPatch("api/v1/customers/{customerId:guid}")]
    public async Task<ActionResult<CustomerDto>> UpdateCustomer(
        Guid customerId, [FromBody] UpdateCustomerBodyDto body, CancellationToken ct)
    {
        var result = await mediator.Send(new UpdateCustomerCommand(
            customerId, body.Name, body.Email, body.Company, body.Tier), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    // ---------- Tickets ----------

    [HttpGet("api/v1/tickets/{ticketId:guid}")]
    public async Task<ActionResult<TicketDetailDto>> GetTicket(
        Guid ticketId,
        [FromQuery] bool includeInternal = true,
        CancellationToken ct = default)
    {
        var result = await mediator.Send(new GetTicketQuery(ticketId, includeInternal), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpPost("api/v1/projects/{projectId:guid}/tickets")]
    [RequireProjectRole(ProjectRole.Contributor)]
    public async Task<ActionResult<TicketDto>> CreateTicket(
        Guid projectId, [FromBody] CreateTicketBodyDto body, CancellationToken ct)
    {
        var result = await mediator.Send(new CreateTicketCommand(
            projectId, body.CustomerId, body.QueueId,
            body.Subject ?? string.Empty, body.BodyMd,
            body.Priority, body.AssigneeId), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpPatch("api/v1/tickets/{ticketId:guid}")]
    public async Task<ActionResult<TicketDto>> UpdateTicket(
        Guid ticketId, [FromBody] UpdateTicketBodyDto body, CancellationToken ct)
    {
        var result = await mediator.Send(new UpdateTicketCommand(
            ticketId, body.Subject, body.BodyMd, body.Priority,
            body.AssigneeId, body.QueueId), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpPost("api/v1/tickets/{ticketId:guid}/status")]
    public async Task<ActionResult<TicketDto>> ChangeStatus(
        Guid ticketId, [FromBody] ChangeStatusBodyDto body, CancellationToken ct)
    {
        var result = await mediator.Send(new ChangeTicketStatusCommand(
            ticketId, body.To ?? string.Empty), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    // ---------- Replies ----------

    [HttpPost("api/v1/tickets/{ticketId:guid}/replies")]
    public async Task<ActionResult<TicketReplyDto>> AddReply(
        Guid ticketId, [FromBody] AddReplyBodyDto body, CancellationToken ct)
    {
        var result = await mediator.Send(new AddTicketReplyCommand(
            ticketId, body.BodyMd ?? string.Empty, body.IsInternal), ct);
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
            "Support.CustomerNotFound" => StatusCodes.Status404NotFound,
            "Support.QueueNotFound" => StatusCodes.Status404NotFound,
            "Support.TicketNotFound" => StatusCodes.Status404NotFound,
            "Support.ReplyNotFound" => StatusCodes.Status404NotFound,
            "Support.QueueNotInProject" => StatusCodes.Status422UnprocessableEntity,
            "Support.CustomerNotInProject" => StatusCodes.Status422UnprocessableEntity,
            "Support.CannotDeleteQueueWithTickets" => StatusCodes.Status409Conflict,
            "Support.InvalidQueueName" => StatusCodes.Status422UnprocessableEntity,
            "Support.InvalidSla" => StatusCodes.Status422UnprocessableEntity,
            "Support.InvalidCustomerName" => StatusCodes.Status422UnprocessableEntity,
            "Support.InvalidTicketSubject" => StatusCodes.Status422UnprocessableEntity,
            "Support.InvalidTicketStatus" => StatusCodes.Status422UnprocessableEntity,
            "Support.InvalidReplyBody" => StatusCodes.Status422UnprocessableEntity,
            _ => StatusCodes.Status400BadRequest,
        };
        return Problem(title: error.Code, detail: error.Message, statusCode: status);
    }
}

public record CreateQueueBodyDto(string? Name, int? SlaMinutes, Guid? DefaultAssigneeId);
public record UpdateQueueBodyDto(string? Name, int? SlaMinutes, Guid? DefaultAssigneeId);
public record CreateCustomerBodyDto(string? Name, string? Email, string? Company, string? Tier);
public record UpdateCustomerBodyDto(string? Name, string? Email, string? Company, string? Tier);
public record CreateTicketBodyDto(
    Guid CustomerId, Guid? QueueId, string? Subject, string? BodyMd,
    string? Priority, Guid? AssigneeId);
public record UpdateTicketBodyDto(
    string? Subject, string? BodyMd, string? Priority, Guid? AssigneeId, Guid? QueueId);
public record ChangeStatusBodyDto(string? To);
public record AddReplyBodyDto(string? BodyMd, bool IsInternal);
