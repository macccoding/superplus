"""
SuperPlus AI Agent - Telegram Bot Integration v2
Complete with Advanced Features + Profit Reports
"""

import os
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import Application, CommandHandler, MessageHandler, filters, ContextTypes
import anthropic
from datetime import datetime, timedelta
import json
from advanced_features import AdvancedFeatures

class TelegramBot:
    """
    Telegram bot for on-demand business analysis
    """
    
    def __init__(self, agent):
        self.agent = agent  # Reference to main SuperPlus agent
        self.bot_token = os.getenv('TELEGRAM_BOT_TOKEN')
        self.authorized_users = os.getenv('TELEGRAM_AUTHORIZED_USERS', '').split(',')
        
        # Initialize advanced features
        self.features = AdvancedFeatures(agent)
        
    async def start(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Welcome message"""
        user_id = str(update.effective_user.id)
        
        if user_id not in self.authorized_users:
            await update.message.reply_text("⛔ Unauthorized. Contact admin.")
            return
        
        welcome = """👋 **Welcome to SuperPlus AI Agent v2**

I'm your autonomous business advisor with profit tracking!

**📊 Status & Analysis:**
/status - Current week summary
/compare - vs last week
/forecast - Tomorrow's projection
/gas - Gas station details
/morning - Morning briefing

**💰 Profit & Margins:**
/profit - **Weekly profit report (NEW!)**
/margins - Margin analysis
/setcost - Update fuel costs

**📦 Inventory:**
/dips - Inventory levels & alerts
/shrinkage - Fuel loss detection

**🏁 Competition:**
/competitors - Competitor prices

**❓ Help:**
/help - Full command list

**Natural Language:**
Just ask! "How are we doing?" or "What's our profit?"

Ready to help! 🚀"""
        
        await update.message.reply_text(welcome, parse_mode='Markdown')
    
    async def profit_report(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Show weekly profit report with real costs"""
        if not self.is_authorized(update):
            return
        
        await update.message.reply_text("💰 Calculating profit with actual costs...")
        
        try:
            from profit_report import ProfitReport
            
            profit_reporter = ProfitReport(self.agent)
            
            worksheet = self.agent.sheet.worksheet("Daily_Report")
            all_data = worksheet.get_all_records()
            
            if not all_data:
                await update.message.reply_text("⚠️ No data available yet.")
                return
            
            report_text = profit_reporter.generate_profit_report_text(all_data)
            
            await update.message.reply_text(report_text, parse_mode='Markdown')
            
        except Exception as e:
            await update.message.reply_text(f"❌ Error: {str(e)}")
    
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

🎯 **STATUS:** {"Great week!" if metrics['week_over_week']['revenue_change_pct'] > 3 else "On track" if metrics['week_over_week']['revenue_change_pct'] > 0 else "Needs attention"}

💡 Use /profit for actual profit breakdown"""
            
            await update.message.reply_text(report, parse_mode='Markdown')
            
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
• 87 (Regular): {litres_87:,.0f}L ({litres_87/total_litres*100 if total_litres > 0 else 0:.0f}%)
• 90 (Premium): {litres_90:,.0f}L ({litres_90/total_litres*100 if total_litres > 0 else 0:.0f}%)
• ADO (Diesel): {litres_ado:,.0f}L ({litres_ado/total_litres*100 if total_litres > 0 else 0:.0f}%)
• ULSD: {litres_ulsd:,.0f}L ({litres_ulsd/total_litres*100 if total_litres > 0 else 0:.0f}%)

Daily Avg: {total_litres/len(this_week) if this_week else 0:,.0f}L

**REVENUE:**
Total: JMD ${gas_revenue:,.0f}
Daily Avg: JMD ${gas_revenue/len(this_week) if this_week else 0:,.0f}

**CURRENT PRICING:**
87: JMD ${avg_price_87:.2f}/L
90: JMD ${avg_price_90:.2f}/L
ADO: JMD ${avg_price_ado:.2f}/L
ULSD: JMD ${avg_price_ulsd:.2f}/L

💡 Use /profit for actual profit with delivery costs"""
            
            await update.message.reply_text(report, parse_mode='Markdown')
            
        except Exception as e:
            await update.message.reply_text(f"❌ Error: {str(e)}")
    
    async def inventory_status(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Show inventory levels and days remaining"""
        if not self.is_authorized(update):
            return
        
        await update.message.reply_text("📦 Checking inventory...")
        
        try:
            worksheet = self.agent.sheet.worksheet("Daily_Report")
            all_data = worksheet.get_all_records()
            
            inventory = self.features.calculate_inventory_status(all_data)
            alerts = self.features.check_inventory_alerts(inventory)
            
            report = "**📦 INVENTORY STATUS**\n\n"
            
            for fuel, data in inventory.items():
                fuel_name = {
                    '87': 'Gas 87 (Regular)',
                    '90': 'Gas 90 (Premium)',
                    'ado': 'ADO (Diesel)',
                    'ulsd': 'ULSD (Ultra Low Sulfur)'
                }.get(fuel, fuel)
                
                status_icon = "🚨" if data['days_remaining'] < 1.5 else "⚠️" if data['days_remaining'] < 2.5 else "✅"
                
                report += f"{status_icon} **{fuel_name}**\n"
                report += f"Current: {data['opening']:,.0f}L\n"
                report += f"Daily use: {data['avg_daily']:,.0f}L\n"
                report += f"Days left: **{data['days_remaining']:.1f} days**\n\n"
            
            if alerts:
                report += "**🚨 ALERTS:**\n"
                for alert in alerts:
                    report += f"{alert['message']}\n"
            
            await update.message.reply_text(report, parse_mode='Markdown')
            
        except Exception as e:
            await update.message.reply_text(f"❌ Error: {str(e)}")
    
    async def margin_analysis(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Show profit margin analysis"""
        if not self.is_authorized(update):
            return
        
        await update.message.reply_text("💰 Calculating margins...")
        
        try:
            worksheet = self.agent.sheet.worksheet("Daily_Report")
            all_data = worksheet.get_all_records()
            
            margins = self.features.calculate_margins(all_data)
            
            report = "**💰 PROFIT MARGIN ANALYSIS**\nLast 7 Days\n\n"
            
            for fuel in ['87', '90', 'ado', 'ulsd']:
                data = margins.get(fuel, {})
                if data and data.get('litres_sold', 0) > 0:
                    fuel_name = {
                        '87': '87 (Regular)',
                        '90': '90 (Premium)',
                        'ado': 'ADO (Diesel)',
                        'ulsd': 'ULSD (Ultra Low Sulfur)'
                    }.get(fuel, fuel)
                    
                    report += f"**{fuel_name}:**\n"
                    report += f"Sold: {data['litres_sold']:,.0f}L @ ${data['avg_price']:.2f}/L\n"
                    report += f"Cost: ${data['cost']:.2f}/L\n"
                    report += f"Margin: ${data['margin_per_litre']:.2f}/L ({data['margin_pct']:.1f}%)\n"
                    report += f"**Profit: JMD ${data['total_profit']:,.0f}**\n\n"
            
            report += f"📊 **TOTAL GAS PROFIT:** JMD ${margins.get('total_profit', 0):,.0f}\n"
            report += f"Average Margin: {margins.get('avg_margin_pct', 0):.1f}%\n\n"
            
            if margins.get('avg_margin_pct', 0) < 8:
                report += "⚠️ Margin below 8% target - review costs or prices"
            else:
                report += "✅ Margins healthy"
            
            report += "\n\n💡 Use /profit for full profit report with actual delivery costs"
            
            await update.message.reply_text(report, parse_mode='Markdown')
            
        except Exception as e:
            await update.message.reply_text(f"❌ Error: {str(e)}")
    
    async def competitor_prices(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Show competitor price comparison"""
        if not self.is_authorized(update):
            return
        
        await update.message.reply_text("🏁 Checking competitor prices...")
        
        try:
            worksheet = self.agent.sheet.worksheet("Daily_Report")
            all_data = worksheet.get_all_records()
            
            latest = all_data[-1] if all_data else {}
            competitor_data_str = latest.get('Competitor_Prices', '')
            
            if not competitor_data_str:
                await update.message.reply_text("No competitor prices found in recent data.\n\nMake sure staff includes competitor prices in their daily WhatsApp report.")
                return
            
            try:
                competitor_data = json.loads(competitor_data_str)
            except:
                await update.message.reply_text("Error parsing competitor data.")
                return
            
            if not competitor_data:
                await update.message.reply_text("No competitor prices available.")
                return
            
            def safe_float(val):
                if not val or val == '':
                    return 0
                try:
                    return float(str(val).replace(',', '').replace('$', '').strip())
                except:
                    return 0
            
            our_prices = {
                '87': safe_float(latest.get('GasMart_87_Price', 0)),
                '90': safe_float(latest.get('GasMart_90_Price', 0)),
                'ado': safe_float(latest.get('GasMart_ADO_Price', 0)),
                'ulsd': safe_float(latest.get('GasMart_ULSD_Price', 0))
            }
            
            report = "**🏁 COMPETITOR PRICE COMPARISON**\n\n"
            
            for comp in competitor_data:
                competitor_name = comp.get('competitor', 'Unknown')
                report += f"**{competitor_name}:**\n"
                
                for fuel_key in ['fuel_87', 'fuel_90', 'fuel_ado', 'fuel_ulsd']:
                    if fuel_key in comp:
                        their_price = comp[fuel_key]
                        fuel_type = fuel_key.replace('fuel_', '')
                        our_price = our_prices.get(fuel_type, 0)
                        
                        fuel_label = {
                            '87': '87 (Regular)',
                            '90': '90 (Premium)',
                            'ado': 'ADO (Diesel)',
                            'ulsd': 'ULSD'
                        }.get(fuel_type, fuel_type)
                        
                        if our_price > 0:
                            diff = our_price - their_price
                            if diff < -0.5:
                                status = "cheaper ✅"
                            elif diff > 0.5:
                                status = "MORE expensive ⚠️"
                            else:
                                status = "~same"
                            
                            report += f"  {fuel_label}: ${their_price:.2f} (we're ${our_price:.2f}, {status})\n"
                        else:
                            report += f"  {fuel_label}: ${their_price:.2f}\n"
                
                report += "\n"
            
            report += "💡 **Tip:** Use /gas to see our current volume by fuel type"
            
            await update.message.reply_text(report, parse_mode='Markdown')
            
        except Exception as e:
            await update.message.reply_text(f"❌ Error: {str(e)}")
    
    async def set_fuel_cost(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Set fuel cost - Usage: /setcost 87 160.00"""
        if not self.is_authorized(update):
            return
        
        try:
            if len(context.args) != 2:
                await update.message.reply_text(
                    "Usage: /setcost <fuel> <cost>\n"
                    "Example: /setcost 87 160.00\n\n"
                    "Fuel types: 87, 90, ado, ulsd\n\n"
                    "💡 Better: Include cost in delivery report!\n"
                    "e.g. \"Tanker arrived: 87 - 15000L @ $158/L\""
                )
                return
            
            fuel_type = context.args[0].lower()
            new_cost = float(context.args[1])
            
            success = self.features.update_fuel_cost(fuel_type, new_cost)
            
            if success:
                await update.message.reply_text(
                    f"✅ Updated {fuel_type.upper()} default cost to ${new_cost:.2f}/L\n\n"
                    "Use /profit to see updated profit analysis."
                )
            else:
                await update.message.reply_text(f"❌ Invalid fuel type: {fuel_type}")
            
        except ValueError:
            await update.message.reply_text("❌ Invalid cost value. Use format: /setcost 87 160.00")
        except Exception as e:
            await update.message.reply_text(f"❌ Error: {str(e)}")
    
    async def morning_alert(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Show morning status alert"""
        if not self.is_authorized(update):
            return
        
        try:
            worksheet = self.agent.sheet.worksheet("Daily_Report")
            all_data = worksheet.get_all_records()
            
            alert = self.features.generate_morning_alert(all_data)
            
            await update.message.reply_text(alert, parse_mode='Markdown')
            
        except Exception as e:
            await update.message.reply_text(f"❌ Error: {str(e)}")
    
    async def shrinkage_analysis(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Analyse fuel shrinkage: opening - sold - closing = gap"""
        if not self.is_authorized(update):
            return
        
        try:
            worksheet = self.agent.sheet.worksheet("Daily_Report")
            all_data = worksheet.get_all_records()
            
            if not all_data:
                await update.message.reply_text("📦 No data yet.")
                return
            
            def sf(val):
                if not val or val == '':
                    return None
                try:
                    return float(str(val).replace(',','').replace('$','').strip())
                except:
                    return None
            
            fuels = [
                ("87 (Regular)",  "Opening_87_Litres",  "Gas_87_Litres",  "Closing_87_Litres",  "Delivery_87_Litres"),
                ("90 (Premium)",  "Opening_90_Litres",  "Gas_90_Litres",  "Closing_90_Litres",  "Delivery_90_Litres"),
                ("ADO (Diesel)",  "Opening_ADO_Litres", "Gas_ADO_Litres", "Closing_ADO_Litres", "Delivery_ADO_Litres"),
                ("ULSD",          "Opening_ULSD_Litres","Gas_ULSD_Litres","Closing_ULSD_Litres","Delivery_ULSD_Litres"),
            ]
            
            # Find rows that have BOTH opening and closing dips
            days_with_full = []
            for row in all_data:
                has_opening  = any(sf(row.get(f[1])) for f in fuels)
                has_closing  = any(sf(row.get(f[3])) for f in fuels)
                if has_opening and has_closing:
                    days_with_full.append(row)
            
            if not days_with_full:
                await update.message.reply_text(
                    "📊 *Shrinkage Analysis*\n\n"
                    "No days with both opening AND closing dips yet.\n\n"
                    "Once staff sends closing dips to the bot, "
                    "shrinkage will be calculated automatically.\n\n"
                    "Formula per fuel:\n"
                    "`Expected closing = Opening + Deliveries - Litres Sold`\n"
                    "`Shrinkage = Expected closing - Actual closing`",
                    parse_mode='Markdown'
                )
                return
            
            # Calculate shrinkage per fuel
            msg = "📊 *Shrinkage Analysis*\n"
            msg += f"_(based on {len(days_with_full)} day(s) with full data)_\n"
            
            total_shrinkage_litres = 0
            total_shrinkage_value  = 0
            fuel_costs = {
                "87 (Regular)": float(os.getenv('COST_87', '160')),
                "90 (Premium)": float(os.getenv('COST_90', '170')),
                "ADO (Diesel)": float(os.getenv('COST_ADO', '175')),
                "ULSD":         float(os.getenv('COST_ULSD','180')),
            }
            
            for label, o_key, s_key, c_key, d_key in fuels:
                fuel_shrinkage = 0
                fuel_days = 0
                
                for row in days_with_full:
                    opening   = sf(row.get(o_key)) or 0
                    sold      = sf(row.get(s_key)) or 0
                    closing   = sf(row.get(c_key)) or 0
                    delivery  = sf(row.get(d_key)) or 0
                    
                    if opening == 0 and closing == 0:
                        continue
                    
                    expected_closing = opening + delivery - sold
                    shrinkage        = expected_closing - closing
                    fuel_shrinkage  += shrinkage
                    fuel_days       += 1
                
                if fuel_days == 0:
                    continue
                
                avg_shrinkage = fuel_shrinkage / fuel_days
                cost          = fuel_costs.get(label, 0)
                value         = fuel_shrinkage * cost
                
                total_shrinkage_litres += fuel_shrinkage
                total_shrinkage_value  += value
                
                if abs(avg_shrinkage) > 50:
                    flag = "🔴"
                elif abs(avg_shrinkage) > 10:
                    flag = "🟡"
                else:
                    flag = "🟢"
                
                msg += f"\n{flag} *{label}*\n"
                msg += f"   Total shrinkage: {fuel_shrinkage:+.0f}L over {fuel_days} day(s)\n"
                msg += f"   Avg/day: {avg_shrinkage:+.1f}L  |  Est. cost: ${value:,.0f}"
            
            msg += f"\n\n{'─'*30}\n"
            msg += f"📉 *Total shrinkage: {total_shrinkage_litres:+.0f}L*\n"
            msg += f"💰 *Estimated cost: ${total_shrinkage_value:,.0f}*\n"
            
            if abs(total_shrinkage_litres) > 100:
                msg += "\n⚠️ Shrinkage is elevated — worth investigating.\n"
            else:
                msg += "\n✅ Shrinkage looks normal.\n"
            
            msg += "\n_Legend: 🟢 <10L/day  🟡 10–50L/day  🔴 >50L/day_"
            
            await update.message.reply_text(msg, parse_mode='Markdown')
            
        except Exception as e:
            await update.message.reply_text(f"❌ Error: {str(e)}")
    
    async def help_command(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Show all available commands"""
        help_text = """**📱 SUPERPLUS AI AGENT v2 COMMANDS**

**📊 Status & Analysis:**
/status - Current week summary
/compare - vs last week
/forecast - Tomorrow's projection
/gas - Gas station details
/morning - Morning briefing

**💰 Profit & Margins:**
/profit - **Weekly profit report** ⭐
/margins - Margin analysis
/setcost - Update default fuel costs
Example: /setcost 87 160.00

**📦 Inventory:**
/dips - Inventory levels & alerts
/shrinkage - Fuel loss detection

**🏁 Competition:**
/competitors - Competitor prices

**❓ Help:**
/help - This message

**Natural Language:**
Just ask! "How are we doing?" or "What's our profit?"

**💡 NEW: Delivery Cost Tracking**
Staff can now report delivery costs:
"Tanker arrived: 87 - 15000L @ $158/L"
This gives you accurate profit margins!
"""
        
        await update.message.reply_text(help_text, parse_mode='Markdown')
    
    async def handle_message(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle natural language queries"""
        if not self.is_authorized(update):
            return
        
        message = update.message.text.lower()
        
        # Detect intent
        if any(word in message for word in ['profit', 'making money', 'earning']):
            await self.profit_report(update, context)
        elif any(word in message for word in ['status', 'how', 'doing', 'update']):
            await self.status(update, context)
        elif any(word in message for word in ['compare', 'vs', 'versus', 'last week']):
            await self.compare(update, context)
        elif any(word in message for word in ['forecast', 'predict', 'tomorrow', 'expect']):
            await self.forecast(update, context)
        elif 'gas' in message:
            await self.gas_analysis(update, context)
        elif any(word in message for word in ['inventory', 'dips', 'stock']):
            await self.inventory_status(update, context)
        elif any(word in message for word in ['shrinkage', 'loss', 'shrink', 'losing']):
            await self.shrinkage_analysis(update, context)
        elif any(word in message for word in ['margin']):
            await self.margin_analysis(update, context)
        elif any(word in message for word in ['competitor', 'competition', 'prices']):
            await self.competitor_prices(update, context)
        else:
            await update.message.reply_text(
                "I didn't understand that. Try:\n"
                "• /profit - Weekly profit report ⭐\n"
                "• /status - Current week\n"
                "• /margins - Margin analysis\n"
                "• /dips - Inventory\n"
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
        
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        try:
            application = Application.builder().token(self.bot_token).build()
            
            # Add ALL command handlers
            application.add_handler(CommandHandler("start", self.start))
            application.add_handler(CommandHandler("status", self.status))
            application.add_handler(CommandHandler("compare", self.compare))
            application.add_handler(CommandHandler("forecast", self.forecast))
            application.add_handler(CommandHandler("gas", self.gas_analysis))
            
            # Profit & margins
            application.add_handler(CommandHandler("profit", self.profit_report))
            application.add_handler(CommandHandler("margins", self.margin_analysis))
            application.add_handler(CommandHandler("setcost", self.set_fuel_cost))
            
            # Inventory
            application.add_handler(CommandHandler("dips", self.inventory_status))
            application.add_handler(CommandHandler("shrinkage", self.shrinkage_analysis))
            
            # Competition
            application.add_handler(CommandHandler("competitors", self.competitor_prices))
            
            # Other
            application.add_handler(CommandHandler("morning", self.morning_alert))
            application.add_handler(CommandHandler("help", self.help_command))
            
            # Natural language
            application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, self.handle_message))
            
            print("🤖 Telegram bot started (v2 with profit reports)!")
            
            loop.run_until_complete(application.initialize())
            loop.run_until_complete(application.start())
            loop.run_until_complete(application.updater.start_polling())
            
            loop.run_forever()
            
        except Exception as e:
            print(f"❌ Telegram bot error: {e}")
        finally:
            loop.close()


def initialize_telegram_bot(agent):
    """Initialize Telegram bot with agent reference"""
    bot = TelegramBot(agent)
    
    import threading
    bot_thread = threading.Thread(target=bot.run, daemon=True)
    bot_thread.start()
    
    return bot
