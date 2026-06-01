import json
from datetime import datetime
from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import declarative_base, sessionmaker, relationship
from config import settings

# Create engine and session maker
engine = create_engine(
    settings.DATABASE_URL, 
    connect_args={"check_same_thread": False} if settings.DATABASE_URL.startswith("sqlite") else {}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(100), unique=True, index=True, nullable=False)
    hashed_password = Column(String(200), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    sessions = relationship("ChatSession", back_populates="user", cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="user", cascade="all, delete-orphan")

class ChatSession(Base):
    __tablename__ = "chat_sessions"
    id = Column(String(50), primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String(100), default="New Loan Consultation")
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="sessions")
    messages = relationship("ChatMessage", back_populates="session", cascade="all, delete-orphan")

class ChatMessage(Base):
    __tablename__ = "chat_messages"
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String(50), ForeignKey("chat_sessions.id"), nullable=False)
    sender = Column(String(20), nullable=False) # "user" or "assistant"
    message = Column(Text, nullable=False)
    trace_data = Column(Text, nullable=True) # Stored as JSON string
    created_at = Column(DateTime, default=datetime.utcnow)

    session = relationship("ChatSession", back_populates="messages")

class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    action = Column(String(100), nullable=False)
    details = Column(Text, nullable=True) # Stored as JSON string
    timestamp = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="audit_logs")

class PromptConfig(Base):
    __tablename__ = "prompt_configs"
    id = Column(Integer, primary_key=True, index=True)
    agent_name = Column(String(50), nullable=False) # e.g., "profile_extractor"
    system_prompt = Column(Text, nullable=False)
    version = Column(Integer, default=1)
    is_active = Column(Boolean, default=True)
    updated_at = Column(DateTime, default=datetime.utcnow)

def init_db():
    Base.metadata.create_all(bind=engine)
    
    # Seed base prompts if they do not exist
    db = SessionLocal()
    try:
        count = db.query(PromptConfig).count()
        if count == 0:
            seed_default_prompts(db)
    finally:
        db.close()

def seed_default_prompts(db):
    default_prompts = [
        {
            "agent_name": "profile_extractor",
            "system_prompt": """You are a financial profile extraction engine.
Extract borrower information from user input.
Fields to extract:
- loanAmount (number)
- loanPurpose (string)
- monthlyIncome (number)
- existingEMI (number)
- employmentType (string, e.g., "Salaried", "Self-Employed", "Business Owner")
- preferredTenure (number of months)
- riskProfile (string, e.g., "Low", "Medium", "High")

Evaluate riskProfile strictly as:
- 'Low' if existingEMI / monthlyIncome < 0.2
- 'Medium' if existingEMI / monthlyIncome is between 0.2 and 0.4
- 'High' if existingEMI / monthlyIncome > 0.4

Return JSON only in the following schema:
{
  "loanAmount": number or null,
  "loanPurpose": string or null,
  "monthlyIncome": number or null,
  "existingEMI": number or null,
  "employmentType": string or null,
  "preferredTenure": number or null,
  "riskProfile": string or null,
  "missingFields": ["field1", "field2"]
}
If information is missing, set value to null and list the field name in the "missingFields" array. Provide helpful suggestions in your follow-ups."""
        },
        {
            "agent_name": "eligibility",
            "system_prompt": """You are a lending eligibility engine.
Compare borrower profile against product catalog guidelines.
Product Rules:
- Personal Loan: monthlyIncome >= 25000
- Salary Advance: employmentType is 'Salaried' and monthlyIncome >= 20000
- SME Loan: employmentType is 'Business Owner' or 'Self-Employed' and monthlyIncome >= 40000
- BNPL: loanAmount <= 50000
- Secured Loan: Collateral or lower risk profile (riskProfile is 'Low' or 'Medium')

Evaluate and return JSON only:
{
  "eligibleProducts": [{"name": string, "minRate": number, "maxTenure": number}],
  "rejectedProducts": [{"name": string, "reason": string}],
  "reasoning": [string]
}"""
        },
        {
            "agent_name": "recommendation",
            "system_prompt": """You are a loan recommendation engine.
Rank eligible products for the borrower based on:
1. Affordability (monthly payments vs income)
2. Purpose match
3. Best interest rate
4. Low risk profile match

Return JSON only:
{
  "recommendedProduct": {"name": string, "rate": number, "tenure": number, "suitabilityScore": number},
  "alternatives": [{"name": string, "rate": number, "tenure": number, "suitabilityScore": number}],
  "whyRecommended": [string]
}"""
        },
        {
            "agent_name": "compliance",
            "system_prompt": """You are a responsible lending compliance checker.
Review recommendations against compliance guardrails:
1. Never guarantee approval.
2. Never claim loan certainty or use terms like '100% approved'.
3. Alert borrower if their total estimated debt burden (existing EMI + new EMI) exceeds 50% of monthly income.
4. Mandate that underwriting review and KYC verification are required.

Return JSON only:
{
  "complianceApproved": boolean,
  "warnings": [string]
}"""
        },
        {
            "agent_name": "explanation",
            "system_prompt": """You are a professional financial advisor.
Summarize the loan consultation details in a clear, friendly, and empowering way.
Address:
1. The recommended product and why it matches their purpose.
2. The EMI burden and total repayment breakdown.
3. Compare short vs long tenure trade-offs for their specific amount (interest saved vs monthly cash flow).
4. Compliance warnings in a supportive but clear tone.

Use markdown format. Start with a structured dashboard summary table, then provide deep insights.
Always add this exact disclaimer at the end:
*Disclaimer: Final approval depends on lender underwriting, KYC verification, and policy checks.*"""
        }
    ]

    for p in default_prompts:
        config = PromptConfig(
            agent_name=p["agent_name"],
            system_prompt=p["system_prompt"],
            version=1,
            is_active=True
        )
        db.add(config)
    db.commit()
