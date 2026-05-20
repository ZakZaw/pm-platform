using Application.Common;
using Application.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.AI.Commands;

public record DismissSuggestionCommand(Guid Id) : IRequest<Result>;

public class DismissSuggestionCommandHandler(IAppDbContext db, ICurrentUser currentUser)
    : IRequestHandler<DismissSuggestionCommand, Result>
{
    public async Task<Result> Handle(DismissSuggestionCommand request, CancellationToken ct)
    {
        if (currentUser.UserId is not { } userId)
            return Result.Failure(AuthErrors.NotAuthenticated);

        var s = await db.AISuggestions.FirstOrDefaultAsync(x => x.Id == request.Id, ct);
        if (s is null)
            return Result.Failure(AIErrors.RequestNotFound);

        if (s.Status != "Open") return Result.Success();
        s.Status = "Dismissed";
        s.ActedAt = DateTime.UtcNow;
        s.ActedByUserId = userId;
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

public record AcceptSuggestionCommand(Guid Id) : IRequest<Result>;

public class AcceptSuggestionCommandHandler(IAppDbContext db, ICurrentUser currentUser)
    : IRequestHandler<AcceptSuggestionCommand, Result>
{
    public async Task<Result> Handle(AcceptSuggestionCommand request, CancellationToken ct)
    {
        if (currentUser.UserId is not { } userId)
            return Result.Failure(AuthErrors.NotAuthenticated);

        var s = await db.AISuggestions.FirstOrDefaultAsync(x => x.Id == request.Id, ct);
        if (s is null)
            return Result.Failure(AIErrors.RequestNotFound);

        if (s.Status != "Open") return Result.Success();
        s.Status = "Accepted";
        s.ActedAt = DateTime.UtcNow;
        s.ActedByUserId = userId;
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
