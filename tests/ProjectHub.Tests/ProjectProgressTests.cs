using ProjectHub.Domain;
using ProjectHub.Application;
using Xunit;

namespace ProjectHub.Tests;

public class ProjectProgressTests
{
    [Fact]
    public void ProjectContractsExposeStepsWithoutPercentage()
    {
        Assert.Null(typeof(Project).GetProperty("Progress"));
        Assert.Null(typeof(ProjectDto).GetProperty("Progress"));
        Assert.Null(typeof(ProjectSummary).GetProperty("Progress"));
        Assert.NotNull(typeof(ProjectDto).GetProperty("StageId"));
        Assert.NotNull(typeof(ProjectDto).GetProperty("Milestones"));
    }
}
