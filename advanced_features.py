"""
SuperPlus AI Agent - Advanced Features
Morning Dips, Profit Margins, Competitor Tracking, Smart Alerts
"""

import os
from datetime import datetime, timedelta
from typing import Dict, List
import json

class AdvancedFeatures:
    """
    Advanced business intelligence features
    """
    
    def __init__(self, agent):
        self.agent = agent
        self.load_cost_data()
        self.load_competitor_data()
    
    def load_cost_data(self):
        """Load fuel cost data from environment or defaults"""
        self.fuel_costs = {
            '87': float(os.getenv('COST_87', '160.00')),
            '90': float(os.getenv('COST_90', '170.00')),
            'ado': float(os.getenv('COST_ADO', '175.00')),
            'ulsd': float(os.getenv('COST_ULSD', '180.00'))
        }
        print(f"💰 Loaded fuel costs: 87=${self.fuel_costs['87']}, 90=${self.fuel_costs['90']}, ADO=${self.fuel_costs['ado']}, ULSD=${self.fuel_costs['ulsd']}")
    
    def load_competitor_data(self):
        """Load competitor tracking data"""
        self.competitors = {}
        # Will be populated from sheet data
    
    # ============================================
    # FEATURE 1: MORNING DIPS TRACKING
    # ============================================
    
    def calculate_inventory_status(self, sheet_data: List[Dict]) -> Dict:
        """Calculate current inventory status and days remaining"""
        try:
            def safe_float(val):
                if not val or val == '':
                    return 0
                try:
                    return float(str(val).replace(',', '').replace('$', '').strip())
                except:
                    return 0
            
            # Get most recent opening dips
            latest = sheet_data[-1] if sheet_data else {}
            
            opening_87 = safe_float(latest.get('Opening_87_Litres', 0))
            opening_90 = safe_float(latest.get('Opening_90_Litres', 0))
            opening_ado = safe_float(latest.get('Opening_ADO_Litres', 0))
            opening_ulsd = safe_float(latest.get('Opening_ULSD_Litres', 0))
            
            # Calculate average daily consumption (last 7 days)
            recent_week = sheet_data[-7:] if len(sheet_data) >= 7 else sheet_data
            
            avg_87 = sum([safe_float(row.get('Gas_87_Litres', 0)) for row in recent_week]) / len(recent_week) if recent_week else 0
            avg_90 = sum([safe_float(row.get('Gas_90_Litres', 0)) for row in recent_week]) / len(recent_week) if recent_week else 0
            avg_ado = sum([safe_float(row.get('Gas_ADO_Litres', 0)) for row in recent_week]) / len(recent_week) if recent_week else 0
            avg_ulsd = sum([safe_float(row.get('Gas_ULSD_Litres', 0)) for row in recent_week]) / len(recent_week) if recent_week else 0
            
            # Calculate days remaining
            days_87 = opening_87 / avg_87 if avg_87 > 0 else 999
            days_90 = opening_90 / avg_90 if avg_90 > 0 else 999
            days_ado = opening_ado / avg_ado if avg_ado > 0 else 999
            days_ulsd = opening_ulsd / avg_ulsd if avg_ulsd > 0 else 999
            
            return {
                '87': {'opening': opening_87, 'avg_daily': avg_87, 'days_remaining': days_87},
                '90': {'opening': opening_90, 'avg_daily': avg_90, 'days_remaining': days_90},
                'ado': {'opening': opening_ado, 'avg_daily': avg_ado, 'days_remaining': days_ado},
                'ulsd': {'opening': opening_ulsd, 'avg_daily': avg_ulsd, 'days_remaining': days_ulsd}
            }
            
        except Exception as e:
            print(f"❌ Error calculating inventory: {e}")
            return {}
    
    def check_inventory_alerts(self, inventory_status: Dict) -> List[str]:
        """Check for inventory alerts"""
        alerts = []
        
        for fuel, data in inventory_status.items():
            days = data['days_remaining']
            opening = data['opening']
            avg_daily = data['avg_daily']
            
            fuel_name = {
                '87': 'Gas 87 (Regular)',
                '90': 'Gas 90 (Premium)',
                'ado': 'ADO (Diesel)',
                'ulsd': 'ULSD (Ultra Low Sulfur)'
            }.get(fuel, fuel)
            
            if days < 1.5:
                alerts.append({
                    'level': 'URGENT',
                    'fuel': fuel_name,
                    'opening': opening,
                    'avg_daily': avg_daily,
                    'days_remaining': days,
                    'message': f"🚨 URGENT: {fuel_name} critically low - {days:.1f} days remaining"
                })
            elif days < 2.5:
                alerts.append({
                    'level': 'WARNING',
                    'fuel': fuel_name,
                    'opening': opening,
                    'avg_daily': avg_daily,
                    'days_remaining': days,
                    'message': f"⚠️ WARNING: {fuel_name} running low - {days:.1f} days remaining"
                })
        
        return alerts
    
    # ============================================
    # FEATURE 2: PROFIT MARGIN TRACKING
    # ============================================
    
    def calculate_margins(self, sheet_data: List[Dict]) -> Dict:
        """Calculate profit margins for all fuel types"""
        try:
            def safe_float(val):
                if not val or val == '':
                    return 0
                try:
                    return float(str(val).replace(',', '').replace('$', '').strip())
                except:
                    return 0
            
            # Get last 7 days
            recent = sheet_data[-7:] if len(sheet_data) >= 7 else sheet_data
            
            margins = {}
            total_profit = 0
            
            for fuel_type in ['87', '90', 'ado', 'ulsd']:
                # Sum litres sold
                litres_key = f'Gas_{fuel_type.upper()}_Litres' if fuel_type in ['87', '90'] else f'Gas_{fuel_type.upper()}_Litres'
                price_key = f'GasMart_{fuel_type.upper()}_Price' if fuel_type in ['87', '90'] else f'GasMart_{fuel_type.upper()}_Price'
                
                total_litres = sum([safe_float(row.get(litres_key, 0)) for row in recent])
                
                # Get average price
                prices = [safe_float(row.get(price_key, 0)) for row in recent if row.get(price_key)]
                avg_price = sum(prices) / len(prices) if prices else 0
                
                # Get cost
                cost = self.fuel_costs.get(fuel_type.lower(), 0)
                
                # Calculate margin
                margin_per_litre = avg_price - cost
                margin_pct = (margin_per_litre / avg_price * 100) if avg_price > 0 else 0
                total_margin = margin_per_litre * total_litres
                
                margins[fuel_type] = {
                    'litres_sold': total_litres,
                    'avg_price': avg_price,
                    'cost': cost,
                    'margin_per_litre': margin_per_litre,
                    'margin_pct': margin_pct,
                    'total_profit': total_margin
                }
                
                total_profit += total_margin
            
            margins['total_profit'] = total_profit
            margins['avg_margin_pct'] = sum([m['margin_pct'] for m in margins.values() if isinstance(m, dict)]) / 4
            
            return margins
            
        except Exception as e:
            print(f"❌ Error calculating margins: {e}")
            return {}
    
    def update_fuel_cost(self, fuel_type: str, new_cost: float):
        """Update fuel cost"""
        fuel_type = fuel_type.lower()
        if fuel_type in self.fuel_costs:
            old_cost = self.fuel_costs[fuel_type]
            self.fuel_costs[fuel_type] = new_cost
            
            # TODO: Save to persistent storage or sheet
            print(f"💰 Updated {fuel_type.upper()} cost: ${old_cost:.2f} → ${new_cost:.2f}")
            return True
        return False
    
    # ============================================
    # FEATURE 3: COMPETITOR PRICE MONITORING
    # ============================================
    
    def extract_competitor_prices(self, message_text: str) -> Dict:
        """Extract competitor prices from message"""
        try:
            import re
            
            competitors = {}
            
            # Common competitor names
            competitor_names = ['jamgas', 'total', 'greenvale', 'yaadman', 'spur tree', 'rubis']
            
            lines = message_text.lower().split('\n')
            
            for line in lines:
                for comp in competitor_names:
                    if comp in line:
                        # Extract prices (e.g., "87-172" or "87: 172")
                        prices = {}
                        
                        # Pattern: 87-172, 90-182
                        matches = re.findall(r'(\d{2,3})[:-]\s*(\d{3})', line)
                        for fuel, price in matches:
                            prices[fuel] = float(price)
                        
                        if prices:
                            competitors[comp.title()] = prices
            
            return competitors
            
        except Exception as e:
            print(f"❌ Error extracting competitor prices: {e}")
            return {}
    
    def compare_competitor_prices(self, our_prices: Dict, competitor_prices: Dict) -> List[Dict]:
        """Compare our prices to competitors"""
        comparisons = []
        
        for competitor, their_prices in competitor_prices.items():
            for fuel, their_price in their_prices.items():
                our_price = our_prices.get(fuel, 0)
                
                if our_price > 0:
                    difference = our_price - their_price
                    pct_diff = (difference / their_price * 100)
                    
                    status = 'cheaper' if difference < 0 else 'more_expensive' if difference > 0 else 'same'
                    
                    comparisons.append({
                        'competitor': competitor,
                        'fuel': fuel,
                        'our_price': our_price,
                        'their_price': their_price,
                        'difference': difference,
                        'pct_diff': pct_diff,
                        'status': status
                    })
        
        return comparisons
    
    # ============================================
    # FEATURE 4: SMART ALERTS
    # ============================================
    
    def generate_morning_alert(self, sheet_data: List[Dict]) -> str:
        """Generate morning status alert"""
        try:
            def safe_float(val):
                if not val or val == '':
                    return 0
                try:
                    return float(str(val).replace(',', '').replace('$', '').strip())
                except:
                    return 0
            
            # Yesterday's performance
            yesterday = sheet_data[-1] if sheet_data else {}
            yesterday_revenue = safe_float(yesterday.get('Total_Revenue', 0))
            
            # This week so far
            this_week = sheet_data[-7:] if len(sheet_data) >= 7 else sheet_data
            week_revenue = sum([safe_float(row.get('Total_Revenue', 0)) for row in this_week])
            
            # Calculate average and comparison
            avg_daily = week_revenue / len(this_week) if this_week else 0
            yesterday_vs_avg = ((yesterday_revenue - avg_daily) / avg_daily * 100) if avg_daily > 0 else 0
            
            # Inventory status
            inventory = self.calculate_inventory_status(sheet_data)
            inventory_alerts = self.check_inventory_alerts(inventory)
            
            # Margins
            margins = self.calculate_margins(sheet_data)
            
            alert = f"""☀️ **GOOD MORNING!**
{datetime.now().strftime('%A, %B %d, %Y')}

**YESTERDAY:**
Revenue: JMD ${yesterday_revenue:,.0f}
vs Average: {yesterday_vs_avg:+.1f}%
Status: {"Strong ✅" if yesterday_vs_avg > 0 else "Below avg ⚠️"}

**THIS WEEK SO FAR:**
Total: JMD ${week_revenue:,.0f}
Daily Avg: JMD ${avg_daily:,.0f}

**TODAY'S FOCUS:**"""
            
            if inventory_alerts:
                alert += "\n"
                for inv_alert in inventory_alerts[:2]:  # Top 2 alerts
                    alert += f"\n{inv_alert['message']}"
            
            if margins and margins.get('avg_margin_pct', 0) > 0:
                alert += f"\n💰 Margin: {margins['avg_margin_pct']:.1f}% ({"strong ✅" if margins['avg_margin_pct'] >= 8 else "review ⚠️"})"
            
            alert += f"\n\n**TODAY'S GOAL:** JMD ${avg_daily * 1.03:,.0f} (+3%)"
            
            return alert
            
        except Exception as e:
            print(f"❌ Error generating morning alert: {e}")
            return "☀️ Good morning! Unable to generate full status."
    
    def generate_evening_alert(self, sheet_data: List[Dict]) -> str:
        """Generate evening summary alert"""
        try:
            def safe_float(val):
                if not val or val == '':
                    return 0
                try:
                    return float(str(val).replace(',', '').replace('$', '').strip())
                except:
                    return 0
            
            # Today's performance
            today = sheet_data[-1] if sheet_data else {}
            today_revenue = safe_float(today.get('Total_Revenue', 0))
            
            # Calculate goal (avg * 1.03)
            this_week = sheet_data[-7:] if len(sheet_data) >= 7 else sheet_data
            avg_daily = sum([safe_float(row.get('Total_Revenue', 0)) for row in this_week]) / len(this_week) if this_week else 0
            goal = avg_daily * 1.03
            
            vs_goal = ((today_revenue - goal) / goal * 100) if goal > 0 else 0
            
            alert = f"""🌙 **END OF DAY SUMMARY**
{datetime.now().strftime('%A, %B %d, %Y')}

**TODAY:**
Revenue: JMD ${today_revenue:,.0f}
vs Goal: JMD ${goal:,.0f} ({vs_goal:+.1f}% {"🎉" if vs_goal > 0 else "📉"})

**HIGHLIGHTS:**"""
            
            gas_litres = safe_float(today.get('Total_Litres', 0))
            if gas_litres > 0:
                alert += f"\n⛽ Gas: {gas_litres:,.0f}L"
            
            store = safe_float(today.get('Store_Sales', 0))
            if store > 0:
                alert += f"\n🏪 Store: JMD ${store:,.0f}"
            
            alert += "\n\nGood night! 🌟"
            
            return alert
            
        except Exception as e:
            print(f"❌ Error generating evening alert: {e}")
            return "🌙 Good night!"
