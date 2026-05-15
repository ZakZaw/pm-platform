using Application.Common;
using Application.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Subtasks.Commands;

public record DeleteSubtaskCommand(Guid SubtaskId) : IRequest<Result>;

public class DeleteSubtaskCommandHandler(IAppDbContext db)
    : IRequestHandler<DeleteSubtaskCommand, Result>
{
    public async Task<Result> Handle(DeleteSubtaskCommand request, CancellationToken ct)
    {
        var sub = await db.Subtasks.FirstOrDefaultAsync(s => s.Id == request.SubtaskId, ct);
        if (sub is null)
            return Result.Failure(SubtaskErrors.NotFound);
        db.Subtasks.Remove(sub);
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
