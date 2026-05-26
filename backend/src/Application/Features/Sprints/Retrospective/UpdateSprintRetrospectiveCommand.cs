using Application.Common;
using Application.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Sprints.Retrospective;

/// <summary>
/// PM-editable narrative fields. Doesn't touch the AI draft — that's
/// regenerated as a unit. Nulls in the request leave the field
/// untouched so the UI can save one section at a time.
/// </summary>
public record UpdateSprintRetrospectiveCommand(
    Guid SprintId,
    string? Summary,
    string? WhatWentWell,
    string? WhatDidnt,
    string? Suggestions) : IRequest<Result<SprintRetrospectiveDto>>;

public class UpdateSprintRetrospectiveCommandHandler(IAppDbContext db)
    : IRequestHandler<UpdateSprintRetrospectiveCommand, Result<SprintRetrospectiveDto>>
{
    public async Task<Result<SprintRetrospectiveDto>> Handle(
        UpdateSprintRetrospectiveCommand request, CancellationToken ct)
    {
        var entity = await db.SprintRetrospectives
            .FirstOrDefaultAsync(r => r.SprintId == request.SprintId, ct);
        if (entity is null) return Result.Failure<SprintRetrospectiveDto>(SprintErrors.RetroNotFound);

        if (request.Summary is not null) entity.Summary = request.Summary.Trim();
        if (request.WhatWentWell is not null) entity.WhatWentWell = request.WhatWentWell.Trim();
        if (request.WhatDidnt is not null) entity.WhatDidnt = request.WhatDidnt.Trim();
        if (request.Suggestions is not null) entity.Suggestions = request.Suggestions.Trim();

        await db.SaveChangesAsync(ct);

        // Reuse the get handler's hydration to avoid duplicating the
        // lookup logic. Empty dict is fine — the draft section will
        // still render but pick titles fall back to "(task removed)";
        // callers that need the draft refresh tasks separately.
        return Result.Success(RetrospectiveMapper.ToDto(
            entity, new Dictionary<Guid, RetrospectiveMapper.TaskKeyAndTitle>()));
    }
}
