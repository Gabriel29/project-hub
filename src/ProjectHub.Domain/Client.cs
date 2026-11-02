namespace ProjectHub.Domain;

public class Client
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string? CodePrefix { get; set; }
    public string Name { get; set; } = "";
    public string UserId { get; set; } = "";
}
