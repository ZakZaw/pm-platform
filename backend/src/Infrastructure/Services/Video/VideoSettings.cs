namespace Infrastructure.Services.Video;

/// <summary>
/// F2-20 settings bound from <c>Video</c> section of app config.
/// LiveKit cloud users only need URL + API key + secret; the
/// recording fields stay optional so dev environments without an S3
/// bucket can still join rooms — recording just no-ops.
/// </summary>
public class VideoSettings
{
    /// <summary>Public WSS URL, e.g. <c>wss://my-app.livekit.cloud</c>.</summary>
    public string? Url { get; set; }
    public string? ApiKey { get; set; }
    public string? ApiSecret { get; set; }

    public string? RecordingBucket { get; set; }
    public string? RecordingRegion { get; set; }
    public string? RecordingAccessKey { get; set; }
    public string? RecordingSecretKey { get; set; }

    /// <summary>Default token lifetime in minutes. Keep short so a
    /// leaked token has a tight blast radius.</summary>
    public int AccessTokenMinutes { get; set; } = 60;

    /// <summary>Guest invite link default lifetime in hours.</summary>
    public int GuestLinkHours { get; set; } = 24;
}
