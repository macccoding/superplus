#!/usr/bin/env python3
"""
SuperPlus AI Business Agent - Production Version
Includes Flask web server for WhatsApp webhooks
"""

import anthropic
import os
from datetime import datetime, timedelta
import json
import time
from typing import Dict, List, Any
import schedule
import threading
from flask import Flask, request, jsonify
import gspread
from google.oauth2.service_account import Credentials

# Initialize Flask app
app = Flask(__name__)

# Global agent instance
agent = None

class SuperPlusAgent:
    """
    Autonomous AI agent for SuperPlus business management
    """
    
    def __init__(self):
        # Load configuration from environment
        self.anthropic_api_key = os.getenv('ANTHROPIC_API_KEY')
        self.client = anthropic.Anthropic(api_key=self.anthropic_api_key)
        self.model = "claude-sonnet-4-20250514"
        
        # WhatsApp configuration (supports both Cloud API and Twilio)
        self.whatsapp_phone_id = os.getenv('WHATSAPP_PHONE_NUMBER_ID')
        self.whatsapp_token = os.getenv('WHATSAPP_ACCESS_TOKEN')
        self.twilio_sid = os.getenv('TWILIO_ACCOUNT_SID')
        self.twilio_token = os.getenv('TWILIO_AUTH_TOKEN')
        self.twilio_number = os.getenv('TWILIO_WHATSAPP_NUMBER')
        
        # Google Sheets configuration
        self.sheet_id = os.getenv('GOOGLE_SHEET_ID')
        self.setup_google_sheets()
        
        # Owner contact
        self.owner_phone = os.getenv('OWNER_PHONE')
        self.owner_email = os.getenv('OWNER_EMAIL')
        
        # Agent memory
        self.memory = {
            "messages": [],
            "patterns": {},
            "anomalies": [],
            "last_processed": None
        }
        
        print("✅ SuperPlus AI Agent initialized")
        print(f"📊 Connected to Google Sheet: {self.sheet_id}")
        print(f"📱 WhatsApp mode: {'Cloud API' if self.whatsapp_phone_id else 'Twilio'}")
    
    def setup_google_sheets(self):
        """Initialize Google Sheets connection"""
        try:
            # Load credentials from environment
            creds_json = os.getenv('GOOGLE_CREDENTIALS')
            if creds_json:
                creds_dict = json.loads(creds_json)
                scopes = ['https://www.googleapis.com/auth/spreadsheets']
                credentials = Credentials.from_service_account_info(creds_dict, scopes=scopes)
                self.gc = gspread.authorize(credentials)
                self.sheet = self.gc.open_by_key(self.sheet_id)
                print("✅ Google Sheets connected")
            else:
                print("⚠️ Google Sheets credentials not found")
                self.gc = None
                self.sheet = None
        except Exception as e:
            print(f"❌ Error connecting to Google Sheets: {e}")
            self.gc = None
            self.sheet = None
    
    def process_whatsapp_message(self, message_data: Dict) -> Dict:
        """
        Process incoming WhatsApp message using AI agent reasoning
        """
        try:
            # Extract message content
            message_text = self.extract_message_text(message_data)
            sender = self.extract_sender(message_data)
            
            print(f"\n📱 New message from {sender}")
            print(f"Content preview: {message_text[:100]}...")
            
            # Store in memory
            self.memory["messages"].append({
                "timestamp": datetime.now().isoformat(),
                "sender": sender,
                "content": message_text
            })
            
            # Use AI agent to analyze and decide what to do
            response = self.agent_reasoning(message_text, sender)
            
            return {
                "success": True,
                "action_taken": response,
                "timestamp": datetime.now().isoformat()
            }
            
        except Exception as e:
            print(f"❌ Error processing message: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def extract_message_text(self, data: Dict) -> str:
        """Extract message text from WhatsApp webhook payload"""
        try:
            # WhatsApp Cloud API format
            if 'entry' in data:
                return data['entry'][0]['changes'][0]['value']['messages'][0]['text']['body']
            # Twilio format
            elif 'Body' in data:
                return data['Body']
            else:
                return str(data)
        except:
            return str(data)
    
    def extract_sender(self, data: Dict) -> str:
        """Extract sender from WhatsApp webhook payload"""
        try:
            # WhatsApp Cloud API
            if 'entry' in data:
                return data['entry'][0]['changes'][0]['value']['messages'][0]['from']
            # Twilio
            elif 'From' in data:
                return data['From']
            else:
                return "Unknown"
        except:
            return "Unknown"
    
    def agent_reasoning(self, message_text: str, sender: str) -> str:
        """
        AI agent analyzes message and decides what to do
        """
        
        system_prompt = """You are the AI Business Manager for SuperPlus in Jamaica.

Your job: Analyze incoming WhatsApp messages from staff and extract business data.

Staff send daily reports like:
"Sales $702,327.66
Phone Cards $63,427
Restaurant/Deli $186,059.97

Gas litres:
87-2316
90-6151
Ado-931
Ulsd-4356.90"

Extract:
1. Date (if mentioned, else use today)
2. Total sales
3. Phone cards revenue
4. Restaurant revenue
5. Store revenue (calculate: total - phone - restaurant)
6. Gas litres by type (87, 90, ADO, ULSD)
7. Any notes/context (power outage, busy day, etc)

Return as JSON:
{
  "date": "YYYY-MM-DD",
  "total_sales": number,
  "phone_cards": number,
  "restaurant": number,
  "store": number,
  "gas_87": number,
  "gas_90": number,
  "gas_ado": number,
  "gas_ulsd": number,
  "notes": "any context mentioned"
}

If data is unclear or incomplete, note what's missing in "notes" field."""

        try:
            response = self.client.messages.create(
                model=self.model,
                max_tokens=1000,
                temperature=0.1,
                system=system_prompt,
                messages=[{
                    "role": "user",
                    "content": f"Extract data from this message:\n\n{message_text}"
                }]
            )
            
            # Extract JSON from response
            result_text = response.content[0].text
            
            # Parse JSON (Claude sometimes wraps in markdown)
            if "```json" in result_text:
                result_text = result_text.split("```json")[1].split("```")[0].strip()
            elif "```" in result_text:
                result_text = result_text.split("```")[1].split("```")[0].strip()
            
            data = json.loads(result_text)
            
            print(f"✅ Extracted data: {json.dumps(data, indent=2)}")
            
            # Update Google Sheet
            if self.sheet:
                self.update_google_sheet(data)
            
            return f"Data extracted and stored: {data.get('date')}"
            
        except Exception as e:
            print(f"❌ Error in agent reasoning: {e}")
            return f"Error: {str(e)}"
    
    def update_google_sheet(self, data: Dict):
        """Update Google Sheet with extracted data"""
        try:
            # Get or create "Daily_Report" worksheet
            try:
                worksheet = self.sheet.worksheet("Daily_Report")
            except:
                worksheet = self.sheet.add_worksheet("Daily_Report", rows=1000, cols=20)
                # Add headers
                headers = [
                    "Date", "Total_Sales", "Phone_Cards", "Restaurant", 
                    "Store", "Gas_87", "Gas_90", "Gas_ADO", "Gas_ULSD", "Notes"
                ]
                worksheet.append_row(headers)
            
            # Prepare row data
            row = [
                data.get("date", datetime.now().strftime("%Y-%m-%d")),
                data.get("total_sales", 0),
                data.get("phone_cards", 0),
                data.get("restaurant", 0),
                data.get("store", 0),
                data.get("gas_87", 0),
                data.get("gas_90", 0),
                data.get("gas_ado", 0),
                data.get("gas_ulsd", 0),
                data.get("notes", "")
            ]
            
            # Append to sheet
            worksheet.append_row(row)
            print(f"✅ Updated Google Sheet with data for {data.get('date')}")
            
        except Exception as e:
            print(f"❌ Error updating Google Sheet: {e}")
    
    def run_weekly_analysis(self):
        """Run comprehensive weekly analysis"""
        print("\n" + "="*60)
        print("📊 RUNNING WEEKLY ANALYSIS")
        print("="*60)
        
        try:
            # Get last 7 days of data from Google Sheet
            worksheet = self.sheet.worksheet("Daily_Report")
            all_data = worksheet.get_all_records()
            
            # Get last 7 days
            recent_data = all_data[-7:] if len(all_data) >= 7 else all_data
            
            print(f"📈 Analyzing {len(recent_data)} days of data")
            
            # Send to Claude for analysis
            analysis_prompt = f"""Analyze this week's SuperPlus business data and provide:

1. Executive summary (2-3 sentences)
2. Key wins (top 3)
3. Key concerns (top 3)
4. Specific action items for next week
5. Projections for next week

Data:
{json.dumps(recent_data, indent=2)}

Be specific and actionable. Focus on revenue, patterns, and opportunities."""

            response = self.client.messages.create(
                model=self.model,
                max_tokens=2000,
                temperature=0.3,
                messages=[{
                    "role": "user",
                    "content": analysis_prompt
                }]
            )
            
            analysis = response.content[0].text
            
            print("\n" + analysis)
            
            # TODO: Send analysis via WhatsApp/Email to owner
            # For now, just log it
            
            return analysis
            
        except Exception as e:
            print(f"❌ Error running analysis: {e}")
            return None


# ============================================
# FLASK WEB SERVER (for WhatsApp webhooks)
# ============================================

@app.route('/')
def home():
    """Health check endpoint"""
    return jsonify({
        "status": "running",
        "service": "SuperPlus AI Agent",
        "version": "1.0",
        "timestamp": datetime.now().isoformat()
    })

@app.route('/webhook', methods=['GET', 'POST'])
def webhook():
    """WhatsApp webhook endpoint"""
    
    if request.method == 'GET':
        # Webhook verification (for WhatsApp Cloud API)
        mode = request.args.get('hub.mode')
        token = request.args.get('hub.verify_token')
        challenge = request.args.get('hub.challenge')
        
        verify_token = os.getenv('WEBHOOK_VERIFY_TOKEN', 'superplus_verify_token')
        
        if mode == 'subscribe' and token == verify_token:
            print("✅ Webhook verified")
            return challenge, 200
        else:
            return 'Forbidden', 403
    
    elif request.method == 'POST':
        # Process incoming message
        data = request.get_json() or request.form.to_dict()
        
        print(f"\n📨 Webhook received: {json.dumps(data, indent=2)[:200]}...")
        
        if agent:
            result = agent.process_whatsapp_message(data)
            return jsonify(result), 200
        else:
            return jsonify({"error": "Agent not initialized"}), 500

@app.route('/dashboard')
def dashboard():
    """Simple dashboard showing agent status"""
    if agent:
        status = {
            "status": "running",
            "messages_processed": len(agent.memory.get("messages", [])),
            "last_processed": agent.memory.get("last_processed"),
            "patterns_learned": len(agent.memory.get("patterns", {})),
            "sheet_connected": agent.sheet is not None
        }
    else:
        status = {"status": "not initialized"}
    
    return jsonify(status), 200

@app.route('/run-analysis', methods=['POST'])
def run_analysis_endpoint():
    """Manual trigger for weekly analysis"""
    if agent:
        analysis = agent.run_weekly_analysis()
        return jsonify({
            "success": True,
            "analysis": analysis
        }), 200
    else:
        return jsonify({"error": "Agent not initialized"}), 500


# ============================================
# SCHEDULER (runs in background)
# ============================================

def run_scheduler():
    """Background thread for scheduled tasks"""
    while True:
        schedule.run_pending()
        time.sleep(60)

def schedule_tasks():
    """Set up scheduled tasks"""
    # Weekly analysis every Sunday at 8 PM Jamaica time
    schedule.every().sunday.at("20:00").do(lambda: agent.run_weekly_analysis() if agent else None)
    
    print("📅 Scheduled tasks configured:")
    print("   - Weekly analysis: Sunday 8:00 PM")


# ============================================
# MAIN
# ============================================

def main():
    """Initialize and run the agent"""
    global agent
    
    print("\n" + "="*60)
    print("🤖 SUPERPLUS AI AGENT STARTING")
    print("="*60 + "\n")
    
    # Initialize agent
    agent = SuperPlusAgent()
    
    # Set up scheduled tasks
    schedule_tasks()
    
    # Start scheduler in background thread
    scheduler_thread = threading.Thread(target=run_scheduler, daemon=True)
    scheduler_thread.start()
    
    print("\n✅ Agent ready!")
    print("="*60)
    print(f"📡 Webhook URL: https://YOUR-RAILWAY-URL/webhook")
    print(f"📊 Dashboard: https://YOUR-RAILWAY-URL/dashboard")
    print(f"🏥 Health check: https://YOUR-RAILWAY-URL/")
    print("="*60 + "\n")
    
    # Start Flask web server
    port = int(os.getenv('PORT', 8080))
    app.run(host='0.0.0.0', port=port, debug=False)


if __name__ == "__main__":
    main()
