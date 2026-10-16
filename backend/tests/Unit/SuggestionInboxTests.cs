using Application.Features.AI;

namespace Unit;

public class SuggestionInboxTests
{
    [Theory]
    [InlineData("sprint.health", "Sprint")]
    [InlineData("sprint.replan", "Sprint")]
    [InlineData("task.blocked.cascade", "Task")]
    [InlineData("member.unavailable", "Team")]
    [InlineData("support.sla.breach", "SLA")]
    [InlineData("sales.deal.stuck", "Pipeline")]
    [InlineData("marketing.asset.overdue", "Content")]
    [InlineData("operations.run.overdue", "Runs")]
    [InlineData("SPRINT.HEALTH", "Sprint")]
    [InlineData("something.new", "Other")]
    [InlineData("", "Other")]
    [InlineData(null, "Other")]
    public void CategoryFor_MapsKindPrefix(string? kind, string expected) =>
        Assert.Equal(expected, SuggestionInbox.CategoryFor(kind));

    [Fact]
    public void Dto_ExposesDerivedCategory()
    {
        var dto = new AISuggestionDto(
            Guid.NewGuid(), Guid.NewGuid(), "Support", "support.sla.breach",
            "t", null, null, "Open", DateTime.UtcNow, null, "rule");
        Assert.Equal("SLA", dto.Category);
    }

    private record Item(string Type, DateTime At, string Name);

    [Fact]
    public void GroupByType_UsesCanonicalTypeOrder_NewestFirst()
    {
        var t0 = new DateTime(2026, 10, 1);
        var groups = SuggestionInbox.GroupByType(
        [
            new Item("Support", t0, "s-old"),
            new Item("Engineering", t0, "e1"),
            new Item("Support", t0.AddDays(2), "s-new"),
            new Item("Sales", t0, "sa"),
            new Item("Mystery", t0, "m"),
        ], i => i.Type, i => i.At);

        Assert.Equal(["Engineering", "Sales", "Support", "Mystery"], groups.Select(g => g.ProjectType));
        var support = groups.Single(g => g.ProjectType == "Support").Items;
        Assert.Equal(["s-new", "s-old"], support.Select(i => i.Name));
    }

    [Fact]
    public void GroupByType_Empty_IsEmpty() =>
        Assert.Empty(SuggestionInbox.GroupByType(Array.Empty<Item>(), i => i.Type, i => i.At));
}
