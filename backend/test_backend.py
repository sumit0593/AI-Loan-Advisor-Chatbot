import unittest
import json
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from database import Base, seed_default_prompts, PromptConfig
from agents import calculate_emi, run_eligibility_engine, run_recommendation_engine, run_emi_tool

class TestLoanAdvisorBackend(unittest.TestCase):
    
    def setUp(self):
        # Temporarily disable Gemini API key to force sandboxed simulation mode
        from config import settings
        self.saved_key = settings.GEMINI_API_KEY
        settings.GEMINI_API_KEY = None

        # Create an in-memory SQLite database for sandboxed validation
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(bind=self.engine)
        self.SessionLocal = sessionmaker(bind=self.engine)
        self.db = self.SessionLocal()
        
        # Seed test prompts
        seed_default_prompts(self.db)

    def tearDown(self):
        from config import settings
        settings.GEMINI_API_KEY = self.saved_key
        self.db.close()
        Base.metadata.drop_all(bind=self.engine)

    def test_emi_math_calculator(self):
        """Assert pure deterministic mathematical EMI correctness."""
        # Scenario: 1,00,000 INR principal, 12% rate, 12 months
        res = calculate_emi(100000, 12.0, 12)
        
        self.assertEqual(res["emi"], 8884.88)
        self.assertEqual(res["interest"], 6618.55)
        self.assertEqual(res["repayment"], 106618.55)
        
        # Scenario: Interest-free BNPL
        res_zero = calculate_emi(30000, 0.0, 3)
        self.assertEqual(res_zero["emi"], 10000.0)
        self.assertEqual(res_zero["interest"], 0.0)
        self.assertEqual(res_zero["repayment"], 30000.0)

    def test_eligibility_engine_salaried(self):
        """Assert strict eligibility parameters matching catalog."""
        profile = {
            "monthlyIncome": 30000,
            "employmentType": "Salaried",
            "loanAmount": 40000,
            "riskProfile": "Low"
        }
        res, trace = run_eligibility_engine(profile, self.db)
        
        eligible_names = [p["name"] for p in res["eligibleProducts"]]
        rejected_names = [p["name"] for p in res["rejectedProducts"]]
        
        self.assertIn("Personal Loan", eligible_names)
        self.assertIn("Salary Advance", eligible_names)
        self.assertIn("BNPL", eligible_names)
        self.assertIn("Secured Loan", eligible_names)
        self.assertIn("SME Loan", rejected_names) # business only

    def test_eligibility_engine_business(self):
        """Assert business profiles trigger SME loans and block salary advance."""
        profile = {
            "monthlyIncome": 50000,
            "employmentType": "Business Owner",
            "loanAmount": 100000,
            "riskProfile": "Medium"
        }
        res, trace = run_eligibility_engine(profile, self.db)
        
        eligible_names = [p["name"] for p in res["eligibleProducts"]]
        rejected_names = [p["name"] for p in res["rejectedProducts"]]
        
        self.assertIn("SME Loan", eligible_names)
        self.assertIn("Personal Loan", eligible_names)
        self.assertIn("Salary Advance", rejected_names) # salaried only

    def test_recommendation_ranking(self):
        """Assert recommendation ranks products dynamically based on match scores."""
        profile = {
            "monthlyIncome": 50000,
            "employmentType": "Business Owner",
            "loanAmount": 100000,
            "loanPurpose": "Business",
            "preferredTenure": 24,
            "riskProfile": "Low"
        }
        eligibility = {
            "eligibleProducts": [
                {"name": "Personal Loan", "minRate": 10.5, "maxTenure": 60},
                {"name": "SME Loan", "minRate": 8.5, "maxTenure": 84}
            ]
        }
        res, trace = run_recommendation_engine(profile, eligibility, self.db)
        
        recommended = res["recommendedProduct"]
        self.assertEqual(recommended["name"], "SME Loan") # Matches purpose, lower rate

    def test_emi_scenarios_generation(self):
        """Verify scenario generation calculates multi-tenure options for graphs."""
        profile = {
            "loanAmount": 100000,
            "preferredTenure": 12
        }
        recommendation = {
            "recommendedProduct": {
                "name": "Personal Loan",
                "rate": 12.0,
                "tenure": 12
            }
        }
        res, trace = run_emi_tool(profile, recommendation)
        
        self.assertEqual(res["amount"], 100000)
        self.assertEqual(res["rate_applied"], 12.0)
        self.assertEqual(len(res["scenarios"]), 5) # 12, 24, 36, 48, 60 months
        
        # Verify first scenario (12 months) matches standard calculations
        scenario_12 = res["scenarios"][0]
        self.assertEqual(scenario_12["tenure_months"], 12)
        self.assertEqual(scenario_12["emi"], 8884.88)

    def test_rate_limit_fallback_profile_extractor(self):
        """Assert profile extractor falls back to mock logic and sets _rate_limited on rate limit error."""
        from unittest.mock import patch
        from config import settings
        from agents import run_profile_extractor
        
        settings.GEMINI_API_KEY = "test_key"
        
        with patch("agents.call_gemini", side_effect=Exception("429 RESOURCE_EXHAUSTED Quota limit exceeded")):
            profile = {}
            res, trace = run_profile_extractor("I need rs. 50000", profile, self.db)
            
            # Assert rate limited flag is set to True
            self.assertTrue(res.get("_rate_limited"))
            # Assert mock parsing extracted the amount
            self.assertEqual(res.get("loanAmount"), 50000.0)

    def test_rate_limit_fallback_explanation_agent(self):
        """Assert explanation agent prepends fallback message on rate limit error."""
        from unittest.mock import patch
        from config import settings
        from agents import run_explanation_agent
        
        settings.GEMINI_API_KEY = "test_key"
        
        with patch("agents.call_gemini", side_effect=Exception("429 RESOURCE_EXHAUSTED Quota limit exceeded")):
            profile = {"loanAmount": 50000, "monthlyIncome": 30000, "loanPurpose": "Education"}
            recommendation = {"recommendedProduct": {"name": "Personal Loan", "rate": 10.5, "tenure": 12}}
            emi_data = {"main_calculation": {"emi": 4500, "interest": 400, "repayment": 50400}, "tenure": 12, "amount": 50000}
            compliance = {"complianceApproved": True, "warnings": []}
            
            res, trace = run_explanation_agent(profile, recommendation, emi_data, compliance, "english", self.db)
            
            # Assert rate limited flag is set to True
            self.assertTrue(profile.get("_rate_limited"))
            # Assert fallback warning is prepended to the response
            self.assertIn("API Connection Issue / Rate Limit", res)
            self.assertIn("rule-based simulations", res)

if __name__ == "__main__":
    unittest.main()
