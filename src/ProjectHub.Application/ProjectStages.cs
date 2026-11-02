using ProjectHub.Domain;

namespace ProjectHub.Application;

public static class ProjectStages
{
    public static Guid? Current(Project project) => project.Milestones.OrderBy(m => m.OrderIndex).FirstOrDefault(m => !m.StageComplete)?.Id;

    public static bool Completed(Project project) => project.Milestones.Count > 0 && project.Milestones.All(m => m.StageComplete);

    public static void Select(Project project, Guid? stageId, bool allComplete)
    {
        var order = stageId == null ? (int?)null : project.Milestones.Single(m => m.Id == stageId).OrderIndex;
        foreach (var milestone in project.Milestones)
        {
            milestone.StageComplete = allComplete || (order.HasValue && milestone.OrderIndex < order.Value);
        }
    }

    public static void Normalize(Project project)
    {
        var incomplete = false;
        foreach (var milestone in project.Milestones.OrderBy(m => m.OrderIndex))
        {
            incomplete |= !milestone.StageComplete;
            if (incomplete)
            {
                milestone.StageComplete = false;
            }
        }
    }
}
