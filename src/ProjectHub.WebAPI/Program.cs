using ProjectHub.Infrastructure;
using ProjectHub.WebAPI;

var builder = WebApplication.CreateBuilder(args);
builder.ConfigurePortalHosting();
builder.Services
    .AddPortalApplication()
    .AddProjectHubInfrastructure(builder.Configuration, builder.Environment.IsDevelopment())
    .AddPortalWebApi();

var app = builder.Build();
app.UsePortalPipeline();
app.MapPortalEndpoints();
await app.InitializePortalAsync();
app.Run();

public partial class Program
{
}
