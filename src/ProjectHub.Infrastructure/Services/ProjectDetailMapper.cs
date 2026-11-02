using ProjectHub.Application;
using ProjectHub.Domain;

namespace ProjectHub.Infrastructure;

internal static class ProjectDetailMapper
{
    public static ProjectDto Project(Project project, AccountContact? manager, AccountContact? clientContact, bool isManager)
    {
        var milestones = project.Milestones.OrderBy(stage => stage.OrderIndex).Select(stage => new MilestoneDto(stage.Id, stage.Name, stage.OrderIndex, stage.Description, stage.StageComplete)).ToList();
        return new ProjectDto(project.Id, project.Code, project.Name, project.Location, project.Description, manager?.DisplayName ?? "", manager?.PhoneNumber ?? "", ProjectStages.Current(project), project.UpdatedAt, project.ClientId, milestones, isManager ? project.ManagerUserId : null, project.NextMaintenanceDate, ProjectStages.Completed(project), manager?.Email, clientContact?.DisplayName, clientContact?.Email, clientContact?.PhoneNumber);
    }

    public static FolderDto Folder(DocumentFolder folder, IEnumerable<DocumentFolder> tree, bool isManager)
    {
        var policy = SharedFolders.Policy(tree, folder.Id);
        return new(folder.Id, folder.Name, !isManager && folder.SectionKey != null ? null : folder.ParentId, folder.SectionKey, policy?.ClientVisible == true, policy?.ClientCanUpload == true, isManager, policy?.ImagesOnly == true);
    }

    public static List<FileDto> Files(IEnumerable<ProjectFile> files, IReadOnlyList<FileContent> contents, bool activityAttachment = false)
    {
        var byFile = contents.ToDictionary(content => content.ProjectFileId);
        return files.Select(file =>
        {
            var content = byFile[file.Id];
            return new FileDto(file.Id, file.Title, file.FolderId, new FileContentDto(content.Id, content.FileName, content.ContentType, content.Size, content.CreatedAt, content.Sha256), activityAttachment);
        }).ToList();
    }
}
