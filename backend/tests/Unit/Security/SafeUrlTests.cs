using Application.Common;

namespace Unit.Security;

public class SafeUrlTests
{
    [Theory]
    [InlineData("https://github.com/acme/app/pull/42")]
    [InlineData("http://git.internal:8080/pr/7")]
    [InlineData("  https://github.com/acme/app/pull/42  ")]
    public void HttpUrls_AreAccepted(string url) => Assert.True(SafeUrl.IsHttp(url));

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("javascript:alert(1)")]
    [InlineData("JaVaScRiPt:alert(1)")]
    [InlineData("data:text/html,<script>alert(1)</script>")]
    [InlineData("/relative/path")]
    [InlineData("ftp://example.com/x")]
    [InlineData("https://")]
    public void EverythingElse_IsRejected(string? url) => Assert.False(SafeUrl.IsHttp(url));

    [Fact]
    public void OverlongUrls_AreRejected() =>
        Assert.False(SafeUrl.IsHttp("https://example.com/" + new string('a', SafeUrl.MaxLength)));
}