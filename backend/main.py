# 1. Standard Library Imports
import uuid
import json
from datetime import datetime
from typing import Dict, Any, List

# 2. Third-Party Imports
from fastapi import FastAPI, Depends, HTTPException, status, Body
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

# 3. Local Application Imports
from config import settings
from database import SessionLocal, init_db, User, ChatSession, ChatMessage, AuditLog, PromptConfig
from auth import get_password_hash, verify_password, create_access_token, get_current_user_id
from agents import execute_loan_chain

# Initialize database tables and seed baseline prompts
init_db()

app = FastAPI(title="AI Loan Advisor Chatbot API")

# Setup CORS to allow seamless communication with React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# DB dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ----------------- AUTH ENDPOINTS -----------------

@app.post("/api/auth/signup", status_code=status.HTTP_201_CREATED)
def signup(payload: dict = Body(...), db: Session = Depends(get_db)):
    username = payload.get("username")
    email = payload.get("email")
    password = payload.get("password")
    
    if not username or not email or not password:
        raise HTTPException(status_code=400, detail="Missing required credentials.")
        
    # Check duplicate
    existing_user = db.query(User).filter((User.username == username) | (User.email == email)).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Username or email already registered.")
        
    hashed = get_password_hash(password)
    user = User(username=username, email=email, hashed_password=hashed)
    db.add(user)
    db.commit()
    db.refresh(user)
    
    # Audit log
    log = AuditLog(user_id=user.id, action="USER_SIGNUP", details=f"User {username} registered successfully.")
    db.add(log)
    db.commit()
    
    return {"message": "User registered successfully.", "userId": user.id}

@app.post("/api/auth/login")
def login(payload: dict = Body(...), db: Session = Depends(get_db)):
    username = payload.get("username")
    password = payload.get("password")
    
    user = db.query(User).filter(User.username == username).first()
    if not user or not verify_password(password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect credentials.")
        
    token = create_access_token({"sub": str(user.id)})
    
    # Audit log
    log = AuditLog(user_id=user.id, action="USER_LOGIN", details=f"User {username} logged in.")
    db.add(log)
    db.commit()
    
    return {
        "accessToken": token,
        "tokenType": "bearer",
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email
        }
    }

# ----------------- CHAT ENDPOINTS -----------------

@app.get("/api/chat/sessions")
def get_sessions(user_id: int = Depends(get_current_user_id), db: Session = Depends(get_db)):
    sessions = db.query(ChatSession).filter(ChatSession.user_id == user_id).order_by(ChatSession.created_at.desc()).all()
    return [{"id": s.id, "title": s.title, "createdAt": s.created_at} for s in sessions]

@app.post("/api/chat/sessions")
def create_session(
    payload: dict = Body(default={}), 
    user_id: int = Depends(get_current_user_id), 
    db: Session = Depends(get_db)
):
    session_id = str(uuid.uuid4())
    title = payload.get("title", "New Loan Consultation")
    
    session = ChatSession(id=session_id, user_id=user_id, title=title)
    db.add(session)
    db.commit()
    return {"id": session.id, "title": session.title}

@app.delete("/api/chat/sessions/{session_id}")
def delete_session(
    session_id: str,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    session = db.query(ChatSession).filter(ChatSession.id == session_id, ChatSession.user_id == user_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")
    db.delete(session)
    db.commit()
    return {"message": "Session deleted successfully."}

@app.get("/api/chat/sessions/{session_id}/messages")
def get_messages(
    session_id: str,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    # Verify session ownership
    session = db.query(ChatSession).filter(ChatSession.id == session_id, ChatSession.user_id == user_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")
        
    messages = db.query(ChatMessage).filter(ChatMessage.session_id == session_id).order_by(ChatMessage.created_at.asc()).all()
    
    response = []
    for msg in messages:
        trace_parsed = None
        if msg.trace_data:
            try:
                trace_parsed = json.loads(msg.trace_data)
            except Exception:
                pass
        response.append({
            "id": msg.id,
            "sender": msg.sender,
            "message": msg.message,
            "traceData": trace_parsed,
            "createdAt": msg.created_at
        })
    return response

@app.post("/api/chat/sessions/{session_id}/messages")
def post_message(
    session_id: str,
    payload: dict = Body(...),
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    # Verify session ownership
    session = db.query(ChatSession).filter(ChatSession.id == session_id, ChatSession.user_id == user_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")
        
    text = payload.get("message")
    language = payload.get("language", "english") # english / hindi / hinglish
    
    if not text:
        raise HTTPException(status_code=400, detail="Message content empty.")
        
    # 1. Fetch current profile from previous messages to carry state forward (Memory)
    current_profile = {}
    last_assistant_msg = db.query(ChatMessage).filter(
        ChatMessage.session_id == session_id,
        ChatMessage.sender == "assistant",
        ChatMessage.trace_data != None
    ).order_by(ChatMessage.created_at.desc()).first()
    
    if last_assistant_msg:
        try:
            trace_json = json.loads(last_assistant_msg.trace_data)
            # Fetch output profile of the last step (which sits inside the trace of Profile Extractor)
            for step in trace_json:
                if step.get("agent") == "Profile Extractor":
                    current_profile = step.get("output", {})
                    # Delete metadata keys if any
                    current_profile.pop("missingFields", None)
                    current_profile.pop("error", None)
                    break
        except Exception:
            pass
            
    # Save the user message in DB
    user_msg = ChatMessage(session_id=session_id, sender="user", message=text)
    db.add(user_msg)
    db.commit()
    
    # 2. Run multi-agent execution pipeline
    agent_result = execute_loan_chain(text, current_profile, language, db)
    
    # Update chat session title if it was default and we just extracted a purpose/amount
    if session.title == "New Loan Consultation":
        prof = agent_result.get("profile", {})
        purp = prof.get("loanPurpose")
        amt = prof.get("loanAmount")
        if purp and amt:
            session.title = f"₹{int(amt):,} {purp} Consultation"
            db.commit()
            
    # Save the assistant message with execution trace data
    assistant_msg = ChatMessage(
        session_id=session_id,
        sender="assistant",
        message=agent_result["text_response"],
        trace_data=json.dumps(agent_result["trace"])
    )
    db.add(assistant_msg)
    db.commit()
    
    return {
        "id": assistant_msg.id,
        "sender": "assistant",
        "message": agent_result["text_response"],
        "traceData": agent_result["trace"],
        "createdAt": assistant_msg.created_at,
        "complete": agent_result.get("complete", False),
        "updatedSessionTitle": session.title
    }

# ----------------- DEVELOPER PORTAL ENDPOINTS -----------------

@app.get("/api/developer/prompts")
def get_prompts(user_id: int = Depends(get_current_user_id), db: Session = Depends(get_db)):
    prompts = db.query(PromptConfig).filter(PromptConfig.is_active == True).all()
    return [{
        "id": p.id,
        "agent_name": p.agent_name,
        "system_prompt": p.system_prompt,
        "version": p.version,
        "updated_at": p.updated_at
    } for p in prompts]

@app.put("/api/developer/prompts/{agent_name}")
def update_prompt(
    agent_name: str,
    payload: dict = Body(...),
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    new_prompt = payload.get("system_prompt")
    if not new_prompt:
        raise HTTPException(status_code=400, detail="Prompt empty.")
        
    # Deactivate existing active prompt
    existing = db.query(PromptConfig).filter(
        PromptConfig.agent_name == agent_name,
        PromptConfig.is_active == True
    ).all()
    
    max_ver = 0
    for p in existing:
        p.is_active = False
        max_ver = max(max_ver, p.version)
        
    # Write a new version
    updated_config = PromptConfig(
        agent_name=agent_name,
        system_prompt=new_prompt,
        version=max_ver + 1,
        is_active=True,
        updated_at=datetime.utcnow()
    )
    db.add(updated_config)
    db.commit()
    
    # Audit logging
    log = AuditLog(
        user_id=user_id,
        action="UPDATE_PROMPT",
        details=f"Updated agent '{agent_name}' to version {max_ver + 1}."
    )
    db.add(log)
    db.commit()
    
    return {
        "message": f"Agent '{agent_name}' updated successfully to version {max_ver + 1}.",
        "version": max_ver + 1
    }

@app.get("/api/developer/logs")
def get_logs(user_id: int = Depends(get_current_user_id), db: Session = Depends(get_db)):
    logs = db.query(AuditLog).order_by(AuditLog.timestamp.desc()).limit(100).all()
    return [{
        "id": l.id,
        "action": l.action,
        "details": l.details,
        "timestamp": l.timestamp
    } for l in logs]

@app.get("/api/developer/status")
def get_status():
    return {
        "status": "online",
        "timestamp": datetime.utcnow(),
        "gemini_api_key_configured": bool(settings.GEMINI_API_KEY)
    }
