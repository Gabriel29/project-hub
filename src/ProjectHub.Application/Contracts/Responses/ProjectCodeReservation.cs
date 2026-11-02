namespace ProjectHub.Application;

public sealed record ProjectCodeReservation(
    Guid? ClientId,
    string Code);
