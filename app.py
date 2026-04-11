
from flask import Flask, render_template, request, jsonify, redirect, url_for, flash
from flask_cors import CORS
import os
import duckdb
import pandas as pd
import psycopg2
from dotenv import load_dotenv
from groq import Groq
from sqlalchemy import create_engine, text, inspect
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager, UserMixin, login_user, login_required, logout_user, current_user
from flask_bcrypt import Bcrypt
from flask import flash
from datetime import datetime
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail as SGMail
from itsdangerous import URLSafeTimedSerializer, SignatureExpired, BadTimeSignature


# Load env
load_dotenv()
BASE_URL=os.getenv("BASE_URL")

import logging
logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'queryforge-secret-key-default')
database_url = os.environ.get('DATABASE_URL', 'sqlite:////tmp/app_backend.db')
if database_url.startswith("postgres://"):
    database_url = database_url.replace("postgres://", "postgresql://", 1)
app.config['SQLALCHEMY_DATABASE_URI'] = database_url
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

CORS(app)

db = SQLAlchemy(app)

s = URLSafeTimedSerializer(app.config['SECRET_KEY'])

bcrypt = Bcrypt(app)
login_manager = LoginManager(app)
login_manager.login_view = 'login'

class User(db.Model, UserMixin):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(150), unique=True, nullable=False)
    password = db.Column(db.String(150), nullable=False)
    role = db.Column(db.String(50), default='user')  # 'user' or 'admin'
    email = db.Column(db.String(150), unique=True, nullable=True)
    is_verified = db.Column(db.Boolean, default=False)
    is_blocked = db.Column(db.Boolean, default=False)
    queries = db.relationship('QueryHistory', backref='user', lazy=True)

class QueryHistory(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    nl_query = db.Column(db.Text, nullable=False)
    sql_query = db.Column(db.Text, nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)

@login_manager.user_loader
def load_user(user_id):
    return db.session.get(User, int(user_id))

with app.app_context():
    if 'sqlite' in app.config['SQLALCHEMY_DATABASE_URI']:
        db.drop_all()  # Dev: local only
    db.create_all()
    log.info("DB ready. Users: %d (URI: %s)", User.query.count(), app.config['SQLALCHEMY_DATABASE_URI'][:50]+"...")
    
# Test raw psycopg2 connection (for Postgres) - standalone
DATABASE_URL = os.getenv("DATABASE_URL")
if DATABASE_URL and "postgresql" in DATABASE_URL:
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cursor = conn.cursor()
        cursor.execute("SELECT 1;")
        result = cursor.fetchone()
        print("Raw psycopg2 test: SUCCESS", result)
        cursor.close()
        conn.close()
    except Exception as e:
        print("Raw psycopg2 test: FAILED", str(e))

df_cache = {}

# ===== API KEY =====
api_key = os.getenv("GROQ_API_KEY")
if not api_key:
    print("[WARNING] GROQ_API_KEY not set - AI features disabled")
    client = None
else:
    client = Groq(api_key=api_key)

MODEL = "llama-3.3-70b-versatile"

# ===== PROMPT (FIXED) =====
SYSTEM_PROMPT = """You are an expert SQL assistant.

Rules:
- ALWAYS use table name EXACTLY as given in schema (e.g., data_table)
- Use LIMIT 20 for SELECT unless specified
- Use correct column names with double quotes " for spaces
- Support JOIN, GROUP BY, HAVING, ORDER BY, aggregations (SUM, COUNT, AVG, MIN, MAX), subqueries, window functions
- Handle multiple tables if schema shows them (data_table1 JOIN data_table2 ON ...)
- NEVER use backticks (`). Use LIMIT for safety.
- If unclear → return INVALID_QUERY
Return ONLY valid DuckDB SQL, no explanation."""

# ===== ROUTES =====
@app.route("/health")
def health():
    return jsonify({
        "status": "ok", 
        "cache_keys": list(df_cache.keys()),
        "cache_size": len(df_cache),
        "user_count": User.query.count()
    })

@app.route("/")
def landing():
    if current_user.is_authenticated:
        return redirect(url_for('admin_dashboard') if current_user.role == 'admin' else url_for('index'))
    return render_template("landing.html")

@app.route("/index")
@login_required
def index():
    return render_template("index.html")

# ===== AUTH ROUTES =====
@app.route("/register", methods=["GET", "POST"])
def register():
    if current_user.is_authenticated:
        return redirect(url_for('admin_dashboard') if current_user.role == 'admin' else url_for('index'))
    if request.method == "POST":
        username = request.form.get("username")
        password = request.form.get("password")
        email = request.form.get("email")
        
        if User.query.filter_by(username=username).first():
            return render_template("register.html", error="Username already exists.")
        if email and User.query.filter_by(email=email).first():
            return render_template("register.html", error="Email already used.")
        
        hashed_password = bcrypt.generate_password_hash(password).decode('utf-8')
        
        # User explicitly becomes an admin if they provide the secret code
        admin_code = request.form.get("admin_code")
        role = 'user'
        if admin_code == 'forge-admin':
            role = 'admin'
            
        new_user = User(username=username, email=email, password=hashed_password, role=role, is_verified=False)
        db.session.add(new_user)
        db.session.commit()
        
        # Send confirmation email via SendGrid
        try:
            token = s.dumps(email, salt='email-confirm')
            link = url_for('confirm_email', token=token, _external=True)
            
            sender_email = os.environ.get('SENDGRID_FROM_EMAIL', 'noreply@queryforge.app')
            message = SGMail(
                from_email=sender_email,
                to_emails=email,
                subject='Verify your QueryForge Account',
                html_content=f'<strong>Welcome!</strong><br>Your verification link is: <a href="{link}">{link}</a>'
            )
            sg = SendGridAPIClient(os.environ.get('SENDGRID_API_KEY'))
            sg.send(message)
            return render_template("login.html", error="Account created! A verification link has been sent to your email.")
        except Exception as e:
            print(f"[SENDGRID ERROR] Failed to send email: {e}")
            error_msg = str(e)
            if hasattr(e, 'body'):
                error_msg += f" Details: {e.body}"
            
            import traceback
            traceback.print_exc()
            return render_template("login.html", error=f"Email failed to send! Please check your SENDGRID keys in .env. ({error_msg})")
            
    return render_template("register.html")

@app.route("/verify_email/<token>")
def confirm_email(token):
    try:
        email = s.loads(token, salt='email-confirm', max_age=3600)
    except SignatureExpired:
        return render_template("login.html", error="The verification link has expired!")
    except BadTimeSignature:
        return render_template("login.html", error="Invalid verification link!")
        
    user = User.query.filter_by(email=email).first()
    if not user:
        return render_template("login.html", error="Verification failed. User not found.")
        
    if user.is_verified:
        return render_template("login.html", error="Account already verified. Please login.")
        
    user.is_verified = True
    db.session.commit()
    return render_template("login.html", error="Your account has been successfully verified! Please log in.")

@app.route("/login", methods=["GET", "POST"])
def login():
    if current_user.is_authenticated:
        return redirect(url_for('admin_dashboard') if current_user.role == 'admin' else url_for('index'))
    if request.method == "POST":
        username = request.form.get("username")
        password = request.form.get("password")
        login_as_admin = request.form.get("login_as_admin")
        
        user = User.query.filter_by(username=username).first()
        
        if user and bcrypt.check_password_hash(user.password, password):
            # Check if email is verified
            if user.email and not user.is_verified:
                return render_template("login.html", error="Please verify your email before logging in. Check your inbox.")

            # Check if user is blocked
            if getattr(user, 'is_blocked', False):
                return render_template("login.html", error="Your account has been blocked by an administrator.")

            # Check if they are trying to login as admin but aren't an admin
            if login_as_admin and user.role != 'admin':
                return render_template("login.html", error="You do not have Administrator permissions.")
            
            login_user(user)
            return redirect(url_for('admin_dashboard') if user.role == 'admin' else url_for('index'))
        else:
            return render_template("login.html", error="Login Unsuccessful. Please check username and password")
    return render_template("login.html")

@app.route("/logout")
@login_required
def logout():
    logout_user()
    return redirect(url_for("landing"))

@app.route("/history")
@login_required
def history():
    user_history = QueryHistory.query.filter_by(user_id=current_user.id).order_by(QueryHistory.timestamp.desc()).all()
    return render_template("history.html", history=user_history)

@app.route("/admin")
@login_required
def admin_dashboard():
    if current_user.role != 'admin':
        return "Access Denied: Admins Only", 403
    users = User.query.all()
    all_history = QueryHistory.query.order_by(QueryHistory.timestamp.desc()).limit(100).all()
    return render_template("admin_dashboard.html", users=users, history=all_history)

@app.route("/admin/toggle_block/<int:user_id>", methods=["POST"])
@login_required
def toggle_block(user_id):
    if current_user.role != 'admin':
        return "Access Denied: Admins Only", 403
    
    target_user = User.query.get_or_404(user_id)
    # Prevent self-blocking and blocking other admins
    if target_user.id == current_user.id:
        flash("You cannot block yourself.")
    elif target_user.role == 'admin':
        flash("You cannot block another admin.")
    else:
        target_user.is_blocked = not getattr(target_user, 'is_blocked', False)
        db.session.commit()
        flash(f"User {target_user.username} {'blocked' if target_user.is_blocked else 'unblocked'} successfully.")
        
    return redirect(url_for('admin_dashboard'))

@app.route("/admin/delete_user/<int:user_id>", methods=["POST"])
@login_required
def delete_user(user_id):
    if current_user.role != 'admin':
        return "Access Denied: Admins Only", 403
    
    target_user = User.query.get_or_404(user_id)
    
    # Prevent self-deleting and deleting other admins
    if target_user.id == current_user.id:
        flash("You cannot delete yourself.")
    elif target_user.role == 'admin':
        flash("You cannot delete another admin.")
    else:
        QueryHistory.query.filter_by(user_id=target_user.id).delete()
        db.session.delete(target_user)
        db.session.commit()
        flash(f"User {target_user.username} deleted successfully.")
        
    return redirect(url_for('admin_dashboard'))



# ===== SCHEMA =====
@app.route("/schema", methods=["POST"])
def schema():
    try:
        source = request.form.get("source")
        print("[INFO] Source:", source)

        if source == "csv":
            file = request.files.get("csv_file")
            print("[INFO] File:", file)

            if hasattr(file, 'content_length') and file.content_length > 50 * 1024 * 1024:
                return jsonify({"error": "File too large (max 50MB)"})

            if not file:
                return jsonify({"error": "No CSV file received"})

            # 🔥 RESET POINTER
            file.seek(0)

            # 🔥 SAFE READ
            df = pd.read_csv(file, encoding="latin1", on_bad_lines="skip", nrows=100000)
            print("[INFO] Columns:", df.columns)

            df_cache[file.name] = df

            schema_text = "Table: data_table\n"

            for col, dtype in zip(df.columns, df.dtypes):
                schema_text += f"\"{col}\" (type: {dtype})\n"

            print("[SUCCESS] Schema created")
            return jsonify({"schema": schema_text})

        elif source == "db":
            db_uri = request.form.get("db_uri")
            if not db_uri:
                return jsonify({"error": "No Database URI provided"})
            
            try:
                engine = create_engine(db_uri)
                inspector = inspect(engine)
                schema_text = ""
                
                for table_name in inspector.get_table_names():
                    schema_text += f"Table: {table_name}\n"
                    for column in inspector.get_columns(table_name):
                        schema_text += f"\"{column['name']}\" (type: {column['type']})\n"
                    schema_text += "\n"
                
                if not schema_text:
                    schema_text = "No tables found in the database."

                return jsonify({"schema": schema_text.strip()})
            except Exception as e:
                import traceback
                traceback.print_exc()
                print("[ERROR] DB SCHEMA ERROR:", e)
                return jsonify({"error": f"Failed to connect or fetch schema: {str(e)}"})

        return jsonify({"error": "Invalid source"})

    except Exception as e:
        import traceback
        traceback.print_exc()
        print("[ERROR] SCHEMA ERROR:", e)
        return jsonify({"error": str(e)})


# ===== GENERATE SQL =====
@app.route('/generate_sql', methods=['POST'])
def generate_sql():
    try:
        nl_query = request.form['nl_query']
        schema = request.form['schema']

        if client is None:
            return jsonify({'error': 'AI features are disabled because GROQ_API_KEY is not set.'})

        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": f"Schema:\n{schema}\n\nUser Query:\n{nl_query}\n\nSQL:"}
        ]

        chat_completion = client.chat.completions.create(
            messages=messages,
            model=MODEL,
            temperature=0.1,
            max_tokens=500
        )

        sql = chat_completion.choices[0].message.content.strip()

        # clean formatting
        if "```" in sql:
            sql = sql.replace("```sql", "").replace("```", "").strip()
            
        # replace any backticks with double quotes for standard sql compliance (DuckDB/SQLite)
        sql = sql.replace('`', '"')

        # validate SQL
        if not sql or "select" not in sql.lower():
            return jsonify({'error': 'Invalid query generated'})

        # Save query to history
        if current_user.is_authenticated:
            new_history = QueryHistory(user_id=current_user.id, nl_query=nl_query, sql_query=sql)
            db.session.add(new_history)
            db.session.commit()

        return jsonify({'sql': sql})

    except Exception as e:
        import traceback
        traceback.print_exc()
        print("[ERROR] GROQ ERROR:", e)
        return jsonify({'error': str(e)})


# ===== EXECUTE SQL =====
@app.route('/execute_sql', methods=['POST'])
def execute_sql():
    try:
        sql = request.form['sql']
        source = request.form['source']

        print("[INFO] SQL:", sql)

        if source == 'csv':
            file = request.files.get("csv_file")

            if hasattr(file, 'content_length') and file.content_length > 50 * 1024 * 1024:
                return jsonify({'error': 'File too large (max 50MB)'})

            if not file:
                return jsonify({'error': 'CSV file missing'})

            # 🔥 RESET POINTER AGAIN
            file.seek(0)

            cache_key = file.name
            if cache_key in df_cache:
                df = df_cache[cache_key]
                print("[SUCCESS] Using cached DF")
            else:
                df = pd.read_csv(file, encoding="latin1", on_bad_lines="skip", nrows=100000)
                df_cache[cache_key] = df

            con = duckdb.connect(':memory:')
            con.register('data_table', df)

            result_df = con.execute(sql).fetchdf()
            con.close()

            return jsonify({
                'columns': result_df.columns.tolist(),
                'results': result_df.values.tolist()
            })

        elif source == 'db':
            db_uri = request.form.get("db_uri")
            if not db_uri:
                return jsonify({"error": "No Database URI provided"})
            
            try:
                engine = create_engine(db_uri)
                with engine.connect() as conn:
                    result = conn.execute(text(sql))
                    columns = list(result.keys())
                    rows = [list(row) for row in result.fetchall()]

                return jsonify({'columns': columns, 'results': rows})
            except Exception as e:
                import traceback
                traceback.print_exc()
                print("[ERROR] DB EXECUTION ERROR:", e)
                return jsonify({'error': f'Database execution error: {str(e)}'})

        else:
            return jsonify({'error': 'Invalid source'})

    except Exception as e:
        import traceback
        traceback.print_exc()
        print("[ERROR] EXECUTION ERROR:", e)
        return jsonify({'error': f'Execution error: {str(e)}'})


# ===== GENERATE INSIGHTS =====
@app.route('/generate_insights', methods=['POST'])
def generate_insights():
    try:
        data_json = request.form.get('data')

        if client is None:
            return jsonify({'error': 'AI features are disabled because GROQ_API_KEY is not set.'})
        
        system_prompt = """You are a highly analytical AI Data Scientist.
Review the provided JSON SQL querying results. 
Provide a concise, 2-to-3 sentence analytical summary or business insight about what the data shows.
Do NOT explain the SQL. Only explain the data insights and trends. Be professional and formatting-clean (no markdown blocks)."""

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Query Results data:\n{data_json}"}
        ]

        chat_completion = client.chat.completions.create(
            messages=messages,
            model=MODEL,
            temperature=0.3,
            max_tokens=250
        )

        insight = chat_completion.choices[0].message.content.strip()

        return jsonify({'insight': insight})

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)})


# ===== RUN =====
if __name__ == '__main__':
    port=int(os.environ.get("PORT", 10000))
    app.run(host='0.0.0.0', port=port)