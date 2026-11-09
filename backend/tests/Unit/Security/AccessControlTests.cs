using Application.Authorization;
using Application.Interfaces;
using Domain.Enums;
using Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Unit.Security;

public class AccessPolicyTests
{
    private static readonly Guid User = Guid.NewGuid();
    private static readonly Guid Org = Guid.NewGuid();
    private static readonly AccessPrincipal Caller = new(User, null);

    private static ProjectAccessFacts OrgProject(ProjectRole? role, bool activeOrg = true) =>
        new(IsPersonal: false, OwnerUserId: null, OrganizationId: Org, HasActiveOrgMembership: activeOrg, ProjectRole: role);

    [Fact]
    public void MissingProject_IsNotFound()
    {
        var r = AccessPolicy.EvaluateProject(null, Caller, ProjectRole.Viewer);
        Assert.Equal("Project.NotFound", r.Error!.Code);
    }

    [Theory]
    [InlineData(ProjectRole.PM, ProjectRole.Viewer, true)]
    [InlineData(ProjectRole.Viewer, ProjectRole.Viewer, true)]
    [InlineData(ProjectRole.Contributor, ProjectRole.Contributor, true)]
    [InlineData(ProjectRole.Viewer, ProjectRole.Contributor, false)]
    [InlineData(ProjectRole.Contributor, ProjectRole.TeamLead, false)]
    [InlineData(ProjectRole.TeamLead, ProjectRole.PM, false)]
    public void ProjectRole_MustMeetMinimum(ProjectRole actual, ProjectRole minimum, bool allowed)
    {
        var r = AccessPolicy.EvaluateProject(OrgProject(actual), Caller, minimum);
        Assert.Equal(allowed, r.IsSuccess);
        if (!allowed) Assert.Equal("Project.InsufficientRole", r.Error!.Code);
    }

    [Fact]
    public void NonMember_IsForbidden()
    {
        var r = AccessPolicy.EvaluateProject(OrgProject(null), Caller, ProjectRole.Viewer);
        Assert.Equal("Project.NotAMember", r.Error!.Code);
    }

    [Fact]
    public void RemovedFromOrg_LosesProjectAccess_EvenWithStaleProjectRow()
    {
        var r = AccessPolicy.EvaluateProject(OrgProject(ProjectRole.PM, activeOrg: false), Caller, ProjectRole.Viewer);
        Assert.Equal("Project.NotAMember", r.Error!.Code);
    }

    [Fact]
    public void PersonalProject_OnlyOwner()
    {
        var owned = new ProjectAccessFacts(true, User, null, false, null);
        var foreign = new ProjectAccessFacts(true, Guid.NewGuid(), null, false, null);

        Assert.True(AccessPolicy.EvaluateProject(owned, Caller, ProjectRole.PM).IsSuccess);
        Assert.False(AccessPolicy.EvaluateProject(foreign, Caller, ProjectRole.Viewer).IsSuccess);
    }

    [Fact]
    public void ApiKey_IsConfinedToItsOrg()
    {
        var inOrg = new AccessPrincipal(User, Org);
        var otherOrg = new AccessPrincipal(User, Guid.NewGuid());

        Assert.True(AccessPolicy.EvaluateProject(OrgProject(ProjectRole.PM), inOrg, ProjectRole.PM).IsSuccess);
        Assert.False(AccessPolicy.EvaluateProject(OrgProject(ProjectRole.PM), otherOrg, ProjectRole.Viewer).IsSuccess);
        Assert.False(AccessPolicy.EvaluateOrg(new OrgAccessFacts(Org, OrgRole.Owner), otherOrg, OrgRole.Guest).IsSuccess);
    }

    [Fact]
    public void ApiKey_CannotReachPersonalProjects()
    {
        var owned = new ProjectAccessFacts(true, User, null, false, null);
        Assert.False(AccessPolicy.EvaluateProject(owned, new AccessPrincipal(User, Org), ProjectRole.Viewer).IsSuccess);
    }

    [Theory]
    [InlineData(OrgRole.Owner, OrgRole.Admin, true)]
    [InlineData(OrgRole.Admin, OrgRole.Admin, true)]
    [InlineData(OrgRole.Member, OrgRole.Admin, false)]
    [InlineData(OrgRole.Guest, OrgRole.Member, false)]
    [InlineData(OrgRole.Guest, OrgRole.Guest, true)]
    public void OrgRole_MustMeetMinimum(OrgRole actual, OrgRole minimum, bool allowed)
    {
        var r = AccessPolicy.EvaluateOrg(new OrgAccessFacts(Org, actual), Caller, minimum);
        Assert.Equal(allowed, r.IsSuccess);
    }

    [Fact]
    public void Org_NonMemberOrMissing()
    {
        Assert.Equal("Org.NotAMember", AccessPolicy.EvaluateOrg(new OrgAccessFacts(Org, null), Caller, OrgRole.Guest).Error!.Code);
        Assert.Equal("Org.NotFound", AccessPolicy.EvaluateOrg(null, Caller, OrgRole.Guest).Error!.Code);
    }
}

/// <summary>
/// The id → project/org resolvers must translate to SQL for every scope.
/// <c>ToQueryString()</c> runs the full EF/Npgsql translation pipeline
/// without opening a connection, so a broken join or an unmapped scope
/// fails here instead of as a 500 at runtime.
/// </summary>
public class AccessControlResolverTests
{
    private sealed class NoUser : ICurrentUser
    {
        public Guid? UserId => null;
        public bool IsAuthenticated => false;
        public Guid? ApiKeyOrgId => null;
    }

    private static AccessControl Create()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql("Host=localhost;Database=unused;Username=unused;Password=unused")
            .Options;
        return new AccessControl(new AppDbContext(options), new NoUser());
    }

    public static IEnumerable<object[]> ProjectScopes() =>
        Enum.GetValues<ProjectScope>().Select(s => new object[] { s });

    public static IEnumerable<object[]> OrgScopes() =>
        Enum.GetValues<OrgScope>().Where(s => s != OrgScope.Slug).Select(s => new object[] { s });

    [Theory]
    [MemberData(nameof(ProjectScopes))]
    public void EveryProjectScope_Translates(ProjectScope scope)
    {
        var sql = Create().ProjectIdQuery(scope, Guid.NewGuid()).ToQueryString();
        Assert.Contains("SELECT", sql);
    }

    [Theory]
    [MemberData(nameof(OrgScopes))]
    public void EveryOrgScope_Translates(OrgScope scope)
    {
        var sql = Create().OrgIdQuery(scope, Guid.NewGuid()).ToQueryString();
        Assert.Contains("SELECT", sql);
    }

    [Fact]
    public void ChecklistItem_ResolvesThroughRunAndWorkflow()
    {
        var sql = Create().ProjectIdQuery(ProjectScope.ChecklistItem, Guid.NewGuid()).ToQueryString();
        Assert.Contains("workflow_runs", sql, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("workflows", sql, StringComparison.OrdinalIgnoreCase);
    }
}
