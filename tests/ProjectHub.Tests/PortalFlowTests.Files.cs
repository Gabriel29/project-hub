using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.EntityFrameworkCore;
using ProjectHub.Infrastructure;
using ProjectHub.Domain;
using ProjectHub.Application;
using Xunit;

namespace ProjectHub.Tests;

public partial class PortalFlowTests
{
    [Fact]
    public async Task FolderRenamePreservesTreeAndPermissionsAndProtectsSystemFolders()
    {
        using var factory = new PortalFactory();
        using var owner = Client(factory);
        using var admin = Client(factory);
        using var client = Client(factory);
        await SetupAsync(owner);
        var person = await Post(owner, "/api/admin/users", new { name = "Client" });
        await Post(client, "/api/auth/activate", new { token = Token(person), email = "client@example.test", password = "client1" });
        await InviteAdminAsync(owner, admin);
        var project = await Post(owner, "/api/projects", ProjectBody("FOLDERS", person.GetProperty("clientId").GetGuid()));
        var pid = project.GetProperty("id").GetString()!;
        var other = await Post(owner, "/api/projects", ProjectBody("OTHER", null));
        await Post(owner, $"/api/projects/{pid}/files/folders", new { name = "Archive", sectionKey = "contracts" });
        await Post(owner, $"/api/projects/{pid}/files/folders", new { name = "Existing", sectionKey = "contracts" });
        var detail = await ProjectDataAsync(owner, $"/api/projects/{pid}");
        var folders = detail.GetProperty("folders").EnumerateArray().ToArray();
        var folder = folders.Single(f => f.GetProperty("name").GetString() == "Archive");
        var id = folder.GetProperty("id").GetGuid();
        await Post(owner, $"/api/projects/{pid}/files/folders", new { name = "Child", parentId = id });
        var file = await UploadAsync(owner, pid, null, folderId: id.ToString());
        var path = $"/api/projects/{pid}/files/folders/{id}/name";
        Assert.Equal(HttpStatusCode.Forbidden, (await client.PutAsJsonAsync(path, new { name = "Denied" })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await owner.PutAsJsonAsync($"/api/projects/{other.GetProperty("id").GetGuid()}/files/folders/{id}/name", new { name = "Wrong project" })).StatusCode);
        foreach (var name in new[]
        {
            "",
            "  ",
            "..",
            ".contracts",
            "bad/name",
            new string ('x', 121),
            "Existing"
        }

        )
        {
            Assert.Equal(HttpStatusCode.BadRequest, (await owner.PutAsJsonAsync(path, new { name })).StatusCode);
        }

        foreach (var system in folders.Where(f => f.GetProperty("parentId").ValueKind == JsonValueKind.Null || f.GetProperty("sectionKey").ValueKind != JsonValueKind.Null))
        {
            Assert.Equal(HttpStatusCode.BadRequest, (await owner.PutAsJsonAsync($"/api/projects/{pid}/files/folders/{system.GetProperty("id").GetGuid()}/name", new { name = "Forbidden rename" })).StatusCode);
        }

        (await owner.PutAsJsonAsync(path, new { name = "  Signed contracts  " })).EnsureSuccessStatusCode();
        (await admin.PutAsJsonAsync(path, new { name = "Admin archive" })).EnsureSuccessStatusCode();
        detail = await ProjectDataAsync(client, $"/api/projects/{pid}");
        var renamed = detail.GetProperty("folders").EnumerateArray().Single(f => f.GetProperty("id").GetGuid() == id);
        Assert.Equal("Admin archive", renamed.GetProperty("name").GetString());
        Assert.Equal(folder.GetProperty("parentId").GetGuid(), renamed.GetProperty("parentId").GetGuid());
        Assert.True(renamed.GetProperty("clientVisible").GetBoolean());
        Assert.False(renamed.GetProperty("clientCanUpload").GetBoolean());
        Assert.Equal(id, detail.GetProperty("folders").EnumerateArray().Single(f => f.GetProperty("name").GetString() == "Child").GetProperty("parentId").GetGuid());
        Assert.Equal(id, detail.GetProperty("files").EnumerateArray().Single(f => f.GetProperty("id").GetGuid() == file.GetProperty("id").GetGuid()).GetProperty("folderId").GetGuid());
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync($"/api/projects/{pid}/files/{file.GetProperty("id").GetGuid()}/content")).StatusCode);
    }

    [Fact]
    public async Task FileRenameRequiresManagerAndPreservesContentAndFolder()
    {
        using var factory = new PortalFactory();
        using var owner = Client(factory);
        using var admin = Client(factory);
        using var client = Client(factory);
        await SetupAsync(owner);
        var person = await Post(owner, "/api/admin/users", new { name = "Client" });
        await Post(client, "/api/auth/activate", new { token = Token(person), email = "client@example.test", password = "client1" });
        await InviteAdminAsync(owner, admin);
        var project = await Post(owner, "/api/projects", ProjectBody("RENAME", person.GetProperty("clientId").GetGuid()));
        var pid = project.GetProperty("id").GetString()!;
        var other = await Post(owner, "/api/projects", ProjectBody("OTHER", null));
        var upload = await UploadAsync(owner, pid, null, sectionKey: "contracts");
        var fid = upload.GetProperty("id").GetGuid();
        var path = $"/api/projects/{pid}/files/{fid}/name";
        var before = (await ProjectDataAsync(owner, $"/api/projects/{pid}")).GetProperty("files")[0];
        Assert.Equal(HttpStatusCode.Forbidden, (await client.PutAsJsonAsync(path, new { title = "Denied" })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await owner.PutAsJsonAsync($"/api/projects/{other.GetProperty("id").GetGuid()}/files/{fid}/name", new { title = "Wrong project" })).StatusCode);
        foreach (var title in new[]
        {
            "",
            "   ",
            new string ('x', 201)
        }

        )
        {
            Assert.Equal(HttpStatusCode.BadRequest, (await owner.PutAsJsonAsync(path, new { title })).StatusCode);
        }

        Assert.Equal(HttpStatusCode.BadRequest, (await owner.PutAsJsonAsync(path, new { title = (string?)null })).StatusCode);
        (await owner.PutAsJsonAsync(path, new { title = "  Signed contract  " })).EnsureSuccessStatusCode();
        var renamed = (await ProjectDataAsync(client, $"/api/projects/{pid}")).GetProperty("files")[0];
        Assert.Equal("Signed contract", renamed.GetProperty("title").GetString());
        Assert.Equal(before.GetProperty("folderId").GetGuid(), renamed.GetProperty("folderId").GetGuid());
        Assert.Equal(before.GetProperty("content").GetRawText(), renamed.GetProperty("content").GetRawText());
        (await admin.PutAsJsonAsync(path, new { title = "Admin renamed" })).EnsureSuccessStatusCode();
        Assert.Equal("Admin renamed", (await ProjectDataAsync(owner, $"/api/projects/{pid}")).GetProperty("files")[0].GetProperty("title").GetString());
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync($"/api/projects/{pid}/files/{fid}/content")).StatusCode);
    }

    [Fact]
    public async Task ProjectDescriptionCanBeOmittedAndFileDescriptionsAreRemoved()
    {
        using var factory = new PortalFactory();
        using var owner = Client(factory);
        await SetupAsync(owner);
        var project = await Post(owner, "/api/projects", new { name = "No description", location = "", clientId = (Guid?)null, managerUserId = managerId });
        var pid = project.GetProperty("id").GetString()!;
        var detail = await ProjectDataAsync(owner, $"/api/projects/{pid}");
        Assert.Equal("", detail.GetProperty("project").GetProperty("description").GetString());
        await UploadAsync(owner, pid, null);
        detail = await ProjectDataAsync(owner, $"/api/projects/{pid}");
        Assert.False(detail.GetProperty("files")[0].TryGetProperty("description", out _));
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PortalDb>();
        Assert.Equal(0, await db.Database.SqlQueryRaw<int>("SELECT COUNT(*)::int AS \"Value\" FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Files' AND column_name = 'Description'").SingleAsync());
    }

    [Fact]
    public async Task RepeatedPostgresMigrationPreservesFolderIdsAndFileReferences()
    {
        using var factory = new PortalFactory();
        using var owner = Client(factory);
        await SetupAsync(owner);
        var project = await Post(owner, "/api/projects", ProjectBody("MIGRATION", null));
        var pid = project.GetProperty("id").GetString()!;
        await UploadAsync(owner, pid, null, sectionKey: "contracts");
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PortalDb>();
        var before = await db.Folders.AsNoTracking().Where(f => f.ProjectId == Guid.Parse(pid)).ToDictionaryAsync(f => f.Id, f => f.SectionKey);
        var fileFolder = await db.Files.Select(f => f.FolderId).SingleAsync();
        await scope.ServiceProvider.GetRequiredService<PostgresMigrationRunner>().RunAsync();
        var after = await db.Folders.AsNoTracking().Where(f => f.ProjectId == Guid.Parse(pid)).ToListAsync();
        Assert.Equal(before.Keys.Order(), after.Select(f => f.Id).Order());
        foreach (var folder in after.Where(f => f.SectionKey != null))
        {
            Assert.Equal(SharedFolders.Names[folder.SectionKey!], folder.Name);
        }

        Assert.Equal(fileFolder, await db.Files.Select(f => f.FolderId).SingleAsync());
        Assert.Equal("en", (await db.Users.AsNoTracking().SingleAsync()).Language);
        await scope.ServiceProvider.GetRequiredService<PostgresMigrationRunner>().RunAsync();
    }

    [Fact]
    public async Task OwnershipFilesAndAdminPermissions()
    {
        using var factory = new PortalFactory();
        using var owner = Client(factory);
        using var client = Client(factory);
        using var other = Client(factory);
        using var admin = Client(factory);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/projects")).StatusCode);
        await SetupAsync(owner);
        var person = await Post(owner, "/api/admin/users", new { name = "Client" });
        var uid = person.GetProperty("id").GetString();
        var cid = person.GetProperty("clientId").GetGuid();
        await Post(client, "/api/auth/activate", new { token = Token(person), email = "client@example.test", password = "client1" });
        var stranger = await Post(owner, "/api/admin/users", new { name = "Other" });
        await Post(other, "/api/auth/activate", new { token = Token(stranger), email = "other@example.test", password = "other1" });
        var project = await Post(owner, "/api/projects", ProjectBody("Q-1", cid));
        var pid = project.GetProperty("id").GetString();
        await Post(owner, "/api/projects", ProjectBody("Q-2", cid));
        await Post(owner, "/api/projects", ProjectBody("Q-3", null));
        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync("/api/projects/search?query=Integration")).StatusCode);
        Assert.Equal(3, (await owner.GetFromJsonAsync<JsonElement>("/api/projects/search?query=Integration")).GetArrayLength());
        Assert.Equal(0, (await owner.GetFromJsonAsync<JsonElement>("/api/projects/search?query=I")).GetArrayLength());
        Assert.Equal(HttpStatusCode.BadRequest, (await owner.GetAsync("/api/projects/search?query=" + new string('x', 121))).StatusCode);
        Assert.Equal(2, (await client.GetFromJsonAsync<JsonElement>("/api/projects")).GetArrayLength());
        Assert.Equal(1, (await owner.GetFromJsonAsync<JsonElement>("/api/projects?clientId=none")).GetArrayLength());
        Assert.Equal(HttpStatusCode.NotFound, (await other.GetAsync($"/api/projects/{pid}")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync("/api/admin/users")).StatusCode);
        var missingAssignment = new
        {
            code = "Q-4",
            name = "Missing",
            location = "",
            manager = "",
            description = "",
            specifications = "",
            warrantyYears = 5,
            progress = 0,
            stageId = (Guid?)null
        };
        Assert.Equal(HttpStatusCode.BadRequest, (await owner.PostAsJsonAsync("/api/projects", missingAssignment)).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await owner.PostAsJsonAsync("/api/projects", ProjectBody("Q-5", Guid.NewGuid()))).StatusCode);
        var upload = await UploadAsync(owner, pid!, null, sectionKey: "contracts");
        var fid = upload.GetProperty("id").GetString();
        var vid = upload.GetProperty("contentId").GetString();
        using (var revision = new MultipartFormDataContent())
        {
            revision.Add(new StringContent("Revision"), "title");
            revision.Add(new StringContent(fid!), "fileId");
            revision.Add(new ByteArrayContent("%PDF-1.7\nRevision"u8.ToArray()), "file", "plan.pdf");
            Assert.Equal(HttpStatusCode.BadRequest, (await owner.PostAsync($"/api/projects/{pid}/files", revision)).StatusCode);
        }

        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync($"/api/projects/{pid}/files/{fid}/content")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await other.GetAsync($"/api/projects/{pid}/files/{fid}/content")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await owner.PostAsJsonAsync($"/api/projects/{pid}/approvals", new { title = "Removed workflow" })).StatusCode);
        var detail = await ProjectDataAsync(client, $"/api/projects/{pid}");
        Assert.False(detail.TryGetProperty("approvals", out _));
        await InviteAdminAsync(owner, admin);
        await Post(admin, "/api/admin/users", new { name = "Admin-created client" });
        await Post(admin, "/api/projects", ProjectBody("Q-ADMIN", null));
        Assert.Equal(HttpStatusCode.Forbidden, (await admin.PostAsJsonAsync("/api/admin/users", new { name = "Another admin", admin = true, email = "second@example.test", password = "admin2" })).StatusCode);
        (await owner.PutAsJsonAsync($"/api/projects/{pid}", ProjectBody("Q-1", stranger.GetProperty("clientId").GetGuid()))).EnsureSuccessStatusCode();
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync($"/api/projects/{pid}")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await other.GetAsync($"/api/projects/{pid}")).StatusCode);
    }

    [Fact]
    public async Task GenericStagesRootFoldersCalendarAndIdentitySchema()
    {
        using var factory = new PortalFactory();
        using var owner = Client(factory);
        using var client = Client(factory);
        await SetupAsync(owner);
        (await owner.PutAsJsonAsync("/api/auth/phone", new { phoneNumber = "+40 721 234 567" })).EnsureSuccessStatusCode();
        Assert.Equal("+40 721 234 567", (await owner.GetFromJsonAsync<JsonElement>("/api/auth/me")).GetProperty("phoneNumber").GetString());
        var person = await Post(owner, "/api/admin/users", new { name = "Client", phoneNumber = "+40 722 222 222" });
        await Post(client, "/api/auth/activate", new { token = Token(person), email = "client@example.test", password = "client1", phoneNumber = "+40 733 333 333" });
        Assert.Equal("+40 733 333 333", (await client.GetFromJsonAsync<JsonElement>("/api/auth/me")).GetProperty("phoneNumber").GetString());
        var project = await Post(owner, "/api/projects", ProjectBody("GENERIC", person.GetProperty("clientId").GetGuid()));
        var pid = project.GetProperty("id").GetString();
        var otherProject = await Post(owner, "/api/projects", ProjectBody("OTHER", null));
        var otherId = otherProject.GetProperty("id").GetString();
        var stageBody = new[]
        {
            new
            {
                id = (Guid? )null,
                name = "Pregătire personalizată",
                description = "Descriere etapă"
            },
            new
            {
                id = (Guid? )null,
                name = "Recepție client",
                description = "Recepția proiectului"
            }
        };
        (await owner.PutAsJsonAsync($"/api/projects/{pid}/stages", stageBody)).EnsureSuccessStatusCode();
        var detail = await ProjectDataAsync(client, $"/api/projects/{pid}");
        var stages = detail.GetProperty("project").GetProperty("milestones");
        var first = stages[0].GetProperty("id").GetGuid();
        var second = stages[1].GetProperty("id").GetGuid();
        Assert.Equal(first, detail.GetProperty("project").GetProperty("stageId").GetGuid());
        Assert.Equal(1, stages[1].GetProperty("orderIndex").GetInt32());
        Assert.Equal(HttpStatusCode.Forbidden, (await client.PutAsJsonAsync($"/api/projects/{pid}/stages", stageBody)).StatusCode);
        (await owner.PutAsJsonAsync($"/api/projects/{pid}/stages", new[] { new { id = second, name = "Recepție client", description = "Descriere etapă" }, new { id = first, name = "Pregătire personalizată", description = "Descriere etapă" } })).EnsureSuccessStatusCode();
        detail = await ProjectDataAsync(client, $"/api/projects/{pid}");
        Assert.Equal(second, detail.GetProperty("project").GetProperty("milestones")[0].GetProperty("id").GetGuid());
        // Stages can now be removed independently of activities.
        Assert.Equal(HttpStatusCode.BadRequest, (await owner.PutAsJsonAsync($"/api/projects/{otherId}", new { code = "OTHER", name = "Other", location = "", manager = "", managerPhone = "", description = "", specifications = "", warrantyYears = 5, progress = 0, stageId = first, clientId = (Guid?)null })).StatusCode);
        // The contracts section exists with its stable storage name.
        detail = await ProjectDataAsync(client, $"/api/projects/{pid}");
        var folder = detail.GetProperty("folders").EnumerateArray().Single(f => f.GetProperty("sectionKey").GetString() == "contracts").GetProperty("id").GetString();
        Assert.Equal(HttpStatusCode.Forbidden, (await client.PostAsJsonAsync($"/api/projects/{pid}/files/folders", new { name = "Forbidden" })).StatusCode);
        var uploaded = await UploadAsync(owner, pid!, null, folder);
        var fileId = uploaded.GetProperty("id").GetString();
        var contentId = uploaded.GetProperty("contentId").GetString();
        detail = await ProjectDataAsync(client, $"/api/projects/{pid}");
        Assert.Equal(folder, detail.GetProperty("files")[0].GetProperty("folderId").GetString());
        Assert.Equal(HttpStatusCode.Forbidden, (await client.PutAsJsonAsync($"/api/projects/{pid}/files/{fileId}/folder", new { folderId = folder })).StatusCode);
        (await owner.PutAsJsonAsync($"/api/projects/{pid}/files/{fileId}/folder", new { folderId = folder })).EnsureSuccessStatusCode();
        detail = await ProjectDataAsync(client, $"/api/projects/{pid}");
        Assert.Equal(folder, detail.GetProperty("files")[0].GetProperty("folderId").GetString());
        await Post(owner, $"/api/projects/{otherId}/files/folders", new { name = "OtherFolder" });
        var other = await ProjectDataAsync(owner, $"/api/projects/{otherId}");
        var foreignFolder = other.GetProperty("folders")[0].GetProperty("id").GetGuid();
        Assert.Equal(HttpStatusCode.BadRequest, (await owner.PutAsJsonAsync($"/api/projects/{pid}/files/{fileId}/folder", new { folderId = foreignFolder })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.DeleteAsync($"/api/projects/{pid}/files/{fileId}")).StatusCode);
        await Post(owner, $"/api/projects/{pid}/updates", new { title = "Noutate manuală", details = "Pregătirea a început", occurredAt = DateTimeOffset.UtcNow, photoContentId = (Guid?)null, stageId = first });
        Assert.Equal(HttpStatusCode.Forbidden, (await client.PostAsJsonAsync($"/api/projects/{pid}/updates", new { title = "Forbidden", details = "", occurredAt = DateTimeOffset.UtcNow })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await owner.PostAsJsonAsync($"/api/projects/{pid}/updates", new { title = "Bad photo", details = "", occurredAt = DateTimeOffset.UtcNow, photoContentId = contentId })).StatusCode);
        var photo = await UploadAsync(owner, pid!, null, null, true);
        await Post(owner, $"/api/projects/{pid}/updates", new { title = "Fotografie", details = "Montaj", occurredAt = DateTimeOffset.UtcNow, photoContentId = photo.GetProperty("contentId").GetString(), stageId = second, cover = true });
        detail = await ProjectDataAsync(client, $"/api/projects/{pid}");
        Assert.Equal(2, detail.GetProperty("updates").GetArrayLength());
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PortalDb>();
        Assert.Equal("identity", db.Model.FindEntityType(typeof(PortalUser))!.GetSchema());
        foreach (var type in new[]
        {
            typeof(Client),
            typeof(FileContent),
            typeof(ProjectEvent),
            typeof(CalendarEntry),
            typeof(DocumentFolder)
        }

        )
        {
            Assert.Contains(db.Model.FindEntityType(type)!.GetForeignKeys(), fk => fk.PrincipalEntityType.ClrType == typeof(PortalUser));
        }

        Assert.DoesNotContain(typeof(Project).Assembly.GetTypes(), type => type.IsEnum);
    }

    [Fact]
    public async Task NestedFoldersAndVisibleProgressPhotosStayWithinTheProject()
    {
        using var factory = new PortalFactory();
        using var owner = Client(factory);
        using var admin = Client(factory);
        await SetupAsync(owner);
        await InviteAdminAsync(owner, admin);
        var project = await Post(owner, "/api/projects", ProjectBody("IGNORED", null));
        var pid = project.GetProperty("id").GetString()!;
        var detail = await ProjectDataAsync(owner, $"/api/projects/{pid}");
        var root = detail.GetProperty("folders").EnumerateArray().Single(f => f.GetProperty("parentId").ValueKind == JsonValueKind.Null);
        Assert.Equal("Root", root.GetProperty("name").GetString());
        Assert.Equal(JsonValueKind.Null, root.GetProperty("parentId").ValueKind);
        await Post(owner, $"/api/projects/{pid}/files/folders", new { name = "Contracte", parentId = root.GetProperty("id").GetGuid() });
        detail = await ProjectDataAsync(owner, $"/api/projects/{pid}");
        var parent = detail.GetProperty("folders").EnumerateArray().Single(f => f.GetProperty("name").GetString() == "Contracte").GetProperty("id").GetGuid();
        await Post(owner, $"/api/projects/{pid}/files/folders", new { name = "Semnate", parentId = parent });
        foreach (var invalid in new[]
        {
            ".hidden",
            "..",
            "Bad/Name",
            "Bad\\Name"
        }

        )
        {
            Assert.Equal(HttpStatusCode.BadRequest, (await owner.PostAsJsonAsync($"/api/projects/{pid}/files/folders", new { name = invalid })).StatusCode);
        }

        Assert.Equal(HttpStatusCode.BadRequest, (await owner.PostAsJsonAsync($"/api/projects/{pid}/files/folders", new { name = "Wrong", parentId = Guid.NewGuid() })).StatusCode);
        (await owner.PutAsJsonAsync($"/api/projects/{pid}/stages", new[] { new { id = (Guid?)null, name = "Montaj", description = "Instalarea elementelor" } })).EnsureSuccessStatusCode();
        detail = await ProjectDataAsync(owner, $"/api/projects/{pid}");
        var stage = detail.GetProperty("project").GetProperty("milestones")[0].GetProperty("id").GetGuid();
        var photo = await UploadAsync(owner, pid, null, null, true);
        var version = photo.GetProperty("contentId").GetGuid();
        await Post(owner, $"/api/projects/{pid}/updates", new { title = "Montaj", details = "Activitate", occurredAt = DateTimeOffset.UtcNow, photoContentId = version, stageId = stage, cover = true });
        detail = await ProjectDataAsync(owner, $"/api/projects/{pid}");
        Assert.False(detail.GetProperty("project").TryGetProperty("coverContentId", out _));
        Assert.True(detail.GetProperty("files")[0].GetProperty("calendarPhoto").GetBoolean());
        Assert.DoesNotContain(detail.GetProperty("folders").EnumerateArray(), f => f.GetProperty("name").GetString() == ".hidden");
        Assert.Equal(HttpStatusCode.OK, (await admin.PostAsJsonAsync($"/api/projects/{pid}/updates", new { title = "Cover", details = "", occurredAt = DateTimeOffset.UtcNow, photoContentId = version, stageId = stage, cover = true })).StatusCode);
        var entry = detail.GetProperty("updates")[0].GetProperty("id").GetGuid();
        (await owner.PutAsJsonAsync($"/api/projects/{pid}/updates/{entry}", new { title = "Actualizat", details = "Editat", occurredAt = DateTimeOffset.UtcNow, photoContentId = version, stageId = stage })).EnsureSuccessStatusCode();
        (await owner.PutAsJsonAsync($"/api/projects/{pid}/status", new { stageId = stage })).EnsureSuccessStatusCode();
        var statusDetail = await ProjectDataAsync(owner, $"/api/projects/{pid}");
        Assert.False(statusDetail.GetProperty("project").TryGetProperty("progress", out _));
        Assert.Equal(HttpStatusCode.BadRequest, (await owner.PutAsJsonAsync($"/api/projects/{pid}/status", new { stageId = Guid.NewGuid() })).StatusCode);
        using var scope = factory.Services.CreateScope();
        var database = scope.ServiceProvider.GetRequiredService<PortalDb>();
        var hidden = await database.Folders.SingleAsync(f => f.ProjectId == Guid.Parse(pid) && f.SectionKey == "progress");
        Assert.Equal(root.GetProperty("id").GetGuid(), hidden.ParentId);
        Assert.Equal(hidden.Id, (await database.Files.SingleAsync(f => f.Id == photo.GetProperty("id").GetGuid())).FolderId);
        Assert.Equal(".progress", hidden.Name);
        Assert.False(await database.Folders.AnyAsync(f => f.ProjectId == Guid.Parse(pid) && f.Name == ".hidden"));
    }

    [Fact]
    public async Task SingleContentMultiplePhotosAndFolderActions()
    {
        using var factory = new PortalFactory();
        using var owner = Client(factory);
        await SetupAsync(owner);
        var project = await Post(owner, "/api/projects", ProjectBody("FILES", null));
        var pid = project.GetProperty("id").GetString()!;
        await Post(owner, $"/api/projects/{pid}/files/folders", new { name = "Parent" });
        var detail = await ProjectDataAsync(owner, $"/api/projects/{pid}");
        var parent = detail.GetProperty("folders").EnumerateArray().Single(f => f.GetProperty("name").GetString() == "Parent").GetProperty("id").GetGuid();
        var root = detail.GetProperty("folders").EnumerateArray().Single(f => f.GetProperty("parentId").ValueKind == JsonValueKind.Null).GetProperty("id").GetGuid();
        await Post(owner, $"/api/projects/{pid}/files/folders", new { name = "Child", parentId = parent });
        detail = await ProjectDataAsync(owner, $"/api/projects/{pid}");
        var child = detail.GetProperty("folders").EnumerateArray().Single(f => f.GetProperty("name").GetString() == "Child").GetProperty("id").GetGuid();
        Assert.Equal(HttpStatusCode.BadRequest, (await owner.PutAsJsonAsync($"/api/projects/{pid}/files/folders/{parent}/parent", new { folderId = child })).StatusCode);
        (await owner.PutAsJsonAsync($"/api/projects/{pid}/files/folders/{child}/parent", new { folderId = root })).EnsureSuccessStatusCode();
        (await owner.PutAsJsonAsync($"/api/projects/{pid}/files/folders/{child}/parent", new { folderId = parent })).EnsureSuccessStatusCode();
        var document = await UploadAsync(owner, pid, null, child.ToString());
        var saved = await owner.GetAsync($"/api/projects/{pid}/files/{document.GetProperty("id").GetString()}/content");
        Assert.Equal("Test plan.pdf", saved.Content.Headers.ContentDisposition!.FileNameStar);
        var fileId = document.GetProperty("id").GetString();
        detail = await ProjectDataAsync(owner, $"/api/projects/{pid}");
        Assert.False(detail.GetProperty("files")[0].TryGetProperty("versions", out _));
        Assert.False(detail.GetProperty("files")[0].GetProperty("content").TryGetProperty("number", out _));
        var preview = await owner.GetAsync($"/api/projects/{pid}/files/{fileId}/content?inline=true");
        Assert.Equal("application/pdf", preview.Content.Headers.ContentType!.MediaType);
        Assert.Equal("inline", preview.Content.Headers.ContentDisposition!.DispositionType);
        Assert.Equal("Test plan.pdf", preview.Content.Headers.ContentDisposition.FileNameStar);
        Assert.Equal("SAMEORIGIN", preview.Headers.GetValues("X-Frame-Options").Single());
        (await owner.PutAsJsonAsync($"/api/projects/{pid}/stages", new[] { new { id = (Guid?)null, name = "Montaj" } })).EnsureSuccessStatusCode();
        detail = await ProjectDataAsync(owner, $"/api/projects/{pid}");
        var stage = detail.GetProperty("project").GetProperty("milestones")[0].GetProperty("id").GetGuid();
        var photo1 = await UploadAsync(owner, pid, null, null, true);
        var photo2 = await UploadAsync(owner, pid, null, null, true);
        var photos = new[]
        {
            photo1.GetProperty("contentId").GetGuid(),
            photo2.GetProperty("contentId").GetGuid()
        };
        await Post(owner, $"/api/projects/{pid}/updates", new { title = "Galerie", details = "Două fotografii", occurredAt = DateTimeOffset.UtcNow, photoIds = photos, stageId = stage });
        detail = await ProjectDataAsync(owner, $"/api/projects/{pid}");
        Assert.Equal(photos, detail.GetProperty("updates")[0].GetProperty("photoIds").EnumerateArray().Select(p => p.GetGuid()).ToArray());
        var entryId = detail.GetProperty("updates")[0].GetProperty("id").GetGuid();
        (await owner.PutAsJsonAsync($"/api/projects/{pid}/updates/{entryId}", new { title = "Galerie reordonată", details = "Ordine carusel", occurredAt = DateTimeOffset.UtcNow, photoIds = new[] { photos[1], photos[0], photos[1] } })).EnsureSuccessStatusCode();
        detail = await ProjectDataAsync(owner, $"/api/projects/{pid}");
        Assert.Equal(new[] { photos[1], photos[0] }, detail.GetProperty("updates")[0].GetProperty("photoIds").EnumerateArray().Select(p => p.GetGuid()).ToArray());
        Assert.Equal(photos[1], detail.GetProperty("updates")[0].GetProperty("photoContentId").GetGuid());
        Assert.Equal(HttpStatusCode.BadRequest, (await owner.PostAsJsonAsync($"/api/projects/{pid}/updates", new { title = "Invalid", details = "", occurredAt = DateTimeOffset.UtcNow, photoIds = new[] { Guid.NewGuid() }, stageId = stage })).StatusCode);
        (await owner.DeleteAsync($"/api/projects/{pid}/files/folders/{parent}")).EnsureSuccessStatusCode();
        Assert.Equal(HttpStatusCode.NotFound, (await owner.GetAsync($"/api/projects/{pid}/files/{fileId}/content")).StatusCode);
        detail = await ProjectDataAsync(owner, $"/api/projects/{pid}");
        Assert.DoesNotContain(detail.GetProperty("folders").EnumerateArray(), f => f.GetProperty("id").GetGuid() == parent || f.GetProperty("id").GetGuid() == child);
        Assert.Equal(HttpStatusCode.BadRequest, (await owner.DeleteAsync($"/api/projects/{pid}/files/folders/{root}")).StatusCode);
    }

    [Fact]
    public async Task SharedSectionsRestrictMetadataDownloadsAndUploadDestinations()
    {
        using var factory = new PortalFactory();
        using var owner = Client(factory);
        using var client = Client(factory);
        await SetupAsync(owner);
        var person = await Post(owner, "/api/admin/users", new { name = "Client" });
        await Post(client, "/api/auth/activate", new { token = Token(person), email = "client@example.test", password = "client1" });
        var project = await Post(owner, "/api/projects", ProjectBody("SHARED", person.GetProperty("clientId").GetGuid()));
        var pid = project.GetProperty("id").GetString()!;
        var privateFile = await UploadAsync(owner, pid, null);
        var privateId = privateFile.GetProperty("id").GetString();
        var detail = await ProjectDataAsync(client, $"/api/projects/{pid}");
        Assert.Empty(detail.GetProperty("files").EnumerateArray());
        Assert.Equal(4, detail.GetProperty("folders").GetArrayLength());
        Assert.All(detail.GetProperty("folders").EnumerateArray(), f => Assert.NotNull(f.GetProperty("sectionKey").GetString()));
        Assert.Empty(detail.GetProperty("events").EnumerateArray());
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync($"/api/projects/{pid}/files/{privateId}/content?inline=true")).StatusCode);
        // Simulate an older/incomplete project: category uploads must recreate its missing folder.
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<PortalDb>();
            db.Folders.Remove(await db.Folders.SingleAsync(f => f.ProjectId == Guid.Parse(pid) && f.SectionKey == "contracts"));
            await db.SaveChangesAsync();
        }

        var shared = await UploadAsync(owner, pid, null, sectionKey: "contracts");
        var sharedId = shared.GetProperty("id").GetString();
        detail = await ProjectDataAsync(owner, $"/api/projects/{pid}");
        var root = detail.GetProperty("folders").EnumerateArray().Single(f => f.GetProperty("parentId").ValueKind == JsonValueKind.Null).GetProperty("id").GetString();
        var section = detail.GetProperty("folders").EnumerateArray().Single(f => f.GetProperty("sectionKey").GetString() == "contracts").GetProperty("id").GetString();
        Assert.Equal(root, detail.GetProperty("folders").EnumerateArray().Single(f => f.GetProperty("id").GetString() == section).GetProperty("parentId").GetString());
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync($"/api/projects/{pid}/files/{sharedId}/content")).StatusCode);
        await Post(owner, $"/api/projects/{pid}/files/folders", new { name = "Documente semnate", parentId = section });
        detail = await ProjectDataAsync(owner, $"/api/projects/{pid}");
        var child = detail.GetProperty("folders").EnumerateArray().Single(f => f.GetProperty("name").GetString() == "Documente semnate").GetProperty("id").GetString();
        var nested = await UploadAsync(owner, pid, null, child, sectionKey: "contracts");
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync($"/api/projects/{pid}/files/{nested.GetProperty("id").GetString()}/content")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await owner.DeleteAsync($"/api/projects/{pid}/files/folders/{section}")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await owner.PutAsJsonAsync($"/api/projects/{pid}/files/folders/{section}/parent", new { folderId = root })).StatusCode);
        foreach (var destination in new[]
        {
            (root, (string? )null, HttpStatusCode.Forbidden),
            (root, "contracts", HttpStatusCode.Forbidden),
            (child, "warranty", HttpStatusCode.Forbidden),
            (child, "unknown", HttpStatusCode.Forbidden)
        }

        )
        {
            using var form = new MultipartFormDataContent();
            form.Add(new StringContent("Forbidden"), "title");
            form.Add(new StringContent(destination.Item1!), "folderId");
            if (destination.Item2 != null)
            {
                form.Add(new StringContent(destination.Item2), "sectionKey");
            }

            form.Add(new ByteArrayContent("%PDF-1.7\nTest upload"u8.ToArray()), "file", "plan.pdf");
            Assert.Equal(destination.Item3, (await client.PostAsync($"/api/projects/{pid}/files", form)).StatusCode);
        }

        (await owner.PutAsJsonAsync($"/api/projects/{pid}/files/{sharedId}/folder", new { folderId = root })).EnsureSuccessStatusCode();
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync($"/api/projects/{pid}/files/{sharedId}/content")).StatusCode);
        (await owner.PutAsJsonAsync($"/api/projects/{pid}/files/{privateId}/folder", new { folderId = child })).EnsureSuccessStatusCode();
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync($"/api/projects/{pid}/files/{privateId}/content")).StatusCode);
        detail = await ProjectDataAsync(client, $"/api/projects/{pid}");
        Assert.DoesNotContain(detail.GetProperty("files").EnumerateArray(), f => f.GetProperty("id").GetString() == sharedId);
        Assert.DoesNotContain(detail.GetProperty("folders").EnumerateArray(), f => f.GetProperty("id").GetString() == root);
        var unpublished = await UploadAsync(owner, pid, null, photo: true);
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync($"/api/projects/{pid}/files/{unpublished.GetProperty("id").GetString()}/content")).StatusCode);
        (await owner.PutAsJsonAsync($"/api/projects/{pid}/stages", new[] { new { id = (Guid?)null, name = "Montaj", description = "" } })).EnsureSuccessStatusCode();
        detail = await ProjectDataAsync(owner, $"/api/projects/{pid}");
        await Post(owner, $"/api/projects/{pid}/updates", new { title = "Fotografie publicată", details = "", occurredAt = DateTimeOffset.UtcNow, stageId = detail.GetProperty("project").GetProperty("stageId").GetGuid(), photoIds = new[] { unpublished.GetProperty("contentId").GetGuid() }, cover = true });
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync($"/api/projects/{pid}/files/{unpublished.GetProperty("id").GetString()}/content?inline=true")).StatusCode);
    }

    [Fact]
    public async Task NewProjectsCreateEverySharedFolderForOwnerAndAdmin()
    {
        using var factory = new PortalFactory();
        using var owner = Client(factory);
        using var admin = Client(factory);
        using var client = Client(factory);
        await SetupAsync(owner);
        await InviteAdminAsync(owner, admin);
        var person = await Post(owner, "/api/admin/users", new { name = "Client" });
        await Post(client, "/api/auth/activate", new { token = Token(person), email = "client@example.test", password = "client1" });
        foreach (var manager in new[]
        {
            owner,
            admin
        }

        )
        {
            var created = await Post(manager, "/api/projects", ProjectBody("DEFAULTS", person.GetProperty("clientId").GetGuid()));
            var id = created.GetProperty("id").GetGuid();
            var detail = await ProjectDataAsync(manager, $"/api/projects/{id}");
            var folders = detail.GetProperty("folders").EnumerateArray().ToArray();
            Assert.Equal(6, folders.Length);
            var root = folders.Single(f => f.GetProperty("parentId").ValueKind == JsonValueKind.Null).GetProperty("id").GetGuid();
            foreach (var section in SharedFolders.Names)
            {
                var folder = Assert.Single(folders, f => f.GetProperty("sectionKey").GetString() == section.Key);
                Assert.Equal(section.Value, folder.GetProperty("name").GetString());
                Assert.Equal(root, folder.GetProperty("parentId").GetGuid());
            }

            detail = await ProjectDataAsync(client, $"/api/projects/{id}");
            Assert.Equal(4, detail.GetProperty("folders").GetArrayLength());
            Assert.Empty(detail.GetProperty("files").EnumerateArray());
            using var scope = factory.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<PortalDb>();
            Assert.Equal(6, await db.Folders.CountAsync(f => f.ProjectId == id));
        }
    }

    [Fact]
    public async Task FirstUploadsShareOneSectionAndReuseExistingNamedFolder()
    {
        using var factory = new PortalFactory();
        using var owner = Client(factory);
        await SetupAsync(owner);
        var project = await Post(owner, "/api/projects", ProjectBody("CONCURRENT", null));
        var pid = project.GetProperty("id").GetString()!;
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<PortalDb>();
            db.Folders.Remove(await db.Folders.SingleAsync(f => f.ProjectId == Guid.Parse(pid) && f.SectionKey == "technical"));
            await db.SaveChangesAsync();
        }

        await Task.WhenAll(UploadAsync(owner, pid, null, sectionKey: "technical"), UploadAsync(owner, pid, null, sectionKey: "technical"));
        var detail = await ProjectDataAsync(owner, $"/api/projects/{pid}");
        var folders = detail.GetProperty("folders").EnumerateArray().Where(f => f.GetProperty("sectionKey").GetString() == "technical").ToArray();
        Assert.Single(folders);
        Assert.All(detail.GetProperty("files").EnumerateArray(), f => Assert.Equal(folders[0].GetProperty("id").GetGuid(), f.GetProperty("folderId").GetGuid()));
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<PortalDb>();
            var root = await db.Folders.SingleAsync(f => f.ProjectId == Guid.Parse(pid) && f.ParentId == null);
            var legacy = await db.Folders.SingleAsync(f => f.ProjectId == Guid.Parse(pid) && f.SectionKey == "warranty");
            legacy.SectionKey = null;
            await db.SaveChangesAsync();
        }

        await UploadAsync(owner, pid, null, sectionKey: "warranty");
        detail = await ProjectDataAsync(owner, $"/api/projects/{pid}");
        Assert.Single(detail.GetProperty("folders").EnumerateArray(), f => f.GetProperty("name").GetString() == ".warranty" && f.GetProperty("sectionKey").GetString() == "warranty");
    }

    [Theory]
    [InlineData("contracts")]
    [InlineData("warranty")]
    [InlineData("maintenance")]
    [InlineData("technical")]
    public async Task SharedSectionsAreReadOnlyForClientsIncludingDescendantsAndMissingFolders(string sectionKey)
    {
        using var factory = new PortalFactory();
        using var owner = Client(factory);
        using var admin = Client(factory);
        using var client = Client(factory);
        await SetupAsync(owner);
        await InviteAdminAsync(owner, admin);
        var person = await Post(owner, "/api/admin/users", new { name = "Client" });
        await Post(client, "/api/auth/activate", new { token = Token(person), email = "client@example.test", password = "client1" });
        var project = await Post(owner, "/api/projects", ProjectBody("POLICIES", person.GetProperty("clientId").GetGuid()));
        var pid = project.GetProperty("id").GetString()!;
        var detail = await ProjectDataAsync(client, $"/api/projects/{pid}");
        var warranty = detail.GetProperty("folders").EnumerateArray().Single(f => f.GetProperty("sectionKey").GetString() == sectionKey);
        var folder = warranty.GetProperty("id").GetGuid();
        Assert.True(warranty.GetProperty("clientVisible").GetBoolean());
        Assert.False(warranty.GetProperty("clientCanUpload").GetBoolean());
        Assert.False(warranty.GetProperty("canUpload").GetBoolean());
        var policy = detail.GetProperty("sections").EnumerateArray().Single(s => s.GetProperty("key").GetString() == sectionKey);
        Assert.False(policy.GetProperty("canUpload").GetBoolean());
        await Post(owner, $"/api/projects/{pid}/files/folders", new { name = "Certificate", parentId = folder });
        detail = await ProjectDataAsync(client, $"/api/projects/{pid}");
        var child = detail.GetProperty("folders").EnumerateArray().Single(f => f.GetProperty("name").GetString() == "Certificate");
        Assert.False(child.GetProperty("canUpload").GetBoolean());
        Assert.True(child.GetProperty("clientVisible").GetBoolean());
        foreach (var id in new[]
        {
            folder,
            child.GetProperty("id").GetGuid()
        }

        )
        {
            using var form = new MultipartFormDataContent();
            form.Add(new StringContent("Forged"), "title");
            form.Add(new StringContent(id.ToString()), "folderId");
            form.Add(new StringContent("true"), "canUpload");
            form.Add(new ByteArrayContent("%PDF-1.7\nTest file"u8.ToArray()), "file", "certificate.pdf");
            Assert.Equal(HttpStatusCode.Forbidden, (await client.PostAsync($"/api/projects/{pid}/files", form)).StatusCode);
        }

        Assert.Equal(HttpStatusCode.Forbidden, (await client.PostAsJsonAsync($"/api/projects/{pid}/files/folders", new { name = "Forbidden", parentId = folder, sectionKey })).StatusCode);
        foreach (var manager in new[]
        {
            owner,
            admin
        }

        )
        {
            var name = manager == owner ? "Owner folder" : "Admin folder";
            await Post(manager, $"/api/projects/{pid}/files/folders", new { name, parentId = child.GetProperty("id").GetGuid(), sectionKey });
            var clientView = await ProjectDataAsync(client, $"/api/projects/{pid}");
            var managerFolder = clientView.GetProperty("folders").EnumerateArray().Single(f => f.GetProperty("name").GetString() == name);
            Assert.True(managerFolder.GetProperty("clientVisible").GetBoolean());
            Assert.False(managerFolder.GetProperty("canUpload").GetBoolean());
            var file = await UploadAsync(manager, pid, null, managerFolder.GetProperty("id").GetString(), photo: sectionKey == "progress", sectionKey: sectionKey, viaExplorer: true);
            if (sectionKey == "progress")
            {
                await Post(manager, $"/api/projects/{pid}/updates", new { title = "Published photo", details = "", photoIds = new[] { file.GetProperty("contentId").GetGuid() } });
            }

            Assert.Equal(HttpStatusCode.OK, (await client.GetAsync($"/api/projects/{pid}/files/{file.GetProperty("id").GetString()}/content")).StatusCode);
            var managed = await ProjectDataAsync(manager, $"/api/projects/{pid}");
            Assert.True(managed.GetProperty("folders").EnumerateArray().Single(f => f.GetProperty("id").GetGuid() == folder).GetProperty("canUpload").GetBoolean());
        }

        var empty = await Post(owner, "/api/projects", ProjectBody("MISSING", person.GetProperty("clientId").GetGuid()));
        var missing = empty.GetProperty("id").GetString()!;
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<PortalDb>();
            db.Folders.Remove(await db.Folders.SingleAsync(f => f.ProjectId == Guid.Parse(missing) && f.SectionKey == sectionKey));
            await db.SaveChangesAsync();
        }

        using (var form = new MultipartFormDataContent())
        {
            form.Add(new StringContent("Denied"), "title");
            form.Add(new StringContent(sectionKey), "sectionKey");
            form.Add(new ByteArrayContent("%PDF-1.7\nTest file"u8.ToArray()), "file", "certificate.pdf");
            Assert.Equal(HttpStatusCode.Forbidden, (await client.PostAsync($"/api/projects/{missing}/files", form)).StatusCode);
        }

        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<PortalDb>();
            Assert.False(await db.Folders.AnyAsync(f => f.ProjectId == Guid.Parse(missing) && f.SectionKey == sectionKey));
            Assert.False(await db.Files.AnyAsync(f => f.ProjectId == Guid.Parse(missing)));
        }

        await Post(admin, $"/api/projects/{missing}/files/folders", new { name = "Recovered category folder", sectionKey });
        await UploadAsync(owner, missing, null, sectionKey: sectionKey);
        detail = await ProjectDataAsync(client, $"/api/projects/{missing}");
        Assert.Single(detail.GetProperty("folders").EnumerateArray(), f => f.GetProperty("sectionKey").GetString() == sectionKey);
    }

    [Fact]
    public async Task ActivityDeletionIsManagerOnlyScopedAndUnpublishesStoredFiles()
    {
        using var factory = new PortalFactory();
        using var owner = Client(factory);
        using var client = Client(factory);
        await SetupAsync(owner);
        var person = await Post(owner, "/api/admin/users", new { name = "Client" });
        await Post(client, "/api/auth/activate", new { token = Token(person), email = "client@example.test", password = "client1" });
        var project = await Post(owner, "/api/projects", ProjectBody("Delete activity", person.GetProperty("clientId").GetGuid()));
        var pid = project.GetProperty("id").GetString()!;
        var photo = await UploadAsync(owner, pid, null, photo: true, sectionKey: "progress", viaExplorer: true);
        var contentId = photo.GetProperty("contentId").GetGuid();
        await Post(owner, $"/api/projects/{pid}/updates", new { title = "Montaj", details = "Photo", photoIds = new[] { contentId }, cover = true });
        var detail = await ProjectDataAsync(owner, $"/api/projects/{pid}");
        var entryId = detail.GetProperty("updates")[0].GetProperty("id").GetGuid();
        Assert.Equal(HttpStatusCode.Forbidden, (await client.DeleteAsync($"/api/projects/{pid}/updates/{entryId}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await owner.DeleteAsync($"/api/projects/{Guid.NewGuid()}/updates/{entryId}")).StatusCode);
        (await owner.DeleteAsync($"/api/projects/{pid}/updates/{entryId}")).EnsureSuccessStatusCode();
        detail = await ProjectDataAsync(client, $"/api/projects/{pid}");
        Assert.Empty(detail.GetProperty("updates").EnumerateArray());
        Assert.False(detail.GetProperty("project").TryGetProperty("coverContentId", out _));
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync($"/api/projects/{pid}/files/{photo.GetProperty("id").GetString()}/content")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await owner.GetAsync($"/api/projects/{pid}/files/{photo.GetProperty("id").GetString()}/content")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await owner.DeleteAsync($"/api/projects/{pid}/updates/{entryId}")).StatusCode);
    }

}
