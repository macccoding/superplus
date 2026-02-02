#!/usr/bin/env python3
"""
SuperPlus AI Business Agent - Production Version v3
Multi-tab sheet structure via sheet_manager
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
        
        # WhatsApp Cloud API (Meta)
        self.whatsapp_phone_id = os.getenv('WHATSAPP_PHONE_NUMBER_ID')
        self.whatsapp_token = os.getenv('WHATSAPP_ACCESS_TOKEN')
        
        # Twilio
        self.twilio_sid = os.getenv('TWILIO_ACCOUNT_SID')
        self.twilio_token = os.getenv('TWILIO_AUTH_TOKEN')
        self.twilio_number = os.getenv('TWILIO_WHATSAPP_NUMBER')
        
        # Google Sheets
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
        
        print("✅ SuperPlus AI Agent initialized (v3 - multi-tab)")
        print(f"📊 Connected to Google Sheet: {self.sheet_id}")
    
    def setup_google_sheets(self):
        """Initialize Google Sheets connection and sheet manager"""
        try:
            creds_dict = None
            
            # Try loading credentials
            creds_json = os.getenv('GOOGLE_CREDENTIALS')
            if creds_json and creds_json.strip():
                try:
                    creds_dict = json.loads(creds_json)
                    print("✅ Loaded credentials from GOOGLE_CREDENTIALS")
                except json.JSONDecodeError as e:
                    print(f"⚠️ Failed to parse GOOGLE_CREDENTIALS: {e}")
            
            if not creds_dict:
                import base64
                creds_base64 = os.getenv('GOOGLE_CREDENTIALS_BASE64')
                if creds_base64:
                    try:
                        decoded = base64.b64decode(creds_base64)
                        creds_dict = json.loads(decoded)
                        print("✅ Loaded credentials from GOOGLE_CREDENTIALS_BASE64")
                    except Exception as e:
                        print(f"⚠️ Failed to decode GOOGLE_CREDENTIALS_BASE64: {e}")
            
            if creds_dict:
                scopes = ['https://www.googleapis.com/auth/spreadsheets']
                credentials = Credentials.from_service_account_info(creds_dict, scopes=scopes)
                self.gc = gspread.authorize(credentials)
                self.sheet = self.gc.open_by_key(self.sheet_id)
                
                # Initialize sheet manager for multi-tab routing
                from sheet_manager import SheetManager
                self.sheet_manager = SheetManager(self.sheet)
                
                print(f"✅ Google Sheets connected with multi-tab structure")
            else:
                print("❌ No Google Sheets credentials found")
                self.gc = None
                self.sheet = None
                self.sheet_manager = None
                
        except Exception as e:
            print(f"❌ Error connecting to Google Sheets: {e}")
            import traceback
            traceback.print_exc()
            self.gc = None
            self.sheet = None
            self.sheet_manager = None
    
    def process_whatsapp_message(self, message_data: Dict) -> Dict:
        """Process incoming WhatsApp message"""
        try:
            message_text = self.extract_message_text(message_data)
            sender = self.extract_sender(message_data)
            
            print(f"\n📱 New message from {sender}")
            print(f"Content preview: {message_text[:100]}...")
            
            self.memory["messages"].append({
                "timestamp": datetime.now().isoformat(),
                "sender": sender,
                "content": message_text
            })
            
            response = self.agent_reasoning(message_text, sender)
            
            return {
                "success": True,
                "action_taken": response.get("action", "processed"),
                "tabs_updated": response.get("tabs_updated", []),
                "confirmation_sent": response.get("confirmation_sent", False),
                "timestamp": datetime.now().isoformat()
            }
            
        except Exception as e:
            print(f"❌ Error processing message: {e}")
            return {"success": False, "error": str(e)}
    
    def extract_message_text(self, data: Dict) -> str:
        """Extract message text from webhook data"""
        try:
            if 'entry' in data:
                return data['entry'][0]['changes'][0]['value']['messages'][0]['text']['body']
            elif 'Body' in data:
                return data['Body']
            else:
                return str(data)
        except (KeyError, IndexError) as e:
            return str(data)
    
    def extract_sender(self, data: Dict) -> str:
        """Extract sender from webhook data"""
        try:
            if 'entry' in data:
                return data['entry'][0]['changes'][0]['value']['messages'][0]['from']
            elif 'From' in data:
                return data['From']
            else:
                return "Unknown"
        except (KeyError, IndexError):
            return "Unknown"
    
    def agent_reasoning(self, message_text: str, sender: str) -> Dict:
        """AI agent analyzes message and routes to appropriate tabs"""
        
        system_prompt = """You are the AI Business Manager for SuperPlus (GasMart) in Jamaica.

CRITICAL: SuperPlus has 4 SEPARATE business units:
1. Gas Station (tracked by litres sold)
2. Community Store (the "Total Sales" or "Sales" figure)
3. Phone Cards (Western Union area - separate)
4. Deli/Restaurant (food service - separate)

Your job: Extract business data from WhatsApp messages.

=== CRITICAL MESSAGE TYPES - MUST DISTINGUISH ===

**TYPE 1: INVENTORY CHECK / TANK STATUS**
Phrases: "Products available in tanks", "tank levels", "what's in tanks"
Example: "Good afternoon. Products available in tanks: 87- 12,657, 90-16,801"
→ This is a MID-DAY inventory reading, NOT opening or closing dips
→ Set as: opening_XX if morning (before noon), closing_XX if evening (after 6pm)
→ If time unclear, store as opening_XX

**TYPE 2: FUEL DELIVERY with BEFORE/AFTER readings**
Phrases: "Product del", "delivery from", "tanker", "load arrived"
Suppliers: NAJ'S Energy, WIP, Petrojam, etc.
Example: "Product del from NAJ'S Energy. 90-12,200. Opening 90-14,133. Closing 90-26,585"
→ "90-12,200" = LITRES DELIVERED (delivery_90)
→ "Opening 90-14,133" = tank level BEFORE delivery (ignore for daily dips)
→ "Closing 90-26,585" = tank level AFTER delivery (ignore for daily dips)
→ These before/after readings are for DELIVERY VERIFICATION only, NOT daily opening/closing dips!
→ DO NOT set opening_XX or closing_XX from delivery messages!

**TYPE 3: END OF DAY CLOSING FIGURES**
Phrases: "closing figures", "Gnight closing", "end of day dips", "EOD"
Example: "Gnight closing figures: 87-11,937, 90-23,367, Ado-13,342, Ulsd-10,578"
→ These ARE the official closing_XX values for the day

**TYPE 4: MORNING OPENING DIPS**
Phrases: "morning dips", "opening dips", "start of day"
Example: "Morning dips: 87-13,618, 90-21,918"
→ These ARE the official opening_XX values for the day

**TYPE 5: LITRES SOLD (from daily sales report)**
Phrases: "litres sold", "sold today", "fuel sales"
Example: "Litres sold: 87 - 2,316, 90 - 6,151"
→ This is gas_XX (actual sales)

**TYPE 6: DAILY REPORT (comprehensive)**
Contains: store sales, phone cards, deli, AND litres sold together
Example: "Store sales: 702,327. Phone: 63,427. Deli: 186,059. Litres: 87-2316, 90-6151"

=== SUPPLIER NAMES (for deliveries) ===
- NAJ'S Energy (or NAJ, Naj's)
- WIP (or wip)
- Petrojam
- These indicate a DELIVERY message

=== KEY RULES ===
1. Delivery messages have "del" or "delivery" - extract delivery_XX ONLY
2. Delivery before/after dips are NOT daily opening/closing dips
3. "Products available in tanks" without delivery context = inventory check
4. "Closing figures" or "Gnight" = official daily closing dips
5. "Morning dips" or "opening" without delivery = official daily opening dips
6. If message mentions cm (centimeters) with dips, that's a dipstick reading - extract the LITRES number not the cm

Return as JSON:
{
  "date": "YYYY-MM-DD" or "TODAY" or null,
  "store_sales": number or null,
  "phone_cards": number or null,
  "deli_sales": number or null,
  "gas_87": number or null (LITRES SOLD - only from sales reports),
  "gas_90": number or null (LITRES SOLD),
  "gas_ado": number or null (LITRES SOLD),
  "gas_ulsd": number or null (LITRES SOLD),
  "opening_87": number or null (OFFICIAL MORNING DIPS - not delivery readings),
  "opening_90": number or null,
  "opening_ado": number or null,
  "opening_ulsd": number or null,
  "closing_87": number or null (OFFICIAL END OF DAY DIPS - not delivery readings),
  "closing_90": number or null,
  "closing_ado": number or null,
  "closing_ulsd": number or null,
  "delivery_87": number or null (LITRES DELIVERED),
  "delivery_90": number or null,
  "delivery_ado": number or null,
  "delivery_ulsd": number or null,
  "delivery_87_cost": number or null (COST PER LITRE),
  "delivery_90_cost": number or null,
  "delivery_ado_cost": number or null,
  "delivery_ulsd_cost": number or null,
  "delivery_supplier": string or null (NAJ'S Energy, WIP, Petrojam, etc.),
  "gasmart_87_price": number or null,
  "gasmart_90_price": number or null,
  "gasmart_ado_price": number or null,
  "gasmart_ulsd_price": number or null,
  "competitor_prices": [{"competitor": "name", "fuel_87": price, "fuel_90": price}] or [],
  "notes": "any important context"
}

Be flexible with number formats (commas, periods, spaces, K for thousands)."""

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
            
            result_text = response.content[0].text
            
            # Parse JSON
            if "```json" in result_text:
                result_text = result_text.split("```json")[1].split("```")[0].strip()
            elif "```" in result_text:
                result_text = result_text.split("```")[1].split("```")[0].strip()
            
            data = json.loads(result_text)
            
            # Handle "TODAY" date
            if data.get("date") == "TODAY":
                data["date"] = datetime.now().strftime("%Y-%m-%d")
            
            # If no date but we have actual data, default to today
            if not data.get("date"):
                has_data = any([
                    data.get('store_sales'), data.get('deli_sales'), data.get('phone_cards'),
                    data.get('gas_87'), data.get('gas_90'), data.get('gas_ado'), data.get('gas_ulsd'),
                    data.get('opening_87'), data.get('opening_90'), data.get('closing_87'), data.get('closing_90'),
                    data.get('delivery_87'), data.get('delivery_90'), data.get('delivery_ado'), data.get('delivery_ulsd'),
                    data.get('competitor_prices')
                ])
                if has_data:
                    data["date"] = datetime.now().strftime("%Y-%m-%d")
                    print(f"📅 No date specified, defaulting to today: {data['date']}")
            
            print(f"✅ Extracted data: {json.dumps(data, indent=2)}")
            
            # Route to appropriate tabs via sheet_manager
            tabs_updated = []
            confirmation_sent = False
            
            if self.sheet_manager and data.get("date"):
                route_result = self.sheet_manager.route_data(data)
                tabs_updated = route_result.get('updates', [])
                
                # Send confirmation reply to staff
                confirmation_msg = self.generate_confirmation_message(data, tabs_updated)
                if confirmation_msg:
                    self.send_staff_confirmation(sender, confirmation_msg)
                    confirmation_sent = True
                    
            elif not data.get("date"):
                print("⚠️ No date found, skipping sheet update")
            
            return {
                "action": f"Data extracted and routed for {data.get('date')}",
                "data": data,
                "tabs_updated": tabs_updated,
                "confirmation_sent": confirmation_sent
            }
            
        except Exception as e:
            print(f"❌ Error in agent reasoning: {e}")
            import traceback
            traceback.print_exc()
            return {"action": f"Error: {str(e)}", "data": None, "tabs_updated": [], "confirmation_sent": False}
    
    def generate_confirmation_message(self, data: Dict, tabs_updated: List[str]) -> str:
        """Generate confirmation message showing what was extracted"""
        parts = []
        date_str = data.get("date", "today")
        
        # Sales data
        if data.get("store_sales"):
            parts.append(f"Store: ${data['store_sales']:,}")
        if data.get("phone_cards"):
            parts.append(f"Phone: ${data['phone_cards']:,}")
        if data.get("deli_sales"):
            parts.append(f"Deli: ${data['deli_sales']:,}")
        
        # Litres sold
        sold_parts = []
        for fuel in ['87', '90', 'ado', 'ulsd']:
            if data.get(f'gas_{fuel}'):
                sold_parts.append(f"{fuel.upper()}: {data[f'gas_{fuel}']:,}L")
        if sold_parts:
            parts.append(f"Sold: {', '.join(sold_parts)}")
        
        # Opening dips
        open_parts = []
        for fuel in ['87', '90', 'ado', 'ulsd']:
            if data.get(f'opening_{fuel}'):
                open_parts.append(f"{fuel.upper()}: {data[f'opening_{fuel}']:,}L")
        if open_parts:
            parts.append(f"Opening: {', '.join(open_parts)}")
        
        # Closing dips
        close_parts = []
        for fuel in ['87', '90', 'ado', 'ulsd']:
            if data.get(f'closing_{fuel}'):
                close_parts.append(f"{fuel.upper()}: {data[f'closing_{fuel}']:,}L")
        if close_parts:
            parts.append(f"Closing: {', '.join(close_parts)}")
        
        # Deliveries with costs
        delivery_parts = []
        for fuel in ['87', '90', 'ado', 'ulsd']:
            litres = data.get(f"delivery_{fuel}")
            cost = data.get(f"delivery_{fuel}_cost")
            if litres:
                if cost:
                    delivery_parts.append(f"{fuel.upper()}: {litres:,}L @ ${cost}/L")
                else:
                    delivery_parts.append(f"{fuel.upper()}: {litres:,}L")
        if delivery_parts:
            parts.append(f"Delivery: {', '.join(delivery_parts)}")
        
        # Prices
        price_parts = []
        for fuel in ['87', '90', 'ado', 'ulsd']:
            if data.get(f'gasmart_{fuel}_price'):
                price_parts.append(f"{fuel.upper()}: ${data[f'gasmart_{fuel}_price']}")
        if price_parts:
            parts.append(f"Prices: {', '.join(price_parts)}")
        
        # Competitor prices
        if data.get("competitor_prices"):
            parts.append(f"Competitors: {len(data['competitor_prices'])} recorded")
        
        if not parts:
            return None
        
        # Build message
        msg = f"✅ Got it for {date_str}:\n"
        msg += "\n".join(f"• {p}" for p in parts)
        
        if tabs_updated:
            msg += f"\n\n📊 Updated: {', '.join(tabs_updated)}"
        
        msg += "\n\nWrong? Reply with correction."
        
        return msg
    
    def send_staff_confirmation(self, sender: str, message: str):
        """Send confirmation message back to staff"""
        try:
            # Try Meta Cloud API first
            if self.whatsapp_phone_id and self.whatsapp_token:
                import requests
                
                url = f"https://graph.facebook.com/v18.0/{self.whatsapp_phone_id}/messages"
                headers = {
                    "Authorization": f"Bearer {self.whatsapp_token}",
                    "Content-Type": "application/json"
                }
                
                to_number = sender.replace('whatsapp:', '')
                
                payload = {
                    "messaging_product": "whatsapp",
                    "to": to_number,
                    "type": "text",
                    "text": {"body": message}
                }
                
                response = requests.post(url, headers=headers, json=payload)
                
                if response.status_code == 200:
                    print(f"✅ Confirmation sent via Meta API to {sender}")
                    return True
            
            # Fallback to Twilio
            if self.twilio_sid and self.twilio_token:
                from twilio.rest import Client
                client = Client(self.twilio_sid, self.twilio_token)
                
                to_number = sender if sender.startswith('whatsapp:') else f'whatsapp:{sender}'
                
                client.messages.create(
                    from_=f'whatsapp:{self.twilio_number}',
                    body=message,
                    to=to_number
                )
                
                print(f"✅ Confirmation sent via Twilio to {sender}")
                return True
            
            return False
            
        except Exception as e:
            print(f"⚠️ Could not send confirmation: {e}")
            return False
    
    def calculate_weekly_metrics(self, this_week: List[Dict], last_week: List[Dict]) -> Dict:
        """Calculate key metrics for analysis using sheet_manager data"""
        def safe_float(value):
            if value is None or value == '':
                return 0
            if isinstance(value, (int, float)):
                return float(value)
            try:
                return float(str(value).replace('$', '').replace(',', '').strip())
            except:
                return 0
        
        def safe_sum(data, field):
            return sum([safe_float(row.get(field, 0)) for row in data])
        
        # This week metrics
        tw_total = safe_sum(this_week, 'Total_Revenue')
        tw_gas = safe_sum(this_week, 'Gas_Revenue')
        tw_store = safe_sum(this_week, 'Store_Sales')
        tw_deli = safe_sum(this_week, 'Deli_Sales')
        tw_phone = safe_sum(this_week, 'Phone_Cards')
        tw_litres = safe_sum(this_week, 'Total_Litres')
        
        # Last week
        lw_total = safe_sum(last_week, 'Total_Revenue') if last_week else 0
        lw_litres = safe_sum(last_week, 'Total_Litres') if last_week else 0
        
        # Week-over-week
        wow_revenue = ((tw_total - lw_total) / lw_total * 100) if lw_total > 0 else 0
        wow_litres = ((tw_litres - lw_litres) / lw_litres * 100) if lw_litres > 0 else 0
        
        total_rev = tw_total if tw_total > 0 else 1
        
        return {
            "this_week": {
                "total_revenue": tw_total,
                "gas_revenue": tw_gas,
                "store_sales": tw_store,
                "deli_sales": tw_deli,
                "phone_cards": tw_phone,
                "total_litres": tw_litres,
                "daily_avg_revenue": tw_total / len(this_week) if this_week else 0
            },
            "last_week": {
                "total_revenue": lw_total,
                "total_litres": lw_litres
            },
            "week_over_week": {
                "revenue_change_pct": wow_revenue,
                "litres_change_pct": wow_litres
            },
            "business_mix": {
                "gas_pct": (tw_gas / total_rev * 100) if tw_gas else 0,
                "store_pct": (tw_store / total_rev * 100) if tw_store else 0,
                "deli_pct": (tw_deli / total_rev * 100) if tw_deli else 0,
                "phone_pct": (tw_phone / total_rev * 100) if tw_phone else 0
            }
        }
    
    def run_weekly_analysis(self) -> str:
        """Run comprehensive weekly analysis"""
        print("\n" + "="*60)
        print("📊 RUNNING WEEKLY AUTONOMOUS ANALYSIS")
        print("="*60)
        
        try:
            # Get data via sheet_manager
            this_week = self.sheet_manager.get_daily_summaries(days=7)
            last_week_data = self.sheet_manager.get_daily_summaries(days=14)
            last_week = last_week_data[:-7] if len(last_week_data) > 7 else []
            
            if not this_week:
                print("⚠️ No data available")
                return "No data available for analysis"
            
            metrics = self.calculate_weekly_metrics(this_week, last_week)
            
            # Get fuel sales for detailed analysis
            fuel_sales = self.sheet_manager.get_fuel_sales_range(days=7)
            
            # Get deliveries for cost analysis
            deliveries = self.sheet_manager.get_deliveries_range(days=7)
            
            analysis_prompt = f"""You are the AI Business Advisor for SuperPlus (GasMart) in rural Jamaica.

THIS WEEK'S DAILY SUMMARIES:
{json.dumps(this_week, indent=2)}

FUEL SALES DETAIL:
{json.dumps(fuel_sales, indent=2)}

FUEL DELIVERIES (with costs):
{json.dumps(deliveries, indent=2)}

CALCULATED METRICS:
{json.dumps(metrics, indent=2)}

Provide a comprehensive business analysis with:
1. Executive Summary (2-3 sentences)
2. Key Insights (top 5 findings)
3. Concerns & Risks (top 3)
4. Recommendations (immediate, short-term, strategic)
5. Next week projections

Be specific with numbers. Be an ADVISOR, not just a reporter."""

            response = self.client.messages.create(
                model=self.model,
                max_tokens=4000,
                system="You are an expert business analyst for a Jamaican gas station and convenience store. Provide actionable insights.",
                messages=[{"role": "user", "content": analysis_prompt}]
            )
            
            analysis = response.content[0].text
            
            print("\n" + analysis)
            
            # Send to owner via Telegram
            self.send_telegram_message(analysis)
            
            return analysis
            
        except Exception as e:
            print(f"❌ Error in weekly analysis: {e}")
            import traceback
            traceback.print_exc()
            return f"Error: {str(e)}"
    
    def send_telegram_message(self, message: str):
        """Send message via Telegram"""
        try:
            import requests
            
            token = os.getenv('TELEGRAM_BOT_TOKEN')
            chat_id = os.getenv('TELEGRAM_CHAT_ID')
            
            if not token or not chat_id:
                print("⚠️ Telegram not configured")
                return
            
            # Split long messages
            max_len = 4000
            messages = [message[i:i+max_len] for i in range(0, len(message), max_len)]
            
            for msg in messages:
                url = f"https://api.telegram.org/bot{token}/sendMessage"
                payload = {
                    "chat_id": chat_id,
                    "text": msg,
                    "parse_mode": "Markdown"
                }
                requests.post(url, json=payload)
            
            print("✅ Sent to Telegram")
            
        except Exception as e:
            print(f"⚠️ Telegram error: {e}")


# ============================================
# FLASK ROUTES
# ============================================

@app.route('/webhook', methods=['GET', 'POST'])
@app.route('/webhook/whatsapp', methods=['GET', 'POST'])
def whatsapp_webhook():
    """Handle WhatsApp webhooks (Meta Cloud API)"""
    global agent
    
    if request.method == 'GET':
        # Verification challenge
        verify_token = os.getenv('WEBHOOK_VERIFY_TOKEN', 'superplus_verify')
        if request.args.get('hub.verify_token') == verify_token:
            return request.args.get('hub.challenge', '')
        return 'Invalid verification token', 403
    
    try:
        # Handle different content types
        data = None
        content_type = request.content_type or ''
        
        if 'application/json' in content_type:
            data = request.get_json()
        elif 'application/x-www-form-urlencoded' in content_type:
            # Twilio-style form data
            data = request.form.to_dict()
        else:
            # Try to parse as JSON anyway (force=True skips content-type check)
            try:
                data = request.get_json(force=True)
            except:
                # Last resort: try form data
                data = request.form.to_dict() if request.form else {}
        
        print(f"📥 Webhook received - Content-Type: {content_type}")
        print(f"📥 Data: {json.dumps(data, indent=2) if data else 'None'}")
        
        if not data:
            return jsonify({"status": "ignored", "reason": "no data"})
        
        # Filter out Twilio status webhooks (sent/delivered notifications)
        if data.get('MessageStatus') in ['sent', 'delivered', 'read']:
            return jsonify({"status": "ignored", "reason": "status update"})
        
        # Filter out messages without a Body (Twilio) or messages content (Meta)
        if 'Body' not in data and 'entry' not in data:
            return jsonify({"status": "ignored", "reason": "no message content"})
        
        # Check if it's a status update (ignore)
        if 'entry' in data:
            changes = data['entry'][0].get('changes', [{}])[0]
            if 'statuses' in changes.get('value', {}):
                return jsonify({"status": "ignored", "reason": "status update"})
            
            # Check if there's an actual message
            messages = changes.get('value', {}).get('messages', [])
            if not messages:
                return jsonify({"status": "ignored", "reason": "no messages"})
        
        if agent:
            result = agent.process_whatsapp_message(data)
            return jsonify(result)
        else:
            return jsonify({"error": "Agent not initialized"}), 500
            
    except Exception as e:
        print(f"❌ Webhook error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route('/webhook/twilio', methods=['POST'])
def twilio_webhook():
    """Handle Twilio WhatsApp webhooks"""
    global agent
    
    try:
        data = request.form.to_dict()
        
        if agent:
            result = agent.process_whatsapp_message(data)
            return jsonify(result)
        else:
            return jsonify({"error": "Agent not initialized"}), 500
            
    except Exception as e:
        print(f"❌ Twilio webhook error: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        "status": "healthy",
        "version": "3.0-multitab",
        "timestamp": datetime.now().isoformat(),
        "agent_initialized": agent is not None,
        "sheet_manager": agent.sheet_manager is not None if agent else False
    })


@app.route('/status', methods=['GET'])
def get_status():
    """Get current status and metrics"""
    global agent
    
    if not agent or not agent.sheet_manager:
        return jsonify({"error": "Agent not initialized"}), 500
    
    try:
        weekly = agent.sheet_manager.get_weekly_summary()
        inventory = agent.sheet_manager.get_latest_inventory()
        
        return jsonify({
            "weekly_summary": weekly,
            "current_inventory": inventory,
            "timestamp": datetime.now().isoformat()
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/analysis', methods=['GET'])
def run_analysis():
    """Trigger weekly analysis"""
    global agent
    
    if agent:
        result = agent.run_weekly_analysis()
        return jsonify({"analysis": result})
    return jsonify({"error": "Agent not initialized"}), 500


@app.route('/forecast', methods=['GET'])
def get_forecast():
    """Get demand forecast"""
    global agent
    
    if not agent or not agent.sheet_manager:
        return jsonify({"error": "Agent not initialized"}), 500
    
    try:
        from demand_forecast import DemandForecaster
        
        forecaster = DemandForecaster()
        
        # Get fuel sales data for forecasting
        fuel_sales = agent.sheet_manager.get_fuel_sales_range(days=28)
        
        # Convert to format forecaster expects
        all_data = []
        for sale in fuel_sales:
            all_data.append({
                'Date': sale.get('Date'),
                'Gas_87_Litres': sale.get('Gas_87_Litres', 0),
                'Gas_90_Litres': sale.get('Gas_90_Litres', 0),
                'Gas_ADO_Litres': sale.get('Gas_ADO_Litres', 0),
                'Gas_ULSD_Litres': sale.get('Gas_ULSD_Litres', 0),
                'Opening_87_Litres': 0,  # Would need inventory data
            })
        
        # Get inventory for projections
        inventory = agent.sheet_manager.get_latest_inventory()
        if inventory:
            if all_data:
                all_data[-1]['Opening_87_Litres'] = inventory.get('87', 0)
                all_data[-1]['Opening_90_Litres'] = inventory.get('90', 0)
                all_data[-1]['Opening_ADO_Litres'] = inventory.get('ado', 0)
                all_data[-1]['Opening_ULSD_Litres'] = inventory.get('ulsd', 0)
        
        report = forecaster.generate_full_forecast_report(all_data)
        text_report = forecaster.generate_forecast_text(all_data)
        
        return jsonify({
            "report": report,
            "text": text_report
        })
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


# ============================================
# SCHEDULED TASKS
# ============================================

def run_scheduler():
    """Run scheduled tasks in background"""
    while True:
        schedule.run_pending()
        time.sleep(60)


def setup_schedules():
    """Setup scheduled tasks"""
    global agent
    
    # Weekly analysis every Sunday at 8 PM
    schedule.every().sunday.at("20:00").do(lambda: agent.run_weekly_analysis() if agent else None)
    
    # Morning forecast check at 6 AM
    def morning_forecast():
        if agent and agent.sheet_manager:
            try:
                from demand_forecast import check_and_send_order_alerts
                check_and_send_order_alerts(agent)
            except Exception as e:
                print(f"❌ Morning forecast error: {e}")
    
    schedule.every().day.at("06:00").do(morning_forecast)
    
    print("📅 Scheduled tasks configured")


# ============================================
# MAIN
# ============================================

def create_app():
    """Create and configure the Flask app"""
    global agent
    
    agent = SuperPlusAgent()
    setup_schedules()
    
    # Start scheduler in background
    scheduler_thread = threading.Thread(target=run_scheduler, daemon=True)
    scheduler_thread.start()
    
    # Start Telegram bot in background thread
    def run_telegram_bot():
        try:
            import asyncio
            from telegram import Update
            from telegram.ext import Application, CommandHandler, MessageHandler, filters
            
            token = os.getenv('TELEGRAM_BOT_TOKEN')
            if not token:
                print("⚠️ TELEGRAM_BOT_TOKEN not set - bot disabled")
                return
            
            # Import the telegram bot class
            from telegram_bot_v3 import SuperPlusTelegramBot
            bot = SuperPlusTelegramBot()
            
            # Create new event loop for this thread
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            
            # Build application
            app_tg = Application.builder().token(token).build()
            
            # Register handlers
            app_tg.add_handler(CommandHandler("start", bot.cmd_start))
            app_tg.add_handler(CommandHandler("help", bot.cmd_help))
            app_tg.add_handler(CommandHandler("status", bot.cmd_status))
            app_tg.add_handler(CommandHandler("today", bot.cmd_today))
            app_tg.add_handler(CommandHandler("gas", bot.cmd_gas))
            app_tg.add_handler(CommandHandler("dips", bot.cmd_dips))
            app_tg.add_handler(CommandHandler("deliveries", bot.cmd_deliveries))
            app_tg.add_handler(CommandHandler("shrinkage", bot.cmd_shrinkage))
            app_tg.add_handler(CommandHandler("profit", bot.cmd_profit))
            app_tg.add_handler(CommandHandler("forecast", bot.cmd_forecast))
            app_tg.add_handler(CommandHandler("competitors", bot.cmd_competitors))
            app_tg.add_handler(CommandHandler("compare", bot.cmd_compare))
            app_tg.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, bot.handle_message))
            
            print("🤖 Telegram bot starting polling...")
            
            # Use start_polling + idle pattern that works in threads
            async def run_bot():
                await app_tg.initialize()
                await app_tg.start()
                await app_tg.updater.start_polling(allowed_updates=Update.ALL_TYPES)
                print("✅ Telegram bot polling active")
                
                # Keep running until stopped
                while True:
                    await asyncio.sleep(1)
            
            loop.run_until_complete(run_bot())
            
        except Exception as e:
            print(f"⚠️ Telegram bot error: {e}")
            import traceback
            traceback.print_exc()
    
    telegram_thread = threading.Thread(target=run_telegram_bot, daemon=True)
    telegram_thread.start()
    print("🤖 Telegram bot thread started")
    
    return app


if __name__ == "__main__":
    app = create_app()
    port = int(os.getenv('PORT', 8080))
    app.run(host='0.0.0.0', port=port, debug=False)
