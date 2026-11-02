using ProjectHub.Application;
using Xunit;

namespace ProjectHub.Tests;

public class DownloadNameTests
{
    [Theory]
    [InlineData("Contract semnat", "scan.PDF", "Contract semnat.pdf")]
    [InlineData("Garanție & utilizare", "original.pdf", "Garanție & utilizare.pdf")]
    [InlineData("Plan.PDF", "original.pdf", "Plan.pdf")]
    [InlineData("..", "original.png", "Document.png")]
    [InlineData("CON", "original.pdf", "_CON.pdf")]
    [InlineData("Plan/etaj:1", "original.pdf", "Plan-etaj-1.pdf")]
    [InlineData("Plan\r\n\u202e", "original.pdf", "Plan.pdf")]
    public void UsesDisplayTitleAndRealExtensionWithSafeCharacters(string title, string original, string expected) => Assert.Equal(expected, FileRules.DownloadName(title, original));

    [Fact]
    public void LimitsUtf8LengthWithoutSplittingUnicodeCharacters()
    {
        var name = FileRules.DownloadName(string.Concat(Enumerable.Repeat("🏠", 100)), "original.png");
        Assert.True(System.Text.Encoding.UTF8.GetByteCount(name) <= 240);
        Assert.EndsWith(".png", name);
        Assert.DoesNotContain("�", name);
    }
}
