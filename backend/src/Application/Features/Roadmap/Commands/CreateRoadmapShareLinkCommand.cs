using System.Security.Cryptography;
using Application.Common;
using Application.Interfaces;
using Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Roadmap.Commands;

public record CreateRoadmapShareLinkCommand(
    Guid ProjectId,
    string? Password,
    DateTime? ExpiresAt,
    bool HideInternalLabels,
    bool HideAssignees) : IRequest<Result<RoadmapShareLinkDto>>;

public record RoadmapShareLinkDto(
    Guid Id,
    Guid ProjectId,
    string Token,
    bool HasPassword,
    DateTime? ExpiresAt,
    bool HideInternalLabels,
    bool HideAssignees,
    Guid CreatedByUserId,
    string? CreatedByName,
    DateTime CreatedAt,
    DateTime? RevokedAt);

public class CreateRoadmapShareLinkCommandHandler(
    IAppDbContext db,
    ICurrentUser currentUser,
    IPasswordHasher passwords)
    : IRequestHandler<CreateRoadmapShareLinkCommand, Result<RoadmapShareLinkDto>>
{
    public async Task<Result<RoadmapShareLinkDto>> Handle(CreateRoadmapShareLinkCommand request, CancellationToken ct)
    {
        if (currentUser.UserId is not { } userId)
            return Result.Failure<RoadmapShareLinkDto>(AuthErrors.NotAuthenticated);

        var projectExists = await db.Projects.AnyAsync(p => p.Id == request.ProjectId, ct);
        if (!projectExists) return Result.Failure<RoadmapShareLinkDto>(ProjectErrors.NotFound);

        if (request.ExpiresAt is { } exp && exp <= DateTime.UtcNow)
            return Result.Failure<RoadmapShareLinkDto>(RoadmapShareErrors.InvalidExpiry);

        string? hash = null;
        if (!string.IsNullOrEmpty(request.Password))
        {
            if (request.Password.Length is < 4 or > 128)
                return Result.Failure<RoadmapShareLinkDto>(RoadmapShareErrors.InvalidPasswordValue);
            hash = passwords.Hash(request.Password);
        }

        var link = new RoadmapShareLink
        {
            ProjectId = request.ProjectId,
            Token = GenerateToken(),
            PasswordHash = hash,
            ExpiresAt = request.ExpiresAt,
            HideInternalLabels = request.HideInternalLabels,
            HideAssignees = request.HideAssignees,
            CreatedByUserId = userId,
        };

        db.RoadmapShareLinks.Add(link);
        await db.SaveChangesAsync(ct);

        var creatorName = await db.Users
            .Where(u => u.Id == userId)
            .Select(u => u.FullName)
            .FirstOrDefaultAsync(ct);

        return Result.Success(new RoadmapShareLinkDto(
            link.Id, link.ProjectId, link.Token, link.PasswordHash is not null,
            link.ExpiresAt, link.HideInternalLabels, link.HideAssignees,
            link.CreatedByUserId, creatorName, link.CreatedAt, link.RevokedAt));
    }

    private static string GenerateToken()
    {
        // 32 bytes → 43-char URL-safe base64 (no padding). Unique index on
        // the column catches the astronomically unlikely collision.
        Span<byte> buf = stackalloc byte[32];
        RandomNumberGenerator.Fill(buf);
        return Convert.ToBase64String(buf)
            .Replace('+', '-').Replace('/', '_').TrimEnd('=');
    }
}
