using Application.Features.Integrations;

namespace Unit;

/// <summary>
/// F2-23 — the branch / PR-title → task-key parser is the linchpin of
/// the GitHub webhook wiring, so it gets focused coverage here.
/// </summary>
public class GitTaskKeyParserTests
{
    [Theory]
    [InlineData("feat/AT-247-add-login", "AT", 247)]
    [InlineData("AT-247", "AT", 247)]
    [InlineData("Fix AT-247: flaky test", "AT", 247)]
    [InlineData("bugfix/PROJ-1", "PROJ", 1)]
    [InlineData("refs/heads/feature/WEB-1099-thing", "WEB", 1099)]
    public void Parse_extracts_first_key(string input, string expectedKey, int expectedNum)
    {
        var result = GitTaskKeyParser.Parse(input);

        Assert.NotNull(result);
        Assert.Equal(expectedKey, result!.Value.ProjectKey);
        Assert.Equal(expectedNum, result.Value.KeyNum);
    }

    [Fact]
    public void Parse_uppercases_the_key_so_lowercased_branches_still_match()
    {
        var result = GitTaskKeyParser.Parse("feat/at-247-add-login");

        Assert.NotNull(result);
        Assert.Equal("AT", result!.Value.ProjectKey);
        Assert.Equal(247, result.Value.KeyNum);
    }

    [Theory]
    [InlineData("feature/no-key-here")]
    [InlineData("release/v1.2.3")]
    [InlineData("main")]
    [InlineData("")]
    [InlineData(null)]
    public void Parse_returns_null_when_no_key_present(string? input)
    {
        Assert.Null(GitTaskKeyParser.Parse(input));
    }

    [Fact]
    public void Parse_takes_the_first_key_when_several_appear()
    {
        var result = GitTaskKeyParser.Parse("AT-247 depends on AT-9");

        Assert.Equal("AT", result!.Value.ProjectKey);
        Assert.Equal(247, result.Value.KeyNum);
    }

    [Fact]
    public void ParseAll_returns_distinct_keys_in_first_seen_order()
    {
        var all = GitTaskKeyParser.ParseAll("AT-1 and AT-2 and AT-1 again, plus WEB-5");

        Assert.Collection(all,
            r => { Assert.Equal("AT", r.ProjectKey); Assert.Equal(1, r.KeyNum); },
            r => { Assert.Equal("AT", r.ProjectKey); Assert.Equal(2, r.KeyNum); },
            r => { Assert.Equal("WEB", r.ProjectKey); Assert.Equal(5, r.KeyNum); });
    }

    [Fact]
    public void ParseAll_is_empty_for_keyless_text()
    {
        Assert.Empty(GitTaskKeyParser.ParseAll("just a normal branch name"));
    }
}
