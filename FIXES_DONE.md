# FIXES_DONE.md

## Changes Made (Minimum Required to Fix Runtime Errors)

### 1. `backend/routes/tasks.js` — Line 45: Broken SQL string literal
**Problem:** The SQL string used single-quote delimiters but contained a single-quoted value `'pending'` inside it, causing a JavaScript syntax/parse error that prevented the entire file from loading:
```js
// BROKEN
db.prepare('UPDATE tasks SET status='pending', due_date=?, completed_at=NULL WHERE id=?')
```
**Fix:** Changed outer quotes to double quotes so the inner SQL single quotes are valid:
```js
// FIXED
db.prepare("UPDATE tasks SET status='pending', due_date=?, completed_at=NULL WHERE id=?")
```

---

### 2. `backend/routes/phase2.js` — Dead route registered after `module.exports`
**Problem:** The `router.post('/ai/suggestions/accept', ...)` route handler was placed **after** `module.exports = router;`. In Node.js, code after `module.exports` still executes, but the route additions happen after the router has already been exported — meaning the route was never reachable. The frontend's "Accept" button on adaptive suggestions would always return 404.

**Fix:** Moved the `router.post('/ai/suggestions/accept', ...)` block to **before** `module.exports = router;`, so the route is properly registered on the exported router.

---

No other changes were made. All existing features, UI, and logic are preserved.
