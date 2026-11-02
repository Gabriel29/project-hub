using System.IO.Compression;
using ProjectHub.Application;
using Xunit;

namespace ProjectHub.Tests;

public sealed class OfficePackageTests
{
    [Theory]
    [InlineData(".docx", "word/document.xml", "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml")]
    [InlineData(".xlsx", "xl/workbook.xml", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml")]
    public void ValidatesOfficePackageContentTypes(string extension, string document, string contentType)
    {
        var bytes = Package(document, contentType);
        Assert.Equal("application/octet-stream", FileRules.ContentType(extension, bytes));
        Assert.Null(FileRules.ContentType(extension == ".docx" ? ".xlsx" : ".docx", bytes));
        Assert.Null(FileRules.ContentType(extension, Package(document, "application/octet-stream")));
        Assert.Null(FileRules.ContentType(extension, Package(document, contentType, macro: true)));
    }

    [Fact]
    public void RejectsArbitraryZipAndMalformedPackages()
    {
        Assert.Null(FileRules.ContentType(".docx", Package("data.txt", "text/plain")));
        Assert.Null(FileRules.ContentType(".xlsx", "PK\u0003\u0004not really a zip"u8.ToArray()));
    }

    private static byte[] Package(string path, string type, bool macro = false)
    {
        using var stream = new MemoryStream();
        using (var archive = new ZipArchive(stream, ZipArchiveMode.Create, leaveOpen: true))
        {
            using (var writer = new StreamWriter(archive.CreateEntry("[Content_Types].xml").Open()))
            {
                writer.Write($"<Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\"><Override PartName=\"/{path}\" ContentType=\"{type}\" /></Types>");
            }

            using (var writer = new StreamWriter(archive.CreateEntry(path).Open()))
            {
                writer.Write("<document />");
            }

            using (var writer = new StreamWriter(archive.CreateEntry("_rels/.rels").Open()))
            {
                writer.Write("<Relationships />");
            }

            if (macro)
            {
                archive.CreateEntry("word/vbaProject.bin");
            }
        }

        return stream.ToArray();
    }
}
