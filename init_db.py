import sqlite3
import pandas as pd

# 📂 Change this path to your CSV file
CSV_FILE = "data.csv"   # or your uploaded file name

# 🛢 Database name
DB_FILE = "data.db"

def init_db():
    try:
        # Load CSV
        df = pd.read_csv(CSV_FILE)

        # Connect to SQLite
        conn = sqlite3.connect(DB_FILE)

        # Save to table 'data'
        df.to_sql("data", conn, if_exists="replace", index=False)

        conn.commit()
        conn.close()

        print("✅ Database initialized successfully!")
        print(f"Rows inserted: {len(df)}")

    except Exception as e:
        print("❌ Error:", str(e))


if __name__ == "__main__":
    init_db()