namespace ProjectHub.Application;

public sealed class PortalException(int status, string code) : Exception(code)
{
    public int Status { get; } = status;
    public string Code { get; } = code;
}

public static class PortalErrorCodes
{
    public static string ForStatus(int status) => status switch
    {
        400 => "invalidRequest",
        401 => "signInRequired",
        403 => "accessDenied",
        404 => "notFound",
        409 => "valueExists",
        413 => "invalidFileSize",
        429 => "rateLimited",
        503 => "maintenance",
        _ => "unexpected"
    };
}
