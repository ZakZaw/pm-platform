using System.Net;
using Integration.Infrastructure;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.DependencyInjection;

namespace Integration;

/// <summary>H3 - attachments are private, typed-checked at upload and served only as downloads.</summary>
[Collection(ApiCollection.Name)]
public class AttachmentTests(ApiFixture fx)
{
    private TestApi Api => fx.Api;

    private async Task<(TestUser Owner, Guid TaskId)> TaskAsync()
    {
        var owner = await Api.RegisterAsync();
        var org = await Api.CreateOrgAsync(owner);
        var project = await Api.CreateProjectAsync(owner, org);
        var task = await Api.CreateTaskAsync(owner, project.Id);
        return (owner, task.GetProperty("id").GetGuid());
    }

    [Theory]
    [InlineData("page.html", "text/html")]
    [InlineData("page.htm", "application/octet-stream")]
    [InlineData("logo.svg", "image/svg+xml")]
    [InlineData("innocent.png", "text/html")]
    [InlineData("script.js", "text/plain")]
    public async Task Renderable_or_executable_uploads_are_refused(string fileName, string contentType)
    {
        var (owner, taskId) = await TaskAsync();
        var resp = await SeededWorld.UploadRawAsync(owner.Client, taskId, fileName, contentType,
            "<html><script>alert(1)</script></html>"u8.ToArray());
        Assert.Equal(HttpStatusCode.UnsupportedMediaType, resp.StatusCode);
    }

    [Fact]
    public async Task Png_downloads_through_the_authorized_endpoint_as_an_attachment()
    {
        var (owner, taskId) = await TaskAsync();
        var uploaded = await SeededWorld.UploadAsync(owner.Client, taskId, "diagram.png", "image/png", SeededWorld.Png);
        var id = uploaded.GetProperty("id").GetGuid();
        var url = uploaded.GetProperty("url").GetString();
        Assert.Equal($"/api/v1/attachments/{id}/download", url);

        var resp = await owner.Client.GetAsync(url);
        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        Assert.Equal(SeededWorld.Png, await resp.Content.ReadAsByteArrayAsync());
        Assert.Equal("image/png", resp.Content.Headers.ContentType?.MediaType);
        Assert.Equal("attachment", resp.Content.Headers.ContentDisposition?.DispositionType);
        Assert.Equal("nosniff", resp.Headers.GetValues("X-Content-Type-Options").Single());
        Assert.Contains("sandbox", resp.Headers.GetValues("Content-Security-Policy").Single());

        // Stored outside wwwroot.
        Assert.True(Directory.EnumerateFiles(Api.Factory.PrivateUploadsRoot, "*diagram.png", SearchOption.AllDirectories).Any());

        // Non-members can't download it; anonymous callers can't either.
        var outsider = await Api.RegisterAsync();
        var denied = await outsider.Client.GetAsync(url);
        Assert.True(denied.StatusCode is HttpStatusCode.Forbidden or HttpStatusCode.NotFound, $"outsider got {(int)denied.StatusCode}");
        Assert.Equal(HttpStatusCode.Unauthorized, (await Api.Anonymous().GetAsync(url)).StatusCode);
    }

    [Fact]
    public async Task Unknown_types_are_served_as_octet_stream()
    {
        var (owner, taskId) = await TaskAsync();
        var uploaded = await SeededWorld.UploadAsync(owner.Client, taskId, "notes.bin", "application/x-weird", [1, 2, 3]);
        var resp = await owner.Client.GetAsync(uploaded.GetProperty("url").GetString());
        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        Assert.Equal("application/octet-stream", resp.Content.Headers.ContentType?.MediaType);
    }

    [Fact]
    public async Task Public_uploads_outside_tasks_are_still_served_with_nosniff()
    {
        var env = Api.Factory.Services.GetRequiredService<IWebHostEnvironment>();
        var name = "itest-" + Guid.NewGuid().ToString("N")[..8];
        var dir = Path.Combine(env.ContentRootPath, "wwwroot", "uploads", name);
        Directory.CreateDirectory(dir);
        await File.WriteAllBytesAsync(Path.Combine(dir, "avatar.png"), SeededWorld.Png);
        try
        {
            var resp = await Api.Anonymous().GetAsync($"/uploads/{name}/avatar.png");
            Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
            Assert.Equal("nosniff", resp.Headers.GetValues("X-Content-Type-Options").Single());
        }
        finally
        {
            Directory.Delete(dir, recursive: true);
        }
    }

    [Theory]
    [InlineData("/uploads/tasks/{0}")]
    [InlineData("/uploads/TASKS/{0}")]
    [InlineData("/uploads//tasks/{0}")]
    [InlineData("/uploads/%74asks/{0}")]
    [InlineData("/uploads/./tasks/{0}")]
    public async Task Legacy_static_attachment_paths_are_not_served(string pathTemplate)
    {
        // A pre-H3 attachment that still sits under wwwroot/uploads/tasks.
        var env = Api.Factory.Services.GetRequiredService<IWebHostEnvironment>();
        var dir = Path.Combine(env.ContentRootPath, "wwwroot", "uploads", "tasks", "itest-" + Guid.NewGuid().ToString("N")[..8]);
        Directory.CreateDirectory(dir);
        var file = Path.Combine(dir, "legacy.html");
        await File.WriteAllTextAsync(file, "<script>alert(1)</script>");
        try
        {
            var relative = Path.GetFileName(dir) + "/legacy.html";
            var resp = await Api.Anonymous().GetAsync(string.Format(pathTemplate, relative));
            Assert.Equal(HttpStatusCode.NotFound, resp.StatusCode);
            Assert.DoesNotContain("alert", await resp.Content.ReadAsStringAsync());
        }
        finally
        {
            Directory.Delete(dir, recursive: true);
        }
    }
}
