BEGIN TRANSACTION;

-- User table (matching Flask-SQLAlchemy model)
CREATE TABLE IF NOT EXISTS user (
    id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    username VARCHAR(150) NOT NULL UNIQUE,
    password VARCHAR(150) NOT NULL,
    role VARCHAR(50) DEFAULT 'user',
    email VARCHAR(150) UNIQUE,
    is_verified BOOLEAN NOT NULL DEFAULT 0,
    is_blocked BOOLEAN NOT NULL DEFAULT 0
);

-- QueryHistory table
CREATE TABLE IF NOT EXISTS queryhistory (
    id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    nl_query TEXT NOT NULL,
    sql_query TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES user(id)
);

COMMIT;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_queryhistory_user_id ON queryhistory(user_id);
CREATE INDEX IF NOT EXISTS idx_queryhistory_timestamp ON queryhistory(timestamp);
