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
            # Try multiple credential sources
            creds_dict = None
            
            # Method 1: Direct JSON string
            creds_json = os.getenv('GOOGLE_CREDENTIALS')
            if creds_json and creds_json.strip():
                try:
                    creds_dict = json.loads(creds_json)
                    print("✅ Loaded credentials from GOOGLE_CREDENTIALS")
                except json.JSONDecodeError as e:
                    print(f"⚠️ Failed to parse GOOGLE_CREDENTIALS: {e}")
            
            # Method 2: Base64 encoded
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
            
            # Method 3: File path (if running locally)
            if not creds_dict:
                creds_file = os.getenv('GOOGLE_CREDENTIALS_FILE', 'google-credentials.json')
                if os.path.exists(creds_file):
                    with open(creds_file, 'r') as f:
                        creds_dict = json.load(f)
                    print(f"✅ Loaded credentials from file: {creds_file}")
            
            if creds_dict:
                scopes = ['https://www.googleapis.com/auth/spreadsheets']
                credentials = Credentials.from_service_account_info(creds_dict, scopes=scopes)
                self.gc = gspread.authorize(credentials)
                self.sheet = self.gc.open_by_key(self.sheet_id)
                print(f"✅ Google Sheets connected: {self.sheet_id}")
            else:
                print("❌ No Google Sheets credentials found in any format")
                self.gc = None
                self.sheet = None
                
        except Exception as e:
            print(f"❌ Error connecting to Google Sheets: {e}")
            import traceback
            traceback.print_exc()
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
        
        system_prompt = """You are the AI Business Manager for SuperPlus (GasMart) in Jamaica.

CRITICAL: SuperPlus has 4 SEPARATE business units:
1. Gas Station (tracked by litres sold)
2. Community Store (the "Total Sales" or "Sales" figure)
3. Phone Cards (Western Union area - separate)
4. Deli/Restaurant (food service - separate)

Your job: Extract business data from WhatsApp messages.

WHAT TO EXTRACT:

1. **Date** - Look for dates like "28.01.26" or "Wednesday 28,2026"
   - If NO date mentioned, return "TODAY" as the date
   - Price updates without dates should use "TODAY"
2. **Store Sales** - Look for "Sales $XXX" - this is ONLY the community store
3. **Phone Cards** - Separate revenue stream (Western Union area)
4. **Deli/Restaurant** - Separate revenue stream (food service)
5. **Gas Litres Sold** - Look for "Litres sales DD.MM.YY":
   - 87: XXXX litres (regular)
   - 90: XXXX litres (premium)
   - ADO: XXXX litres (diesel)
   - ULSD: XXXX litres (ultra-low sulfur diesel)
6. **GasMart Fuel Prices** - Under "Gas mart" section:
   - 87, 90, ADO, ULSD prices per litre
7. **Notes** - Deliveries, power outages, busy periods, issues

IMPORTANT:
- "Sales $XXX" = Store ONLY (not total of all businesses)
- Phone Cards and Deli are SEPARATE from Store Sales
- If NO DATE mentioned, use "TODAY" (especially for price updates)
- Ignore competitor prices (Jamgas, Total Greenvale, Yaadman, Spur Tree)
- Ignore opening/closing dips (operational data only)
- Opening dips like "87-9,231" are NOT litres sold (ignore these)

EXAMPLES:

Input: "Good night Sir\\nWednesday 28,2026\\nSales $702,327.66\\nPhone Cards $63,427\\nDeli $186,059.97"
Output: {
  "date": "2026-01-28",
  "store_sales": 702327.66,
  "phone_cards": 63427,
  "deli_sales": 186059.97,
  "gas_87": null,
  "gas_90": null,
  "gas_ado": null,
  "gas_ulsd": null,
  "gasmart_87_price": null,
  "gasmart_90_price": null,
  "gasmart_ado_price": null,
  "gasmart_ulsd_price": null,
  "notes": ""
}

Input: "Litres sales 28.01.26\\n87-2316\\n90-6151\\nAdo-931\\nUlsd-4356.90"
Output: {
  "date": "2026-01-28",
  "store_sales": null,
  "phone_cards": null,
  "deli_sales": null,
  "gas_87": 2316,
  "gas_90": 6151,
  "gas_ado": 931,
  "gas_ulsd": 4356.90,
  "gasmart_87_price": null,
  "gasmart_90_price": null,
  "gasmart_ado_price": null,
  "gasmart_ulsd_price": null,
  "notes": ""
}

Input: "Gas Prices\\nGas mart\\n87-174.60\\n90-184.40\\nAdo-188.30\\nUlsd-195.50"
Output: {
  "date": "TODAY",
  "store_sales": null,
  "phone_cards": null,
  "deli_sales": null,
  "gas_87": null,
  "gas_90": null,
  "gas_ado": null,
  "gas_ulsd": null,
  "gasmart_87_price": 174.60,
  "gasmart_90_price": 184.40,
  "gasmart_ado_price": 188.30,
  "gasmart_ulsd_price": 195.50,
  "notes": "Price update"
}

Input: "Good morning: opening dips\\n87-9,231\\n90-6,756\\nAdo-10,696\\nUlsd-5,229"
Output: {
  "date": null,
  "store_sales": null,
  "phone_cards": null,
  "deli_sales": null,
  "gas_87": null,
  "gas_90": null,
  "gas_ado": null,
  "gas_ulsd": null,
  "gasmart_87_price": null,
  "gasmart_90_price": null,
  "gasmart_ado_price": null,
  "gasmart_ulsd_price": null,
  "notes": "Opening dips - not litres sold"
}

Return as JSON:
{
  "date": "YYYY-MM-DD" or "TODAY" or null,
  "store_sales": number or null,
  "phone_cards": number or null,
  "deli_sales": number or null,
  "gas_87": number or null,
  "gas_90": number or null,
  "gas_ado": number or null,
  "gas_ulsd": number or null,
  "gasmart_87_price": number or null,
  "gasmart_90_price": number or null,
  "gasmart_ado_price": number or null,
  "gasmart_ulsd_price": number or null,
  "notes": "any important context"
}

Be flexible with number formats (commas, periods, spaces)."""

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
            
            # Handle "TODAY" date
            from datetime import datetime
            if data.get("date") == "TODAY":
                data["date"] = datetime.now().strftime("%Y-%m-%d")
                print(f"📅 No date in message, using today: {data['date']}")
            
            print(f"✅ Extracted data: {json.dumps(data, indent=2)}")
            
            # Update Google Sheet
            if self.sheet and data.get("date"):
                self.update_google_sheet(data)
            elif not data.get("date"):
                print("⚠️ No date found, skipping sheet update")
            
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
                # Headers for 4 separate business units
                headers = [
                    "Date", 
                    "Day",
                    "Store_Sales",
                    "Phone_Cards", 
                    "Deli_Sales",
                    "Gas_Revenue_Est",
                    "Total_Revenue",
                    "Gas_87_Litres", 
                    "Gas_90_Litres", 
                    "Gas_ADO_Litres", 
                    "Gas_ULSD_Litres",
                    "Total_Litres",
                    "GasMart_87_Price",
                    "GasMart_90_Price",
                    "GasMart_ADO_Price",
                    "GasMart_ULSD_Price",
                    "Notes"
                ]
                worksheet.append_row(headers)
                
                # Format header row
                worksheet.format('A1:Q1', {
                    "backgroundColor": {"red": 0.2, "green": 0.6, "blue": 0.86},
                    "textFormat": {"bold": True, "foregroundColor": {"red": 1, "green": 1, "blue": 1}},
                    "horizontalAlignment": "CENTER"
                })
            
            # Parse date and get day of week
            from datetime import datetime
            date_str = data.get("date")
            
            # Special handling for price updates without dates
            if not date_str and any([data.get("gasmart_87_price"), data.get("gasmart_90_price")]):
                # Price update - use today's date or most recent row's date
                existing_dates = worksheet.col_values(1)[1:]  # Skip header
                if existing_dates:
                    # Use most recent date in sheet
                    date_str = existing_dates[-1]
                    print(f"💲 Price update - using most recent date: {date_str}")
                else:
                    # Use today's date
                    date_str = datetime.now().strftime("%Y-%m-%d")
                    print(f"💲 Price update - using today's date: {date_str}")
            
            if not date_str:
                print("⚠️ No date found and no price data, skipping...")
                return
                
            try:
                date_obj = datetime.strptime(date_str, "%Y-%m-%d")
                day_of_week = date_obj.strftime("%A")
            except:
                day_of_week = ""
            
            # Get business unit data
            store_sales = data.get("store_sales") or ""
            phone_cards = data.get("phone_cards") or ""
            deli_sales = data.get("deli_sales") or ""
            
            # Gas data
            gas_87 = data.get("gas_87") or 0
            gas_90 = data.get("gas_90") or 0
            gas_ado = data.get("gas_ado") or 0
            gas_ulsd = data.get("gas_ulsd") or 0
            total_litres = gas_87 + gas_90 + gas_ado + gas_ulsd if any([gas_87, gas_90, gas_ado, gas_ulsd]) else ""
            
            # Pricing data
            price_87 = data.get("gasmart_87_price") or ""
            price_90 = data.get("gasmart_90_price") or ""
            price_ado = data.get("gasmart_ado_price") or ""
            price_ulsd = data.get("gasmart_ulsd_price") or ""
            
            # Check if we already have data for this date
            existing_dates = worksheet.col_values(1)[1:]  # Skip header
            if date_str in existing_dates:
                # Update existing row
                row_index = existing_dates.index(date_str) + 2
                print(f"📝 Updating existing row for {date_str}")
                
                existing_row = worksheet.row_values(row_index)
                
                # Get current prices from row for gas revenue calculation
                current_price_87 = price_87 if price_87 != "" else (float(existing_row[12].replace('$','').replace(',','')) if len(existing_row) > 12 and existing_row[12] else 0)
                current_price_90 = price_90 if price_90 != "" else (float(existing_row[13].replace('$','').replace(',','')) if len(existing_row) > 13 and existing_row[13] else 0)
                current_price_ado = price_ado if price_ado != "" else (float(existing_row[14].replace('$','').replace(',','')) if len(existing_row) > 14 and existing_row[14] else 0)
                current_price_ulsd = price_ulsd if price_ulsd != "" else (float(existing_row[15].replace('$','').replace(',','')) if len(existing_row) > 15 and existing_row[15] else 0)
                
                # Get current litres
                current_gas_87 = gas_87 if gas_87 else (float(existing_row[7].replace(',','')) if len(existing_row) > 7 and existing_row[7] else 0)
                current_gas_90 = gas_90 if gas_90 else (float(existing_row[8].replace(',','')) if len(existing_row) > 8 and existing_row[8] else 0)
                current_gas_ado = gas_ado if gas_ado else (float(existing_row[9].replace(',','')) if len(existing_row) > 9 and existing_row[9] else 0)
                current_gas_ulsd = gas_ulsd if gas_ulsd else (float(existing_row[10].replace(',','')) if len(existing_row) > 10 and existing_row[10] else 0)
                
                # Calculate gas revenue with updated data
                gas_revenue = ""
                if all([current_gas_87, current_gas_90, current_price_87, current_price_90]):
                    gas_revenue = (current_gas_87 * current_price_87) + (current_gas_90 * current_price_90)
                    if current_gas_ado and current_price_ado:
                        gas_revenue += current_gas_ado * current_price_ado
                    if current_gas_ulsd and current_price_ulsd:
                        gas_revenue += current_gas_ulsd * current_price_ulsd
                
                # Get current store/phone/deli for total calc
                current_store = store_sales if store_sales != "" else (float(existing_row[2].replace('$','').replace(',','')) if len(existing_row) > 2 and existing_row[2] else 0)
                current_phone = phone_cards if phone_cards != "" else (float(existing_row[3].replace('$','').replace(',','')) if len(existing_row) > 3 and existing_row[3] else 0)
                current_deli = deli_sales if deli_sales != "" else (float(existing_row[4].replace('$','').replace(',','')) if len(existing_row) > 4 and existing_row[4] else 0)
                
                # Calculate total revenue
                total_revenue = ""
                if any([current_store, current_phone, current_deli, gas_revenue]):
                    total_revenue = sum([x for x in [current_store, current_phone, current_deli, gas_revenue] if x])
                
                # Merge new data with existing
                row = [
                    date_str,
                    day_of_week,
                    store_sales if store_sales != "" else (existing_row[2] if len(existing_row) > 2 else ""),
                    phone_cards if phone_cards != "" else (existing_row[3] if len(existing_row) > 3 else ""),
                    deli_sales if deli_sales != "" else (existing_row[4] if len(existing_row) > 4 else ""),
                    gas_revenue if gas_revenue != "" else (existing_row[5] if len(existing_row) > 5 else ""),
                    total_revenue if total_revenue != "" else (existing_row[6] if len(existing_row) > 6 else ""),
                    current_gas_87 if current_gas_87 else "",
                    current_gas_90 if current_gas_90 else "",
                    current_gas_ado if current_gas_ado else "",
                    current_gas_ulsd if current_gas_ulsd else "",
                    total_litres if total_litres != "" else (existing_row[11] if len(existing_row) > 11 else ""),
                    price_87 if price_87 != "" else (existing_row[12] if len(existing_row) > 12 else ""),
                    price_90 if price_90 != "" else (existing_row[13] if len(existing_row) > 13 else ""),
                    price_ado if price_ado != "" else (existing_row[14] if len(existing_row) > 14 else ""),
                    price_ulsd if price_ulsd != "" else (existing_row[15] if len(existing_row) > 15 else ""),
                    data.get("notes", existing_row[16] if len(existing_row) > 16 else "")
                ]
                
                worksheet.update(f'A{row_index}:Q{row_index}', [row])
                last_row = row_index
                
            else:
                # Append new row
                # Calculate gas revenue for new row
                gas_revenue = ""
                if all([gas_87, gas_90, price_87, price_90]):
                    gas_revenue = (gas_87 * price_87) + (gas_90 * price_90)
                    if gas_ado and price_ado:
                        gas_revenue += gas_ado * price_ado
                    if gas_ulsd and price_ulsd:
                        gas_revenue += gas_ulsd * price_ulsd
                
                # Calculate total revenue
                total_revenue = ""
                revenue_parts = [store_sales, phone_cards, deli_sales, gas_revenue]
                if any([isinstance(x, (int, float)) and x != "" for x in revenue_parts]):
                    total_revenue = sum([x for x in revenue_parts if isinstance(x, (int, float)) and x != ""])
                
                row = [
                    date_str,
                    day_of_week,
                    store_sales,
                    phone_cards,
                    deli_sales,
                    gas_revenue,
                    total_revenue,
                    gas_87 if gas_87 else "",
                    gas_90 if gas_90 else "",
                    gas_ado if gas_ado else "",
                    gas_ulsd if gas_ulsd else "",
                    total_litres,
                    price_87,
                    price_90,
                    price_ado,
                    price_ulsd,
                    data.get("notes", "")
                ]
                
                worksheet.append_row(row)
                last_row = len(worksheet.get_all_values())
            
            # Format the row
            # Currency format for revenue columns (C-G)
            worksheet.format(f'C{last_row}:G{last_row}', {
                "numberFormat": {"type": "CURRENCY", "pattern": "$#,##0.00"}
            })
            
            # Number format for litres (columns H-L)
            worksheet.format(f'H{last_row}:L{last_row}', {
                "numberFormat": {"type": "NUMBER", "pattern": "#,##0.00"}
            })
            
            # Currency format for prices (columns M-P)
            worksheet.format(f'M{last_row}:P{last_row}', {
                "numberFormat": {"type": "CURRENCY", "pattern": "$#,##0.00"}
            })
            
            print(f"✅ Updated Google Sheet with data for {date_str} ({day_of_week})")
            
        except Exception as e:
            print(f"❌ Error updating Google Sheet: {e}")
            import traceback
            traceback.print_exc()
    
    def run_weekly_analysis(self):
        """Run comprehensive weekly analysis with autonomous insights"""
        print("\n" + "="*60)
        print("📊 RUNNING WEEKLY AUTONOMOUS ANALYSIS")
        print("="*60)
        
        try:
            from datetime import datetime, timedelta
            
            # Get data from Google Sheet
            worksheet = self.sheet.worksheet("Daily_Report")
            all_data = worksheet.get_all_records()
            
            if len(all_data) < 7:
                print(f"⚠️ Only {len(all_data)} days of data available")
            
            # Get last 7 days AND previous 7 days for comparison
            this_week = all_data[-7:] if len(all_data) >= 7 else all_data
            last_week = all_data[-14:-7] if len(all_data) >= 14 else []
            
            # Calculate key metrics
            metrics = self.calculate_weekly_metrics(this_week, last_week)
            
            print(f"📈 Analyzing {len(this_week)} days of data")
            print(f"📊 Week-over-week comparison: {len(last_week)} days vs {len(this_week)} days")
            
            # Enhanced analysis prompt with business context
            analysis_prompt = f"""You are the AI Business Advisor for SuperPlus (GasMart) in rural Jamaica.

BUSINESS CONTEXT:
- 4 separate revenue streams: Gas Station, Community Store, Phone Cards (Western Union), Deli
- Only business within 5-mile radius (competitive moat)
- Serves rural community: farmers, government workers, local residents
- Open 6am-9pm daily
- Payday cycles: Government workers (monthly), local businesses (bi-weekly)
- Weather impacts: Rain reduces foot traffic, hurricane season July-November

THIS WEEK'S DATA:
{json.dumps(this_week, indent=2)}

LAST WEEK'S DATA (for comparison):
{json.dumps(last_week, indent=2) if last_week else "No previous week data available"}

CALCULATED METRICS:
{json.dumps(metrics, indent=2)}

YOUR TASK - Provide a comprehensive autonomous business analysis:

## 📈 EXECUTIVE SUMMARY
- 2-3 sentences: Overall performance, key trends, business health

## 🎯 KEY INSIGHTS (Top 5)
Identify the most important findings:
1. Revenue trends across all 4 businesses
2. Gas volume/margin patterns
3. Customer behavior patterns (day-of-week, time trends)
4. Operational issues or wins
5. Market opportunities

## ⚠️ CONCERNS & RISKS (Top 3)
What needs immediate attention? Be specific with impact:
- Revenue decline in specific area?
- Inventory issues?
- Margin compression?
- Competitive threats?

## 💡 AUTONOMOUS RECOMMENDATIONS
Provide SPECIFIC, ACTIONABLE recommendations with expected ROI:

**IMMEDIATE (This Week):**
- What to do Monday morning
- Quick wins (low effort, high impact)
- Problems to fix now

**SHORT-TERM (2-4 Weeks):**
- Process improvements
- Inventory optimizations
- Staffing adjustments
- Pricing strategies

**STRATEGIC (1-3 Months):**
- Revenue diversification
- Market expansion
- Operational efficiency
- Customer retention

## 📊 NEXT WEEK PROJECTIONS
Based on patterns, predict next week's performance:
- **Best Case:** If positive trends continue + favorable conditions
- **Base Case:** Most likely scenario
- **Cautious Case:** If risks materialize

Provide specific numbers for:
- Total Revenue projection
- Each business unit
- Key metrics to watch

## 🔍 PATTERNS DETECTED
What patterns has the agent learned?
- Day-of-week trends
- Payday effects
- Weather correlations
- Pricing sweet spots
- Customer behavior

## 📋 METRICS TO MONITOR
What should I (the agent) watch closely this week?
- Leading indicators
- Early warning signs
- Opportunity signals

## 🤖 AGENT LEARNING
What has the agent learned that improves future analysis?
- New patterns discovered
- Refined understanding
- Hypothesis to test

FORMAT:
- Be conversational but professional
- Use specific numbers and percentages
- Focus on ACTIONABLE insights (not just reporting)
- Think like a business advisor, not a data analyst
- Highlight Jamaica-specific factors (payday cycles, weather, community dynamics)
- Make bold recommendations with confidence when data supports it

CRITICAL: Be an ADVISOR, not just a reporter. The owner should finish reading and know EXACTLY what to do."""

            response = self.client.messages.create(
                model=self.model,
                max_tokens=4000,
                temperature=0.3,
                messages=[{
                    "role": "user",
                    "content": analysis_prompt
                }]
            )
            
            analysis = response.content[0].text
            
            # Log the analysis
            print("\n" + "="*60)
            print("WEEKLY ANALYSIS REPORT")
            print("="*60)
            print(analysis)
            print("="*60 + "\n")
            
            # Send to owner via WhatsApp
            self.send_weekly_report(analysis, metrics)
            
            # Update agent memory with new patterns
            self.update_agent_memory(analysis, metrics)
            
            return analysis
            
        except Exception as e:
            print(f"❌ Error running analysis: {e}")
            import traceback
            traceback.print_exc()
            return None
    
    def calculate_weekly_metrics(self, this_week: List[Dict], last_week: List[Dict]) -> Dict:
        """Calculate key metrics for analysis"""
        def safe_float(value):
            """Safely convert any value to float, handling currency formatting"""
            if value is None or value == '':
                return 0
            if isinstance(value, (int, float)):
                return float(value)
            # Remove currency symbols, commas, spaces
            cleaned = str(value).replace('$', '').replace(',', '').replace(' ', '').strip()
            try:
                return float(cleaned) if cleaned else 0
            except (ValueError, AttributeError):
                return 0
        
        def safe_sum(data, field):
            return sum([safe_float(row.get(field, 0)) for row in data])
        
        def safe_avg(data, field):
            values = [safe_float(row.get(field, 0)) for row in data if row.get(field)]
            return sum(values) / len(values) if values else 0
        
        # This week metrics
        tw_store = safe_sum(this_week, 'Store_Sales')
        tw_phone = safe_sum(this_week, 'Phone_Cards')
        tw_deli = safe_sum(this_week, 'Deli_Sales')
        tw_gas_rev = safe_sum(this_week, 'Gas_Revenue_Est')
        tw_total = safe_sum(this_week, 'Total_Revenue')
        
        tw_litres = safe_sum(this_week, 'Total_Litres')
        tw_87 = safe_sum(this_week, 'Gas_87_Litres')
        tw_90 = safe_sum(this_week, 'Gas_90_Litres')
        
        tw_avg_price_87 = safe_avg(this_week, 'GasMart_87_Price')
        tw_avg_price_90 = safe_avg(this_week, 'GasMart_90_Price')
        
        # Last week metrics (for comparison)
        lw_total = safe_sum(last_week, 'Total_Revenue') if last_week else 0
        lw_litres = safe_sum(last_week, 'Total_Litres') if last_week else 0
        
        # Calculate week-over-week changes
        wow_revenue = ((tw_total - lw_total) / lw_total * 100) if lw_total > 0 else 0
        wow_litres = ((tw_litres - lw_litres) / lw_litres * 100) if lw_litres > 0 else 0
        
        # Business unit percentages
        total_rev = tw_total if tw_total > 0 else 1
        
        return {
            "this_week": {
                "total_revenue": tw_total,
                "store_sales": tw_store,
                "phone_cards": tw_phone,
                "deli_sales": tw_deli,
                "gas_revenue": tw_gas_rev,
                "total_litres": tw_litres,
                "litres_87": tw_87,
                "litres_90": tw_90,
                "avg_price_87": tw_avg_price_87,
                "avg_price_90": tw_avg_price_90,
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
                "gas_pct": (tw_gas_rev / total_rev * 100) if tw_gas_rev else 0,
                "store_pct": (tw_store / total_rev * 100) if tw_store else 0,
                "phone_pct": (tw_phone / total_rev * 100) if tw_phone else 0,
                "deli_pct": (tw_deli / total_rev * 100) if tw_deli else 0
            },
            "fuel_mix": {
                "regular_87_pct": (tw_87 / tw_litres * 100) if tw_litres > 0 else 0,
                "premium_90_pct": (tw_90 / tw_litres * 100) if tw_litres > 0 else 0
            }
        }
    
    def send_weekly_report(self, analysis: str, metrics: Dict):
        """Send weekly report to owner via WhatsApp and Email"""
        try:
            # Send WhatsApp summary
            summary = f"""📊 **SUPERPLUS WEEKLY REPORT**
Week ending {datetime.now().strftime('%B %d, %Y')}

💰 **REVENUE:** JMD ${metrics['this_week']['total_revenue']:,.0f}
📈 **vs Last Week:** {metrics['week_over_week']['revenue_change_pct']:+.1f}%

⛽ **GAS:** {metrics['this_week']['total_litres']:,.0f} litres ({metrics['week_over_week']['litres_change_pct']:+.1f}%)
🏪 **STORE:** JMD ${metrics['this_week']['store_sales']:,.0f}
🍽️ **DELI:** JMD ${metrics['this_week']['deli_sales']:,.0f}
💳 **PHONE CARDS:** JMD ${metrics['this_week']['phone_cards']:,.0f}

Check your email for the full detailed analysis with recommendations.

- Your AI Business Agent"""
            
            # Send via Twilio WhatsApp
            if self.twilio_sid and self.twilio_token:
                from twilio.rest import Client
                client = Client(self.twilio_sid, self.twilio_token)
                
                message = client.messages.create(
                    from_=f'whatsapp:{self.twilio_number}',
                    body=summary,
                    to=f'whatsapp:{self.owner_phone}'
                )
                
                print(f"✅ Weekly summary sent via WhatsApp to {self.owner_phone}")
            
            # Send via Email (if configured)
            sendgrid_key = os.getenv('SENDGRID_API_KEY')
            html_content = None
            
            if sendgrid_key:
                try:
                    from email_reporter import EmailReporter
                    email_reporter = EmailReporter()
                    html_content = email_reporter.generate_weekly_html(analysis, metrics)
                    email_reporter.send_weekly_report(analysis, metrics)
                    print(f"✅ Weekly report sent via Email")
                except Exception as e:
                    print(f"⚠️ Could not send email: {e}")
            else:
                print(f"⚠️ SendGrid not configured - skipping email")
            
            # Archive to Google Drive (if configured)
            if self.sheet:  # If we have Google credentials, we can use Drive
                try:
                    from drive_archiver import DriveArchiver
                    drive = DriveArchiver()
                    
                    # Upload HTML report
                    if html_content:
                        drive_url = drive.upload_weekly_report(html_content, metrics)
                        if drive_url:
                            print(f"✅ Report archived to Google Drive")
                    
                    # Backup raw data
                    worksheet = self.sheet.worksheet("Daily_Report")
                    all_data = worksheet.get_all_records()
                    drive.upload_data_backup(all_data)
                    
                except Exception as e:
                    print(f"⚠️ Could not archive to Drive: {e}")
            
        except Exception as e:
            print(f"⚠️ Could not send report: {e}")
    
    def update_agent_memory(self, analysis: str, metrics: Dict):
        """Update agent's long-term memory with new patterns"""
        try:
            # Store key patterns for future reference
            self.memory["patterns"]["last_analysis_date"] = datetime.now().isoformat()
            self.memory["patterns"]["recent_metrics"] = metrics
            
            # TODO: Store more sophisticated patterns:
            # - Day-of-week preferences
            # - Payday cycle correlations
            # - Weather impact patterns
            # - Pricing elasticity
            
            print("✅ Agent memory updated with new patterns")
            
        except Exception as e:
            print(f"⚠️ Could not update memory: {e}")


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
        # Twilio sends form data, not JSON
        data = request.form.to_dict() if request.form else request.get_json()
        
        if not data:
            return jsonify({"error": "No data received"}), 400
        
        print(f"\n📨 Webhook received: {json.dumps(data, indent=2)[:500]}...")
        
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
            "sheet_connected": agent.sheet is not None,
            "whatsapp_configured": agent.twilio_sid is not None,
            "telegram_configured": os.getenv('TELEGRAM_BOT_TOKEN') is not None,
            "email_configured": os.getenv('SENDGRID_API_KEY') is not None
        }
    else:
        status = {"status": "not initialized"}
    
    return jsonify(status), 200

@app.route('/test-email')
def test_email():
    """Test endpoint to send email report immediately"""
    try:
        if not agent:
            return jsonify({"error": "Agent not initialized"}), 500
        
        print("📧 Testing email report...")
        
        # Get recent data
        worksheet = agent.sheet.worksheet("Daily_Report")
        all_data = worksheet.get_all_records()
        
        this_week = all_data[-7:] if len(all_data) >= 7 else all_data
        last_week = all_data[-14:-7] if len(all_data) >= 14 else []
        
        if not this_week:
            return jsonify({"error": "No data available"}), 400
        
        # Calculate metrics
        metrics = agent.calculate_weekly_metrics(this_week, last_week)
        
        # Generate test analysis
        analysis = "This is a test email report generated manually. Your weekly automated reports will contain full AI analysis with insights, trends, and recommendations."
        
        # Send email
        sendgrid_key = os.getenv('SENDGRID_API_KEY')
        if not sendgrid_key:
            return jsonify({"error": "SendGrid not configured"}), 400
        
        from email_reporter import EmailReporter
        email_reporter = EmailReporter()
        success = email_reporter.send_weekly_report(analysis, metrics)
        
        if success:
            return jsonify({
                "status": "success",
                "message": "Test email sent! Check your inbox.",
                "recipient": os.getenv('OWNER_EMAIL')
            })
        else:
            return jsonify({"error": "Failed to send email"}), 500
            
    except Exception as e:
        print(f"❌ Test email error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@app.route('/test-drive')
def test_drive():
    """Test endpoint to upload report to Google Drive"""
    try:
        if not agent:
            return jsonify({"error": "Agent not initialized"}), 500
        
        print("📁 Testing Google Drive upload...")
        
        # Get recent data
        worksheet = agent.sheet.worksheet("Daily_Report")
        all_data = worksheet.get_all_records()
        
        this_week = all_data[-7:] if len(all_data) >= 7 else all_data
        last_week = all_data[-14:-7] if len(all_data) >= 14 else []
        
        if not this_week:
            return jsonify({"error": "No data available"}), 400
        
        # Calculate metrics
        metrics = agent.calculate_weekly_metrics(this_week, last_week)
        
        # Generate test HTML
        from email_reporter import EmailReporter
        email_reporter = EmailReporter()
        html_content = email_reporter.generate_weekly_html("Test report uploaded to Drive", metrics)
        
        # Upload to Drive
        from drive_archiver import DriveArchiver
        drive = DriveArchiver()
        drive_url = drive.upload_weekly_report(html_content, metrics)
        
        if drive_url:
            return jsonify({
                "status": "success",
                "message": "Report uploaded to Google Drive!",
                "url": drive_url
            })
        else:
            return jsonify({"error": "Failed to upload to Drive"}), 500
            
    except Exception as e:
        print(f"❌ Test Drive error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

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
    
    # Initialize Telegram bot (if configured)
    telegram_bot_token = os.getenv('TELEGRAM_BOT_TOKEN')
    if telegram_bot_token:
        try:
            from telegram_bot import initialize_telegram_bot
            telegram_bot = initialize_telegram_bot(agent)
            print("✅ Telegram bot initialized")
        except Exception as e:
            print(f"⚠️ Telegram bot not available: {e}")
    else:
        print("⚠️ Telegram bot disabled (no token)")
    
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
    if telegram_bot_token:
        print(f"📱 Telegram: Send /start to your bot")
    print("="*60 + "\n")
    
    # Start Flask web server
    port = int(os.getenv('PORT', 8080))
    app.run(host='0.0.0.0', port=port, debug=False)


if __name__ == "__main__":
    main()
