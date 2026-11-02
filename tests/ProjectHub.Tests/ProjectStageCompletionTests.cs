using ProjectHub.Application;
using ProjectHub.Domain;
using Xunit;

namespace ProjectHub.Tests;

public class ProjectStageCompletionTests
{
    [Fact]
    public void MovingForwardCompletesEveryPreviousStageAndMovingBackReopensLaterStages()
    {
        var project = new Project
        {
            Milestones = Enumerable.Range(0, 4).Select(i => new Milestone { OrderIndex = i }).ToList()
        };
        ProjectStages.Select(project, project.Milestones[3].Id, false);
        Assert.Equal(new[] { true, true, true, false }, project.Milestones.Select(m => m.StageComplete));
        Assert.Equal(project.Milestones[3].Id, ProjectStages.Current(project));
        ProjectStages.Select(project, project.Milestones[1].Id, false);
        Assert.Equal(new[] { true, false, false, false }, project.Milestones.Select(m => m.StageComplete));
        ProjectStages.Select(project, null, true);
        Assert.All(project.Milestones, m => Assert.True(m.StageComplete));
        Assert.True(ProjectStages.Completed(project));
        Assert.Null(ProjectStages.Current(project));
    }

    [Fact]
    public void AddingAnIncompleteStageReopensCompletedProjectAndReorderKeepsCompletionSequential()
    {
        var project = new Project
        {
            Milestones = [new()
            {
                OrderIndex = 0,
                StageComplete = true
            }, new()
            {
                OrderIndex = 1,
                StageComplete = true
            }

            ]
        };
        project.Milestones.Add(new() { OrderIndex = 2 });
        Assert.False(ProjectStages.Completed(project));
        Assert.Equal(project.Milestones[2].Id, ProjectStages.Current(project));
        project.Milestones[2].OrderIndex = -1;
        ProjectStages.Normalize(project);
        Assert.All(project.Milestones, m => Assert.False(m.StageComplete));
    }
}
