namespace ProjectHub.Application;

public interface ICurrentUser
{
    string Id { get; }

    bool IsManager { get; }

    bool IsOwner { get; }

    string? Ip { get; }
}
