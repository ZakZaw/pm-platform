namespace Application.Features.Attachments;

/// <summary>
/// H3 - what may be uploaded as a task attachment and how it is served
/// back. Files are only ever downloaded through the authorized endpoint
/// with <c>Content-Disposition: attachment</c>, <c>nosniff</c> and a
/// sandbox CSP; on top of that, types a browser would execute or render
/// as a document (HTML, SVG, XML, scripts) are refused at upload.
/// </summary>
public static class AttachmentFilePolicy
{
    private static readonly HashSet<string> BlockedExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".html", ".htm", ".xhtml", ".shtml", ".mht", ".mhtml",
        ".svg", ".svgz", ".xml", ".xsl", ".xslt",
        ".js", ".mjs", ".cjs", ".hta", ".swf",
    };

    private static readonly HashSet<string> BlockedTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "text/xml", "application/xml", "text/xsl", "application/x-shockwave-flash",
    };

    /// <summary>Content types safe to send back as-is (still as an attachment).</summary>
    private static readonly HashSet<string> PassThroughTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "image/png", "image/jpeg", "image/gif", "image/webp",
        "application/pdf", "text/plain", "text/csv",
    };

    public const string FallbackContentType = "application/octet-stream";

    public static bool IsBlocked(string fileName, string? contentType)
    {
        var ext = Path.GetExtension(fileName ?? string.Empty);
        if (!string.IsNullOrEmpty(ext) && BlockedExtensions.Contains(ext))
            return true;

        // Match on the bare media type: "+xml" suffix types (SVG, XHTML,
        // XSLT, ...), anything HTML, any script type, and plain XML. A
        // substring test for "xml" would wrongly catch Office's
        // "openxmlformats" types.
        var type = (contentType ?? string.Empty).Split(';')[0].Trim().ToLowerInvariant();
        return BlockedTypes.Contains(type)
            || type.EndsWith("+xml", StringComparison.Ordinal)
            || type.Contains("html")
            || type.Contains("javascript")
            || type.Contains("ecmascript");
    }

    /// <summary>The Content-Type to use when serving a stored attachment.</summary>
    public static string ResponseContentType(string? storedType)
    {
        var bare = (storedType ?? string.Empty).Split(';')[0].Trim();
        return PassThroughTypes.Contains(bare) ? bare : FallbackContentType;
    }

    public static string DownloadUrl(Guid attachmentId) => $"/api/v1/attachments/{attachmentId}/download";
}