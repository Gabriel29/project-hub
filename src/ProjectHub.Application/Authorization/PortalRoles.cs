namespace ProjectHub.Application;

public static class PortalRoles
{
    public const string Owner = "Owner";
    public const string Admin = "Admin";
    public const string Client = "Client";
    public const string Manage = "ManagePortal";
    public const string Own = "OwnPortal";
}

public static class ActorGuard
{
    public static void Authenticated(ICurrentUser actor)
    {
        if (string.IsNullOrWhiteSpace(actor.Id))
        {
            throw new PortalException(401, "signInRequired");
        }
    }

    public static void Manager(ICurrentUser actor)
    {
        Authenticated(actor);
        if (!actor.IsManager)
        {
            throw new PortalException(403, "accessDenied");
        }
    }

    public static void Owner(ICurrentUser actor)
    {
        Authenticated(actor);
        if (!actor.IsOwner)
        {
            throw new PortalException(403, "accessDenied");
        }
    }
}
