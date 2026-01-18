# ⚠️ DEPRECATED - Legacy Frontend Code

**Status**: 🧟 Not in use - Archived for reference only

## Important Notice

This directory contains the **original frontend implementation** of the Anchor mobile app. It is **no longer maintained** and should **not be used** for development.

## Why is this deprecated?

All valid code from this directory has been migrated to the current mobile app located at:

**`/apps/mobile/`** ← Use this instead

## Key Differences

The legacy frontend was built during Phase 1 and early Phase 2 of development. While it contains many of the core features, it lacks:

- Production-ready code quality (type safety, error handling)
- Accessibility support (screen readers, WCAG compliance)
- Testing infrastructure (no tests)
- Monitoring and analytics
- Manual Forge feature
- Latest UX improvements (Toast, LoadingSpinner, skeletons)

See the root README.md for a complete comparison table.

## Why keep it?

This code is preserved for:

1. **Historical reference** - Understanding the evolution of the app
2. **Code archaeology** - Recovering forgotten implementations if needed
3. **Audit trail** - Demonstrating project progression

## What should I use instead?

For all development work, use:

```
/apps/mobile/
```

This is the **canonical, production-ready** mobile app with:
- ✅ Full feature set (Phase 1 + 2 + 2.6 + 2.7)
- ✅ 48 passing tests (35% coverage, targeting 70%)
- ✅ Production monitoring (Analytics, Error Tracking, Performance)
- ✅ WCAG 2.1 Level A accessibility compliance
- ✅ TypeScript strict mode (zero 'any' types)
- ✅ Comprehensive documentation (TESTING.md, MONITORING.md)

## Questions?

See:
- `/docs/START_HERE.md` - Project overview and navigation
- `/README.md` - Full project documentation
- `/apps/mobile/README.md` - Current mobile app details

---

**Last Updated**: January 2026
**Archived By**: Repository restructuring (claude/restructure-anchor-repo-K9hPw)
