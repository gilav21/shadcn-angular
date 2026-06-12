# Local SonarQube pre-delivery audit

We deliver code that **clients** run through their SonarQube. To catch those
findings *before* delivery — across the whole repo, not just the files open in
SonarLint — run **SonarQube Community Edition locally in Docker** and scan with
`sonar-scanner`. It's the same analyzer the clients use, so it catches every
rule (including the TS-specific `S77xx` rules that `eslint-plugin-sonarjs` and
`npm run lint` don't have).

> `npm run lint` (eslint-plugin-sonarjs) is still the fast CI gate for the common
> Sonar way base. This local SonarQube is the heavier, **complete** pre-delivery
> check.

## 1. Start a local SonarQube (once)

```bash
docker run -d --name sonarqube -p 9000:9000 sonarqube:community
```

Wait ~1 minute, then open <http://localhost:9000> (default login `admin` /
`admin`, it forces a password change). Create a project named `shadcn-angular`
and generate an **analysis token** (My Account → Security → Generate Token).

## 2. Run the scan (each time you want a report)

The scanner runs in Docker too — nothing to install. From the repo root:

**Windows (PowerShell):**
```powershell
docker run --rm `
  -e SONAR_HOST_URL="http://host.docker.internal:9000" `
  -e SONAR_TOKEN="<your-token>" `
  -v "${PWD}:/usr/src" `
  sonarsource/sonar-scanner-cli
```

**macOS / Linux:**
```bash
docker run --rm \
  -e SONAR_HOST_URL="http://host.docker.internal:9000" \
  -e SONAR_TOKEN="<your-token>" \
  -v "$(pwd):/usr/src" \
  sonarsource/sonar-scanner-cli
```

(On Linux you can also use `--network host` and `http://localhost:9000`.)

Config (sources, exclusions, the `tsconfig.eslint.json` for type-aware rules)
lives in `sonar-project.properties`.

## 3. Read the results

Open <http://localhost:9000/dashboard?id=shadcn-angular> — every Bug, Code Smell,
Vulnerability and Security Hotspot the client would see, with the rule id (e.g.
`typescript:S7727`) and file:line. Fix, re-scan, repeat until the gate is clean.

## Notes

- **Community Edition is free** and includes the full JS/TS rule set (Sonar way).
  Commercial editions add branch analysis, more languages, and advanced security
  — not the JS/TS code-smell/bug rules, which are all here.
- If a client uses a **custom quality profile** (most do — "wide base + a few
  tweaks"), mirror it: in the local SonarQube create a quality profile matching
  theirs, or export/import their profile XML, and assign it to the project.
- Stop the server with `docker stop sonarqube` (state persists; `docker start
  sonarqube` to resume).
