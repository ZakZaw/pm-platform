using Application.Common;
using Application.Features.Attachments.Commands;
using Application.Features.Attachments.Queries;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Api.Controllers;

[ApiController]
[Authorize]
public class AttachmentsController(ISender mediator) : ControllerBase
{
    [HttpGet("api/v1/tasks/{taskId:guid}/attachments")]
    public async Task<ActionResult<IReadOnlyList<AttachmentDto>>> List(Guid taskId, CancellationToken ct)
    {
        var result = await mediator.Send(new ListTaskAttachmentsQuery(taskId), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpPost("api/v1/tasks/{taskId:guid}/attachments")]
    [RequestSizeLimit(60 * 1024 * 1024)]
    public async Task<ActionResult<AttachmentDto>> Upload(
        Guid taskId,
        IFormFile file,
        CancellationToken ct)
    {
        if (file is null || file.Length == 0)
            return Problem(title: "Attachment.EmptyFile", detail: "No file was uploaded.", statusCode: 400);

        using var ms = new MemoryStream();
        await file.CopyToAsync(ms, ct);
        var bytes = ms.ToArray();

        var result = await mediator.Send(new UploadAttachmentCommand(
            taskId, bytes, file.FileName, file.ContentType), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpDelete("api/v1/attachments/{attachmentId:guid}")]
    public async Task<ActionResult> Delete(Guid attachmentId, CancellationToken ct)
    {
        var result = await mediator.Send(new DeleteAttachmentCommand(attachmentId), ct);
        return result.IsSuccess ? NoContent() : ToProblem(result.Error!);
    }

    private ObjectResult ToProblem(Error error)
    {
        var status = error.Code switch
        {
            "Auth.NotAuthenticated" => StatusCodes.Status401Unauthorized,
            "Task.NotFound" => StatusCodes.Status404NotFound,
            "Attachment.NotFound" => StatusCodes.Status404NotFound,
            "Attachment.FileTooLarge" => StatusCodes.Status413PayloadTooLarge,
            "Attachment.EmptyFile" => StatusCodes.Status400BadRequest,
            "Attachment.InvalidFileName" => StatusCodes.Status422UnprocessableEntity,
            _ => StatusCodes.Status400BadRequest
        };
        return Problem(title: error.Code, detail: error.Message, statusCode: status);
    }
}
