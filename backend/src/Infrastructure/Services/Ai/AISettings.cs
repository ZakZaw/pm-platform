namespace Infrastructure.Services.Ai;

public class AISettings
{
    /// <summary>API key for Google Gemini in dev. When null/empty we fall
    /// back to the in-process stub provider so local dev still works.</summary>
    public string? GeminiApiKey { get; set; }

    /// <summary>Override which Gemini model to call. Defaults to
    /// gemini-2.0-flash per CLAUDE.md.</summary>
    public string Model { get; set; } = "gemini-2.0-flash";
}
