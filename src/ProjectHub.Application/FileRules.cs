using System.IO.Compression;
using System.Xml;
using System.Xml.Linq;

namespace ProjectHub.Application;

public static class FileRules
{
    public static string DownloadName(string title, string originalName)
    {
        var extension = Path.GetExtension(originalName).ToLowerInvariant();
        var name = title.Normalize(System.Text.NormalizationForm.FormC);
        name = string.Concat(name.EnumerateRunes().Select(r => System.Text.Rune.GetUnicodeCategory(r) is System.Globalization.UnicodeCategory.Control or System.Globalization.UnicodeCategory.Format ? "" : "<>:\"/\\|?*".Contains(r.ToString(), StringComparison.Ordinal) ? "-" : r.ToString())).Trim(' ', '.');
        if (name.EndsWith(extension, StringComparison.OrdinalIgnoreCase) && extension.Length > 0)
        {
            name = name[..^extension.Length].Trim(' ', '.');
        }

        if (string.IsNullOrWhiteSpace(name))
        {
            name = "Document";
        }

        var stem = name.Split('.')[0].ToUpperInvariant();
        if (stem is "CON" or "PRN" or "AUX" or "NUL" || (stem.Length == 4 && (stem.StartsWith("COM") || stem.StartsWith("LPT")) && stem[3] is >= '1' and <= '9'))
        {
            name = "_" + name;
        }

        var safe = new System.Text.StringBuilder();
        var bytes = 0;
        foreach (var rune in name.EnumerateRunes())
        {
            if (bytes + rune.Utf8SequenceLength > 240 - System.Text.Encoding.UTF8.GetByteCount(extension))
            {
                break;
            }

            safe.Append(rune.ToString());
            bytes += rune.Utf8SequenceLength;
        }

        return safe.ToString().TrimEnd(' ', '.') + extension;
    }

    public static string? ContentType(string ext, byte[] b)
    {
        if (b.Length < 12)
        {
            return null;
        }

        if (ext == ".pdf" && b.AsSpan(0, 5).SequenceEqual("%PDF-"u8))
        {
            return "application/pdf";
        }

        if (ext is ".jpg" or ".jpeg" && b[0] == 255 && b[1] == 216 && b[2] == 255)
        {
            return "image/jpeg";
        }

        if (ext == ".png" && b.AsSpan(0, 8).SequenceEqual(new byte[] { 137, 80, 78, 71, 13, 10, 26, 10 }))
        {
            return "image/png";
        }

        if (ext == ".webp" && b.AsSpan(0, 4).SequenceEqual("RIFF"u8) && b.AsSpan(8, 4).SequenceEqual("WEBP"u8))
        {
            return "image/webp";
        }

        if (ext is ".docx" or ".xlsx" && ValidOfficePackage(ext, b))
        {
            return "application/octet-stream";
        }

        return null;
    }

    private static bool ValidOfficePackage(string extension, byte[] bytes)
    {
        try
        {
            using var stream = new MemoryStream(bytes, writable: false);
            using var archive = new ZipArchive(stream, ZipArchiveMode.Read);
            if (archive.Entries.Count is 0 or > 2048)
            {
                return false;
            }

            if (archive.Entries.Sum(e => e.Length) > 100_000_000 || archive.Entries.Any(e => e.Length > 25_000_000 || e.FullName.Contains("..", StringComparison.Ordinal) || e.FullName.Contains("vbaProject", StringComparison.OrdinalIgnoreCase)))
            {
                return false;
            }

            if (archive.Entries.Select(e => e.FullName).Distinct(StringComparer.Ordinal).Count() != archive.Entries.Count)
            {
                return false;
            }

            var documentPath = extension == ".docx" ? "word/document.xml" : "xl/workbook.xml";
            if (archive.GetEntry(documentPath) == null || archive.GetEntry("_rels/.rels") == null)
            {
                return false;
            }

            var types = archive.GetEntry("[Content_Types].xml");
            if (types == null || types.Length > 256_000)
            {
                return false;
            }

            using var content = types.Open();
            using var reader = XmlReader.Create(content, new XmlReaderSettings { DtdProcessing = DtdProcessing.Prohibit, XmlResolver = null, MaxCharactersInDocument = 256_000 });
            var document = XDocument.Load(reader);
            var expected = extension == ".docx" ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml";
            XNamespace ns = "http://schemas.openxmlformats.org/package/2006/content-types";
            return document.Root?.Elements(ns + "Override").Any(e => (string?)e.Attribute("PartName") == "/" + documentPath && (string?)e.Attribute("ContentType") == expected) == true;
        }
        catch (Exception exception) when (exception is InvalidDataException or IOException or XmlException or OverflowException)
        {
            return false;
        }
    }
}
