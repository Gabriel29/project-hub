using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace ProjectHub.Tests;

public partial class PortalFlowTests
{
    // Workflow assertions assemble their fixtures through the public resource APIs.
    // The project endpoint itself intentionally returns no document/activity collections.
    private static async Task<JsonElement> ProjectDataAsync(HttpClient client, string path)
    {
        var overview = (await client.GetFromJsonAsync<JsonObject>(path))!;
        var sections = (await client.GetFromJsonAsync<JsonArray>($"{path}/sections"))!;
        var feed = (await client.GetFromJsonAsync<JsonObject>($"{path}/activities"))!;
        var folders = new Dictionary<string, JsonNode>();
        var files = new Dictionary<string, JsonNode>();
        var queue = new Queue<string>();
        if (overview["rootFolderId"]?.GetValue<string>() is string root)
        {
            queue.Enqueue(root);
            overview["events"] = await client.GetFromJsonAsync<JsonArray>($"{path}/events");
        }
        else
        {
            foreach (var section in sections)
            {
                queue.Enqueue(section!["folderId"]!.GetValue<string>());
            }

            overview["events"] = new JsonArray();
        }

        var visited = new HashSet<string>();
        while (queue.TryDequeue(out var folderId))
        {
            if (!visited.Add(folderId))
            {
                continue;
            }

            var listing = (await client.GetFromJsonAsync<JsonObject>($"{path}/folders/{folderId}/contents"))!;
            folders[folderId] = listing["folder"]!.DeepClone();
            foreach (var child in listing["folders"]!.AsArray())
            {
                queue.Enqueue(child!["id"]!.GetValue<string>());
            }

            foreach (var file in listing["files"]!.AsArray())
            {
                files[file!["id"]!.GetValue<string>()] = file.DeepClone();
            }
        }

        foreach (var file in feed["files"]!.AsArray())
        {
            files[file!["id"]!.GetValue<string>()] = file.DeepClone();
        }

        overview["folders"] = new JsonArray(folders.Values.ToArray());
        overview["files"] = new JsonArray(files.Values.ToArray());
        overview["sections"] = sections;
        overview["updates"] = feed["updates"]!.DeepClone();
        return JsonSerializer.SerializeToElement(overview);
    }
}
