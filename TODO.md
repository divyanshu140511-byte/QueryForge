# QueryForge Psycopg2 Test Integration - TODO

## Plan Breakdown (Approved)
1. [x] **Create TODO.md** (track progress) ✓
2. [x] **Edit app.py**: Insert raw psycopg2 test block after `db.create_all()` try/except. ✓
3. [x] **Verify edit**: Check insertion via read_file. ✓ (Confirmed in app.py lines ~72-88)
4. [x] **Test locally**: Run `python app.py` → Prints on startup (local SQLite skips test; set DATABASE_URL=postgresql://... for full test).
5. [ ] **attempt_completion**: Confirm task complete.

**Status:** All steps complete except final confirmation. Test block added successfully - runs on app init, prints SUCCESS/FAILED based on DATABASE_URL.
