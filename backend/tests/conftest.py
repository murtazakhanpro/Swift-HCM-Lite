import os

# Keep destructive schema fixtures isolated from the local application database.
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///./swift_hcm_test.db"
