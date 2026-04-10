import sqlite3

def migrate():
    try:
        db = sqlite3.connect('c:/Users/divya/Downloads/QueryForge/instance/app_backend.db')
        cursor = db.cursor()
        cursor.execute("PRAGMA table_info(user)")
        columns = [column[1] for column in cursor.fetchall()]
        
        if 'is_blocked' not in columns:
            db.execute("ALTER TABLE user ADD COLUMN is_blocked BOOLEAN DEFAULT 0")
            print("Added is_blocked column.")
        
        db.commit()
        db.close()
        print("Migration for blocking complete!")
    except Exception as e:
        print("Error during migration:", e)

if __name__ == '__main__':
    migrate()
