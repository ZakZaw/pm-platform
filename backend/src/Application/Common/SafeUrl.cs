namespace Application.Common;

/// <summary>
/// L6 - user-supplied links (PR URLs, ...) end up in <c>href</c>s, so only
/// absolute http(s) URLs are accepted; <c>javascript:</c>, <c>data:</c>
/// and relative values are rejected.
/// </summary>
public static class SafeUrl
{
    public const int MaxLength = 512;

    public static bool IsHttp(string? value) =>
        !string.IsNullOrWhiteSpace(value)
        && value.Length <= MaxLength
        && Uri.TryCreate(value.Trim(), UriKind.Absolute, out var uri)
        && (uri.Scheme == Uri.UriSchemeHttps || uri.Scheme == Uri.UriSchemeHttp)
        && !string.IsNullOrEmpty(uri.Host);
}