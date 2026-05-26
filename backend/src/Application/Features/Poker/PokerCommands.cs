using Application.Common;
using Application.Interfaces;
using Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Poker;

public record PokerVoteDto(
    Guid UserId,
    string? UserName,
    string? Value,
    bool HasVoted);

public record PokerSessionDto(
    Guid Id,
    Guid TaskId,
    Guid ProjectId,
    Guid HostUserId,
    string? HostName,
    string Status,
    int? FinalEstimate,
    DateTime CreatedAt,
    DateTime? RevealedAt,
    DateTime? ClosedAt,
    IReadOnlyList<PokerVoteDto> Votes,
    double? Average,
    int? Median);

public static class PokerCards
{
    public static readonly HashSet<string> Allowed = new(StringComparer.OrdinalIgnoreCase)
    {
        "0", "1", "2", "3", "5", "8", "13", "21", "?", "coffee",
    };
}

internal static class PokerProjection
{
    /// <summary>
    /// Project a session to DTO, hiding individual ballot values until
    /// the round is revealed/closed. Members see only "voted/not voted"
    /// during voting.
    /// </summary>
    public static PokerSessionDto Build(
        PokerSession session,
        IReadOnlyList<(Guid UserId, string? Name, string Value, DateTime CreatedAt)> votes,
        string? hostName)
    {
        var hide = session.Status == PokerSessionStatus.Voting;
        var voteDtos = votes
            .Select(v => new PokerVoteDto(
                v.UserId, v.Name,
                hide ? null : v.Value,
                true))
            .ToList();

        double? avg = null;
        int? median = null;
        if (!hide && votes.Count > 0)
        {
            var numeric = votes
                .Select(v => int.TryParse(v.Value, out var n) ? (int?)n : null)
                .Where(n => n is not null)
                .Select(n => n!.Value)
                .OrderBy(n => n)
                .ToList();
            if (numeric.Count > 0)
            {
                avg = Math.Round(numeric.Average(), 1);
                median = numeric.Count % 2 == 1
                    ? numeric[numeric.Count / 2]
                    : (numeric[numeric.Count / 2 - 1] + numeric[numeric.Count / 2]) / 2;
            }
        }

        return new PokerSessionDto(
            session.Id, session.TaskId, session.ProjectId,
            session.HostUserId, hostName,
            session.Status.ToString(),
            session.FinalEstimate,
            session.CreatedAt, session.RevealedAt, session.ClosedAt,
            voteDtos, avg, median);
    }
}

public record StartPokerSessionCommand(Guid TaskId) : IRequest<Result<PokerSessionDto>>;

public class StartPokerSessionCommandHandler(
    IAppDbContext db,
    ICurrentUser currentUser,
    IProjectEventBus events)
    : IRequestHandler<StartPokerSessionCommand, Result<PokerSessionDto>>
{
    public async Task<Result<PokerSessionDto>> Handle(StartPokerSessionCommand request, CancellationToken ct)
    {
        if (currentUser.UserId is not { } userId)
            return Result.Failure<PokerSessionDto>(AuthErrors.NotAuthenticated);

        var task = await db.Tasks
            .Where(t => t.Id == request.TaskId)
            .Select(t => new { t.Id, t.ProjectId })
            .FirstOrDefaultAsync(ct);
        if (task is null) return Result.Failure<PokerSessionDto>(TaskErrors.NotFound);

        var openExists = await db.PokerSessions
            .AnyAsync(s => s.TaskId == task.Id
                && (s.Status == PokerSessionStatus.Voting || s.Status == PokerSessionStatus.Revealed), ct);
        if (openExists) return Result.Failure<PokerSessionDto>(PokerErrors.AlreadyOpen);

        var session = new PokerSession
        {
            TaskId = task.Id,
            ProjectId = task.ProjectId,
            HostUserId = userId,
            Status = PokerSessionStatus.Voting,
        };
        db.PokerSessions.Add(session);
        await db.SaveChangesAsync(ct);

        var hostName = await db.Users.Where(u => u.Id == userId).Select(u => u.FullName).FirstOrDefaultAsync(ct);
        var dto = PokerProjection.Build(session, [], hostName);

        await events.PublishAsync(task.ProjectId, ProjectEvents.PokerStarted, new
        {
            sessionId = session.Id, taskId = session.TaskId, hostUserId = userId,
        }, ct);

        return Result.Success(dto);
    }
}

public record CastPokerVoteCommand(Guid SessionId, string Value)
    : IRequest<Result<PokerSessionDto>>;

public class CastPokerVoteCommandHandler(
    IAppDbContext db,
    ICurrentUser currentUser,
    IProjectEventBus events)
    : IRequestHandler<CastPokerVoteCommand, Result<PokerSessionDto>>
{
    public async Task<Result<PokerSessionDto>> Handle(CastPokerVoteCommand request, CancellationToken ct)
    {
        if (currentUser.UserId is not { } userId)
            return Result.Failure<PokerSessionDto>(AuthErrors.NotAuthenticated);

        var value = (request.Value ?? string.Empty).Trim();
        if (!PokerCards.Allowed.Contains(value))
            return Result.Failure<PokerSessionDto>(PokerErrors.InvalidValue);

        var session = await db.PokerSessions
            .Include(s => s.Votes)
            .FirstOrDefaultAsync(s => s.Id == request.SessionId, ct);
        if (session is null) return Result.Failure<PokerSessionDto>(PokerErrors.NotFound);
        if (session.Status != PokerSessionStatus.Voting)
            return Result.Failure<PokerSessionDto>(PokerErrors.NotVoting);

        var existing = session.Votes.FirstOrDefault(v => v.UserId == userId);
        if (existing is null)
        {
            db.PokerVotes.Add(new PokerVote { SessionId = session.Id, UserId = userId, Value = value });
        }
        else
        {
            existing.Value = value;
            existing.CreatedAt = DateTime.UtcNow;
        }
        await db.SaveChangesAsync(ct);

        var dto = await BuildDtoAsync(db, session, ct);

        await events.PublishAsync(session.ProjectId, ProjectEvents.PokerVoteCast, new
        {
            sessionId = session.Id,
            userId,
            voterCount = dto.Votes.Count,
        }, ct);

        return Result.Success(dto);
    }

    internal static async Task<PokerSessionDto> BuildDtoAsync(
        IAppDbContext db, PokerSession session, CancellationToken ct)
    {
        var rows = await db.PokerVotes
            .Where(v => v.SessionId == session.Id)
            .Select(v => new { v.UserId, Name = v.User.FullName, v.Value, v.CreatedAt })
            .ToListAsync(ct);
        var votes = rows.Select(r => (r.UserId, (string?)r.Name, r.Value, r.CreatedAt)).ToList();
        var hostName = await db.Users.Where(u => u.Id == session.HostUserId)
            .Select(u => u.FullName).FirstOrDefaultAsync(ct);
        return PokerProjection.Build(session, votes, hostName);
    }
}

public record RevealPokerSessionCommand(Guid SessionId) : IRequest<Result<PokerSessionDto>>;

public class RevealPokerSessionCommandHandler(
    IAppDbContext db,
    ICurrentUser currentUser,
    IProjectEventBus events)
    : IRequestHandler<RevealPokerSessionCommand, Result<PokerSessionDto>>
{
    public async Task<Result<PokerSessionDto>> Handle(RevealPokerSessionCommand request, CancellationToken ct)
    {
        if (currentUser.UserId is not { } userId)
            return Result.Failure<PokerSessionDto>(AuthErrors.NotAuthenticated);

        var session = await db.PokerSessions.FirstOrDefaultAsync(s => s.Id == request.SessionId, ct);
        if (session is null) return Result.Failure<PokerSessionDto>(PokerErrors.NotFound);
        if (session.HostUserId != userId) return Result.Failure<PokerSessionDto>(PokerErrors.HostOnly);
        if (session.Status != PokerSessionStatus.Voting)
            return Result.Failure<PokerSessionDto>(PokerErrors.NotRevealable);

        session.Status = PokerSessionStatus.Revealed;
        session.RevealedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);

        var dto = await CastPokerVoteCommandHandler.BuildDtoAsync(db, session, ct);
        await events.PublishAsync(session.ProjectId, ProjectEvents.PokerRevealed, new
        {
            sessionId = session.Id,
            average = dto.Average,
            median = dto.Median,
        }, ct);

        return Result.Success(dto);
    }
}

public record ClosePokerSessionCommand(Guid SessionId, int? FinalEstimate, bool ApplyToTask)
    : IRequest<Result<PokerSessionDto>>;

public class ClosePokerSessionCommandHandler(
    IAppDbContext db,
    ICurrentUser currentUser,
    IProjectEventBus events)
    : IRequestHandler<ClosePokerSessionCommand, Result<PokerSessionDto>>
{
    public async Task<Result<PokerSessionDto>> Handle(ClosePokerSessionCommand request, CancellationToken ct)
    {
        if (currentUser.UserId is not { } userId)
            return Result.Failure<PokerSessionDto>(AuthErrors.NotAuthenticated);

        var session = await db.PokerSessions
            .FirstOrDefaultAsync(s => s.Id == request.SessionId, ct);
        if (session is null) return Result.Failure<PokerSessionDto>(PokerErrors.NotFound);
        if (session.HostUserId != userId) return Result.Failure<PokerSessionDto>(PokerErrors.HostOnly);
        if (session.Status == PokerSessionStatus.Closed)
            return Result.Failure<PokerSessionDto>(PokerErrors.AlreadyClosed);

        session.Status = PokerSessionStatus.Closed;
        session.ClosedAt = DateTime.UtcNow;
        session.FinalEstimate = request.FinalEstimate;

        if (request.ApplyToTask && request.FinalEstimate is { } pts && pts >= 0)
        {
            var task = await db.Tasks.FirstOrDefaultAsync(t => t.Id == session.TaskId, ct);
            if (task is not null) task.StoryPoints = pts;
        }
        await db.SaveChangesAsync(ct);

        var dto = await CastPokerVoteCommandHandler.BuildDtoAsync(db, session, ct);
        await events.PublishAsync(session.ProjectId, ProjectEvents.PokerClosed, new
        {
            sessionId = session.Id,
            taskId = session.TaskId,
            finalEstimate = session.FinalEstimate,
        }, ct);

        return Result.Success(dto);
    }
}

public record GetActivePokerSessionQuery(Guid TaskId) : IRequest<Result<PokerSessionDto?>>;

public class GetActivePokerSessionQueryHandler(IAppDbContext db)
    : IRequestHandler<GetActivePokerSessionQuery, Result<PokerSessionDto?>>
{
    public async Task<Result<PokerSessionDto?>> Handle(GetActivePokerSessionQuery request, CancellationToken ct)
    {
        var session = await db.PokerSessions
            .Where(s => s.TaskId == request.TaskId
                && (s.Status == PokerSessionStatus.Voting || s.Status == PokerSessionStatus.Revealed))
            .OrderByDescending(s => s.CreatedAt)
            .FirstOrDefaultAsync(ct);
        if (session is null) return Result.Success<PokerSessionDto?>(null);

        var dto = await CastPokerVoteCommandHandler.BuildDtoAsync(db, session, ct);
        return Result.Success<PokerSessionDto?>(dto);
    }
}
