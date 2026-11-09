using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Primitives;

namespace Api.Middleware;

/// <summary>
/// H3 - a physical file provider that refuses to hand out anything under
/// an excluded directory. The decision is made on the resolved physical
/// path, so URL spellings that dodge a request-path prefix check
/// ("/uploads//tasks/...", "/uploads/./tasks/...") are refused too.
/// </summary>
public sealed class ExcludingFileProvider(PhysicalFileProvider inner, string excludedDirectory) : IFileProvider
{
    private readonly string _excluded =
        Path.TrimEndingDirectorySeparator(Path.GetFullPath(excludedDirectory)) + Path.DirectorySeparatorChar;

    public IFileInfo GetFileInfo(string subpath)
    {
        var file = inner.GetFileInfo(subpath);
        return file.PhysicalPath is { } path && IsExcluded(path) ? new NotFoundFileInfo(subpath) : file;
    }

    // Only static-file serving uses this provider (no directory browsing).
    public IDirectoryContents GetDirectoryContents(string subpath) => inner.GetDirectoryContents(subpath);

    public IChangeToken Watch(string filter) => inner.Watch(filter);

    private bool IsExcluded(string physicalPath) =>
        Path.GetFullPath(physicalPath).StartsWith(_excluded, StringComparison.OrdinalIgnoreCase);
}
