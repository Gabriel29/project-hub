# Object storage

Development and production Compose files use `chrislusf/seaweedfs:4.48` directly.
The MinIO source-build Dockerfile is removed. SeaweedFS runs its master, volume,
filer and S3 gateway together with `weed mini`; this is a single-node deployment,
not a replicated or highly available storage cluster.

## Configuration

- Service: `storage`; container S3 endpoint: `http://storage:8333`.
- Host development endpoint: `http://localhost:8333`, published on loopback only.
- Application bucket: `projecthub-files`; region: `us-east-1`; path-style S3 enabled.
- Credentials: `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`, shared by the
  API and SeaweedFS. Development has local-only defaults; production requires
  explicit private values in Dokploy Environment.
- Data: named `seaweedfs-data` volume mounted at `/data`. Master, filer metadata,
  volume data and generated identity configuration persist there across restarts.
- Readiness: S3 `/readyz`; API startup then verifies an authenticated
  upload/download/delete round trip before serving requests.

Admin UI, WebDAV, embedded IAM API, Iceberg and Lance endpoints are disabled.
Only S3 is published locally. Production storage stays on the internal backend
network with no host ports or public domain. File downloads pass through the
application's authentication and authorization checks. Missing AWS credentials
must never be used to run the service: SeaweedFS can otherwise allow anonymous
access. Production Compose rejects missing credentials before startup.

`weed mini` seeds initial S3 credentials from the AWS environment variables and
persists identities in its filer. For an existing SeaweedFS volume, rotate
credentials using SeaweedFS identity management and update the API consistently;
changing environment variables alone is not a credential-rotation procedure.
Never remove the volume to rotate credentials.

The existing `S3Storage` adapter and AWS SDK continue to handle objects. PostgreSQL
holds file metadata and folder hierarchies. No database schema change is needed.

## Local usage and verification

Run `docker compose up --build` for the full stack, or
`docker compose up -d postgres storage` for host-based API development. Export
`.env.example` values for the host API; `dotnet run` does not load that file itself.
There is no custom storage image to build and no port-9001 console.

The backend integration test runs against an explicitly supplied disposable local
SeaweedFS endpoint. It creates a unique test bucket and removes only its own
objects and bucket. GitHub CI starts the pinned image and runs the test. To run
locally, set these variables before `dotnet test`:

```sh
export SEAWEEDFS_TEST_ENDPOINT=http://localhost:8333
export SEAWEEDFS_TEST_ACCESS_KEY=local-development-only
export SEAWEEDFS_TEST_SECRET_KEY=local-development-only
dotnet test tests/ProjectHub.Tests/ProjectHub.Tests.csproj --filter FullyQualifiedName~SeaweedStorageTests
```

This checks repeated bucket initialization, startup verification cleanup, a 6 MB
object spanning filer chunks, content type and exact bytes, rejection of unsigned
and invalid credentials, repeated deletion and missing-object responses. Without
the endpoint variable, this integration test is skipped. The normal backend
suite also needs its disposable local PostgreSQL database as documented elsewhere.

## Moving an existing installation from MinIO

Repository changes do not deploy services or migrate existing objects. Before a
production rollout, set private `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`
variables in Dokploy. The retired `MINIO_ROOT_USER` and `MINIO_ROOT_PASSWORD`
variables are no longer consumed by Compose.

MinIO and SeaweedFS have incompatible disk layouts. The new `seaweedfs-data`
volume deliberately does not reuse the old `minio-data` or `storage-data` volume.
A new volume starts empty; pointing existing file metadata at it before copying
objects makes those files unavailable.

For an installation with existing uploads:

1. Back up PostgreSQL and existing object storage together, and pause writes and
   cleanup workers for the final synchronized copy.
2. Start SeaweedFS separately on its own volume and authenticated endpoint, while
   keeping the old storage accessible to the migration tool.
3. Copy the application bucket through the S3 APIs, retaining every object key,
   byte and content type. Verify object counts and checksums/content against the
   source and the keys referenced by PostgreSQL.
4. Switch the API to SeaweedFS, run storage verification and validate real file
   downloads/uploads/deletions before reopening writes.
5. Retain the old volume and backup until the migration is accepted. Remove the
   old service, volume or credentials only when explicitly authorized.

The new Compose service name also leaves an existing local `minio` container as
an orphan. Do not automatically remove that container or its volume before copying
any needed objects. Normal `docker compose down` preserves named volumes.

References: [SeaweedFS 4.48](https://github.com/seaweedfs/seaweedfs/releases/tag/4.48),
[mini quick start](https://github.com/seaweedfs/seaweedfs/wiki/Quick-Start-with-weed-mini),
[S3 credentials](https://github.com/seaweedfs/seaweedfs/wiki/S3-Credentials).
