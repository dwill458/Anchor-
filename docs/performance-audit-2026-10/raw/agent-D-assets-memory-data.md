# Agent D: Assets, Memory and Data (read-only performance audit)

Repo: `E:\Projects\Anchor` (branch `feat/celebration-layer`, dirty tree), mobile in `anchor/mobile`, backend in `backend/`.
Audit date: 2026-10-12. Nothing was run on a device; nothing was edited except this file.

Evidence legend: **measured on disk** = I measured file sizes, dimensions, bitrates, hashes or counted code on disk. **code suspected** = derived from reading source; no runtime measurement. "Decoded" = width x height x 4 bytes (RGBA8888), an upper bound for a bitmap decoded at intrinsic size.

Method (re-derivable): a script walked `src/`, `App.tsx`, `index.js`, resolved every literal `require('...')` (relative and `@/` alias) and read size/dimensions with PIL and `ffprobe`. Result: 415 literal-required assets = 160.8 MB (mp3 216 files / 111.8 MB, jpg 95 / 23.4 MB, png 48 / 19.6 MB, wav 49 / 5.1 MB, webp 1 / 0.7 MB, ttf 6). 144 raster images would decode to 650 MB if all were decoded at once (never true). Files not literally required are not bundled by Metro.

## Known / already-handled (verified, not re-reported as new)
- 2026-10-07 audit: 63 mp3 re-encoded to 128 kbps CBR; panorama (5760x1920) left intentionally; `expo-image` is NOT installed (still true; `expo-image-manipulator` is also absent from `anchor/mobile/package.json`); remote session audio built (`services/audio/remoteAudio.ts`). That audio work has been partly undone, see D-03.
- Chart world masters (`src/assets/chart/world/masters`, 108 MB) are not required anywhere, so not bundled. `ChartJourneyWorld` is commented out of every live caller (`// DEFERRED:` blocks), so its five runtime layers (8.6 MB disk, 43.3 MB decoded per `manifest.json`) are not reachable from the entry graph.
- Root docs `BUNDLE_ANALYSIS.md`, `PERFORMANCE_BASELINE.md`, `PERFORMANCE_OPTIMIZATION_SUMMARY.md`, `DEVICE_PROFILING_GUIDE.md` (last commit 2026-02-02) are stale: baseline numbers are all "TBD", they describe `react-native-fast-image` (not used; `OptimizedImage.tsx` wraps RN `Image`) and `expo-av` removal. Do not use as baselines.

---

## Issues (ordered by severity)

### D-01  Reference/photo uploads send the original camera file, base64 inline, all in parallel
- **Screen/System:** Vision creation (photos path), Vision add-scene start photo, appearance reference, Chart reference tray; backend `POST /api/v2/assets/upload`, `/api/v2/vision/appearance-reference`
- **Proposed severity:** P1
- **Evidence type:** code suspected (limits and constants read from source)
- **Symptoms:** Multi-photo or high-resolution uploads stall for seconds on cellular; 413 / "Image upload failed" for 50 MP photos (typically >8 MB); JS heap spikes while several uploads are in flight; user photos then feed Visualize, which rejects any image above 2048x2048 px (`isCinematicTextureSize`), so a full-resolution upload can fail the cinematic (`oversizedCount > 0`).
- **Reproduction:** Vision creation > photos > pick 8 photos taken in 50 MP mode on the S24 (or 8 x 12 MP) while watching network and JS heap; then run Visualize on that Vision. For the 413: pick one 50 MP photo.
- **Measurements:** Backend JSON limit for both upload routes is `8mb` (`backend/src/index.ts:243-246`); everything else `1mb` (`:249`). base64 inflates x4/3, so the raw file must be <= ~6 MB. Client reads the original with `FileSystem.readAsStringAsync(..., Base64)`, concatenates `data:<mime>;base64,<...>`, then axios JSON-stringifies it: up to three live copies of a ~8 MB string per upload. `expo-image-picker` `quality` (0.85 / 0.7 / 0.6 by caller) only recompresses, it never resizes. `VISION_BOARD_MAX_IMAGES = 8` (`components/v2/vision/board/visionBoardLayouts.ts:3`) and `prepareUploads` fires every photo concurrently (`useVisionCreationActions.ts:125-127`). Worst case 8 x 3 x ~8 MB = ~190 MB of transient JS strings (my arithmetic, not measured). Backend stores the buffer unchanged (`visionRoutes.ts:432`) and later serves it as `resolvedImageUrl`, so the board downloads the original. Generated images, by contrast, are normalised to 1080x1920 JPEG q86 (`VisionGenerationService.ts:620-629`).
- **Likely root cause (confidence high):** no downscale/re-encode between picker and storage; base64-in-JSON transport.
- **Relevant files:** `anchor/mobile/src/components/v2/vision/ceremony/useVisionCreationActions.ts:81-127`; `hooks/v2/vision/visionPhotoInput.ts:36-80`; `hooks/v2/vision/useVisionAppearanceReference.ts:80-95`; `hooks/v2/vision/useV2Vision.ts:583-592`; `components/v2/chart/chartReferences.ts:36-62`; `components/v2/vision/V2VisionCreationFlow.tsx:160-168`; `screens/v2/practice/visualize/cinematicAssets.tsx:8-16,96-115`; `backend/src/api/routes/v2/visionRoutes.ts:408-446`; `backend/src/services/v2/VisionAppearanceReferenceService.ts:24-40`.
- **Recommended solution:** (1) Backend, OTA-safe: in `/assets/upload`, after validation, `sharp(buf).rotate().resize({width:2048,height:2048,fit:'inside',withoutEnlargement:true}).jpeg({quality:88,mozjpeg:true})` and store that (keep correct mime/size). 2048 long edge exceeds every on-screen use (board tiles, 1080x1920 share, 4.19 MP Visualize cap). (2) Mobile, needs a native build because `expo-image-manipulator` is not installed: resize to long edge 2048 / JPEG 0.85 before reading; upload via `FileSystem.uploadAsync` multipart instead of base64-in-JSON; cap concurrency at 2.
- **Visual preservation:** identical on screen (displayed <= 1080x1920 px; 2048 >= largest consumer). Appearance reference is only a model input (already re-encoded server-side).
- **Risk:** low for backend resize (`.rotate()` handles EXIF); medium for the multipart route. Existing stored assets unchanged unless backfilled.
- **Verification:** upload 12 MP and 50 MP JPEGs: stored object <= ~1 MB and <= 2048 px, no 413; Hermes heap flat during an 8-photo batch; Visualize shows `oversizedCount === 0`.

### D-02  Presigned URLs change on every read, so image caches never hit; private objects also carry `Cache-Control: private, no-store`
- **Screen/System:** Home hero, Anchor Details, Vision board, Share Studio; all `enhancedImageUrl` / `resolvedImageUrl`
- **Proposed severity:** P2
- **Evidence type:** code suspected
- **Symptoms:** After each launch / Home refresh / Vision refetch, artwork and photos are downloaded again instead of served from cache; blank or blur frames before art appears; `Image.prefetch` done on one read model is wasted when the next read returns different URLs; extra R2 egress.
- **Reproduction:** Cold launch twice with network logging: same anchor art fetched again with a different `X-Amz-Date` / `X-Amz-Signature`. Pull-to-refresh Vision and diff `resolvedImageUrl`.
- **Measurements:** `GET /api/anchors` re-signs every `enhancedImageUrl` per request, 7-day expiry (`backend/src/api/routes/anchors.ts:346-347`); Vision reads re-sign every scene per read, 3600 s (`StorageService.ts:281-308`, `VisionService.ts:122-124,496,568`). `buildSignedObjectUrl` presigns with only `{ expiresIn }` (`StorageService.ts:132-150`), i.e. signing date = now. Client caches key on the full URL; no stable-key logic exists in mobile (`grep X-Amz|cacheKey` finds none for images). Private vision uploads are stored with `CacheControl: 'private, no-store'` (`StorageService.ts:467`); iOS NSURLCache will not keep them.
- **Likely root cause (confidence high):** SigV4 presign signs with the current timestamp.
- **Relevant files:** `backend/src/services/StorageService.ts:132-150,248-308,467`; `backend/src/api/routes/anchors.ts:318-358`; `backend/src/services/v2/VisionService.ts:122,496,568,680`; `anchor/mobile/src/hooks/v2/home/useHomePrewarm.ts` (prefetch is by URL).
- **Recommended solution:** pass `signingDate` (floored to UTC midnight or a 6 h bucket) to the presigner and keep `expiresIn` 7 days (R2/S3 max), so the URL is byte-identical for all reads in the bucket and valid >= 6 days. Change private-asset `CacheControl` to `private, max-age=31536000, immutable` (object keys are unique per upload).
- **Visual preservation:** same bytes, fewer fetches; removes blank-then-fade flashes.
- **Risk:** low. Longer-lived URLs widen the exposure window of a leaked Vision link from 1 h to up to 7 days (anchor art already is 7 days); if unacceptable use 1-day expiry floored to 6 h.
- **Verification:** two consecutive anchors/Vision reads in the same bucket return identical URLs; second cold launch makes 0 image network requests for unchanged art.

### D-03  Bundled 192 kbps "V4" mixes undid the 10-07 remote-audio / 128 kbps work (+~96 MB); six `remoteAudio` entries are now dead
- **Screen/System:** App binary and OTA size; Focus, Deep Focus, Visualize guided audio
- **Proposed severity:** P2
- **Evidence type:** measured on disk
- **Symptoms:** Larger APK/IPA and OTA payloads; slower install/update; larger EAS archive.
- **Reproduction:** compare `expo export` asset size: `dist/assets` was **76 MB on 2026-10-09** (before commit `e3362c9e` on 2026-10-10, "update session audio mix tracks to v4"); `dist-vision2` (09-30) was 110 MB; static literal-require total today is 160.8 MB.
- **Measurements:** the 18 files under `focus-mix/` and `visualize/guided/` total **95.9 MB** at **192 kbps** (ffprobe: DeepFocus_10min 600 s / 192019 bps; Embody 615 s; Immerse 200 s; Focus_60s 59 s). Six of them (DeepFocus 5 min x2, DeepFocus 10 min x2, Embody 10 min x2 = **72.7 MB**) are also listed in `REMOTE_AUDIO_TRACKS` (`remoteAudio.ts:22-29`, with identical byte counts) yet are `require()`d locally (`SessionAudioManifest.ts:82-85,229-232`, `visualizeGuidedTracks.ts:14-15`). Nothing references `deepFocus5*`, `deepFocus10*`, `embody*` (grep). The remaining older cues are 128 kbps. md5 duplicates among bundled assets total only ~1.0 MB.
- **Likely root cause (confidence high):** new mixes delivered as bundled assets; manifest synced to local requires.
- **Relevant files:** `anchor/mobile/src/services/SessionAudioManifest.ts:62-98,229-232`; `services/visualizeGuidedTracks.ts:3-18`; `services/audio/remoteAudio.ts:22-30`; `.easignore` (`audio-remote/` excluded).
- **Recommended solution:** move the six long mixes (optionally Immerse 3 min, 9.6 MB) back to the remote pipeline (content-hashed objects via `backend/scripts/upload-remote-audio.mjs`; point `remoteAudio()` at them; delete the local files). Keep <= 60 s mixes bundled. If bundling is intentional for offline reliability, at least re-encode to 128 kbps CBR as on 10-07 (about -32 MB) after confirming beat-map durations are unchanged.
- **Visual preservation:** n/a (audio; 128 kbps CBR was accepted on 10-07; remote move changes nothing audible).
- **Risk:** medium: 10-min Visualize Begin is gated on download in the existing design; first offline use needs a prior download. Needs hash and duration verification.
- **Verification:** `expo export` asset size before/after; ffprobe durations equal; guided playback / beat-map tests pass.

### D-04  authStore writes its whole persisted blob to SecureStore on every `set()` (no debounce, no dedupe, 1800-char chunks)
- **Screen/System:** Cold launch, login, any `useAuthStore` mutation
- **Proposed severity:** P2
- **Evidence type:** code suspected
- **Symptoms:** Extra native bridge traffic and Android Keystore AES operations during launch; possible dropped frames at the splash-to-Home hand-off.
- **Reproduction:** dev build with `perfLog`: count `persist-setItem` for `anchor-auth-storage` between launch and Home idle.
- **Measurements:** `encryptedAuthStorage.setItem` (`stores/authStore.ts:212-228`) does `writeSecureValue` + `AsyncStorage.removeItem` + one `SecureStore.deleteItemAsync` per legacy key, per persist call. `encryptedPersistStorage` debounces 400 ms and skips identical values (`encryptedPersistStorage.ts:173-196`), the auth store bypasses it. `writeSecureValue` = read meta + N deletes + delete meta + N sets + set meta = **2N + 3** native calls with `N = ceil(chars/1800)` (`:80-135`). Persisted slice: `user`, `token`, `profileData` (user duplicated + up to 20 anchors), pending draft/mutations (`authStore.ts:1124-1136`). authStore has 43 `set(` sites plus 10 external `setState`; the launch path hits `setLoading`, `setSession`, `setOfflineMode`, `setLoading`, `setUser`, `setState(profileData)`, `computeStreak` (`App.tsx:459-540`, `AuthHydrationService.ts:~780-800`). If the blob is 8-20 KB (5-12 chunks) that is ~13-27 native calls x 7-10 writes = ~90-270 calls at launch (estimate, not measured).
- **Likely root cause (confidence medium-high):** auth storage predates the debounce wrapper.
- **Relevant files:** `anchor/mobile/src/stores/authStore.ts:190-232,1101-1137`; `stores/encryptedPersistStorage.ts:80-135,173-258`.
- **Recommended solution:** route `encryptedAuthStorage.setItem` through the same `scheduleWrite` (debounce 300-400 ms, trailing flush on `AppState` background and before sign-out); in `writeSecureValue` skip chunks whose content is unchanged and delete only chunks beyond the new count; persist `profileData` only on change (shallow compare in `partialize`) or stop persisting it if it can be rebuilt.
- **Visual preservation:** none.
- **Risk:** medium: auth persistence must flush before process death; `AuthHydrationService.test.ts` is already failing (10-07 note), add coverage.
- **Verification:** count native SecureStore calls during launch (instrument with `perfLog`): from ~100+ to < 20; session restores after kill and relaunch.

### D-05  `writeSecureValue` is not atomic: old chunks are deleted before new ones are written
- **Screen/System:** every `encryptedPersistStorage` / auth write (vault anchors, session store, first-run, creation drafts, guest-only local anchors)
- **Proposed severity:** P1 (data-loss window; low probability, high impact for guest-only local anchors)
- **Evidence type:** code suspected
- **Symptoms:** If the process dies between `clearSecureChunks` and the final meta write, the key reads back empty or "chunk mismatch; clearing corrupted data" (`readSecureValue` deletes on mismatch, `encryptedPersistStorage.ts:104-109`) and state is dropped.
- **Reproduction:** force-stop during a multi-chunk write (large vault, creation save).
- **Measurements:** `writeSecureValue`: `clearSecureChunks(name)` (`:118-121`), then parallel chunk sets, then meta set (`:122-134`). Window = about N Keystore round trips.
- **Likely root cause (confidence high that the window exists; probability depends on kill timing).**
- **Relevant files:** `anchor/mobile/src/stores/encryptedPersistStorage.ts:80-135`.
- **Recommended solution:** write-new-then-swap: write chunks under a generation suffix, write meta (pointing at the new generation) last, then delete the previous generation. Combine with D-04 chunk diffing.
- **Visual preservation:** none. **Risk:** medium (storage format migration, keep the legacy-key reader). **Verification:** unit test with a SecureStore mock that throws after K calls; assert the previous value still reads back.

### D-06  Launch fan-out: full account export every launch, two overlapping anchor-list calls, no compression, and a 100 requests / 15 min limiter
- **Screen/System:** Cold launch hydration (`AuthHydrationService.hydrateAuthenticatedData`), backend `GET /api/auth/me/export`, global rate limiter
- **Proposed severity:** P2 (P1 when the limiter returns 429; "reload then 429" is already in the dev notes)
- **Evidence type:** code suspected (constants read from source)
- **Symptoms:** Slow first sync on large accounts; Home data arrives late; 429 "Too many requests" after ordinary use; Vision-generation polling errors after a few minutes.
- **Reproduction:** launch with network log: `/api/auth/sync`, `/api/auth/me`, `/api/anchors?limit=20`, `/api/anchors?limit=100`, `/api/auth/me/export`, then Home prefetch (recommendation, vision, chart for up to 3-4 anchors). Count requests per launch and per swipe.
- **Measurements:**
  - `fetchCompleteProfile()` does `/api/auth/me` + `fetchActiveAnchors(20)` (`ApiClient.ts:372-377`) while `AuthHydrationService.ts:672-676` also requests `/api/anchors?limit=100`: two anchor-list calls per launch, each re-signing every artwork URL (D-02).
  - `GET /api/auth/me/export` is requested on every hydration (`AuthHydrationService.ts:745`). Backend runs 14 parallel unbounded Prisma queries (anchors with all nested activations and charges, then activations and charges again at top level, all practiceSessions, visualizationScenes, courses, waypoints, reflections, courseEvents, orders, syncQueue, burnedAnchors, flaggedContent) (`backend/src/api/routes/auth.ts:627-730`). Payload grows linearly with history and duplicates activations/charges.
  - No `compression` middleware (not in `backend/package.json` or `src/index.ts`); verify real `Content-Encoding` on Railway.
  - Axios default timeout 120 s, no retry/backoff layer (`ApiClient.ts:22-28`).
  - Limiter `max: 100` per 15 min per uid on all `/api/` calls (`backend/src/index.ts:257-273`; 10 000 only for `NODE_ENV=development`/AI developers). Launch (~8-10 requests) + Home swipes (up to ~3 chart GETs each, D-07) + Vision polling every 2.5 s (24 req/min per active generation, `useV2VisionGeneration.ts:84-87`) exhausts it in minutes.
  - Two `verifyIdToken` passes per request: `optionalAuthMiddleware` on `/api/` (`index.ts:254`) and `authMiddleware` on the route (`api/middleware/auth.ts`).
- **Likely root cause (confidence high):** the export endpoint was reused as a hydration source; limiter sized for abuse control, not for a chatty mobile client.
- **Relevant files:** `anchor/mobile/src/services/AuthHydrationService.ts:655-770`; `services/ApiClient.ts:22-28,372-396`; `backend/src/api/routes/auth.ts:627-730`; `backend/src/index.ts:239-273`; `backend/src/api/middleware/auth.ts`.
- **Recommended solution:** (1) pass the already-fetched anchors into `fetchCompleteProfile` (drop the 20-anchor call); (2) take `/me/export` off the launch path (after Home is interactive, rate-limited to once per N hours) or replace with a delta endpoint `?since=`; at minimum drop the duplicated nested activations/charges; (3) add gzip `compression()`; (4) split limiters: reads 600+/15 min, writes and AI strict, polling GETs in their own bucket; (5) per-call timeouts (15-20 s for reads) and one jittered retry for idempotent GETs; (6) verify the token once per request.
- **Visual preservation:** none. **Risk:** medium for the export change (client uses it for practice-history migration; keep a forced path). **Verification:** launch request count and bytes before/after, `Content-Encoding: gzip`, no 429 in a 30-minute scripted session.

### D-07  Home prewarm re-requests the Chart for every neighbour on each swipe and anchorList change; its abort can cancel shared in-flight requests
- **Screen/System:** Home carousel (`useHomePrewarm`), Chart cache (`useAnchorChart.loadAnchorChart`)
- **Proposed severity:** P2
- **Evidence type:** code suspected
- **Symptoms:** Network and CPU churn on every swipe; adds to 429 pressure (D-06); Chart subscribers rerender on each refetch even when data is identical; possible spurious error on the Home Vision tile if its shared request is aborted.
- **Reproduction:** Home with >= 3 anchors, swipe through with network logging: each swipe issues Chart GETs for current/next/prev regardless of cache.
- **Measurements:** `warmAnchor` calls `loadAnchorChart(id)` unconditionally (`useHomePrewarm.ts:66`); `loadAnchorChart` only dedupes in-flight requests, with no freshness check (`useAnchorChart.ts:91-110`); `publish` notifies listeners with a new object each time and no deep-equal (`:38-45`; Vision has `sameVision`). Recommendations have a TTL (`isV2RecommendationContextFresh`) and Vision checks `visionReadCache.has`. The effect depends on `[anchors, selectedIndex]` (`:90`) and `anchorList` is rebuilt when selection or practice history changes (`useV2HomeModel.ts:336-343`). Cleanup `controller.abort()` (`:84-88`) aborts the signal passed to `prefetchV2Vision`, which shares `inFlightVision` with mounted `useV2Vision` hooks (`useV2Vision.ts:154-170`). Each Chart publish also persists the whole Chart JSON through SecureStore chunks (`:40-42`).
- **Likely root cause (confidence high for the missing freshness check; medium for the abort side effect).**
- **Relevant files:** `anchor/mobile/src/hooks/v2/home/useHomePrewarm.ts:18-91`; `hooks/v2/chart/useAnchorChart.ts:36-110`; `hooks/v2/vision/useV2Vision.ts:154-210`.
- **Recommended solution:** TTL (60-120 s) + `peekAnchorChart` check before `loadAnchorChart` in prewarm; skip `publish` when the serialized value or version/updatedAt is unchanged; do not pass the effect-scoped abort signal into shared in-flight requests.
- **Visual preservation:** none. **Risk:** low. **Verification:** swipe 10 times: Chart GETs drop from ~30 to <= 3; no listener re-render when payload is unchanged.

### D-08  Small display, big bitmap: Vision method polaroids decode three 1920x1280 photos for 104x128 dp thumbnails (plus similar cases)
- **Screen/System:** Vision creation "method" step (`VisionMethodStage`); related items below
- **Proposed severity:** P2
- **Evidence type:** measured on disk (dimensions) + code (display size)
- **Symptoms:** ~29 MB of bitmap memory and a decode hitch entering the step for imagery drawn at ~270x336 px.
- **Reproduction:** open Vision creation to the method step; graphics memory rises ~30 MB (Android Studio profiler / `dumpsys meminfo`).
- **Measurements:** `polaroid: width 104, height 128` (`VisionMethodStage.tsx:165`) x 3 using `vision-future-movement.jpg`, `-home.jpg`, `-family.jpg`, each **1920x1280 = 9.83 MB decoded** (`visionIntroArt.ts:41-45`); needed at 3x density: 312x384 px = ~0.5 MB (about 20x too large). RN Android `Image` does not downsample bundled or remote sources by default: `ImageResizeMethod.AUTO` resizes only content/file URIs (`node_modules/react-native/ReactAndroid/.../ReactImageView.kt:559-562`); only ~8 of 101 `<Image>` usages set `resizeMethod`. Other measured oversize cases: Vision "generate" card photo (720x1280, 3.7 MB decoded, shown in a 68%-width card); `AnchorSelectorSheet` / `AnchorSelectorPill` avatars load 1024x1024 art (4.2 MB each) at ~40-80 dp (`AnchorSelectorSheet.tsx:107`; used by Chart editor/Waypoint detail, reachability worth confirming, low confidence); vision note textures 512x512 PNG x8 (2.9 MB disk); share-environment backgrounds 900x1600 (5.8 MB decoded each) shown in ~180-260 dp previews (the 1080x1920 export node is intentional).
- **Likely root cause (confidence high):** one master asset reused at very different display sizes.
- **Relevant files:** `anchor/mobile/src/components/v2/vision/VisionMethodStage.tsx:84-120,149,165`; `components/v2/vision/visionIntroArt.ts:41-46`; `screens/practice/components/AnchorSelectorSheet.tsx:107`; `components/share/StyleEditorialMorphPreview.tsx`.
- **Recommended solution:** ship `*-thumb` derivatives at 2x the largest display size (polaroid art ~560x373 JPEG q85, ~30 KB); for remote avatars return a 256 px thumbnail (D-10) or set `resizeMethod="resize"`. For bundled images use pre-sized files (`resizeMethod` does not help res/ sources).
- **Visual preservation:** equivalent when thumbs are >= 2x displayed pixels at the highest density; keep full-res where drawn full-bleed.
- **Risk:** low. **Verification:** graphics memory on that step; screenshot diff at 3x.

### D-09  Visualize cinematic fetches each photo up to three times
- **Screen/System:** Visualize prepare / cinematic (`useCinematicAssets`)
- **Proposed severity:** P2
- **Evidence type:** code suspected
- **Symptoms:** Longer "preparing" phase on a Vision with 6-8 photos; three HTTP fetches per image over presigned URLs that are not cache-stable (D-02); 20 s timeout then partial film; photos above 2048x2048 are dropped.
- **Measurements:** per source: `Image.getSize(url)`, `Image.prefetch(url)`, and Skia `useImage(url)` (a separate `Skia.Data.fromURI` fetch) (`cinematicAssets.tsx:40-47,96-115`). `MAX_CINEMATIC_TEXTURE_PIXELS = 2048*2048` = 16 MiB decoded (`:8-14`). `cinematicPhotoFocus` surfaces are <= 384 px and disposed (clean).
- **Likely root cause (confidence medium):** each API uses a different cache.
- **Relevant files:** `anchor/mobile/src/screens/v2/practice/visualize/cinematicAssets.tsx:8-133`; `V2VisualizePrepareScreen.tsx:110-120`.
- **Recommended solution:** download once to the app cache dir keyed by assetId (assets are immutable) with `FileSystem.downloadAsync`, then feed the local `file://` URI to `getSize` and Skia; drop `Image.prefetch`. Pairs with D-01 and D-02.
- **Visual preservation:** identical pixels. **Risk:** low-medium. **Verification:** one network fetch per photo per install; prepare time on a 6-photo Vision.

### D-10  Anchor art is stored as raw model output (PNG-labelled), with no thumbnail or modern format
- **Screen/System:** Home hero, details, selector sheets, share; backend `AIEnhancer.ts:405-421` -> `uploadImageFromBuffer` (default `image/png`)
- **Proposed severity:** P2/P3
- **Evidence type:** measured on disk (local dev outputs in `backend/uploads`, not production)
- **Symptoms:** 0.75-2.9 MB per art file; list views that show 40 dp avatars download and decode the full 1024x1024.
- **Measurements:** newest 400 files in `backend/uploads`: all 1024x1024; 172 true PNG (median 2.39 MB, max 2.95 MB) and 228 JPEG bytes stored under `.png` names and content-type (median 0.89 MB, max 1.40 MB). Production sizes unknown.
- **Likely root cause (confidence medium):** no post-processing between model output and R2.
- **Relevant files:** `backend/src/services/AIEnhancer.ts:405-421`; `backend/src/services/StorageService.ts:445-480`.
- **Recommended solution:** after generation `sharp(buf).webp({lossless:true})` (pixel-identical, typically 30-50% smaller than PNG) for PNG outputs; leave JPEG outputs as JPEG with the true `ContentType`; also write a 256 px thumbnail and return it for list views.
- **Visual preservation:** lossless WebP is pixel-identical; do not re-encode existing JPEG. **Risk:** low-medium (verify WebP decode on the iOS minimum). **Verification:** decoded-pixel compare; list-view network bytes.

### D-11  Generation poll loops re-render every 2.5 s and have no in-flight guard
- **Screen/System:** Vision image generation (`useV2VisionGeneration`, `useV2VisionSceneGeneration`)
- **Proposed severity:** P3
- **Evidence type:** code suspected
- **Measurements:** `setInterval(refresh, 2500)` (`useV2VisionGeneration.ts:84-87`; scene variant `POLL_MS`, `useV2VisionSceneGeneration.ts:74-77`); `refresh` always `setJob(newObject)`; no `if (inFlight) return`; with the 120 s axios timeout a slow server stacks requests. Foreground gating and cleanup are correct.
- **Recommended solution:** skip when a request is in flight; `setJob` only when status/progress/updatedAt changed; back off 2.5 s -> 5 s after 30 s. **Visual preservation:** none. **Risk:** low. **Verification:** request count per generation; React profiler commits.

### D-12  Persisted read models contain expiring presigned URLs and are rewritten on every fetch
- **Screen/System:** `useV2Vision` persisted reads, anchor vault, recommendation and Chart caches
- **Proposed severity:** P3
- **Evidence type:** code suspected
- **Measurements:** `persistVisionRead` runs after every successful fetch (`useV2Vision.ts:86-93,170-180`) through `encryptedPersistStorage`. Because each read has fresh URLs (D-02) the 400 ms dedupe never matches, so the blob (estimate 6-12 KB, 4-7 chunks) is fully rewritten on every Home mount/refresh per anchor. Restored reads seed the first frame with URLs that expired up to 1 h after signing.
- **Recommended solution:** persist storage keys (or URLs with query stripped) and re-sign on first fetch, or fix D-02 so values are stable and dedupe hits. **Risk:** low. **Verification:** SecureStore call count per Home mount.

### D-13  Latent: `V2HomeCategoryEnvironment` would mount all 12 category images at once (75.5 MB decoded)
- **Screen/System:** Home background (exported from `components/v2/home/index.ts:3`, not rendered anywhere; verified by grep)
- **Proposed severity:** P3 (latent)
- **Evidence type:** measured on disk (12 files 1536x1024 = 6.29 MB decoded each) + code
- **Measurements:** comment "All bundled environments stay mounted so repeated switches avoid loading frames" (`V2HomeCategoryEnvironment.tsx:36-47`); inactive layers are `opacity 0` Animated.Views that still hold decoded bitmaps. Displayed ~1080x720 px (3.1 MB). The only live consumer of `homeCategoryArt` is `CreationStage.tsx:748` (single image at 0.24 opacity, fine).
- **Recommended solution (if revived):** mount active + previous/next only and ship 1080x720 variants, or crossfade by swapping one `Image` source. **Visual preservation:** identical. **Risk:** n/a today.

### D-14  Minor / hygiene (P3, code suspected unless noted)
- **Whole-store subscriptions:** `RootNavigator` uses `useAuthStore()` with no selector (`navigation/RootNavigator.tsx:65`), so every auth write (D-04) re-renders the root navigator element; `useTeachingGate` subscribes to the whole teaching store (`utils/useTeachingGate.ts:91`, 18 call sites). Use selectors with `useShallow`.
- **Startup fonts:** 18 TTF registrations (~2.2 MB; Inter 2 x 343 KB, EB Garamond Regular 490 KB) via runtime `useFonts`, gating the splash (`App.tsx:298-318`; `useAppStartup.ts:36-45`). `CormorantGaramond-*` are aliases of CrimsonPro (duplicate registration). Embed fonts at build time with the `expo-font` config plugin (needs a native rebuild).
- **Unbounded small module caches:** `DISTILLATION_CACHE`, `SIGIL_FORMATION_CACHE`, `SIGIL_RESULT_CACHE` (`utils/sigil/*`), `encryptedPersistStorage.lastWrittenValue` (a second copy of every persisted blob string), `writeCounts`, `authWriteCounts`. Typing in IntentionInput adds one `DISTILLATION_CACHE` entry per prefix. Cap with a small LRU (~200).
- **Backend generation jobs** run fire-and-forget in the API process with no concurrency cap (`VisionGenerationService.ts:177,279,307`: `void this.run(...)`); per-call model timeout 60 s (`GeminiImageService.ts:1863`). Add a semaphore (e.g., 3) to protect Railway memory.
- **Repo / EAS archive hygiene (measured):** 277 files / 159.8 MB under `src/assets` and `assets` are not bundled but are uploaded in each EAS archive (`.easignore` excludes `docs/`, `scripts/`, etc. but not these): `src/assets/chart/world/masters` 108 MB, `assets/audio-source` 4 MB, unreferenced onboarding PNGs (~7 MB), `anchor-icon-v2/v3.png`, `anchor-gold.png` 2 MB. Add `src/assets/chart/world/masters/` and `assets/audio-source/` to `.easignore`. `backend/uploads` (626 MB) is gitignored.
- **Duplicate audio cues (measured):** ~1.0 MB of byte-identical voice cue files (e.g., `focus-session-30s-start.mp3` = `focus-session-120s-opening.mp3` = `deep-prime-15m-opening.mp3`); alias one `require`.
- **ForgeDemo** (`components/onboarding/ForgeDemo.tsx:12`) requires `assets/onboarding_anchor.png` (2158x1952, 3.26 MB, 16.8 MB decoded); confirm the screen is reachable, else drop the asset.

---

## Asset size table (top 40 literal-required assets by size)

Rows 11, 16, 17, 22 (`chart_0x` runtime layers) are required only by `ChartJourneyWorld.tsx`, which no live module imports; they should be absent from the bundle (confirm in the export asset map). Audio rows show duration and bitrate from ffprobe.

| # | Path (relative to anchor/mobile) | Size | Format / dims | Decoded RGBA |
|---|---|---|---|---|
| 1 | src/assets/sounds/visualize/guided/Embody_Final_Lina_10min15_V4.mp3 | 14.76 MB | mp3 615 s 192 kbps | |
| 2 | src/assets/sounds/visualize/guided/Embody_Final_10min15_V4.mp3 | 14.76 MB | mp3 615 s 192 kbps | |
| 3 | src/assets/sounds/focus-mix/DeepFocus_10min_Lina.mp3 | 14.40 MB | mp3 600 s 192 kbps | |
| 4 | src/assets/sounds/focus-mix/DeepFocus_10min_Dominic.mp3 | 14.40 MB | mp3 600 s 192 kbps | |
| 5 | src/assets/sounds/focus-mix/DeepFocus_5min_Lina.mp3 | 7.20 MB | mp3 300 s 192 kbps | |
| 6 | src/assets/sounds/focus-mix/DeepFocus_5min_Dominic.mp3 | 7.20 MB | mp3 300 s 192 kbps | |
| 7 | src/assets/sounds/visualize/guided/Anchor_Immerse_Lina_3min_V4.mp3 | 4.80 MB | mp3 200 s 192 kbps | |
| 8 | src/assets/sounds/visualize/guided/Anchor_Immerse_Dominic_3min_V4.mp3 | 4.80 MB | mp3 200 s 192 kbps | |
| 9 | assets/onboarding_anchor.png | 3.26 MB | PNG RGBA 2158x1952 | 16.8 MB |
| 10 | src/assets/sounds/focus-session-ambient.mp3 | 3.01 MB | mp3 188 s 128 kbps | |
| 11 | src/assets/chart/world/runtime/chart_05_foreground.png | 3.00 MB | PNG RGBA 1080x1920 | 8.3 MB |
| 12 | src/assets/onboarding/welcome-panorama-master.jpg | 2.95 MB | JPEG 5760x1920 | 44.2 MB |
| 13 | src/assets/sounds/focus-mix/DeepFocus_2min_Lina.mp3 | 2.88 MB | mp3 120 s 192 kbps | |
| 14 | src/assets/sounds/focus-mix/DeepFocus_2min_Dominic.mp3 | 2.88 MB | mp3 120 s 192 kbps | |
| 15 | src/assets/sounds/visualize/visualize_ambient_3m.mp3 | 2.88 MB | mp3 180 s 128 kbps | |
| 16 | src/assets/chart/world/runtime/chart_04_road.png | 2.59 MB | PNG RGBA 1440x2560 | 14.7 MB |
| 17 | src/assets/chart/world/runtime/chart_03_midground.png | 1.58 MB | PNG RGBA 1080x1920 | 8.3 MB |
| 18 | src/assets/sounds/visualize/guided/Anchor_Glimpse_Dominic_V4.mp3 | 1.57 MB | mp3 65 s 192 kbps | |
| 19 | src/assets/sounds/visualize/guided/Anchor_Glimpse_Lina_V4.mp3 | 1.56 MB | mp3 65 s 192 kbps | |
| 20 | src/assets/sounds/focus-mix/Focus_60s_Dominic_V4.mp3 | 1.41 MB | mp3 59 s 192 kbps | |
| 21 | src/assets/sounds/focus-mix/Focus_60s_Lina_V4.mp3 | 1.41 MB | mp3 59 s 192 kbps | |
| 22 | src/assets/chart/world/runtime/chart_02_city.png | 1.25 MB | PNG RGBA 1080x1920 | 8.3 MB |
| 23 | src/assets/onboarding/screen2/notebook.png | 1.20 MB | PNG RGBA 1200x794 | 3.8 MB |
| 24 | src/assets/sounds/visualize/visualize_ambient_1m.mp3 | 0.96 MB | mp3 60 s 128 kbps | |
| 25 | assets/high_stakes_onboarding_anchor.png | 0.81 MB | PNG RGBA 1006x1080 | 4.3 MB |
| 26 | assets/physical_anchor_onboarding.png | 0.75 MB | PNG RGBA 1080x1058 | 4.6 MB |
| 27 | src/assets/images/auth-landscape-valley.png | 0.71 MB | PNG RGBA 1125x630 | 2.8 MB |
| 28 | src/assets/sounds/focus-mix/Focus_30s_Dominic_V4.mp3 | 0.70 MB | mp3 29 s 192 kbps | |
| 29 | assets/chart/chart-landscape-master.webp | 0.70 MB | WEBP RGB 1704x2360 | 16.1 MB |
| 30 | src/assets/sounds/focus-mix/Focus_30s_Lina_V4.mp3 | 0.69 MB | mp3 29 s 192 kbps | |
| 31 | src/assets/vision/vision-future-open.jpg | 0.69 MB | JPEG 1920x1280 | 9.8 MB |
| 32 | src/assets/onboarding/screen2/environment.jpg | 0.65 MB | JPEG 1536x2732 | 16.8 MB |
| 33 | src/assets/vision/vision-future-family.jpg | 0.52 MB | JPEG 1920x1280 | 9.8 MB |
| 34 | src/assets/share-environments/woven.jpg | 0.48 MB | JPEG 900x1600 | 5.8 MB |
| 35 | src/assets/anchor-details/categories/health-details.jpg | 0.44 MB | JPEG 941x1672 | 6.3 MB |
| 36 | src/assets/vision/vision-future-abundance.jpg | 0.43 MB | JPEG 1920x1280 | 9.8 MB |
| 37 | src/assets/vision/notes/golden-hour.png | 0.43 MB | PNG RGB 512x512 | 1.0 MB |
| 38 | src/assets/anchor-details/categories/focus-details.jpg | 0.42 MB | JPEG 941x1672 | 6.3 MB |
| 39 | src/assets/anchor-details/categories/family-details-palette.jpg | 0.42 MB | JPEG 1024x1536 | 6.3 MB |
| 40 | src/assets/anchor-details/categories/abundance-details.jpg | 0.41 MB | JPEG 941x1672 | 6.3 MB |

Totals (measured): literal-required bundle 160.8 MB. Largest unreferenced (not bundled): `chart/world/masters/*.png` 108.4 MB (chart_00_master 33.4, chart_05_foreground 23.2, chart_01_sky 20.0, chart_03_midground 11.3, chart_04_road 10.9, chart_02_city 9.7), `assets/audio-source/...Glass_and_Gravity...mp3` 4.0 MB. Remote tracks in `audio-remote/session-audio` (8 files) are excluded by `.easignore`. Existing export artifacts: `dist/assets` 76 MB with Hermes bytecode `index-*.hbc` **10.97 MB android / 10.96 MB ios** (2026-10-09, predates `e3362c9e`); `dist-vision2` 14.9 MB hbc / 110 MB assets (2026-09-30). I did not run a fresh export.

Largest decoded-bitmap groups (every required image in the folder decoded at intrinsic size; upper bound): vision 113.8 MB (12 files), share-environments 90.6 MB (16), anchor-details/categories 75.5 MB (12), home/categories 75.5 MB (12; dormant, D-13), onboarding panorama 44.2 MB (1; known, intentional), chart/world/runtime 43.3 MB (dormant), chart landscapes 42.1 MB (6; only the active one is drawn).

## Checked and found clean
- **Listeners and subscriptions:** every `addEventListener` / `addListener` / `subscribe` in `src` has a matching remove on cleanup (static scan; the four flagged files were false positives: V2DialogHost, useTeachingFocus, CourseCompletionScreen, forgeWebViewHtml).
- **Intervals:** all `setInterval` sites are cleared on unmount; polling is foreground-gated through `AppState`; `useReleaseHold` (50 ms) commits React state only on haptic steps; `perfDiagnostics` (16 ms stall probe) and `HomeStartupProfiler` are `__DEV__` only.
- **Skia:** `cinematicPhotoFocus` disposes surface, snapshot and paint in `finally`; chart-map caches are bounded (grain cache capped at 6, single fog set, one landscape, cloud tiles built once with `drawAsImage`); the 213x295 fog field ships as precomputed data (the runtime grid build is only the stale-data fallback); `releaseArtworkImage` makes one surface and snapshots it.
- **Chart landscape master** (1704x2360 WebP, 16.1 MB decoded) decodes once into a module cache; acceptable.
- **Share Studio / view-shot sizing** is deliberate and correct: the export node is `1080/pixelRatio` dp so its native bitmap is 1080 px wide, with a per-platform capture request; the offscreen tree mounts only while the Studio is visible and is released on close (`useShareExportRenderer.tsx`, `anchorExportService.ts:14-40`). Memory cost = one extra 1080x1920 tree while open.
- **SoundPool:** capped at 24 live players, prewarm batched (3 per 50 ms), disposal on eviction.
- **Sigil SVG size:** a single `M ... L ...` path plus an optional one-path border (`traditional-generator.ts:243-266`); a few hundred bytes to ~1-2 KB (not measured by running the generator). The SigilSvg normalisation cache is capped at 250.
- **Vision photograph rendering** (`VisionPhotograph.tsx:60-63`, `VisionPrint.tsx:196-197`, `VisionEditorialPreview.tsx:64`, `VisionMomentInput.tsx:387`) uses `resizeMethod="resize"`, so remote Vision photos decode at view size on Android.
- **Remote audio** (`remoteAudio.ts`): size-verified cache, content-hashed names, partial-file cleanup, background download; sound design (see D-03 for what bypasses it).
- **Recommendation and Vision prefetch** dedupe (TTL / `inFlightVision` / `visionReadCache`); `V2AssetPrewarm` bounds remote prefetch to 12 URLs and unmounts after decode.
- **Vision generated images** are normalised server-side to 1080x1920 JPEG q86; world/start references are downscaled to 1024-1280 px before going to the model.
- **Startup:** no `Asset.loadAsync` preloading of large images; first-paint gating is fonts + settings + auth + prime-on-launch with a fail-open timeout (`useAppStartup.ts`); the authenticated shell renders after `syncCurrentUser`, hydration runs in the background (`App.tsx:520-545`).
- **Stores:** `sessionStore.sessionLog` capped at 50; `anchorStore`, `sessionStore`, `creationStore`, `visualizationSceneStore`, `firstRunStore` use the debounced, deduped `encryptedPersistStorage` (only `authStore` bypasses it, D-04).
- **Uncommitted working-tree changes** (`useReleaseHold`, `evolveSessionStore`, `NodeToneService` + 10 node-tone mp3 of ~11 KB each, `PracticeSubscreen`, etc.): no performance regressions seen. `NodeToneService` requires both WAV and MP3 sets under a `Platform.OS` ternary (about 300 KB even if both end up bundled).

## Not verified (explicitly)
Production payload sizes for `/api/auth/me/export`, Vision/Chart read models and anchor art (only local dev outputs measured); Railway edge compression; Fresco downsampling configuration at runtime (the RN `ReactImageView.kt` resize rule is verified; Fresco defaults are believed to be off); device decode times and heap numbers; whether `e3362c9e` bundled the V4 mixes intentionally for offline reasons; whether `ChartJourneyWorld` assets are truly absent from a fresh export.
