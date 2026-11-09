using Application.Features.Meetings.Commands;

namespace Unit.Security;

public class GuestDisplayNameTests
{
    [Theory]
    [InlineData(null, null)]
    [InlineData("   ", null)]
    [InlineData("\u0007\u0000", null)]
    [InlineData("  Ada  ", "Ada")]
    [InlineData("Ada\nLovelace", "AdaLovelace")]
    public void Sanitizes(string? input, string? expected) =>
        Assert.Equal(expected, JoinAsGuestCommandHandler.SanitizeDisplayName(input));

    [Fact]
    public void CapsTheLength()
    {
        var name = JoinAsGuestCommandHandler.SanitizeDisplayName(new string('x', 500));
        Assert.Equal(JoinAsGuestCommandHandler.MaxDisplayNameLength, name!.Length);
        Assert.Equal(80, JoinAsGuestCommandHandler.MaxDisplayNameLength);
    }
}