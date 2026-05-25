using System.Text.Json;
using Api.Authorization;
using Application.Common;
using Application.Features.CustomFields.Commands;
using Application.Features.CustomFields.Queries;
using Domain.Enums;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Api.Controllers;

[ApiController]
[Authorize]
public class CustomFieldsController(ISender mediator) : ControllerBase
{
    // -------- Schema (definitions) --------

    [HttpGet("api/v1/projects/{projectId:guid}/custom-fields")]
    [RequireProjectRole(ProjectRole.Viewer)]
    public async Task<ActionResult<IReadOnlyList<CustomFieldDefinitionDto>>> List(
        Guid projectId, CancellationToken ct)
    {
        var result = await mediator.Send(new ListProjectCustomFieldsQuery(projectId), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpPost("api/v1/projects/{projectId:guid}/custom-fields")]
    [RequireProjectRole(ProjectRole.TeamLead)]
    public async Task<ActionResult<CustomFieldDefinitionDto>> Create(
        Guid projectId,
        [FromBody] CreateCustomFieldBodyDto body,
        CancellationToken ct)
    {
        var result = await mediator.Send(new CreateCustomFieldDefinitionCommand(
            projectId, body.Name, body.FieldType, body.Options, body.Required), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpPatch("api/v1/projects/{projectId:guid}/custom-fields/{fieldId:guid}")]
    [RequireProjectRole(ProjectRole.TeamLead)]
    public async Task<ActionResult<CustomFieldDefinitionDto>> Update(
        Guid projectId,
        Guid fieldId,
        [FromBody] UpdateCustomFieldBodyDto body,
        CancellationToken ct)
    {
        var result = await mediator.Send(new UpdateCustomFieldDefinitionCommand(
            fieldId, body.Name, body.Options, body.Required, body.SortOrder), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpDelete("api/v1/projects/{projectId:guid}/custom-fields/{fieldId:guid}")]
    [RequireProjectRole(ProjectRole.TeamLead)]
    public async Task<ActionResult> Delete(Guid projectId, Guid fieldId, CancellationToken ct)
    {
        var result = await mediator.Send(new DeleteCustomFieldDefinitionCommand(fieldId), ct);
        return result.IsSuccess ? NoContent() : ToProblem(result.Error!);
    }

    // -------- Per-task values --------

    [HttpGet("api/v1/tasks/{taskId:guid}/custom-fields")]
    public async Task<ActionResult<IReadOnlyList<CustomFieldValueDto>>> GetValues(
        Guid taskId, CancellationToken ct)
    {
        var result = await mediator.Send(new GetTaskCustomFieldValuesQuery(taskId), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpPut("api/v1/tasks/{taskId:guid}/custom-fields")]
    public async Task<ActionResult<IReadOnlyList<CustomFieldValueDto>>> SetValues(
        Guid taskId,
        [FromBody] SetCustomFieldValuesBodyDto body,
        CancellationToken ct)
    {
        var inputs = (body.Values ?? [])
            .Select(v => new CustomFieldValueInput(v.DefinitionId, v.Value))
            .ToList();
        var result = await mediator.Send(new SetTaskCustomFieldValuesCommand(taskId, inputs), ct);
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
            "Task.NotFound" => StatusCodes.Status404NotFound,
            "CustomField.NotFound" => StatusCodes.Status404NotFound,
            "CustomField.DuplicateName" => StatusCodes.Status409Conflict,
            "CustomField.InvalidName" => StatusCodes.Status422UnprocessableEntity,
            "CustomField.InvalidType" => StatusCodes.Status422UnprocessableEntity,
            "CustomField.InvalidOption" => StatusCodes.Status422UnprocessableEntity,
            "CustomField.OptionsRequired" => StatusCodes.Status422UnprocessableEntity,
            "CustomField.OptionsNotAllowed" => StatusCodes.Status422UnprocessableEntity,
            "CustomField.InvalidValue" => StatusCodes.Status422UnprocessableEntity,
            "CustomField.RequiredMissing" => StatusCodes.Status422UnprocessableEntity,
            "CustomField.TaskNotInProject" => StatusCodes.Status422UnprocessableEntity,
            _ => StatusCodes.Status400BadRequest
        };
        return Problem(title: error.Code, detail: error.Message, statusCode: status);
    }
}

public record CreateCustomFieldBodyDto(
    string Name,
    string FieldType,
    IReadOnlyList<string>? Options,
    bool Required);

public record UpdateCustomFieldBodyDto(
    string Name,
    IReadOnlyList<string>? Options,
    bool Required,
    int? SortOrder);

public record SetCustomFieldValuesBodyDto(IReadOnlyList<CustomFieldValueInputDto>? Values);

public record CustomFieldValueInputDto(Guid DefinitionId, JsonElement? Value);
