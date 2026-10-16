using Application.Features.Attachments;

namespace Unit.Security;

public class AttachmentFilePolicyTests
{
    [Theory]
    [InlineData("page.html", "text/plain")]
    [InlineData("PAGE.HTM", null)]
    [InlineData("logo.svg", "image/png")]
    [InlineData("feed.xml", "application/octet-stream")]
    [InlineData("x.js", null)]
    [InlineData("innocent.png", "text/html")]
    [InlineData("innocent.bin", "image/svg+xml")]
    [InlineData("data.dat", "application/xhtml+xml")]
    public void ActiveContent_IsBlocked(string name, string? type) =>
        Assert.True(AttachmentFilePolicy.IsBlocked(name, type));

    [Theory]
    [InlineData("spec.pdf", "application/pdf")]
    [InlineData("shot.png", "image/png")]
    [InlineData("notes.txt", "text/plain")]
    [InlineData("archive.zip", "application/zip")]
    [InlineData("report.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")]
    public void OrdinaryFiles_AreAllowed(string name, string type) =>
        Assert.False(AttachmentFilePolicy.IsBlocked(name, type));

    [Theory]
    [InlineData("image/png", "image/png")]
    [InlineData("application/pdf; charset=binary", "application/pdf")]
    [InlineData("text/html", "application/octet-stream")]
    [InlineData("application/x-msdownload", "application/octet-stream")]
    [InlineData(null, "application/octet-stream")]
    public void ResponseContentType_FallsBackToOctetStream(string? stored, string expected) =>
        Assert.Equal(expected, AttachmentFilePolicy.ResponseContentType(stored));
}