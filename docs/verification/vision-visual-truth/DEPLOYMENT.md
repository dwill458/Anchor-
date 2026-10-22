# Authorized backend deployment

The user authorized committing the Vision work and deploying the backend after the phone QA pass.

- Backend commit: `08a2740b` — preserve focal subjects in editorial image crops.
- Mobile/migration/report commit: `967dcb75` — editorial Canvas and enhanced Anchor surfaces.
- Railway production service: `9452091d-b38c-42f8-98f1-2e3e008af762`, project `c41a295a-49be-4fa1-b099-6c1a2f0edef3`.
- Deployment: `187e5f3c-b76c-45f5-9a84-11eb0f856718`.
- Verified terminal status: **SUCCESS**.
- Production health verified at `2026-10-01T04:20:01.742Z`: HTTP **200**, service `anchor-api`, status `ok`, database `ok`.
- Startup: 35 Prisma migrations found; no pending migrations to apply.
- Pre-deploy verification: backend TypeScript build passed; 3 targeted suites / 47 tests passed.

[Railway deployment](https://railway.com/project/c41a295a-49be-4fa1-b099-6c1a2f0edef3/service/9452091d-b38c-42f8-98f1-2e3e008af762?id=187e5f3c-b76c-45f5-9a84-11eb0f856718)

[Production health](https://anchor-production-26bf.up.railway.app/health)

This deploy uploads the backend from the repository root, using the existing Railway service/build configuration. The existing `.railwayignore` excludes mobile code, local credentials, dependencies, generated bundles, and QA captures from the upload. No provider variables were changed. No mobile OTA was published and no Git push was performed.

Local phone captures, recordings, test output, and export artifacts remain untracked. They were preserved rather than included in the source commits. Authenticated reference-photo/generation acceptance after this release was not independently rerun; deployment health is verified separately from that product test.
