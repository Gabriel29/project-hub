using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ProjectHub.Application;

namespace ProjectHub.WebAPI;

public partial class FilesController
{
    [HttpPost, Authorize(Policy = PortalRoles.Manage), RequestSizeLimit(27_000_000)]
    public async Task<UploadResult> UploadAsync(Guid projectId, [FromForm] UploadRequest request, CancellationToken ct)
    {
        if (request.File == null || request.File.Length is <= 0 or > 25_000_000)
        {
            throw new PortalException(400, "invalidFileSize");
        }

        var content = new byte[checked((int)request.File.Length)];
        await using var input = request.File.OpenReadStream();
        await input.ReadExactlyAsync(content, ct);
        return await uploads.UploadAsync(projectId, new(request.Title, request.FolderId, request.FileId, request.File.FileName, content, request.CalendarPhoto, request.SectionKey), ct);
    }

    [HttpPost("folders"), Authorize(Policy = PortalRoles.Manage)]
    public async Task<IActionResult> FolderAsync(Guid projectId, FolderRequest request, CancellationToken ct = default)
    {
        await folders.CreateFolderAsync(projectId, request, ct);
        return Ok();
    }

    [HttpPut("folders/{folderId:guid}/name"), Authorize(Policy = PortalRoles.Manage)]
    public async Task<IActionResult> RenameFolderAsync(Guid projectId, Guid folderId, RenameFolderRequest request, CancellationToken ct = default)
    {
        await folders.RenameFolderAsync(projectId, folderId, request, ct);
        return Ok();
    }

    [HttpPut("{fileId:guid}/name"), Authorize(Policy = PortalRoles.Manage)]
    public async Task<IActionResult> RenameAsync(Guid projectId, Guid fileId, RenameFileRequest request, CancellationToken ct = default)
    {
        await service.RenameAsync(projectId, fileId, request, ct);
        return Ok();
    }

    [HttpPut("{fileId:guid}/folder"), Authorize(Policy = PortalRoles.Manage)]
    public async Task<IActionResult> MoveAsync(Guid projectId, Guid fileId, MoveFileRequest request, CancellationToken ct = default)
    {
        await service.MoveAsync(projectId, fileId, request, ct);
        return Ok();
    }

    [HttpPut("folders/{folderId:guid}/parent"), Authorize(Policy = PortalRoles.Manage)]
    public async Task<IActionResult> MoveFolderAsync(Guid projectId, Guid folderId, MoveFileRequest request, CancellationToken ct = default)
    {
        await folders.MoveFolderAsync(projectId, folderId, request, ct);
        return Ok();
    }

    [HttpDelete("folders/{folderId:guid}"), Authorize(Policy = PortalRoles.Manage)]
    public async Task<IActionResult> DeleteFolderAsync(Guid projectId, Guid folderId, CancellationToken ct = default)
    {
        await folders.DeleteFolderAsync(projectId, folderId, ct);
        return Ok();
    }

    [HttpDelete("{fileId:guid}"), Authorize(Policy = PortalRoles.Manage)]
    public async Task<IActionResult> DeleteAsync(Guid projectId, Guid fileId, CancellationToken ct = default)
    {
        await service.DeleteAsync(projectId, fileId, ct);
        return Ok();
    }
}
