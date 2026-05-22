using Application.Common;
using Application.Interfaces;
using Domain.Entities;
using Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Sales.Commands;

public record CreateActivityCommand(
    Guid DealId,
    string Type,
    string Summary,
    DateTime? OccurredAt) : IRequest<Result<ActivityDto>>;

public class CreateActivityCommandHandler(IAppDbContext db, ICurrentUser currentUser)
    : IRequestHandler<CreateActivityCommand, Result<ActivityDto>>
{
    public async Task<Result<ActivityDto>> Handle(CreateActivityCommand request, CancellationToken ct)
    {
        if (currentUser.UserId is not { } userId)
            return Result.Failure<ActivityDto>(AuthErrors.NotAuthenticated);

        var summary = request.Summary?.Trim() ?? string.Empty;
        if (summary.Length is < 1 or > 1000)
            return Result.Failure<ActivityDto>(SalesErrors.InvalidActivitySummary);

        if (!Enum.TryParse<ActivityType>(request.Type, ignoreCase: true, out var type))
            return Result.Failure<ActivityDto>(SalesErrors.InvalidActivityType);

        var dealExists = await db.Deals.AnyAsync(d => d.Id == request.DealId, ct);
        if (!dealExists) return Result.Failure<ActivityDto>(SalesErrors.DealNotFound);

        var activity = new Activity
        {
            DealId = request.DealId,
            Type = type,
            Summary = summary,
            OccurredAt = request.OccurredAt ?? DateTime.UtcNow,
            OwnerId = userId,
        };
        db.Activities.Add(activity);
        await db.SaveChangesAsync(ct);

        return Result.Success(new ActivityDto(
            activity.Id, activity.DealId, activity.Type.ToString(),
            activity.Summary, activity.OccurredAt, activity.OwnerId, activity.CreatedAt));
    }
}
