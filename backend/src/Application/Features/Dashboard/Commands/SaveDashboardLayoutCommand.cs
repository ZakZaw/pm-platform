using Application.Common;
using Application.Interfaces;
using Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Dashboard.Commands;

/// <summary>
/// Upsert the calling user's dashboard layout for a project. The layout JSON
/// is treated opaquely server-side — schema lives in the frontend.
/// </summary>
public record SaveDashboardLayoutCommand(Guid ProjectId, string LayoutJson) : IRequest<Result>;

public class SaveDashboardLayoutCommandHandler(IAppDbContext db, ICurrentUser currentUser)
    : IRequestHandler<SaveDashboardLayoutCommand, Result>
{
    private const int MaxJsonBytes = 32_000;

    public async Task<Result> Handle(SaveDashboardLayoutCommand request, CancellationToken ct)
    {
        if (currentUser.UserId is not { } userId)
            return Result.Failure(AuthErrors.NotAuthenticated);

        if (string.IsNullOrWhiteSpace(request.LayoutJson))
            return Result.Failure(new Error("Dashboard.EmptyLayout", "Layout JSON is required."));

        if (request.LayoutJson.Length > MaxJsonBytes)
            return Result.Failure(new Error("Dashboard.LayoutTooLarge",
                $"Layout JSON exceeds {MaxJsonBytes} bytes."));

        // Cheap shape check — full validation lives on the client. Reject
        // obviously-non-JSON payloads so we don't store garbage in jsonb.
        var trimmed = request.LayoutJson.TrimStart();
        if (!trimmed.StartsWith('[') && !trimmed.StartsWith('{'))
            return Result.Failure(new Error("Dashboard.InvalidJson",
                "Layout JSON must be a JSON array or object."));

        var existing = await db.UserDashboardLayouts
            .FirstOrDefaultAsync(l => l.UserId == userId && l.ProjectId == request.ProjectId, ct);

        if (existing is null)
        {
            db.UserDashboardLayouts.Add(new UserDashboardLayout
            {
                UserId = userId,
                ProjectId = request.ProjectId,
                LayoutJson = request.LayoutJson,
            });
        }
        else
        {
            existing.LayoutJson = request.LayoutJson;
            existing.UpdatedAt = DateTime.UtcNow;
        }

        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
