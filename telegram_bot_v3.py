#!/usr/bin/env python3
"""
SuperPlus Telegram Bot - v3 (Multi-tab)
Commands for querying business data from multi-tab sheet structure
"""

import os
import json
from datetime import datetime, timedelta, timezone

# Jamaica timezone (EST/UTC-5, no DST)
JAMAICA_TZ = timezone(timedelta(hours=-5))

def jamaica_now():
    """Get current time in Jamaica"""
    return datetime.now(JAMAICA_TZ)

def jamaica_today():
    """Get today's date in Jamaica as string"""
    return jamaica_now().strftime("%Y-%m-%d")
from telegram import Update
from telegram.ext import Application, CommandHandler, MessageHandler, filters, ContextTypes
import gspread
from google.oauth2.service_account import Credentials


class SuperPlusTelegramBot:
    """Telegram bot for SuperPlus queries - uses multi-tab sheet structure"""
    
    def __init__(self):
        self.token = os.getenv('TELEGRAM_BOT_TOKEN')
        self.authorized_users = os.getenv('TELEGRAM_AUTHORIZED_USERS', '').split(',')
        self.sheet_id = os.getenv('GOOGLE_SHEET_ID')
        
        self.setup_sheets()
    
    def setup_sheets(self):
        """Setup Google Sheets connection with sheet_manager"""
        try:
            import base64
            creds_base64 = os.getenv('GOOGLE_CREDENTIALS_BASE64')
            
            if creds_base64:
                decoded = base64.b64decode(creds_base64)
                creds_dict = json.loads(decoded)
                
                scopes = ['https://www.googleapis.com/auth/spreadsheets']
                credentials = Credentials.from_service_account_info(creds_dict, scopes=scopes)
                gc = gspread.authorize(credentials)
                self.sheet = gc.open_by_key(self.sheet_id)
                
                from sheet_manager import SheetManager
                self.sm = SheetManager(self.sheet)
                
                print("✅ Telegram bot connected to multi-tab sheets")
            else:
                self.sheet = None
                self.sm = None
                print("⚠️ No Google credentials for Telegram bot")
                
        except Exception as e:
            print(f"❌ Telegram sheets error: {e}")
            self.sheet = None
            self.sm = None
    
    def _safe_float(self, val) -> float:
        """Safely convert to float"""
        if val is None or val == '':
            return 0
        if isinstance(val, (int, float)):
            return float(val)
        try:
            return float(str(val).replace(',', '').replace('$', '').strip())
        except:
            return 0
    
    def is_authorized(self, user_id: int) -> bool:
        """Check if user is authorized"""
        if not self.authorized_users or not self.authorized_users[0]:
            return True
        return str(user_id) in self.authorized_users
    
    # ============================================
    # COMMAND HANDLERS
    # ============================================
    
    async def cmd_start(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle /start command"""
        if not self.is_authorized(update.effective_user.id):
            await update.message.reply_text("⛔ Not authorized")
            return
        
        await update.message.reply_text(
            "🏪 **SuperPlus AI Bot** (v3 Multi-tab)\n\n"
            "Commands:\n"
            "/status - Current week summary\n"
            "/today - Today's numbers\n"
            "/gas - Fuel sales analysis\n"
            "/dips - Inventory levels\n"
            "/deliveries - Recent fuel deliveries\n"
            "/shrinkage - Fuel loss detection\n"
            "/profit - Profit report\n"
            "/forecast - Demand forecast\n"
            "/competitors - Competitor prices\n"
            "/compare - Week over week\n"
            "/help - All commands",
            parse_mode='Markdown'
        )
    
    async def cmd_help(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle /help command"""
        if not self.is_authorized(update.effective_user.id):
            return
        
        await update.message.reply_text(
            "📖 **All Commands**\n\n"
            "**Overview:**\n"
            "/status - Weekly summary\n"
            "/today - Today's data\n"
            "/compare - Week vs last week\n\n"
            "**Fuel:**\n"
            "/gas - Sales by fuel type\n"
            "/dips - Tank inventory\n"
            "/deliveries - Recent deliveries\n"
            "/shrinkage - Loss detection\n\n"
            "**Analysis:**\n"
            "/profit - Profit breakdown\n"
            "/forecast - Demand predictions\n"
            "/margins - Margin analysis\n"
            "/competitors - Competitor prices\n\n"
            "**Settings:**\n"
            "/setcost [fuel] [price] - Set default cost",
            parse_mode='Markdown'
        )
    
    async def cmd_status(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle /status - Weekly summary"""
        if not self.is_authorized(update.effective_user.id):
            return
        
        if not self.sm:
            await update.message.reply_text("❌ Database not connected")
            return
        
        try:
            weekly = self.sm.get_weekly_summary()
            
            if not weekly:
                await update.message.reply_text("📊 No data for this week yet")
                return
            
            msg = f"📊 **WEEK SUMMARY**\n"
            msg += f"_{weekly['week_start']} to {weekly['week_end']}_\n"
            msg += f"Days: {weekly['days']}\n\n"
            
            msg += f"💰 **Revenue:** ${weekly['total_revenue']:,.0f}\n"
            msg += f"⛽ Gas: ${weekly['gas_revenue']:,.0f}\n"
            msg += f"🏪 Store: ${weekly['store_sales']:,.0f}\n"
            msg += f"🍔 Deli: ${weekly['deli_sales']:,.0f}\n"
            msg += f"📱 Phone: ${weekly['phone_cards']:,.0f}\n\n"
            msg += f"⛽ **Litres:** {weekly['total_litres']:,.0f}L"
            
            await update.message.reply_text(msg, parse_mode='Markdown')
            
        except Exception as e:
            await update.message.reply_text(f"❌ Error: {e}")
    
    async def cmd_today(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle /today - Today's numbers"""
        if not self.is_authorized(update.effective_user.id):
            return
        
        if not self.sm:
            await update.message.reply_text("❌ Database not connected")
            return
        
        try:
            today = jamaica_today()
            summary = self.sm.get_daily_summary(today)
            fuel = self.sm.get_fuel_sales(today)
            inventory = self.sm.get_fuel_inventory(today)
            deliveries = self.sm.get_deliveries_for_date(today)
            
            if not summary and not fuel:
                await update.message.reply_text("📊 No data for today yet")
                return
            
            msg = f"📅 **TODAY** ({today})\n\n"
            
            if summary:
                if summary.get('Store_Sales'):
                    msg += f"🏪 Store: ${self._safe_float(summary['Store_Sales']):,.0f}\n"
                if summary.get('Deli_Sales'):
                    msg += f"🍔 Deli: ${self._safe_float(summary['Deli_Sales']):,.0f}\n"
                if summary.get('Phone_Cards'):
                    msg += f"📱 Phone: ${self._safe_float(summary['Phone_Cards']):,.0f}\n"
            
            if fuel:
                msg += f"\n⛽ **Fuel Sold:**\n"
                for f in ['87', '90', 'ADO', 'ULSD']:
                    litres = self._safe_float(fuel.get(f'Gas_{f}_Litres', 0))
                    if litres:
                        msg += f"  {f}: {litres:,.0f}L\n"
            
            if inventory:
                msg += f"\n📦 **Dips:**\n"
                for f in ['87', '90', 'ADO', 'ULSD']:
                    opening = self._safe_float(inventory.get(f'Opening_{f}', 0))
                    closing = self._safe_float(inventory.get(f'Closing_{f}', 0))
                    if opening or closing:
                        msg += f"  {f}: {opening:,.0f}L → {closing:,.0f}L\n"
            
            if deliveries:
                msg += f"\n🚛 **Deliveries:** {len(deliveries)}\n"
                for d in deliveries:
                    litres = self._safe_float(d.get('Litres', 0))
                    cost = self._safe_float(d.get('Cost_Per_Litre', 0))
                    fuel_type = d.get('Fuel_Type', '?')
                    if cost:
                        msg += f"  {fuel_type}: {litres:,.0f}L @ ${cost}/L\n"
                    else:
                        msg += f"  {fuel_type}: {litres:,.0f}L\n"
            
            await update.message.reply_text(msg, parse_mode='Markdown')
            
        except Exception as e:
            await update.message.reply_text(f"❌ Error: {e}")
    
    async def cmd_gas(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle /gas - Fuel sales analysis"""
        if not self.is_authorized(update.effective_user.id):
            return
        
        if not self.sm:
            await update.message.reply_text("❌ Database not connected")
            return
        
        try:
            fuel_sales = self.sm.get_fuel_sales_range(days=7)
            
            if not fuel_sales:
                await update.message.reply_text("📊 No fuel sales data")
                return
            
            # Aggregate
            totals = {'87': 0, '90': 0, 'ADO': 0, 'ULSD': 0}
            revenue = {'87': 0, '90': 0, 'ADO': 0, 'ULSD': 0}
            
            for day in fuel_sales:
                for f in totals.keys():
                    totals[f] += self._safe_float(day.get(f'Gas_{f}_Litres', 0))
                    revenue[f] += self._safe_float(day.get(f'Revenue_{f}', 0))
            
            total_litres = sum(totals.values())
            total_revenue = sum(revenue.values())
            
            msg = f"⛽ **FUEL SALES** (7 days)\n\n"
            
            for f in ['87', '90', 'ADO', 'ULSD']:
                if totals[f] > 0:
                    pct = (totals[f] / total_litres * 100) if total_litres > 0 else 0
                    avg = totals[f] / len(fuel_sales)
                    msg += f"**{f}:**\n"
                    msg += f"  Total: {totals[f]:,.0f}L ({pct:.1f}%)\n"
                    msg += f"  Revenue: ${revenue[f]:,.0f}\n"
                    msg += f"  Avg/day: {avg:,.0f}L\n\n"
            
            msg += f"**TOTAL:** {total_litres:,.0f}L\n"
            msg += f"**Revenue:** ${total_revenue:,.0f}"
            
            await update.message.reply_text(msg, parse_mode='Markdown')
            
        except Exception as e:
            await update.message.reply_text(f"❌ Error: {e}")
    
    async def cmd_dips(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle /dips - Current inventory levels"""
        if not self.is_authorized(update.effective_user.id):
            return
        
        if not self.sm:
            await update.message.reply_text("❌ Database not connected")
            return
        
        try:
            inventory = self.sm.get_latest_inventory()
            fuel_sales = self.sm.get_fuel_sales_range(days=7)
            
            if not inventory:
                await update.message.reply_text("📦 No inventory data")
                return
            
            # Calculate daily averages
            daily_avg = {}
            for f in ['87', '90', 'ado', 'ulsd']:
                total = sum([self._safe_float(d.get(f'Gas_{f.upper()}_Litres', 0)) for d in fuel_sales])
                daily_avg[f] = total / len(fuel_sales) if fuel_sales else 0
            
            msg = f"📦 **INVENTORY** ({inventory['date']})\n\n"
            
            for f in ['87', '90', 'ado', 'ulsd']:
                current = inventory.get(f, 0)
                if current > 0:
                    days_remaining = current / daily_avg[f] if daily_avg[f] > 0 else 999
                    
                    # Status indicator
                    if days_remaining < 2:
                        status = "🔴"
                    elif days_remaining < 3:
                        status = "🟠"
                    elif days_remaining < 5:
                        status = "🟡"
                    else:
                        status = "🟢"
                    
                    msg += f"{status} **{f.upper()}:** {current:,.0f}L\n"
                    msg += f"   {days_remaining:.1f} days remaining\n\n"
            
            await update.message.reply_text(msg, parse_mode='Markdown')
            
        except Exception as e:
            await update.message.reply_text(f"❌ Error: {e}")
    
    async def cmd_deliveries(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle /deliveries - Recent fuel deliveries"""
        if not self.is_authorized(update.effective_user.id):
            return
        
        if not self.sm:
            await update.message.reply_text("❌ Database not connected")
            return
        
        try:
            deliveries = self.sm.get_deliveries_range(days=14)
            
            if not deliveries:
                await update.message.reply_text("🚛 No recent deliveries")
                return
            
            msg = "🚛 **RECENT DELIVERIES** (14 days)\n\n"
            
            # Group by date
            by_date = {}
            for d in deliveries:
                date = d.get('Date', 'Unknown')
                if date not in by_date:
                    by_date[date] = []
                by_date[date].append(d)
            
            for date in sorted(by_date.keys(), reverse=True)[:7]:
                msg += f"**{date}:**\n"
                for d in by_date[date]:
                    fuel_type = d.get('Fuel_Type', '?')
                    litres = self._safe_float(d.get('Litres', 0))
                    cost = self._safe_float(d.get('Cost_Per_Litre', 0))
                    total = self._safe_float(d.get('Total_Cost', 0))
                    
                    if cost:
                        msg += f"  {fuel_type}: {litres:,.0f}L @ ${cost}/L = ${total:,.0f}\n"
                    else:
                        msg += f"  {fuel_type}: {litres:,.0f}L\n"
                msg += "\n"
            
            await update.message.reply_text(msg, parse_mode='Markdown')
            
        except Exception as e:
            await update.message.reply_text(f"❌ Error: {e}")
    
    async def cmd_shrinkage(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle /shrinkage - Fuel loss detection"""
        if not self.is_authorized(update.effective_user.id):
            return
        
        if not self.sm:
            await update.message.reply_text("❌ Database not connected")
            return
        
        try:
            shrinkage = self.sm.get_shrinkage_summary(days=7)
            
            msg = "📉 **SHRINKAGE REPORT** (7 days)\n\n"
            
            if shrinkage['days_with_data'] == 0:
                msg += "No shrinkage data available.\n"
                msg += "Need both opening and closing dips."
            else:
                total_shrinkage = 0
                
                for f in ['87', '90', 'ado', 'ulsd']:
                    data = shrinkage[f]
                    if data['days'] > 0:
                        # Positive shrinkage = loss
                        if data['total'] > 50:
                            status = "🔴"
                        elif data['total'] > 20:
                            status = "🟡"
                        elif data['total'] < -20:
                            status = "🟢"  # Gain (unusual)
                        else:
                            status = "✅"
                        
                        msg += f"{status} **{f.upper()}:** {data['total']:,.0f}L\n"
                        msg += f"   ({data['days']} days measured)\n\n"
                        total_shrinkage += data['total']
                
                msg += f"**Total Shrinkage:** {total_shrinkage:,.0f}L"
                
                if total_shrinkage > 100:
                    msg += "\n\n⚠️ High shrinkage detected. Investigate possible causes."
            
            await update.message.reply_text(msg, parse_mode='Markdown')
            
        except Exception as e:
            await update.message.reply_text(f"❌ Error: {e}")
    
    async def cmd_profit(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle /profit - Profit analysis"""
        if not self.is_authorized(update.effective_user.id):
            return
        
        if not self.sm:
            await update.message.reply_text("❌ Database not connected")
            return
        
        try:
            from profit_report import ProfitCalculator
            
            calc = ProfitCalculator(self.sm)
            report = calc.generate_weekly_profit_report()
            
            await update.message.reply_text(report['text'], parse_mode='Markdown')
            
        except ImportError:
            # Fallback simple profit calc
            fuel_sales = self.sm.get_fuel_sales_range(days=7)
            deliveries = self.sm.get_deliveries_range(days=30)
            
            msg = "💰 **PROFIT ESTIMATE** (7 days)\n\n"
            
            # Get latest costs from deliveries
            costs = {}
            for d in reversed(deliveries):
                fuel = d.get('Fuel_Type', '').upper()
                cost = self._safe_float(d.get('Cost_Per_Litre', 0))
                if fuel and cost and fuel not in costs:
                    costs[fuel] = cost
            
            # Defaults
            default_costs = {'87': 158, '90': 168, 'ADO': 172, 'ULSD': 178}
            for f, c in default_costs.items():
                if f not in costs:
                    costs[f] = c
            
            total_profit = 0
            for day in fuel_sales:
                for f in ['87', '90', 'ADO', 'ULSD']:
                    litres = self._safe_float(day.get(f'Gas_{f}_Litres', 0))
                    price = self._safe_float(day.get(f'Price_{f}', 0))
                    cost = costs.get(f, default_costs.get(f, 160))
                    
                    if litres and price:
                        profit = litres * (price - cost)
                        total_profit += profit
            
            msg += f"⛽ Gas Profit: ${total_profit:,.0f}\n"
            msg += f"   (Using delivery costs where available)\n\n"
            msg += "For detailed breakdown, add profit_report.py"
            
            await update.message.reply_text(msg, parse_mode='Markdown')
            
        except Exception as e:
            await update.message.reply_text(f"❌ Error: {e}")
    
    async def cmd_forecast(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle /forecast - Demand predictions"""
        if not self.is_authorized(update.effective_user.id):
            return
        
        if not self.sm:
            await update.message.reply_text("❌ Database not connected")
            return
        
        try:
            from demand_forecast import DemandForecaster
            
            forecaster = DemandForecaster()
            
            # Build data from sheet_manager
            fuel_sales = self.sm.get_fuel_sales_range(days=28)
            inventory = self.sm.get_latest_inventory()
            
            all_data = []
            for sale in fuel_sales:
                all_data.append({
                    'Date': sale.get('Date'),
                    'Gas_87_Litres': sale.get('Gas_87_Litres', 0),
                    'Gas_90_Litres': sale.get('Gas_90_Litres', 0),
                    'Gas_ADO_Litres': sale.get('Gas_ADO_Litres', 0),
                    'Gas_ULSD_Litres': sale.get('Gas_ULSD_Litres', 0),
                    'Opening_87_Litres': inventory.get('87', 0) if inventory else 0,
                    'Opening_90_Litres': inventory.get('90', 0) if inventory else 0,
                    'Opening_ADO_Litres': inventory.get('ado', 0) if inventory else 0,
                    'Opening_ULSD_Litres': inventory.get('ulsd', 0) if inventory else 0,
                })
            
            text_report = forecaster.generate_forecast_text(all_data)
            
            await update.message.reply_text(text_report, parse_mode='Markdown')
            
        except ImportError:
            await update.message.reply_text("❌ demand_forecast.py not installed")
        except Exception as e:
            await update.message.reply_text(f"❌ Error: {e}")
    
    async def cmd_competitors(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle /competitors - Competitor prices"""
        if not self.is_authorized(update.effective_user.id):
            return
        
        if not self.sm:
            await update.message.reply_text("❌ Database not connected")
            return
        
        try:
            competitors = self.sm.get_competitor_prices(days=7)
            
            if not competitors:
                await update.message.reply_text("🏁 No competitor price data")
                return
            
            msg = "🏁 **COMPETITOR PRICES** (7 days)\n\n"
            
            # Group by competitor
            by_comp = {}
            for c in competitors:
                name = c.get('Competitor', 'Unknown')
                if name not in by_comp:
                    by_comp[name] = c
            
            for name, data in by_comp.items():
                msg += f"**{name}:**\n"
                for f in ['87', '90', 'ADO', 'ULSD']:
                    price = self._safe_float(data.get(f'Price_{f}', 0))
                    if price:
                        msg += f"  {f}: ${price}\n"
                msg += f"  _{data.get('Date', '')}_\n\n"
            
            await update.message.reply_text(msg, parse_mode='Markdown')
            
        except Exception as e:
            await update.message.reply_text(f"❌ Error: {e}")
    
    async def cmd_compare(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle /compare - Week over week comparison"""
        if not self.is_authorized(update.effective_user.id):
            return
        
        if not self.sm:
            await update.message.reply_text("❌ Database not connected")
            return
        
        try:
            this_week = self.sm.get_weekly_summary(weeks_back=0)
            last_week = self.sm.get_weekly_summary(weeks_back=1)
            
            if not this_week:
                await update.message.reply_text("📊 No data for this week")
                return
            
            msg = "📈 **WEEK COMPARISON**\n\n"
            
            metrics = [
                ('Total Revenue', 'total_revenue', '$'),
                ('Gas Revenue', 'gas_revenue', '$'),
                ('Store Sales', 'store_sales', '$'),
                ('Deli Sales', 'deli_sales', '$'),
                ('Total Litres', 'total_litres', 'L')
            ]
            
            for label, key, unit in metrics:
                tw_val = this_week.get(key, 0)
                lw_val = last_week.get(key, 0) if last_week else 0
                
                if tw_val or lw_val:
                    change = tw_val - lw_val
                    pct = (change / lw_val * 100) if lw_val else 0
                    
                    arrow = "📈" if change > 0 else "📉" if change < 0 else "➡️"
                    
                    if unit == '$':
                        msg += f"**{label}:**\n"
                        msg += f"  This: ${tw_val:,.0f}\n"
                        msg += f"  Last: ${lw_val:,.0f}\n"
                        msg += f"  {arrow} {pct:+.1f}%\n\n"
                    else:
                        msg += f"**{label}:**\n"
                        msg += f"  This: {tw_val:,.0f}{unit}\n"
                        msg += f"  Last: {lw_val:,.0f}{unit}\n"
                        msg += f"  {arrow} {pct:+.1f}%\n\n"
            
            await update.message.reply_text(msg, parse_mode='Markdown')
            
        except Exception as e:
            await update.message.reply_text(f"❌ Error: {e}")
    
    async def handle_message(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle natural language queries"""
        if not self.is_authorized(update.effective_user.id):
            return
        
        text = update.message.text.lower()
        
        # Route to appropriate command
        if any(w in text for w in ['status', 'summary', 'how are we', 'week']):
            await self.cmd_status(update, context)
        elif any(w in text for w in ['today', 'now', 'current']):
            await self.cmd_today(update, context)
        elif any(w in text for w in ['gas', 'fuel', 'petrol', 'litres']):
            await self.cmd_gas(update, context)
        elif any(w in text for w in ['dip', 'inventory', 'tank', 'level']):
            await self.cmd_dips(update, context)
        elif any(w in text for w in ['deliver', 'tanker', 'load']):
            await self.cmd_deliveries(update, context)
        elif any(w in text for w in ['shrink', 'loss', 'missing']):
            await self.cmd_shrinkage(update, context)
        elif any(w in text for w in ['profit', 'margin', 'money', 'making']):
            await self.cmd_profit(update, context)
        elif any(w in text for w in ['forecast', 'predict', 'order', 'run out']):
            await self.cmd_forecast(update, context)
        elif any(w in text for w in ['competitor', 'jamgas', 'total', 'price']):
            await self.cmd_competitors(update, context)
        elif any(w in text for w in ['compare', 'vs', 'versus', 'last week']):
            await self.cmd_compare(update, context)
        elif any(w in text for w in ['schedule', 'shift', 'roster', 'working', 'staff']):
            await self.cmd_schedule(update, context)
        elif any(w in text for w in ['generate', 'create schedule', 'next week']):
            await self.cmd_generate_schedule(update, context)
        else:
            await update.message.reply_text(
                "I didn't understand. Try /help for commands, or ask about:\n"
                "• status/summary\n"
                "• gas/fuel sales\n"
                "• inventory/dips\n"
                "• profit/margins\n"
                "• forecast/orders\n"
                "• schedule/shifts"
            )
    
    # ============================================
    # SHIFT COMMANDS
    # ============================================
    
    async def cmd_schedule(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Show today's or this week's shift schedule"""
        if not self.is_authorized(update.effective_user.id):
            await update.message.reply_text("⛔ Not authorized")
            return
        
        if not self.sm:
            await update.message.reply_text("❌ Sheet not connected")
            return
        
        try:
            # Get today's shifts
            today_shifts = self.sm.get_todays_schedule()
            
            if not today_shifts:
                await update.message.reply_text(
                    "📅 No shifts found for today.\n\n"
                    "Use /generate_schedule to create next week's roster."
                )
                return
            
            # Format response
            today = jamaica_now().strftime('%A, %b %d')
            msg = f"📅 *Schedule for {today}*\n\n"
            
            # Group by role
            supervisors = [s for s in today_shifts if s.get('Role') == 'Supervisor']
            overnight = [s for s in today_shifts if s.get('Is_Overnight') == 'Yes']
            regular = [s for s in today_shifts if s.get('Role') not in ['Supervisor', 'Overnight'] and s.get('Is_Overnight') != 'Yes']
            
            if supervisors:
                msg += "👑 *Supervisors:*\n"
                for s in supervisors:
                    msg += f"  • {s['Staff_Name']}: {s['Shift_Start']} - {s['Shift_End']}\n"
            
            if regular:
                msg += "\n👷 *Staff:*\n"
                for s in regular:
                    msg += f"  • {s['Staff_Name']}: {s['Shift_Start']} - {s['Shift_End']}\n"
            
            if overnight:
                msg += "\n🌙 *Overnight:*\n"
                for s in overnight:
                    msg += f"  • {s['Staff_Name']}: {s['Shift_Start']} - {s['Shift_End']}\n"
            
            msg += f"\n*Total:* {len(today_shifts)} staff"
            
            await update.message.reply_text(msg, parse_mode='Markdown')
            
        except Exception as e:
            await update.message.reply_text(f"❌ Error: {e}")
    
    async def cmd_generate_schedule(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Generate next week's shift schedule"""
        if not self.is_authorized(update.effective_user.id):
            await update.message.reply_text("⛔ Not authorized")
            return
        
        if not self.sm:
            await update.message.reply_text("❌ Sheet not connected")
            return
        
        try:
            await update.message.reply_text("⏳ Generating next week's schedule...")
            
            # Import generator
            from shift_generator_v2 import ShiftGenerator, STAFF_ROSTER, DAYS
            from datetime import timedelta
            
            # Get previous Sunday workers for rotation
            prev_sunday = self.sm.get_previous_sunday_workers()
            
            # Calculate next week's start (next Sunday)
            today = jamaica_now()
            days_until_sunday = (6 - today.weekday()) % 7
            if days_until_sunday == 0:
                days_until_sunday = 7  # Next Sunday, not today
            next_sunday = today + timedelta(days=days_until_sunday)
            week_start = next_sunday.strftime('%Y-%m-%d')
            
            # Generate schedule
            generator = ShiftGenerator(STAFF_ROSTER, previous_sunday_workers=prev_sunday)
            schedule = generator.generate_schedule()
            
            # Prepare data for sheet
            schedule_rows = []
            for day_idx, day in enumerate(DAYS):
                date_str = (next_sunday + timedelta(days=day_idx)).strftime('%Y-%m-%d')
                
                for staff_name, shifts in schedule.items():
                    shift = shifts[day_idx]
                    if shift != 'OFF':
                        start, end = shift
                        hours = generator._calc_hours(start, end)
                        is_overnight = 'PM' in start and 'AM' in end
                        
                        staff = generator.staff[staff_name]
                        role = 'Supervisor' if staff.is_supervisor else \
                               'Auxiliary' if staff.is_auxiliary else \
                               'Overnight' if staff.is_overnight_specialist else 'Regular'
                        
                        schedule_rows.append({
                            'Date': date_str,
                            'Day': day,
                            'Staff_Name': staff_name,
                            'Shift_Start': start,
                            'Shift_End': end,
                            'Hours': hours,
                            'Is_Overnight': 'Yes' if is_overnight else 'No',
                            'Role': role
                        })
            
            # Save to sheet
            self.sm.save_shift_schedule(schedule_rows, week_start)
            
            # Save Sunday rotation for next week
            sunday_workers = generator.get_sunday_workers()
            self.sm.save_sunday_workers(sunday_workers)
            
            # Get summary
            summary = generator.get_summary()
            
            msg = f"✅ *Schedule Generated for {week_start}*\n\n"
            msg += f"📊 *Summary:*\n"
            msg += f"• Total hours: {summary['total_hours']}\n"
            msg += f"• Avg per staff: {summary['avg_hours']:.1f}h\n\n"
            
            msg += "*Daily Staff Count:*\n"
            for day, count in summary['daily_counts'].items():
                msg += f"  {day}: {count}\n"
            
            msg += f"\n🔄 *Sunday rotation:* {len(sunday_workers)} staff will be OFF next Sunday"
            
            await update.message.reply_text(msg, parse_mode='Markdown')
            
        except Exception as e:
            import traceback
            traceback.print_exc()
            await update.message.reply_text(f"❌ Error generating schedule: {e}")
    
    async def cmd_whos_working(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Show who's currently working"""
        if not self.is_authorized(update.effective_user.id):
            await update.message.reply_text("⛔ Not authorized")
            return
        
        if not self.sm:
            await update.message.reply_text("❌ Sheet not connected")
            return
        
        try:
            working = self.sm.get_whos_working_now()
            
            if not working:
                await update.message.reply_text("👤 No one currently on shift (based on schedule)")
                return
            
            now = jamaica_now().strftime('%I:%M %p')
            msg = f"👷 *Currently Working ({now}):*\n\n"
            
            for s in working:
                role = "👑" if s.get('Role') == 'Supervisor' else "🌙" if s.get('Is_Overnight') == 'Yes' else "👤"
                msg += f"{role} {s['Staff_Name']} ({s['Shift_Start']} - {s['Shift_End']})\n"
            
            await update.message.reply_text(msg, parse_mode='Markdown')
            
        except Exception as e:
            await update.message.reply_text(f"❌ Error: {e}")
    
    def run(self):
        """Start the bot"""
        if not self.token:
            print("❌ TELEGRAM_BOT_TOKEN not set")
            return
        
        app = Application.builder().token(self.token).build()
        
        # Commands
        app.add_handler(CommandHandler("start", self.cmd_start))
        app.add_handler(CommandHandler("help", self.cmd_help))
        app.add_handler(CommandHandler("status", self.cmd_status))
        app.add_handler(CommandHandler("today", self.cmd_today))
        app.add_handler(CommandHandler("gas", self.cmd_gas))
        app.add_handler(CommandHandler("dips", self.cmd_dips))
        app.add_handler(CommandHandler("deliveries", self.cmd_deliveries))
        app.add_handler(CommandHandler("shrinkage", self.cmd_shrinkage))
        app.add_handler(CommandHandler("profit", self.cmd_profit))
        app.add_handler(CommandHandler("forecast", self.cmd_forecast))
        app.add_handler(CommandHandler("competitors", self.cmd_competitors))
        app.add_handler(CommandHandler("compare", self.cmd_compare))
        app.add_handler(CommandHandler("schedule", self.cmd_schedule))
        app.add_handler(CommandHandler("generate_schedule", self.cmd_generate_schedule))
        app.add_handler(CommandHandler("working", self.cmd_whos_working))
        
        # Natural language
        app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, self.handle_message))
        
        print("🤖 Telegram bot starting (v3 multi-tab)...")
        app.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == "__main__":
    bot = SuperPlusTelegramBot()
    bot.run()
