using Application.Features.Sprints.Commands;
using DomainTaskStatus = Domain.Enums.TaskStatus;

namespace Unit;

public class SprintCloseCarryoverTests
{
    [Theory]
    [InlineData(DomainTaskStatus.Backlog, true)]
    [InlineData(DomainTaskStatus.ToDo, true)]
    [InlineData(DomainTaskStatus.InProgress, true)]
    [InlineData(DomainTaskStatus.InReview, true)]
    [InlineData(DomainTaskStatus.Blocked, true)]
    [InlineData(DomainTaskStatus.Done, false)]
    [InlineData(DomainTaskStatus.WontDo, false)]
    public void OnlyUnfinishedWork_CarriesOver(DomainTaskStatus status, bool carries) =>
        Assert.Equal(carries, CloseSprintCommandHandler.IsCarryover(status));
}