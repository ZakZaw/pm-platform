using Application.Common;
using Application.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Marketing.Commands;

public record DeleteMarketingTaskCommand(Guid TaskId) : IRequest<Result>;

public class DeleteMarketingTaskCommandHandler(IAppDbContext db)
    : IRequestHandler<DeleteMarketingTaskCommand, Result>
{
    public async Task<Result> Handle(DeleteMarketingTaskCommand request, CancellationToken ct)
    {
        var task = await db.MarketingTasks.FirstOrDefaultAsync(t => t.Id == request.TaskId, ct);
        if (task is null) return Result.Failure(MarketingErrors.MarketingTaskNotFound);

        db.MarketingTasks.Remove(task);
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
