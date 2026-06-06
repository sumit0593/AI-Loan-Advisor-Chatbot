# AI Loan Advisor Chatbot Sandbox

A full-stack intelligent lending evaluation application. It uses a multi-agent orchestration graph (built with LangGraph and the Gemini API) to assess borrower profiles, determine loan product eligibility, perform EMI/tenure repayment simulations, and verify lending compliance.

**Live Demo URL:** [https://ai-loan-advisor-chatbot-3mt0oequ0-sumit0593s-projects.vercel.app/](https://ai-loan-advisor-chatbot-3mt0oequ0-sumit0593s-projects.vercel.app/)

---

## 🛠️ Technology Stack & Dependencies

### Frontend (`/frontend`)
*   **Core framework:** React 19 + Vite 8
*   **Styling:** Tailwind CSS 4 + Lucide Icons (elegant dark mode and interactive dashboard layout)
*   **Charts:** Recharts 3 (interactive tenure amortization and repayment schedule visualization)
*   **State Management:** React Hook APIs

### Backend (`/backend`)
*   **Core API:** FastAPI + Uvicorn ASGI Server
*   **Orchestration Graph:** LangGraph (coordinates the multi-agent chain)
*   **AI Engine:** Google Gemini GenAI SDK (`google-genai`)
*   **Database:** SQLite + SQLAlchemy ORM (stores user authentication, chat sessions, audit logs, and agent prompts)
*   **Authentication:** JWT Bearer tokens (`python-jose`, `passlib` with bcrypt encryption)

---

## 🔑 Environment Variables Configuration

To run or deploy this application, configure the following environment variables:

### Backend Variables
| Variable Name | Description | Default / Example Value |
| :--- | :--- | :--- |
| `GEMINI_API_KEY` | Your Google Gemini API Key | *[Required]* |
| `DATABASE_URL` | Connection string to SQLite | `sqlite:///./loan_advisor.db` (local) or `sqlite:////data/loan_advisor.db` (Railway volume) |
| `JWT_SECRET` | Secret key used to sign Auth tokens | *[Any long secure random string]* |
| `PORT` | Dynamic port listener for ASGI server | `8000` |
| `HOST` | Bind address for backend server | `0.0.0.0` |

### Frontend Variables
| Variable Name | Description | Example Value |
| :--- | :--- | :--- |
| `VITE_BACKEND_URL` | Base URL of the deployed FastAPI backend API | `https://<service-name>.<environment>.up.railway. app` |

---

## 💻 Local Development Setup

### 1. Run the Backend
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Create and activate a Python virtual environment:
   ```bash
   python -m venv .venv
   # On Windows:
   .venv\Scripts\activate
   # On macOS/Linux:
   source .venv/bin/activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Create a `.env` file in the `backend/` directory:
   ```env
   GEMINI_API_KEY=your_gemini_key_here
   JWT_SECRET=some_random_secret_string
   ```
5. Run the development server:
   ```bash
   uvicorn main:app --reload --port 8000
   ```

### 2. Run the Frontend
1. Navigate to the frontend directory:
   ```bash
   cd ../frontend
   ```
2. Install npm packages:
   ```bash
   npm install
   ```
3. Create a `.env` file in the `frontend/` directory:
   ```env
   VITE_BACKEND_URL=http://localhost:8000
   ```
4. Start the Vite dev server:
   ```bash
   npm run dev
   ```

---

## 🚀 Cloud Deployment Instructions (Vercel + Railway)

This repository includes configuration files to deploy the full stack completely free with persistent data.

### 1. Backend on Railway (with SQLite volume)

### 2. Frontend on Vercel
