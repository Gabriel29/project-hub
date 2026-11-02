using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using ProjectHub.Infrastructure;
using Xunit;

namespace ProjectHub.Tests;

public partial class PortalFlowTests
{
    [Fact]
    public async Task ReadWorkflowsLeaveContextDetachedInsideTransaction()
    {
        using var factory = new PortalFactory();
        using var owner = Client(factory);
        await SetupAsync(owner);
        var account = await Post(owner, "/api/admin/users", new { name = "Client" });
        var clientId = account.GetProperty("clientId").GetGuid();
        var created = await Post(owner, "/api/projects", ProjectBody("Tracking", clientId));
        var projectId = created.GetProperty("id").GetGuid();
        await Post(owner, $"/api/projects/{projectId}/files/folders", new { name = "Child" });
        await UploadAsync(owner, projectId.ToString(), null);
        await Post(owner, $"/api/projects/{projectId}/notes", new { title = "Original note", body = "Body" });
        await Post(owner, $"/api/projects/{projectId}/updates", new { title = "Original activity", details = "Details" });
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PortalDb>();
        var clientUserId = await db.Clients.AsNoTracking().Where(client => client.Id == clientId).Select(client => client.UserId).SingleAsync();
        var ownerId = await db.Users.AsNoTracking().Where(user => user.Id != clientUserId).Select(user => user.Id).SingleAsync();
        var actor = new TestActor(ownerId, true, true);
        var access = new ProjectAccess(db, actor);
        var resources = new ProjectResources(db, access, actor);
        var identity = ActivatorUtilities.CreateInstance<IdentityGateway>(scope.ServiceProvider, actor);
        var queries = new ProjectQueries(db, access, actor, identity);
        await using var transaction = await db.Database.BeginTransactionAsync();
        await new ClientQueries(db, actor).ListAsync();
        await queries.ListAsync(null);
        await queries.SearchAsync("Tracking");
        var detail = await queries.DetailAsync(projectId);
        var rootId = detail.RootFolderId!.Value;
        await resources.SectionsAsync(projectId);
        await resources.ContentsAsync(projectId, rootId);
        await resources.SearchAsync(projectId, rootId, "Child");
        await resources.ActivitiesAsync(projectId);
        await resources.RecentAsync(projectId);
        await resources.EventsAsync(projectId);
        await new NoteQueries(db, access, actor).ListAsync(projectId);
        Assert.Empty(db.ChangeTracker.Entries());
    }

    [Fact]
    public async Task ClientCreationFailureRollsBackIdentityAndBusinessRecordsTogether()
    {
        var fault = new WriteFault();
        using var factory = new PortalFactory(configure: services => services.AddDbContext<PortalDb>(options => options.AddInterceptors(fault)));
        using var owner = Client(factory);
        await SetupAsync(owner);
        fault.FailOnSave = 3;
        await AssertProblem(await owner.PostAsJsonAsync("/api/admin/users", new { name = "Failed invitation", clientName = "Failed business", email = "rollback@example.test" }), HttpStatusCode.InternalServerError, "unexpected");
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PortalDb>();
        Assert.False(await db.Users.AnyAsync(user => user.Email == "rollback@example.test"));
        Assert.False(await db.Clients.AnyAsync(client => client.Name == "Failed business"));
        Assert.Empty(await db.AccessLinks.ToListAsync());
        Assert.Equal(1, await db.UserRoles.CountAsync());
    }
}
