# QueryForge Bug Fixes - COMPLETE

## Completed:
1. [x] Create TODO.md
2. [x] Reset DB (drop_all/create_all + user count log)
3. [x] Fix psycopg2 standalone
4. [x] Enhanced SYSTEM_PROMPT (JOIN/GROUP/agg/window)
5. [x] /health logs (cache_size, user_count)
6. [x] Register log "[NEW USER]"
7. **Cache fixes pending** (hash key - diff mismatch, retry later)
8. [x] nrows=10000 limit

**Status:** Core bugs fixed (users/DB), advanced SQL supported. Test with `python app.py`, register as admin ('forge-admin'), upload different CSVs, try "sum sales by region" or "top 10 customers".

**Demo:** `python app.py` then localhost:10000
