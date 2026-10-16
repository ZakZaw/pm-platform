using Domain.Enums;
using Application.Authorization;
using Api.Authorization;
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
    [RequireProjectRole(ProjectRole.Viewer, ProjectScope.Task, "taskId")]
    public async Task<ActionResult<IReadOnlyList<AttachmentDto>>> List(Guid taskId, CancellationToken ct)
    {
        var result = await mediator.Send(new ListTaskAttachmentsQuery(taskId), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpPost("api/v1/tasks/{taskId:guid}/attachments")]
    [RequireProjectRole(ProjectRole.Contributor, ProjectScope.Task, "taskId")]
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

    // H3 - the only way to read an attachment. Always a download
    // (Content-Disposition: attachment), never sniffed, and sandboxed in
    // case a browser renders it anyway.
    [HttpGet("api/v1/attachments/{attachmentId:guid}/download")]
    [RequireProjectRole(ProjectRole.Viewer, ProjectScope.Attachment, "attachmentId")]
    public async Task<IActionResult> Download(Guid attachmentId, CancellationToken ct)
    {
        var result = await mediator.Send(new GetAttachmentFileQuery(attachmentId), ct);
        if (!result.IsSuccess) return ToProblem(result.Error!);

        var file = result.Value!;
        Response.Headers["X-Content-Type-Options"] = "nosniff";
        Response.Headers["Content-Security-Policy"] = "sandbox; default-src 'none'";
        Response.Headers.CacheControl = "private, no-store";
        return File(file.Content, file.ContentType, file.FileName);
    }

    [HttpDelete("api/v1/attachments/{attachmentId:guid}")]
    [RequireProjectRole(ProjectRole.Contributor, ProjectScope.Attachment, "attachmentId")]
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
            "Attachment.BlockedType" => StatusCodes.Status415UnsupportedMediaType,
            _ => StatusCodes.Status400BadRequest
        };
        return Problem(title: error.Code, detail: error.Message, statusCode: status);
    }
}
