"""
SuperPlus AI Agent - Telegram Bot Integration
Provides on-demand analysis via Telegram commands
"""

import os
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import Application, CommandHandler, MessageHandler, filters, ContextTypes
import anthropic
from datetime import datetime, timedelta
import json

class TelegramBot:
    """
    Telegram bot for on-demand business analysis
    """
    
    def __init__(self, agent):
        self.agent = agent  # Reference to main SuperPlus agent
        self.bot_token = os.getenv('TELEGRAM_BOT_TOKEN')
        self.authorized_users = os.getenv('TELEGRAM_AUTHORIZED_USERS', '').split(',')
        
    async def start(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Welcome message"""
        user_id = str(update.effective_user.id)
        
        if user_id not in self.authorized_users:
            await update.message.reply_text("⛔ Unauthorized. Contact admin.")
            return
        
        welcome = """👋 **Welcome to SuperPlus AI Agent**

I'm your autonomous business advisor. Ask me anything!

**Quick Commands:**
/status - Current week summary
/today - Today's performance  
/yesterday - Yesterday's results
/compare - Compare to last week
/forecast - Tomorrow's projection
/gas - Gas station analysis
/deli - Restaurant analysis
/store - Store performance
/help - Full command list

**Natural Language:**
Just ask! "How are we doing?" or "What's trending?"

Ready to help! 🚀"""
        
        await update.message.reply_text(welcome, parse_mode='Markdown')
    
    async def status(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Current week status"""
        if not self.is_authorized(update):
            return
        
        await update.message.reply_text("📊 Analyzing current week...")
        
        try:
            # Get data from Google Sheets
            worksheet = self.agent.sheet.worksheet("Daily_Report")
            all_data = worksheet.get_all_records()
            
            # Get this week's data
            this_week = all_data[-7:] if len(all_data) >= 7 else all_data
            last_week = all_data[-14:-7] if len(all_data) >= 14 else []
            
            # Calculate metrics
            metrics = self.agent.calculate_weekly_metrics(this_week, last_week)
            
            # Generate status report
            report = f"""📊 **SUPERPLUS STATUS**
{datetime.now().strftime('%A, %B %d, %Y')}

💰 **THIS WEEK SO FAR:**
Total Revenue: JMD ${metrics['this_week']['total_revenue']:,.0f}
Daily Average: JMD ${metrics['this_week']['daily_avg_revenue']:,.0f}

vs Last Week: {metrics['week_over_week']['revenue_change_pct']:+.1f}%

**BREAKDOWN:**
⛽ Gas: JMD ${metrics['this_week']['gas_revenue']:,.0f} ({metrics['business_mix']['gas_pct']:.0f}%)
🏪 Store: JMD ${metrics['this_week']['store_sales']:,.0f} ({metrics['business_mix']['store_pct']:.0f}%)
🍽️ Deli: JMD ${metrics['this_week']['deli_sales']:,.0f} ({metrics['business_mix']['deli_pct']:.0f}%)
💳 Cards: JMD ${metrics['this_week']['phone_cards']:,.0f} ({metrics['business_mix']['phone_pct']:.0f}%)

⛽ **GAS VOLUME:**
Total: {metrics['this_week']['total_litres']:,.0f} litres
87: {metrics['this_week']['litres_87']:,.0f}L ({metrics['fuel_mix']['regular_87_pct']:.0f}%)
90: {metrics['this_week']['litres_90']:,.0f}L ({metrics['fuel_mix']['premium_90_pct']:.0f}%)

📈 **TREND:** {"📈 Up" if metrics['week_over_week']['revenue_change_pct'] > 0 else "📉 Down" if metrics['week_over_week']['revenue_change_pct'] < 0 else "→ Flat"}

🎯 **STATUS:** {"Great week!" if metrics['week_over_week']['revenue_change_pct'] > 3 else "On track" if metrics['week_over_week']['revenue_change_pct'] > 0 else "Needs attention"}"""
            
            await update.message.reply_text(report, parse_mode='Markdown')
            
            # Add quick action buttons
            keyboard = [
                [InlineKeyboardButton("📊 Compare", callback_data='compare'),
                 InlineKeyboardButton("🔮 Forecast", callback_data='forecast')],
                [InlineKeyboardButton("⛽ Gas Details", callback_data='gas'),
                 InlineKeyboardButton("🍽️ Deli Details", callback_data='deli')]
            ]
            reply_markup = InlineKeyboardMarkup(keyboard)
            await update.message.reply_text("Quick actions:", reply_markup=reply_markup)
            
        except Exception as e:
            await update.message.reply_text(f"❌ Error: {str(e)}")
    
    async def compare(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Compare this week to last week"""
        if not self.is_authorized(update):
            return
        
        await update.message.reply_text("📊 Comparing weeks...")
        
        try:
            worksheet = self.agent.sheet.worksheet("Daily_Report")
            all_data = worksheet.get_all_records()
            
            this_week = all_data[-7:] if len(all_data) >= 7 else all_data
            last_week = all_data[-14:-7] if len(all_data) >= 14 else []
            
            if not last_week:
                await update.message.reply_text("⚠️ Not enough data for comparison (need 2 weeks)")
                return
            
            metrics = self.agent.calculate_weekly_metrics(this_week, last_week)
            
            report = f"""📊 **WEEK COMPARISON**

**THIS WEEK:**
Total: JMD ${metrics['this_week']['total_revenue']:,.0f}
Gas: JMD ${metrics['this_week']['gas_revenue']:,.0f}
Store: JMD ${metrics['this_week']['store_sales']:,.0f}
Deli: JMD ${metrics['this_week']['deli_sales']:,.0f}
Cards: JMD ${metrics['this_week']['phone_cards']:,.0f}

**LAST WEEK:**
Total: JMD ${metrics['last_week']['total_revenue']:,.0f}

**CHANGES:**
{"📈" if metrics['week_over_week']['revenue_change_pct'] > 0 else "📉"} Total: {metrics['week_over_week']['revenue_change_pct']:+.1f}% (JMD ${metrics['this_week']['total_revenue'] - metrics['last_week']['total_revenue']:,.0f})
{"📈" if metrics['week_over_week']['litres_change_pct'] > 0 else "📉"} Gas Volume: {metrics['week_over_week']['litres_change_pct']:+.1f}%

🎯 **VERDICT:** {"🎉 Strong performance!" if metrics['week_over_week']['revenue_change_pct'] > 5 else "✅ Solid week" if metrics['week_over_week']['revenue_change_pct'] > 0 else "⚠️ Needs investigation"}"""
            
            await update.message.reply_text(report, parse_mode='Markdown')
            
        except Exception as e:
            await update.message.reply_text(f"❌ Error: {str(e)}")
    
    async def forecast(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Forecast next period"""
        if not self.is_authorized(update):
            return
        
        await update.message.reply_text("🔮 Generating forecast...")
        
        try:
            worksheet = self.agent.sheet.worksheet("Daily_Report")
            all_data = worksheet.get_all_records()
            
            # Use AI to generate intelligent forecast
            recent_data = all_data[-14:] if len(all_data) >= 14 else all_data
            
            forecast_prompt = f"""Based on this SuperPlus business data, forecast tomorrow's performance:

Recent Data:
{json.dumps(recent_data, indent=2)}

Provide:
1. Tomorrow's revenue projection (conservative, base, optimistic)
2. Key factors (day of week, trends, patterns)
3. Specific recommendations

Format as brief Telegram message (200 words max)."""

            response = self.agent.client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=500,
                messages=[{"role": "user", "content": forecast_prompt}]
            )
            
            forecast = response.content[0].text
            
            await update.message.reply_text(f"🔮 **FORECAST**\n\n{forecast}", parse_mode='Markdown')
            
        except Exception as e:
            await update.message.reply_text(f"❌ Error: {str(e)}")
    
    async def gas_analysis(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Gas station specific analysis"""
        if not self.is_authorized(update):
            return
        
        await update.message.reply_text("⛽ Analyzing gas station...")
        
        try:
            def safe_float(value):
                """Safely convert any value to float"""
                if value is None or value == '':
                    return 0
                if isinstance(value, (int, float)):
                    return float(value)
                cleaned = str(value).replace('$', '').replace(',', '').replace(' ', '').strip()
                try:
                    return float(cleaned) if cleaned else 0
                except (ValueError, AttributeError):
                    return 0
            
            worksheet = self.agent.sheet.worksheet("Daily_Report")
            all_data = worksheet.get_all_records()
            this_week = all_data[-7:] if len(all_data) >= 7 else all_data
            
            # Calculate gas metrics with safe conversion
            total_litres = sum([safe_float(row.get('Total_Litres', 0)) for row in this_week])
            litres_87 = sum([safe_float(row.get('Gas_87_Litres', 0)) for row in this_week])
            litres_90 = sum([safe_float(row.get('Gas_90_Litres', 0)) for row in this_week])
            litres_ado = sum([safe_float(row.get('Gas_ADO_Litres', 0)) for row in this_week])
            litres_ulsd = sum([safe_float(row.get('Gas_ULSD_Litres', 0)) for row in this_week])
            gas_revenue = sum([safe_float(row.get('Gas_Revenue_Est', 0)) for row in this_week])
            
            # Calculate average prices
            prices_87 = [safe_float(row.get('GasMart_87_Price', 0)) for row in this_week if row.get('GasMart_87_Price')]
            prices_90 = [safe_float(row.get('GasMart_90_Price', 0)) for row in this_week if row.get('GasMart_90_Price')]
            prices_ado = [safe_float(row.get('GasMart_ADO_Price', 0)) for row in this_week if row.get('GasMart_ADO_Price')]
            prices_ulsd = [safe_float(row.get('GasMart_ULSD_Price', 0)) for row in this_week if row.get('GasMart_ULSD_Price')]
            
            avg_price_87 = sum(prices_87) / len(prices_87) if prices_87 else 0
            avg_price_90 = sum(prices_90) / len(prices_90) if prices_90 else 0
            avg_price_ado = sum(prices_ado) / len(prices_ado) if prices_ado else 0
            avg_price_ulsd = sum(prices_ulsd) / len(prices_ulsd) if prices_ulsd else 0
            
            report = f"""⛽ **GAS STATION ANALYSIS**
This Week (Last {len(this_week)} days)

**VOLUME BY FUEL TYPE:**
Total: {total_litres:,.0f} litres
• 87 (Regular): {litres_87:,.0f}L ({litres_87/total_litres*100:.0f}%)
• 90 (Premium): {litres_90:,.0f}L ({litres_90/total_litres*100:.0f}%)
• ADO (Diesel): {litres_ado:,.0f}L ({litres_ado/total_litres*100:.0f}%)
• ULSD (Ultra Low): {litres_ulsd:,.0f}L ({litres_ulsd/total_litres*100:.0f}%)

Daily Avg: {total_litres/len(this_week):,.0f}L

**REVENUE:**
Total: JMD ${gas_revenue:,.0f}
Daily Avg: JMD ${gas_revenue/len(this_week):,.0f}

**CURRENT PRICING:**
87: JMD ${avg_price_87:.2f}/L
90: JMD ${avg_price_90:.2f}/L
ADO: JMD ${avg_price_ado:.2f}/L
ULSD: JMD ${avg_price_ulsd:.2f}/L

**MARGIN EST:**
~JMD ${gas_revenue * 0.08:,.0f} (assuming 8% margin)

📈 **INSIGHT:** {"Regular 87 is your volume driver" if litres_87 > litres_90 else "Premium 90 performing strong"}"""
            
            await update.message.reply_text(report, parse_mode='Markdown')
            
        except Exception as e:
            await update.message.reply_text(f"❌ Error: {str(e)}")
    
    async def handle_message(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle natural language queries"""
        if not self.is_authorized(update):
            return
        
        message = update.message.text.lower()
        
        # Detect intent
        if any(word in message for word in ['status', 'how', 'doing', 'update']):
            await self.status(update, context)
        elif any(word in message for word in ['compare', 'vs', 'versus', 'last week']):
            await self.compare(update, context)
        elif any(word in message for word in ['forecast', 'predict', 'tomorrow', 'expect']):
            await self.forecast(update, context)
        elif 'gas' in message:
            await self.gas_analysis(update, context)
        else:
            await update.message.reply_text(
                "I didn't understand that. Try:\n"
                "• /status - Current week\n"
                "• /compare - vs last week\n"
                "• /forecast - Tomorrow's projection\n"
                "• /help - All commands"
            )
    
    def is_authorized(self, update: Update) -> bool:
        """Check if user is authorized"""
        user_id = str(update.effective_user.id)
        if user_id not in self.authorized_users:
            update.message.reply_text("⛔ Unauthorized")
            return False
        return True
    
    def run(self):
        """Start the Telegram bot with proper async handling"""
        import asyncio
        
        # Create and set new event loop for this thread
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        try:
            application = Application.builder().token(self.bot_token).build()
            
            # Add command handlers
            application.add_handler(CommandHandler("start", self.start))
            application.add_handler(CommandHandler("status", self.status))
            application.add_handler(CommandHandler("compare", self.compare))
            application.add_handler(CommandHandler("forecast", self.forecast))
            application.add_handler(CommandHandler("gas", self.gas_analysis))
            
            # Add message handler for natural language
            application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, self.handle_message))
            
            # Start polling
            print("🤖 Telegram bot started!")
            
            # Run the application with the event loop
            loop.run_until_complete(application.initialize())
            loop.run_until_complete(application.start())
            loop.run_until_complete(application.updater.start_polling())
            
            # Keep running
            loop.run_forever()
            
        except Exception as e:
            print(f"❌ Telegram bot error: {e}")
        finally:
            loop.close()


# Add to main agent initialization
def initialize_telegram_bot(agent):
    """Initialize Telegram bot with agent reference"""
    bot = TelegramBot(agent)
    
    # Run in separate thread
    import threading
    bot_thread = threading.Thread(target=bot.run, daemon=True)
    bot_thread.start()
    
    return bot
