using Application.Common;
using Application.Interfaces;
using Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Marketing.Queries;

/// <summary>
/// Returns every Asset with a publish date in the requested window, joined
/// with its campaign so the calendar can colour each chip by channel.
/// Archived (or Archived-status) assets are excluded so the calendar
/// surfaces planned + live work only.
/// </summary>
public record GetContentCalendarQuery(
    Guid ProjectId,
    DateTime From,
    DateTime To) : IRequest<Result<ContentCalendarDto>>;

public class GetContentCalendarQueryHandler(IAppDbContext db)
    : IRequestHandler<GetContentCalendarQuery, Result<ContentCalendarDto>>
{
    public async Task<Result<ContentCalendarDto>> Handle(
        GetContentCalendarQuery request, CancellationToken ct)
    {
        var assets = await db.Assets
            .Where(a =>
                a.Campaign.ProjectId == request.ProjectId
                && a.PublishDate != null
                && a.PublishDate >= request.From
                && a.PublishDate < request.To
                && a.Status != AssetStatus.Archived)
            .OrderBy(a => a.PublishDate)
            .Select(a => new CalendarAssetDto(
                a.Id, a.CampaignId, a.Campaign.Name, a.Campaign.Channel.ToString(),
                a.Type.ToString(), a.Title, a.Status.ToString(),
                a.PublishDate!.Value, a.OwnerId))
            .ToListAsync(ct);

        return Result.Success(new ContentCalendarDto(request.From, request.To, assets));
    }
}
