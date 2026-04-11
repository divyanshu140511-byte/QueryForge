<div align="center">
  <img src="https://img.shields.io/badge/QueryForge-ff2a5f?style=for-the-badge&logo=appwrite&logoColor=white" alt="QueryForge Logo" />
  <h1>🚀 QueryForge</h1>
  <p><strong>Transform Natural Language into Powerful SQL Queries instantly using AI.</strong></p>

  <p>
    <a href="#features">Features</a> •
    <a href="#tech-stack">Tech Stack</a> •
    <a href="#quick-start">Quick Start</a> •
    <a href="#environment-variables">Configuration</a> 
  </p>

  <p>
    <img src="https://img.shields.io/badge/Python-3.10+-blue.svg?style=flat-square&logo=python&logoColor=white" alt="Python Version"/>
    <img src="https://img.shields.io/badge/Flask-Web%20Framework-lightgrey.svg?style=flat-square&logo=flask&logoColor=white" alt="Flask"/>
    <img src="https://img.shields.io/badge/Powered_by-Groq_AI-orange.svg?style=flat-square" alt="Groq AI"/>
    <img src="https://img.shields.io/badge/Database-PostgreSQL-blue.svg?style=flat-square&logo=postgresql&logoColor=white" alt="PostgreSQL"/>
  </p>
</div>

---

## 🌟 What is QueryForge?
Writing SQL for complex data analysis can be overwhelming. **QueryForge** is an intelligent web platform that bridges the gap between everyday language and complex databases. Users can upload a CSV or connect directly to a remote database, ask questions in plain English, and have QueryForge instantly generate and securely execute the perfect SQL query. 

It is powered by the cutting-edge **Llama-3.3-70b-versatile** model through the ultra-fast Groq API, ensuring blazing-fast query generations and real-time data insights.

---

## ✨ Features

- 🧠 **AI-Powered SQL Generation**: Simply ask your database a question, and let the AI generate standard, fully optimized SQL.
- 📂 **Multi-Source Support**: Instantly query uploaded `.csv` files (via DuckDB) or connect directly to external relational databases (via SQLAlchemy).
- 📊 **Intelligent Data Insights**: Not just data rows—receive an automatically generated concise AI summary explaining business trends and insights found within your query results.
- 🔐 **Robust Authentication System**: Highly secure User login system utilizing `Flask-Login` and `Flask-Bcrypt`.
- ✉️ **Live Email Verification**: Integrated SendGrid API ensures every newly registered user proves ownership of their inbox before access is granted.
- 🛡️ **Advanced Admin Dashboard**: Dedicated administrative view to globally monitor query history, and powerfully manage your community (block, unblock, and delete uncooperative users).
- 🎨 **Sleek Futuristic UI**: An out-of-the-box, fully responsive dark-mode layout offering a premium, polished user experience.

---

## 🛠️ Tech Stack

### **Backend**
* **Framework**: [Flask](https://flask.palletsprojects.com/)
* **Database Management**: SQLAlchemy ORM, psycopg2 (PostgreSQL)
* **Local Parsing Engine**: DuckDB & Pandas
* **AI Engine**: Groq API integration 

### **Frontend**
* **Architecture**: Server-side rendered HTML/Jinja2 with Vanilla CSS
* **Design Pattern**: Glassmorphism, CSS Variables, Flexbox/Grid
* **Icons**: FontAwesome 6

---

## 🚀 Quick Start (Local Setup)

### 1. Clone the Repository
```bash
git clone https://github.com/yourusername/QueryForge.git
cd QueryForge
```

### 2. Create a Virtual Environment & Install Dependencies
```bash
python -m venv venv

# Activate on Windows:
venv\Scripts\activate

# Activate on Mac/Linux:
source venv/bin/activate

# Install requirements
pip install -r requirements.txt
```

### 3. Setup Environment Variables
Create a `.env` file in the root of the directory and configure your keys. (See [Configuration](#-environment-variables)).

### 4. Run the Application
```bash
python app.py
```
*The app will be running at `http://127.0.0.0:10000/`. You can navigate to `/register` to create your initial account.*

---

## ⚙️ Environment Variables
Required variables inside your `.env` file for proper functionality:

```ini
# Flask Secret
SECRET_KEY=your_super_secret_flask_key

# PostgreSQL Database (Used for saving User data, Accounts, and Query History)
DATABASE_URL=postgresql://user:password@host/dbname

# Groq API Key (powers the natural language to SQL)
GROQ_API_KEY=gsk_your_groq_api_key_here

# SendGrid Verification Engine
SENDGRID_API_KEY=SG.your_sendgrid_key_here
SENDGRID_FROM_EMAIL=noreply@yourdomain.com

# System URLs
BASE_URL=http://localhost:10000
```
*(💡 **Pro Tip**: To automatically make a user an Admin upon registration, provide the secret code `forge-admin` in the Admin Code field on the frontend!)*

---

## 🚢 Deployment

QueryForge is production-ready for platforms like **Render**, **Heroku**, or **Railway**:
1. Connect your GitHub repository to your platform of choice.
2. Bind your environment variables securely in their dashboard.
3. Use Gunicorn as your Web Server Gateway Interface:
   ```bash
   gunicorn app:app --workers 4 --threads 2 --bind 0.0.0.0:$PORT
   ```

---

<div align="center">
  <i>Built with ❤️ by an AI-Augmented Developer</i>
</div>
