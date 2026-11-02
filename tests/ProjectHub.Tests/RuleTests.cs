using ProjectHub.Application;
using Xunit;

namespace ProjectHub.Tests;

public class RuleTests
{
    [Theory]
    [InlineData(".jpg", "<script>alert(1)</script>")]
    [InlineData(".pdf", "fake pdf body")]
    [InlineData(".svg", "<svg onload='attack'/>")]
    [InlineData(".html", "<html>attack</html>")]
    public void RejectsDisguisedOrActiveFiles(string extension, string body) => Assert.Null(FileRules.ContentType(extension, System.Text.Encoding.UTF8.GetBytes(body)));

    [Fact]
    public void AcceptsPdfSignature() => Assert.Equal("application/pdf", FileRules.ContentType(".pdf", "%PDF-1.7\nexample"u8.ToArray()));

    [Fact]
    public void DescriptionIsOptionalAndManagerIsRequired()
    {
        var r = new ProjectChanges("Test", "", "Descriere", null, "manager-id");
        Assert.True(r.Valid());
        Assert.True((r with { Description = "" }).Valid());
        Assert.True((r with { Description = null }).Valid());
        Assert.False((r with { Description = new string('x', 6001) }).Valid());
        Assert.False((r with { ManagerUserId = "" }).Valid());
    }

    [Theory]
    [InlineData("abcde1", true)]
    [InlineData("ABCDEF1", true)]
    [InlineData("abcde", false)]
    [InlineData("abcdef", false)]
    [InlineData("123456", false)]
    [InlineData("a1234", false)]
    public void PasswordPolicyMatchesAgreedBasicConditions(string value, bool valid)
    {
        var error = Record.Exception(() => CredentialRules.Password(value));
        if (valid)
        {
            Assert.Null(error);
        }
        else
        {
            Assert.IsType<PortalException>(error);
        }
    }
}
