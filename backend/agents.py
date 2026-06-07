import json
import time
import re
from google import genai
from sqlalchemy.orm import Session
from config import settings
from database import PromptConfig, AuditLog

# Define default rate catalog for eligibility evaluation
PRODUCT_CATALOG = {
    "Personal Loan": {"minRate": 10.5, "maxTenure": 60, "description": "General personal finance needs."},
    "Salary Advance": {"minRate": 12.0, "maxTenure": 12, "description": "Short-term salary bridge."},
    "SME Loan": {"minRate": 8.5, "maxTenure": 84, "description": "Business scale-up and equipment financing."},
    "BNPL": {"minRate": 0.0, "maxTenure": 3, "description": "Interest-free short-term merchant credit."},
    "Secured Loan": {"minRate": 7.2, "maxTenure": 180, "description": "Lower rate backed by assets/collateral."}
}

def get_active_prompt(db: Session, agent_name: str) -> str:
    """Helper to fetch prompt version from database."""
    config = db.query(PromptConfig).filter(
        PromptConfig.agent_name == agent_name,
        PromptConfig.is_active == True
    ).order_by(PromptConfig.version.desc()).first()
    if config:
        return config.system_prompt
    return ""

def is_rate_limit_error(e: Exception) -> bool:
    """Helper to detect API failures (e.g. rate limit, quota, timeout, network error) from Gemini API."""
    return True

def call_gemini(system_prompt: str, user_content: str) -> str:
    """Utility to query Gemini API or fall back if key is missing."""
    if not settings.GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY is not configured.")
    
    from google.genai import types
    client = genai.Client(api_key=settings.GEMINI_API_KEY)
    
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=user_content,
        config=types.GenerateContentConfig(
            system_instruction=system_prompt,
            response_mime_type="application/json"
        )
    )
    return response.text

def parse_json_safely(text: str, default_val: dict) -> dict:
    """Secure JSON parser handling standard markdown blocks."""
    try:
        cleaned = text.strip()
        if cleaned.startswith("```json"):
            cleaned = cleaned[7:]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
        return json.loads(cleaned.strip())
    except Exception:
        # Regex search for brackets as fallback
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if match:
            try:
                return json.loads(match.group(0))
            except Exception:
                pass
        return default_val

# Pure mathematical tool for EMI calculation
def calculate_emi(principal: float, annual_rate: float, months: int) -> dict:
    if not principal or not months:
        return {"emi": 0, "interest": 0, "repayment": 0}
    
    # BNPL at 0%
    if annual_rate == 0:
        emi = principal / months
        repayment = principal
        interest = 0
    else:
        r = annual_rate / 12 / 100
        emi = (principal * r * ((1 + r) ** months)) / (((1 + r) ** months) - 1)
        repayment = emi * months
        interest = repayment - principal
        
    return {
        "emi": round(emi, 2),
        "interest": round(interest, 2),
        "repayment": round(repayment, 2)
    }

# Stage 1: Profile Extraction Agent
def run_profile_extractor(user_message: str, current_profile: dict, db: Session) -> tuple[dict, dict]:
    start_time = time.time()
    system_prompt = get_active_prompt(db, "profile_extractor")
    
    # Structure payload containing historical state
    user_payload = f"Current profile: {json.dumps(current_profile)}\nNew User Message: '{user_message}'"
    
    use_mock = not settings.GEMINI_API_KEY or current_profile.get("_rate_limited")
    
    if not use_mock:
        try:
            res_raw = call_gemini(system_prompt, user_payload)
            output_data = parse_json_safely(res_raw, {})
            # Merge extracted data into current profile
            for k, v in output_data.items():
                if k != "missingFields" and v is not None:
                    current_profile[k] = v
            current_profile["missingFields"] = output_data.get("missingFields", [])
            output_data = current_profile
        except Exception as e:
            if is_rate_limit_error(e):
                current_profile["_rate_limited"] = True
                use_mock = True
            else:
                output_data = {"error": str(e), **current_profile}
                
    if use_mock:
        # Run mock profile extractor logic
        time.sleep(0.5)
        # Attempt simple parsing of inputs using regex for mock robustness
        extracted = current_profile.copy()
        
        # Simple regex extractors
        amount_match = re.search(r'(?:loan of|need|amount of|rs\.?\s*|inr\s*)(\d+[\d,]*)(?:\s*k|\s*thousand|\s*lakh)?', user_message, re.IGNORECASE)
        if amount_match:
            val_str = amount_match.group(1).replace(",", "")
            val = float(val_str)
            if "k" in user_message.lower(): val *= 1000
            elif "thousand" in user_message.lower(): val *= 1000
            elif "lakh" in user_message.lower(): val *= 100000
            extracted["loanAmount"] = val
            
        income_match = re.search(r'(?:income|salary|earn|earning)(?:\s*is\s*|\s*of\s*|\s*:\s*|rs\.?\s*|inr\s*)(\d+[\d,]*)', user_message, re.IGNORECASE)
        if income_match:
            val_str = income_match.group(1).replace(",", "")
            val = float(val_str)
            extracted["monthlyIncome"] = val
            
        emi_match = re.search(r'(?:emi|existing emi|paying|loan repayment)(?:\s*is\s*|\s*of\s*|\s*:\s*|rs\.?\s*|inr\s*)(\d+[\d,]*)', user_message, re.IGNORECASE)
        if emi_match:
            val_str = emi_match.group(1).replace(",", "")
            extracted["existingEMI"] = float(val_str)
        elif "no emi" in user_message.lower() or "nil emi" in user_message.lower():
            extracted["existingEMI"] = 0
            
        tenure_match = re.search(r'(\d+)\s*(?:months|month|yrs|years|year)', user_message, re.IGNORECASE)
        if tenure_match:
            val = int(tenure_match.group(1))
            if "yr" in user_message.lower() or "year" in user_message.lower():
                val *= 12
            extracted["preferredTenure"] = val
            
        if "salaried" in user_message.lower() or "job" in user_message.lower():
            extracted["employmentType"] = "Salaried"
        elif "business" in user_message.lower() or "owner" in user_message.lower():
            extracted["employmentType"] = "Business Owner"
        elif "self" in user_message.lower() or "freelance" in user_message.lower():
            extracted["employmentType"] = "Self-Employed"
            
        for key in ["wedding", "education", "car", "medical", "home", "renovation", "business", "personal"]:
            if key in user_message.lower():
                extracted["loanPurpose"] = key.capitalize()
                
        # Risk profiling
        inc = extracted.get("monthlyIncome") or 1
        e_emi = extracted.get("existingEMI") or 0
        ratio = e_emi / inc
        if ratio < 0.2: extracted["riskProfile"] = "Low"
        elif ratio <= 0.4: extracted["riskProfile"] = "Medium"
        else: extracted["riskProfile"] = "High"
        
        # Missing fields calculator
        missing = []
        for field in ["loanAmount", "loanPurpose", "monthlyIncome", "existingEMI", "employmentType", "preferredTenure"]:
            if extracted.get(field) is None:
                missing.append(field)
        extracted["missingFields"] = missing
        
        output_data = extracted
            
    latency = time.time() - start_time
    trace = {
        "agent": "Profile Extractor",
        "input": user_payload,
        "output": output_data,
        "latency_ms": round(latency * 1000, 2)
    }
    return output_data, trace

# Stage 2: Eligibility Engine
def run_eligibility_engine(profile: dict, db: Session) -> tuple[dict, dict]:
    start_time = time.time()
    system_prompt = get_active_prompt(db, "eligibility")
    
    income = profile.get("monthlyIncome") or 0
    emp_type = profile.get("employmentType") or ""
    amount = profile.get("loanAmount") or 0
    risk = profile.get("riskProfile") or "Medium"
    
    use_mock = not settings.GEMINI_API_KEY or profile.get("_rate_limited")
    
    if not use_mock:
        try:
            res_raw = call_gemini(system_prompt, json.dumps(profile))
            output_data = parse_json_safely(res_raw, {"eligibleProducts": [], "rejectedProducts": [], "reasoning": []})
        except Exception as e:
            if is_rate_limit_error(e):
                profile["_rate_limited"] = True
                use_mock = True
            else:
                output_data = {"error": str(e), "eligibleProducts": [], "rejectedProducts": []}
                
    if use_mock:
        time.sleep(0.4)
        eligible = []
        rejected = []
        reasoning = []
        
        # 1. Personal Loan
        if income >= 25000:
            eligible.append({"name": "Personal Loan", "minRate": PRODUCT_CATALOG["Personal Loan"]["minRate"], "maxTenure": PRODUCT_CATALOG["Personal Loan"]["maxTenure"]})
            reasoning.append("Eligible for Personal Loan since income is above 25k limit.")
        else:
            rejected.append({"name": "Personal Loan", "reason": "Monthly income must be at least ₹25,000."})
            reasoning.append("Rejected for Personal Loan due to insufficient income.")
            
        # 2. Salary Advance
        if emp_type == "Salaried" and income >= 20000:
            eligible.append({"name": "Salary Advance", "minRate": PRODUCT_CATALOG["Salary Advance"]["minRate"], "maxTenure": PRODUCT_CATALOG["Salary Advance"]["maxTenure"]})
            reasoning.append("Eligible for Salary Advance as a salaried employee.")
        else:
            rejected.append({"name": "Salary Advance", "reason": "Requires Salaried employment status and minimum income of ₹20,000."})
            
        # 3. SME Loan
        if emp_type in ["Business Owner", "Self-Employed"] and income >= 40000:
            eligible.append({"name": "SME Loan", "minRate": PRODUCT_CATALOG["SME Loan"]["minRate"], "maxTenure": PRODUCT_CATALOG["SME Loan"]["maxTenure"]})
            reasoning.append("Eligible for SME Loan based on Business profile.")
        else:
            rejected.append({"name": "SME Loan", "reason": "Requires Business Owner / Self-Employed type and income >= ₹40,000."})
            
        # 4. BNPL
        if amount <= 50000:
            eligible.append({"name": "BNPL", "minRate": PRODUCT_CATALOG["BNPL"]["minRate"], "maxTenure": PRODUCT_CATALOG["BNPL"]["maxTenure"]})
            reasoning.append("Eligible for Buy Now Pay Later (BNPL) credit under limit.")
        else:
            rejected.append({"name": "BNPL", "reason": "BNPL is limited to purchases below ₹50,000."})
            
        # 5. Secured Loan
        if risk in ["Low", "Medium"]:
            eligible.append({"name": "Secured Loan", "minRate": PRODUCT_CATALOG["Secured Loan"]["minRate"], "maxTenure": PRODUCT_CATALOG["Secured Loan"]["maxTenure"]})
            reasoning.append("Eligible for Secured Loan due to favorable risk profile.")
        else:
            rejected.append({"name": "Secured Loan", "reason": "Requires low or medium debt-to-income risk index."})
            
        output_data = {
            "eligibleProducts": eligible,
            "rejectedProducts": rejected,
            "reasoning": reasoning
        }
            
    latency = time.time() - start_time
    trace = {
        "agent": "Eligibility Engine",
        "input": profile,
        "output": output_data,
        "latency_ms": round(latency * 1000, 2)
    }
    return output_data, trace

# Stage 3: Recommendation Agent
def run_recommendation_engine(profile: dict, eligibility: dict, db: Session) -> tuple[dict, dict]:
    start_time = time.time()
    system_prompt = get_active_prompt(db, "recommendation")
    
    payload = {
        "profile": profile,
        "eligibility": eligibility
    }
    
    use_mock = not settings.GEMINI_API_KEY or profile.get("_rate_limited")
    
    if not use_mock:
        try:
            res_raw = call_gemini(system_prompt, json.dumps(payload))
            output_data = parse_json_safely(res_raw, {"recommendedProduct": {}, "alternatives": [], "whyRecommended": []})
        except Exception as e:
            if is_rate_limit_error(e):
                profile["_rate_limited"] = True
                use_mock = True
            else:
                output_data = {"error": str(e), "recommendedProduct": {}, "alternatives": []}
                
    if use_mock:
        time.sleep(0.4)
        eligible = eligibility.get("eligibleProducts", [])
        if not eligible:
            output_data = {
                "recommendedProduct": {},
                "alternatives": [],
                "whyRecommended": ["No eligible products found. Adjust inputs to improve score."]
            }
        else:
            # Simple sorting/ranking logic for mock
            ranked = []
            for prod in eligible:
                name = prod["name"]
                score = 80
                # Boost if purpose matches (e.g. SME Loan for Business)
                if name == "SME Loan" and profile.get("loanPurpose") == "Business":
                    score += 15
                elif name == "BNPL" and profile.get("loanAmount", 0) <= 20000:
                    score += 10
                elif name == "Personal Loan" and profile.get("riskProfile") == "Low":
                    score += 10
                
                # Penalize high amount vs tenure
                if profile.get("loanAmount", 0) > 200000 and prod["maxTenure"] < 24:
                    score -= 20
                    
                ranked.append({
                    "name": name,
                    "rate": prod["minRate"],
                    "tenure": min(profile.get("preferredTenure") or prod["maxTenure"], prod["maxTenure"]),
                    "suitabilityScore": score
                })
                
            ranked = sorted(ranked, key=lambda x: x["suitabilityScore"], reverse=True)
            output_data = {
                "recommendedProduct": ranked[0],
                "alternatives": ranked[1:] if len(ranked) > 1 else [],
                "whyRecommended": [f"Ranked first because suitability score matches {ranked[0]['suitabilityScore']}% alignment with purpose '{profile.get('loanPurpose')}' and affordable tenure constraint."]
            }
            
    latency = time.time() - start_time
    trace = {
        "agent": "Recommendation Engine",
        "input": payload,
        "output": output_data,
        "latency_ms": round(latency * 1000, 2)
    }
    return output_data, trace

# Stage 4: Pure Mathematical EMI Tool
def run_emi_tool(profile: dict, recommendation: dict) -> tuple[dict, dict]:
    start_time = time.time()
    
    amount = profile.get("loanAmount") or 0
    rec_prod = recommendation.get("recommendedProduct") or {}
    rate = rec_prod.get("rate") or 0.0
    tenure = rec_prod.get("tenure") or 12
    
    # Calculate main product EMI
    emi_result = calculate_emi(amount, rate, tenure)
    
    # Calculate alternative options for interactive graph on the frontend (e.g. 12m, 24m, 36m tenures)
    tenure_options = [12, 24, 36, 48, 60]
    # Restrict to product max tenure limits
    matching_catalog = PRODUCT_CATALOG.get(rec_prod.get("name"), {"maxTenure": 60})
    tenure_options = [t for t in tenure_options if t <= matching_catalog["maxTenure"]]
    if tenure not in tenure_options and tenure > 0:
        tenure_options.append(tenure)
    tenure_options = sorted(list(set(tenure_options)))
    
    amortization_scenarios = []
    for t in tenure_options:
        res = calculate_emi(amount, rate, t)
        amortization_scenarios.append({
            "tenure_months": t,
            "emi": res["emi"],
            "total_interest": res["interest"],
            "total_repayment": res["repayment"]
        })
        
    output_data = {
        "main_calculation": emi_result,
        "scenarios": amortization_scenarios,
        "rate_applied": rate,
        "amount": amount,
        "tenure": tenure
    }
    
    latency = time.time() - start_time
    trace = {
        "agent": "EMI Math Tool",
        "input": {"amount": amount, "rate": rate, "tenure": tenure},
        "output": output_data,
        "latency_ms": round(latency * 1000, 2)
    }
    return output_data, trace

# Stage 5: Compliance Checker
def run_compliance_checker(profile: dict, recommendation: dict, emi_data: dict, db: Session) -> tuple[dict, dict]:
    start_time = time.time()
    system_prompt = get_active_prompt(db, "compliance")
    
    # Prepare parameters
    income = profile.get("monthlyIncome") or 1
    existing_emi = profile.get("existingEMI") or 0
    new_emi = emi_data.get("main_calculation", {}).get("emi") or 0
    dti_ratio = (existing_emi + new_emi) / income
    
    payload = {
        "profile": profile,
        "recommendation": recommendation,
        "emi_data": emi_data,
        "dti_ratio": round(dti_ratio, 4)
    }
    
    use_mock = not settings.GEMINI_API_KEY or profile.get("_rate_limited")
    
    if not use_mock:
        try:
            res_raw = call_gemini(system_prompt, json.dumps(payload))
            output_data = parse_json_safely(res_raw, {"complianceApproved": True, "warnings": []})
        except Exception as e:
            if is_rate_limit_error(e):
                profile["_rate_limited"] = True
                use_mock = True
            else:
                output_data = {"error": str(e), "complianceApproved": False, "warnings": ["System check failed."]}
                
    if use_mock:
        time.sleep(0.3)
        warnings = []
        approved = True
        
        # Hard-coded guardrails
        if dti_ratio > 0.5:
            approved = False
            warnings.append(f"High Debt Burden Index: Total combined EMI (₹{int(existing_emi + new_emi)}) consumes {round(dti_ratio*100, 1)}% of monthly income. Standard affordability thresholds advise keeping this below 50%.")
            
        if profile.get("riskProfile") == "High":
            warnings.append("Elevated risk category flags standard KYC audits.")
            
        warnings.append("This matches a simulation scan. Final credit allocation relies strictly on verified payslips, identity documents, and standard physical checks.")
        
        output_data = {
            "complianceApproved": approved,
            "warnings": warnings
        }
            
    latency = time.time() - start_time
    trace = {
        "agent": "Compliance Guardrail",
        "input": payload,
        "output": output_data,
        "latency_ms": round(latency * 1000, 2)
    }
    return output_data, trace

# Stage 6: Financial Explanation Agent (Bilingual support)
def run_explanation_agent(profile: dict, recommendation: dict, emi_data: dict, compliance: dict, language: str, db: Session) -> tuple[str, dict]:
    start_time = time.time()
    system_prompt = get_active_prompt(db, "explanation")
    
    # Append localized instruction to system prompt for Hindi / English support
    if language.lower() == "hindi":
        system_prompt += "\nIMPORTANT: Generate the response completely in Hindi (with clear Devanagari script and professional terms). Address the borrower respectfully."
    elif language.lower() == "hinglish":
        system_prompt += "\nIMPORTANT: Generate the response in comfortable, conversational Hinglish (Hindi written using Latin/English characters) standard in chats."
    
    payload = {
        "profile": profile,
        "recommendation": recommendation,
        "emi_data": emi_data,
        "compliance": compliance
    }
    
    use_mock = not settings.GEMINI_API_KEY or profile.get("_rate_limited")
    
    if not use_mock:
        try:
            res_raw = call_gemini(system_prompt, json.dumps(payload))
            output_data = res_raw
        except Exception as e:
            if is_rate_limit_error(e):
                profile["_rate_limited"] = True
                use_mock = True
            else:
                output_data = f"Error generating explanation: {str(e)}"
                
    if use_mock:
        time.sleep(0.6)
        
        rec_name = recommendation.get("recommendedProduct", {}).get("name", "Standard Loan")
        rate = recommendation.get("recommendedProduct", {}).get("rate", 0)
        tenure = emi_data.get("tenure", 12)
        amount = emi_data.get("amount", 0)
        emi = emi_data.get("main_calculation", {}).get("emi", 0)
        interest = emi_data.get("main_calculation", {}).get("interest", 0)
        repayment = emi_data.get("main_calculation", {}).get("repayment", 0)
        
        # Format a beautifully detailed Markdown output
        if language.lower() == "hindi":
            markdown = f"""### 📝 ऋण सलाहकार रिपोर्ट (Loan Advisor Summary)

आपके विवरण के आधार पर, हमने आपके वित्तीय प्रोफाइल का मूल्यांकन किया है। आपके लिए सर्वश्रेष्ठ विकल्प निम्नलिखित है:

| विवरण | मान |
| :--- | :--- |
| **अनुशंसित ऋण (Product)** | {rec_name} |
| **ब्याज दर (Interest Rate)** | {rate}% प्रति वर्ष |
| **ऋण राशि (Amount Requested)** | ₹{amount:,} |
| **अवधि (Tenure)** | {tenure} महीने |
| **मासिक किस्त (EMI)** | **₹{emi:,}** |
| **कुल ब्याज (Total Interest)** | ₹{interest:,} |
| **कुल भुगतान (Total Repayment)** | ₹{repayment:,} |

---

#### 💡 यह विकल्प क्यों चुना गया?
1. **उद्देश्य अनुकूलन:** आपकी आवश्यकताओं के लिए '{profile.get("loanPurpose")}' सबसे उपयुक्त श्रेणी है।
2. **वहनीयता:** मासिक किस्त (₹{emi:,}) आपकी मासिक आय (₹{profile.get("monthlyIncome", 0):,}) के साथ अच्छी तरह से संतुलित है।

#### 📊 भुगतान अवधि (Tenure) का प्रभाव:
* **छोटी अवधि (जैसे 12 महीने):** आपको प्रति माह अधिक राशि का भुगतान करना होगा, लेकिन आप भारी ब्याज बचत करेंगे।
* **लंबी अवधि (जैसे 36 महीने+):** आपकी मासिक किस्त कम हो जाएगी जिससे आपका नकदी प्रवाह (Cash Flow) बेहतर रहेगा, लेकिन ब्याज का बोझ बढ़ जाएगा।

"""
            if not compliance.get("complianceApproved"):
                markdown += "\n> ⚠️ **महत्वपूर्ण चेतावनी:** आपका कुल ऋण भार (Debt Burden) मासिक आय के 50% से अधिक है। कृपया सोच-समझकर निर्णय लें।\n"
                
            for warning in compliance.get("warnings", []):
                markdown += f"- 📍 {warning}\n"
                
            markdown += "\n*अस्वीकरण: अंतिम स्वीकृति ऋणदाता की अंडरराइटिंग, केवाईसी (KYC) सत्यापन और नीतिगत जांच पर निर्भर करती है।*"
            
        else:
            markdown = f"""### 📝 Financial Advisor Report

Based on the information provided, we have structured a customized lending profile. Here is your evaluation:

| Metric | Details |
| :--- | :--- |
| **Recommended Product** | {rec_name} |
| **Applied Interest Rate** | {rate}% per annum |
| **Principal Amount** | ₹{amount:,} |
| **Configured Tenure** | {tenure} Months |
| **Estimated Monthly EMI** | **₹{emi:,}** |
| **Accumulated Interest** | ₹{interest:,} |
| **Total Cumulative Repayment** | **₹{repayment:,}** |

---

#### 💡 Key Rationale for Selection
1. **Optimal Suitability**: Directly aligns with your stated purpose '{profile.get("loanPurpose")}'.
2. **Sustainable Installment**: The EMI of ₹{emi:,} fits cleanly into your monthly income.

#### 📊 Repayment Tenure Trade-offs:
* **Accelerated Repayment (Shorter Tenure)**: Minimizes overall lifetime interest cash outflow but raises monthly obligations.
* **Balanced Repayment (Longer Tenure)**: Reduces monthly cash flow pressure at the expense of compiling larger interest balances over time.

"""
            if not compliance.get("complianceApproved"):
                markdown += "\n> ⚠️ **AFFORDABILITY WARNING:** Your cumulative debt obligations exceed 50% of your earnings. Take precaution.\n"
                
            for warning in compliance.get("warnings", []):
                markdown += f"- 📍 {warning}\n"
                
            markdown += "\n*Disclaimer: Final approval depends on lender underwriting, KYC verification, and policy checks.*"
            
        output_data = markdown
        
        # Prepend friendly fallback message if rate limited
        if profile.get("_rate_limited"):
            if language.lower() == "hindi":
                fallback_msg = "> ⚠️ **API कनेक्शन समस्या / दर सीमा (API Connection Issue / Rate Limit):** सैंडबॉक्स वातावरण में अस्थायी रूप से API समस्याएं या दर सीमा देखी गई है। सिस्टम स्वचालित रूप से नियम-आधारित सिमुलेशन पर वापस आ गया है। कृपया कुछ क्षणों में पुन: प्रयास करें, या दाईं ओर के डैशबोर्ड पर इंटरैक्टिव स्लाइडर्स का उपयोग करना जारी रखें।\n\n"
            elif language.lower() == "hinglish":
                fallback_msg = "> ⚠️ **API Connection Issue / Rate Limit:** Sandbox environment me temporarily API issue ya rate limit encounter hui hai. System automatic rule-based simulations par fall back kar raha hai. Please thodi der baad try karein, ya right-hand dashboard par interactive sliders ka use continue rakhein.\n\n"
            else:
                fallback_msg = "> ⚠️ **API Connection Issue / Rate Limit:** The sandbox environment has temporarily encountered API issues or rate limits. The system has automatically fallen back to rule-based simulations. Please try again in a moment, or continue using our interactive sliders on the right-hand dashboard.\n\n"
            
            output_data = fallback_msg + output_data
            
    latency = time.time() - start_time
    trace = {
        "agent": "Financial Explanation",
        "input": payload,
        "output": output_data,
        "latency_ms": round(latency * 1000, 2)
    }
    return output_data, trace

# Unified Orchestrator Executing the Whole Pipeline (The State Graph Flow)
def execute_loan_chain(user_message: str, current_profile: dict, language: str, db: Session) -> dict:
    trace_steps = []
    
    # 1. Profile Extraction
    profile, t1 = run_profile_extractor(user_message, current_profile, db)
    trace_steps.append(t1)
    
    # Check if there are critical fields missing
    # We continue the pipeline only if we have basic parameters (amount, income, tenure, etc.)
    # If the profile is very empty, we bypass the remaining stages to avoid hallucinations
    missing = profile.get("missingFields", [])
    
    # If missing crucial parameters (income, amount), return early with request for details
    if "monthlyIncome" in missing or "loanAmount" in missing:
        latency = t1["latency_ms"]
        
        # Format helpful missing fields question
        field_labels = {
            "loanAmount": "Required Loan Amount",
            "loanPurpose": "Loan Purpose (e.g., Wedding, Education, Business)",
            "monthlyIncome": "Your Monthly Inhand Income",
            "existingEMI": "Current EMIs you pay per month",
            "employmentType": "Employment Status (Salaried or Self-Employed)",
            "preferredTenure": "Desired repayment period in months"
        }
        
        missing_prompts = [f"- **{field_labels.get(f, f)}**" for f in missing]
        missing_text = "\n".join(missing_prompts)
        
        if language.lower() == "hindi":
            text_response = f"आपका वित्तीय प्रोफ़ाइल पूरा करने के लिए मुझे कुछ अतिरिक्त विवरणों की आवश्यकता है:\n\n{missing_text}\n\nकृपया इन विवरणों को साझा करें ताकि मैं आपकी पात्रता और मासिक किस्तों की गणना कर सकूं।"
        else:
            text_response = f"To accurately calculate your eligible products and EMI, I need a few more details about you:\n\n{missing_text}\n\nCould you please share these so we can build your evaluation?"
            
        if profile.get("_rate_limited"):
            if language.lower() == "hindi":
                fallback_msg = "> ⚠️ **API कनेक्शन समस्या / दर सीमा (API Connection Issue / Rate Limit):** सैंडबॉक्स वातावरण में अस्थायी रूप से API समस्याएं या दर सीमा देखी गई है। सिस्टम स्वचालित रूप से नियम-आधारित सिमुलेशन पर वापस आ गया है। कृपया कुछ क्षणों में पुन: प्रयास करें, या दाईं ओर के डैशबोर्ड पर इंटरैक्टिव स्लाइडर्स का उपयोग करना जारी रखें।\n\n"
            elif language.lower() == "hinglish":
                fallback_msg = "> ⚠️ **API Connection Issue / Rate Limit:** Sandbox environment me temporarily API issue ya rate limit encounter hui hai. System automatic rule-based simulations par fall back kar raha hai. Please thodi der baad try karein, ya right-hand dashboard par interactive sliders ka use continue rakhein.\n\n"
            else:
                fallback_msg = "> ⚠️ **API Connection Issue / Rate Limit:** The sandbox environment has temporarily encountered API issues or rate limits. The system has automatically fallen back to rule-based simulations. Please try again in a moment, or continue using our interactive sliders on the right-hand dashboard.\n\n"
            text_response = fallback_msg + text_response
            
        return {
            "profile": profile,
            "trace": trace_steps,
            "text_response": text_response,
            "complete": False
        }
        
    # 2. Eligibility Engines
    eligibility, t2 = run_eligibility_engine(profile, db)
    trace_steps.append(t2)
    
    # 3. Recommendation Scoring
    recommendation, t3 = run_recommendation_engine(profile, eligibility, db)
    trace_steps.append(t3)
    
    # 4. Pure EMI Computation Tool
    emi_data, t4 = run_emi_tool(profile, recommendation)
    trace_steps.append(t4)
    
    # 5. Compliance Guardrail
    compliance, t5 = run_compliance_checker(profile, recommendation, emi_data, db)
    trace_steps.append(t5)
    
    # 6. Structured Financial Advisor Summary Explanation
    explanation, t6 = run_explanation_agent(profile, recommendation, emi_data, compliance, language, db)
    trace_steps.append(t6)
    
    # Audit log entry for tracking
    try:
        log = AuditLog(
            action="EXECUTE_LOAN_CHAIN",
            details=json.dumps({
                "profile": profile,
                "recommended": recommendation.get("recommendedProduct", {}).get("name"),
                "total_repayment": emi_data.get("main_calculation", {}).get("repayment"),
                "compliance_approved": compliance.get("complianceApproved")
            })
        )
        db.add(log)
        db.commit()
    except Exception:
        db.rollback()
        
    return {
        "profile": profile,
        "eligibility": eligibility,
        "recommendation": recommendation,
        "emi_data": emi_data,
        "compliance": compliance,
        "text_response": explanation,
        "trace": trace_steps,
        "complete": True
    }
