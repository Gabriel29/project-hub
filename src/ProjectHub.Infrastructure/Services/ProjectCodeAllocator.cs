using Microsoft.EntityFrameworkCore;
using ProjectHub.Application;

namespace ProjectHub.Infrastructure;

public sealed class ProjectCodeAllocator(
    PortalDb db,
    ICurrentUser actor)
{
    public async Task<string> GenerateAsync(Guid? clientId, CancellationToken ct = default)
    {
        ActorGuard.Manager(actor);
        var clients = await db.Clients.AsNoTracking().ToListAsync(ct);
        var client = clientId.HasValue ? await db.Clients.SingleOrDefaultAsync(entity => entity.Id == clientId.Value, ct) : null;
        var all = await db.Projects.AsNoTracking().Select(project => new ProjectCodeReservation(project.ClientId, project.Code)).ToListAsync(ct);
        var prefix = client?.CodePrefix;
        if (prefix == null)
        {
            var letters = new string((client?.Name ?? "Fara Client").Normalize(System.Text.NormalizationForm.FormD).Where(c => c is >= 'A' and <= 'Z' or >= 'a' and <= 'z').Select(char.ToUpperInvariant).ToArray());
            var used = clients.Where(c => c.Id != clientId).Select(c => c.CodePrefix).Concat(all.Where(p => p.ClientId != clientId).Select(p => p.Code.Split('-')[0])).ToHashSet();
            var candidates = new[]
            {
                new string (letters.Where(c => !"AEIOU".Contains(c)).Take(2).ToArray()),
                new string (letters.Take(2).ToArray())
            };
            prefix = candidates.FirstOrDefault(c => c.Length == 2 && !used.Contains(c));
            if (prefix == null)
            {
                var available = Enumerable.Range(0, 676).Select(i => $"{(char)('A' + i / 26)}{(char)('A' + i % 26)}").Where(c => !used.Contains(c)).ToArray();
                if (available.Length == 0)
                {
                    throw new PortalException(409, "prefixesExhausted");
                }

                prefix = available[System.Security.Cryptography.RandomNumberGenerator.GetInt32(available.Length)];
            }

            if (client != null)
            {
                client.CodePrefix = prefix;
            }
        }

        var next = all.Where(p => p.Code.StartsWith(prefix + "-", StringComparison.Ordinal)).Select(p => int.TryParse(p.Code.Split('-').Last(), out var n) ? n : 999).DefaultIfEmpty(999).Max() + 1;
        return $"{prefix}-{next}";
    }
}
