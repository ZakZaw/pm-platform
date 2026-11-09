using System.Collections.Concurrent;
using Application.Interfaces;
using Infrastructure.Services.Ai;
using Microsoft.Extensions.Options;

namespace Infrastructure.Services;

/// <summary>
/// Per-instance daily AI quota (resets at UTC midnight). Yesterday's
/// counters are dropped as soon as a new day starts, so the table only
/// ever holds today's partitions. Configure with AI:DailyQuota
/// (default 500 calls per org per day; 0 disables the cap).
/// </summary>
public sealed class InMemoryAIUsageQuota(IOptions<AISettings> settings) : IAIUsageQuota
{
    private readonly ConcurrentDictionary<string, int> _counts = new();
    private DateOnly _day;
    private readonly Lock _dayLock = new();

    public bool TryConsume(string partition, DateTime utcNow)
    {
        var limit = settings.Value.DailyQuota;
        if (limit <= 0) return true;

        var today = DateOnly.FromDateTime(utcNow);
        lock (_dayLock)
        {
            if (today != _day)
            {
                _counts.Clear();
                _day = today;
            }
        }

        var used = _counts.AddOrUpdate(partition, 1, (_, n) => n + 1);
        if (used <= limit) return true;

        _counts.AddOrUpdate(partition, limit, (_, n) => Math.Max(limit, n - 1));
        return false;
    }
}