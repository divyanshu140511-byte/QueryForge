import sqlite3

def migrate():
    try:
        db = sqlite3.connect('c:/Users/divya/Downloads/QueryForge/instance/app_backend.db')
        
        # Check if email exists
        cursor = db.cursor()
        cursor.execute("PRAGMA table_info(user)")
        columns = [column[1] for column in cursor.fetchall()]
        
        if 'email' not in columns:
            db.execute("ALTER TABLE user ADD COLUMN email VARCHAR(150)")
            print("Added email column.")
            
        if 'is_verified' not in columns:
            db.execute("ALTER TABLE user ADD COLUMN is_verified BOOLEAN DEFAULT 1")
            print("Added is_verified column.")
            
        db.execute("UPDATE user SET is_verified = 1 WHERE is_verified IS NULL")
        db.commit()
        db.close()
        print("Migration complete!")
    except Exception as e:
        print("Error during migration:", e)

if __name__ == '__main__':
    migrate()
