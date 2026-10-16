namespace Infrastructure.Services.Ai;

public class AISettings
{
    /// <summary>API key for Google Gemini in dev. When null/empty we fall
    /// back to the in-process stub provider so local dev still works.</summary>
    public string? GeminiApiKey { get; set; }

    /// <summary>Override which Gemini model to call. Defaults to
    /// gemini-2.0-flash (see the project README / AI section).</summary>
    public string Model { get; set; } = "gemini-2.0-flash";

    /// <summary>H4 - max AI calls per org (or per user, for org-less
    /// calls) per UTC day. 0 disables the cap.</summary>
    public int DailyQuota { get; set; } = 500;
}
