using ProjectHub.Domain;

namespace ProjectHub.Application;

public static class ActivityPhotoRules
{
    // Selection order is the carousel order; the first photo is the primary photo.
    public static Guid[] Ordered(Guid[]? photoIds, Guid? primary) => (photoIds is { Length: > 0 } ? photoIds : primary is Guid id ? [id] : []).Distinct().ToArray();

    public static CalendarEntryDto Dto(CalendarEntry entry)
    {
        var photos = Ordered(entry.PhotoIds, entry.PhotoContentId);
        return new(entry.Id, entry.Title, entry.Details, entry.OccurredAt, photos.Length == 0 ? null : photos[0], photos);
    }
}
