FROM node:22-alpine AS frontend
WORKDIR /build/client
COPY client/package*.json ./
RUN npm ci --no-audit --no-fund
COPY client/ ./
RUN npm run build

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS backend
WORKDIR /build
COPY Directory.Build.props ./
COPY src/ src/
COPY tests/ tests/
RUN dotnet restore src/ProjectHub.WebAPI/ProjectHub.WebAPI.csproj
RUN dotnet publish src/ProjectHub.WebAPI/ProjectHub.WebAPI.csproj -c Release -o /out --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=backend /out ./
COPY --from=frontend /build/client/dist ./wwwroot
ENV ASPNETCORE_ENVIRONMENT=Production
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=120s --retries=3 CMD curl --fail --silent http://localhost:${PORT:-8080}/health || exit 1
USER $APP_UID
ENTRYPOINT ["dotnet", "ProjectHub.WebAPI.dll"]
