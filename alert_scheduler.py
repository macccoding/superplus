"""
SuperPlus AI Agent - Alert Scheduler
Proactive daily intelligence: morning briefings, evening summaries, smart alerts
"""

import os
from datetime import datetime, timedelta
from typing import Dict, List
import json


class AlertScheduler:
    """
    Manages all scheduled alerts and proactive notifications
    """
    
    def __init__(self, agent):
        self.agent = agent
        
        # Telegram for alerts
        self.telegram_chat_id = os.getenv('TELEGRAM_CHAT_ID')
        
        # Alert settings
        self.inventory_warning_days = float(os.getenv('INVENTORY_WARNING_DAYS', '2.5'))
        self.inventory_urgent_days = float(os.getenv('INVENTORY_URGENT_DAYS', '1.5'))
        
        # Track what we've alerted on (to avoid spam)
        self.alerts_sent_today = set()
        
        print("📅 Alert Scheduler initialized")
    
    # ============================================
    # MORNING BRIEFING (8:00 AM)
    # ============================================
    
    def send_morning_briefing(self):
        """Send morning briefing at 8:00 AM"""
        try:
            print("\n☀️ Generating morning briefing...")
            
            # Get data
            worksheet = self.agent.sheet.worksheet("Daily_Report")
            all_data = worksheet.get_all_records()
            
            if not all_data:
                print("⚠️ No data available for morning briefing")
                return
            
            # Generate briefing
            briefing = self._generate_morning_briefing(all_data)
            
            # Send via Telegram
            self._send_telegram_message(briefing)
            
            print("✅ Morning briefing sent")
            
        except Exception as e:
            print(f"❌ Error sending morning briefing: {e}")
            import traceback
            traceback.print_exc()
    
    def _generate_morning_briefing(self, all_data: List[Dict]) -> str:
        """Generate detailed morning briefing"""
        try:
            def safe_float(val):
                if not val or val == '':
                    return 0
                try:
                    return float(str(val).replace(',', '').replace('$', '').strip())
                except:
                    return 0
            
            # Yesterday's data
            yesterday = all_data[-1] if all_data else {}
            yesterday_revenue = safe_float(yesterday.get('Total_Revenue', 0))
            yesterday_date = yesterday.get('Date', 'Unknown')
            
            # This week so far
            this_week = all_data[-7:] if len(all_data) >= 7 else all_data
            week_revenue = sum([safe_float(row.get('Total_Revenue', 0)) for row in this_week])
            days_so_far = len(this_week)
            avg_daily = week_revenue / days_so_far if days_so_far > 0 else 0
            
            # Week projection
            days_remaining = 7 - days_so_far
            projected_week = week_revenue + (avg_daily * days_remaining)
            
            # Last week comparison
            last_week = all_data[-14:-7] if len(all_data) >= 14 else []
            last_week_revenue = sum([safe_float(row.get('Total_Revenue', 0)) for row in last_week]) if last_week else 0
            week_trend = ((week_revenue - last_week_revenue) / last_week_revenue * 100) if last_week_revenue > 0 else 0
            
            # Check inventory
            inventory_alerts = self._check_inventory_alerts(all_data)
            
            # Check competitor changes
            competitor_alerts = self._check_competitor_changes(all_data)
            
            # Build briefing
            briefing = f"""☀️ **GOOD MORNING!**
{datetime.now().strftime('%A, %B %d, %Y')}

**YESTERDAY** ({yesterday_date}):
Revenue: JMD ${yesterday_revenue:,.0f}
Status: {"Strong day ✅" if yesterday_revenue > avg_daily else "Below average ⚠️" if yesterday_revenue < avg_daily * 0.9 else "On track"}

**THIS WEEK SO FAR:**
Total: JMD ${week_revenue:,.0f} ({days_so_far} days)
Daily Avg: JMD ${avg_daily:,.0f}
Projected: JMD ${projected_week:,.0f}
vs Last Week: {week_trend:+.1f}%"""

            # Add alerts section if there are any
            alerts = []
            
            if inventory_alerts:
                alerts.extend(inventory_alerts)
            
            if competitor_alerts:
                alerts.extend(competitor_alerts)
            
            if alerts:
                briefing += "\n\n**🚨 ALERTS:**"
                for alert in alerts[:5]:  # Max 5 alerts
                    briefing += f"\n{alert}"
            
            # Today's goal
            target = avg_daily * 1.03  # 3% above average
            briefing += f"\n\n**TODAY'S TARGET:** JMD ${target:,.0f}"
            
            # Motivational close
            if week_trend > 5:
                briefing += "\n\n💪 Great week so far - keep it up!"
            elif week_trend < -5:
                briefing += "\n\n📈 Let's turn it around today!"
            else:
                briefing += "\n\n✅ Solid week - stay focused!"
            
            return briefing
            
        except Exception as e:
            print(f"❌ Error generating briefing: {e}")
            return "☀️ Good morning! Unable to generate full briefing."
    
    def _generate_short_morning_briefing(self, all_data: List[Dict]) -> str:
        """Generate short version for WhatsApp"""
        try:
            def safe_float(val):
                if not val or val == '':
                    return 0
                try:
                    return float(str(val).replace(',', '').replace('$', '').strip())
                except:
                    return 0
            
            yesterday = all_data[-1] if all_data else {}
            yesterday_revenue = safe_float(yesterday.get('Total_Revenue', 0))
            
            this_week = all_data[-7:] if len(all_data) >= 7 else all_data
            week_revenue = sum([safe_float(row.get('Total_Revenue', 0)) for row in this_week])
            
            inventory_alerts = self._check_inventory_alerts(all_data)
            urgent_count = len([a for a in inventory_alerts if '🚨' in a])
            
            briefing = f"""☀️ GOOD MORNING!

Yesterday: ${yesterday_revenue/1000:.0f}K
Week so far: ${week_revenue/1000:.0f}K"""
            
            if urgent_count > 0:
                briefing += f"\n\n🚨 {urgent_count} URGENT alert(s) - check Telegram"
            
            return briefing
            
        except:
            return "☀️ Good morning!"
    
    # ============================================
    # EVENING SUMMARY (10:00 PM)
    # ============================================
    
    def send_evening_summary(self):
        """Send evening summary at 10:00 PM"""
        try:
            print("\n🌙 Generating evening summary...")
            
            worksheet = self.agent.sheet.worksheet("Daily_Report")
            all_data = worksheet.get_all_records()
            
            if not all_data:
                print("⚠️ No data available for evening summary")
                return
            
            # Generate summary
            summary = self._generate_evening_summary(all_data)
            
            # Send via Telegram
            self._send_telegram_message(summary)
            
            print("✅ Evening summary sent")
            
            # Reset daily alerts
            self.alerts_sent_today = set()
            
        except Exception as e:
            print(f"❌ Error sending evening summary: {e}")
            import traceback
            traceback.print_exc()
    
    def _generate_evening_summary(self, all_data: List[Dict]) -> str:
        """Generate detailed evening summary"""
        try:
            def safe_float(val):
                if not val or val == '':
                    return 0
                try:
                    return float(str(val).replace(',', '').replace('$', '').strip())
                except:
                    return 0
            
            # Today's data
            today = all_data[-1] if all_data else {}
            today_revenue = safe_float(today.get('Total_Revenue', 0))
            today_gas = safe_float(today.get('Gas_Revenue_Est', 0))
            today_store = safe_float(today.get('Store_Sales', 0))
            today_deli = safe_float(today.get('Deli_Sales', 0))
            today_phone = safe_float(today.get('Phone_Cards', 0))
            today_litres = safe_float(today.get('Total_Litres', 0))
            
            # Calculate goal (avg * 1.03)
            this_week = all_data[-7:] if len(all_data) >= 7 else all_data
            week_revenue = sum([safe_float(row.get('Total_Revenue', 0)) for row in this_week])
            avg_daily = week_revenue / len(this_week) if this_week else 0
            goal = avg_daily * 1.03
            
            vs_goal = ((today_revenue - goal) / goal * 100) if goal > 0 else 0
            
            # Last week same day
            same_day_last_week = all_data[-8] if len(all_data) >= 8 else {}
            last_week_same_day_revenue = safe_float(same_day_last_week.get('Total_Revenue', 0))
            vs_last_week = ((today_revenue - last_week_same_day_revenue) / last_week_same_day_revenue * 100) if last_week_same_day_revenue > 0 else 0
            
            summary = f"""🌙 **END OF DAY SUMMARY**
{datetime.now().strftime('%A, %B %d, %Y')}

**TODAY:**
Total Revenue: JMD ${today_revenue:,.0f}
vs Goal: JMD ${goal:,.0f} ({vs_goal:+.1f}% {"🎉" if vs_goal > 0 else "📉"})
vs Last Week: {vs_last_week:+.1f}%

**BREAKDOWN:**
⛽ Gas: ${today_gas:,.0f} ({today_litres:,.0f}L)
🏪 Store: ${today_store:,.0f}
🍽️ Deli: ${today_deli:,.0f}
💳 Phone: ${today_phone:,.0f}"""

            # Performance assessment
            if vs_goal > 5:
                summary += "\n\n🌟 **Excellent day!** Well above target"
            elif vs_goal > 0:
                summary += "\n\n✅ **Good day!** Hit the target"
            elif vs_goal > -5:
                summary += "\n\n📊 **Solid day** - close to target"
            else:
                summary += "\n\n⚠️ **Below target** - review tomorrow's plan"
            
            # Check what needs attention tomorrow
            inventory_alerts = self._check_inventory_alerts(all_data)
            if inventory_alerts:
                summary += "\n\n**TOMORROW'S PREP:**"
                for alert in inventory_alerts[:3]:
                    summary += f"\n{alert}"
            
            summary += "\n\nGood night! 🌟"
            
            return summary
            
        except Exception as e:
            print(f"❌ Error generating summary: {e}")
            return "🌙 Good night!"
    
    def _generate_short_evening_summary(self, all_data: List[Dict]) -> str:
        """Short version for WhatsApp"""
        try:
            def safe_float(val):
                if not val or val == '':
                    return 0
                try:
                    return float(str(val).replace(',', '').replace('$', '').strip())
                except:
                    return 0
            
            today = all_data[-1] if all_data else {}
            today_revenue = safe_float(today.get('Total_Revenue', 0))
            
            this_week = all_data[-7:] if len(all_data) >= 7 else all_data
            week_revenue = sum([safe_float(row.get('Total_Revenue', 0)) for row in this_week])
            avg_daily = week_revenue / len(this_week) if this_week else 0
            goal = avg_daily * 1.03
            vs_goal = ((today_revenue - goal) / goal * 100) if goal > 0 else 0
            
            return f"""🌙 END OF DAY

Today: ${today_revenue/1000:.0f}K
vs Goal: {vs_goal:+.1f}% {"🎉" if vs_goal > 0 else "📉"}

Good night! 🌟"""
            
        except:
            return "🌙 Good night!"
    
    # ============================================
    # SMART ALERTS
    # ============================================
    
    def _check_inventory_alerts(self, all_data: List[Dict]) -> List[str]:
        """Check inventory levels and generate alerts"""
        alerts = []
        
        try:
            def safe_float(val):
                if not val or val == '':
                    return 0
                try:
                    return float(str(val).replace(',', '').replace('$', '').strip())
                except:
                    return 0
            
            # Get latest opening dips
            latest = all_data[-1] if all_data else {}
            
            opening_87 = safe_float(latest.get('Opening_87_Litres', 0))
            opening_90 = safe_float(latest.get('Opening_90_Litres', 0))
            opening_ado = safe_float(latest.get('Opening_ADO_Litres', 0))
            opening_ulsd = safe_float(latest.get('Opening_ULSD_Litres', 0))
            
            # Calculate average daily consumption
            recent = all_data[-7:] if len(all_data) >= 7 else all_data
            
            avg_87 = sum([safe_float(row.get('Gas_87_Litres', 0)) for row in recent]) / len(recent) if recent else 0
            avg_90 = sum([safe_float(row.get('Gas_90_Litres', 0)) for row in recent]) / len(recent) if recent else 0
            avg_ado = sum([safe_float(row.get('Gas_ADO_Litres', 0)) for row in recent]) / len(recent) if recent else 0
            avg_ulsd = sum([safe_float(row.get('Gas_ULSD_Litres', 0)) for row in recent]) / len(recent) if recent else 0
            
            # Check each fuel
            fuels = {
                '87 (Regular)': (opening_87, avg_87),
                '90 (Premium)': (opening_90, avg_90),
                'ADO (Diesel)': (opening_ado, avg_ado),
                'ULSD': (opening_ulsd, avg_ulsd)
            }
            
            for fuel_name, (opening, avg_daily) in fuels.items():
                if opening > 0 and avg_daily > 0:
                    days_remaining = opening / avg_daily
                    
                    if days_remaining < self.inventory_urgent_days:
                        alerts.append(f"🚨 {fuel_name}: {days_remaining:.1f} days left - ORDER NOW")
                    elif days_remaining < self.inventory_warning_days:
                        alerts.append(f"⚠️ {fuel_name}: {days_remaining:.1f} days left - order soon")
            
        except Exception as e:
            print(f"❌ Error checking inventory: {e}")
        
        return alerts
    
    def _check_competitor_changes(self, all_data: List[Dict]) -> List[str]:
        """Check for competitor price changes"""
        alerts = []
        
        try:
            if len(all_data) < 2:
                return alerts
            
            # Compare today vs yesterday
            today = all_data[-1]
            yesterday = all_data[-2]
            
            today_comp = today.get('Competitor_Prices', '')
            yesterday_comp = yesterday.get('Competitor_Prices', '')
            
            if not today_comp or not yesterday_comp:
                return alerts
            
            try:
                today_data = json.loads(today_comp)
                yesterday_data = json.loads(yesterday_comp)
            except:
                return alerts
            
            # Compare each competitor
            for today_competitor in today_data:
                comp_name = today_competitor.get('competitor', '')
                
                # Find same competitor yesterday
                yesterday_competitor = next(
                    (c for c in yesterday_data if c.get('competitor') == comp_name),
                    None
                )
                
                if not yesterday_competitor:
                    continue
                
                # Check each fuel type
                for fuel_key in ['fuel_87', 'fuel_90', 'fuel_ado', 'fuel_ulsd']:
                    if fuel_key in today_competitor and fuel_key in yesterday_competitor:
                        today_price = today_competitor[fuel_key]
                        yesterday_price = yesterday_competitor[fuel_key]
                        
                        diff = today_price - yesterday_price
                        
                        if abs(diff) >= 1.0:  # Alert if change >= $1
                            fuel_label = fuel_key.replace('fuel_', '').upper()
                            direction = "lowered" if diff < 0 else "raised"
                            alerts.append(f"🏁 {comp_name} {direction} {fuel_label} price to ${today_price:.2f} ({diff:+.2f})")
            
        except Exception as e:
            print(f"❌ Error checking competitors: {e}")
        
        return alerts
    
    def send_inventory_alert(self):
        """Check inventory and send alert if needed (runs after morning dips received)"""
        try:
            worksheet = self.agent.sheet.worksheet("Daily_Report")
            all_data = worksheet.get_all_records()
            
            alerts = self._check_inventory_alerts(all_data)
            
            if alerts:
                urgent = [a for a in alerts if '🚨' in a]
                warnings = [a for a in alerts if '⚠️' in a]
                
                if urgent:
                    message = "🚨 **URGENT INVENTORY ALERT**\n\n" + "\n".join(urgent)
                    if warnings:
                        message += "\n\n" + "\n".join(warnings)
                    
                    self._send_telegram_message(message)
                    print(f"✅ Sent {len(urgent)} urgent inventory alerts")
                
        except Exception as e:
            print(f"❌ Error sending inventory alert: {e}")
    
    # ============================================
    # MESSAGE SENDING
    # ============================================
    
    def _send_telegram_message(self, message: str):
        """Send message via Telegram"""
        try:
            if not self.telegram_chat_id:
                print("⚠️ TELEGRAM_CHAT_ID not set - can't send Telegram message")
                return
            
            # Use Telegram bot API
            import requests
            bot_token = os.getenv('TELEGRAM_BOT_TOKEN')
            
            if not bot_token:
                print("⚠️ TELEGRAM_BOT_TOKEN not set")
                return
            
            url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
            
            data = {
                'chat_id': self.telegram_chat_id,
                'text': message,
                'parse_mode': 'Markdown'
            }
            
            response = requests.post(url, json=data)
            
            if response.status_code == 200:
                print("✅ Telegram message sent")
            else:
                print(f"⚠️ Telegram send failed: {response.status_code}")
                
        except Exception as e:
            print(f"❌ Error sending Telegram: {e}")
    
