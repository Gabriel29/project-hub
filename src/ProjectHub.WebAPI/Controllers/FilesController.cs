using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ProjectHub.Infrastructure;

namespace ProjectHub.WebAPI;

[ApiController, Route("api/projects/{projectId:guid}/files"), Authorize]
public partial class FilesController(FileService service, FolderService folders, UploadService uploads, DownloadService downloads) : ControllerBase
{
    [HttpGet("{fileId:guid}/content")]
    public async Task<IActionResult> DownloadAsync(Guid projectId, Guid fileId, [FromQuery] bool inline, CancellationToken ct)
    {
        var r = await downloads.DownloadAsync(projectId, fileId, inline, ct);
        Response.RegisterForDispose(r.File.Owner);
        if (!r.Inline)
        {
            return File(r.File.Body, r.File.ContentType, r.FileName);
        }

        var disposition = new Microsoft.Net.Http.Headers.ContentDispositionHeaderValue("inline");
        disposition.SetHttpFileName(r.FileName);
        Response.Headers.ContentDisposition = disposition.ToString();
        return File(r.File.Body, r.File.ContentType);
    }
}
