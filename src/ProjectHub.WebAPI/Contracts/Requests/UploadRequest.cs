using System.ComponentModel.DataAnnotations;

namespace ProjectHub.WebAPI;

public class UploadRequest
{
    [Required]
    public IFormFile? File { get; set; }

    [Required, StringLength(200)]
    public string Title { get; set; } = "";
    public string? SectionKey { get; set; }
    public bool CalendarPhoto { get; set; }
    public Guid? FolderId { get; set; }
    public Guid? FileId { get; set; }
}
