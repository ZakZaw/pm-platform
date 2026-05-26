using Application.Common;
using Application.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Roadmap.Commands;

public record RevokeRoadmapShareLinkCommand(Guid LinkId) : IRequest<Result>;

public class RevokeRoadmapShareLinkCommandHandler(IAppDbContext db)
    : IRequestHandler<RevokeRoadmapShareLinkCommand, Result>
{
    public async Task<Result> Handle(RevokeRoadmapShareLinkCommand request, CancellationToken ct)
    {
        var link = await db.RoadmapShareLinks.FirstOrDefaultAsync(l => l.Id == request.LinkId, ct);
        if (link is null) return Result.Failure(RoadmapShareErrors.NotFound);

        if (link.RevokedAt is null)
        {
            link.RevokedAt = DateTime.UtcNow;
            await db.SaveChangesAsync(ct);
        }
        return Result.Success();
    }
}
