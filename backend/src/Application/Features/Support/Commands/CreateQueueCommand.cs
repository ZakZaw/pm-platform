using Application.Common;
using Application.Interfaces;
using Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Support.Commands;

public record CreateQueueCommand(
    Guid ProjectId,
    string Name,
    int? SlaMinutes,
    Guid? DefaultAssigneeId) : IRequest<Result<QueueDto>>;

public class CreateQueueCommandHandler(IAppDbContext db)
    : IRequestHandler<CreateQueueCommand, Result<QueueDto>>
{
    public async Task<Result<QueueDto>> Handle(CreateQueueCommand request, CancellationToken ct)
    {
        var name = request.Name?.Trim() ?? string.Empty;
        if (name.Length is < 1 or > 60)
            return Result.Failure<QueueDto>(SupportErrors.InvalidQueueName);

        var sla = request.SlaMinutes ?? 24 * 60;
        if (sla <= 0) return Result.Failure<QueueDto>(SupportErrors.InvalidSla);

        var nextOrder = 1 + await db.Queues
            .Where(q => q.ProjectId == request.ProjectId)
            .Select(q => (int?)q.Order)
            .MaxAsync(ct) ?? 0;

        var queue = new Queue
        {
            ProjectId = request.ProjectId,
            Name = name,
            Order = nextOrder,
            SlaMinutes = sla,
            DefaultAssigneeId = request.DefaultAssigneeId,
        };
        db.Queues.Add(queue);
        await db.SaveChangesAsync(ct);

        return Result.Success(new QueueDto(
            queue.Id, queue.ProjectId, queue.Name, queue.Order, queue.SlaMinutes,
            queue.DefaultAssigneeId, 0, 0));
    }
}
