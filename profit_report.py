"""
SuperPlus AI Agent - Profit Report (v3 Multi-tab)
Calculates actual profit using delivery costs from Fuel_Deliveries tab
"""

import os
from datetime import datetime, timedelta
from typing import Dict, List, Optional


class ProfitCalculator:
    """
    Calculate profit using actual delivery costs from multi-tab structure.
    """
    
    def __init__(self, sheet_manager):
        """
        Initialize with sheet_manager instance.
        
        Args:
            sheet_manager: SheetManager instance for data access
        """
        self.sm = sheet_manager
        
        # Default costs (fallback if no delivery data)
        self.default_costs = {
            '87': float(os.getenv('COST_87', '158')),
            '90': float(os.getenv('COST_90', '168')),
            'ADO': float(os.getenv('COST_ADO', '172')),
            'ULSD': float(os.getenv('COST_ULSD', '178'))
        }
        
        # Margin estimates for non-gas units
        self.store_margin = float(os.getenv('STORE_MARGIN_PCT', '25')) / 100
        self.deli_margin = float(os.getenv('DELI_MARGIN_PCT', '35')) / 100
        self.phone_margin = float(os.getenv('PHONE_MARGIN_PCT', '8')) / 100
    
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
    
    def get_fuel_cost_for_date(self, fuel_type: str, target_date: str) -> float:
        """
        Get the fuel cost for a specific date.
        Uses most recent delivery cost on or before target date.
        Falls back to default if no delivery found.
        """
        fuel_type = fuel_type.upper()
        deliveries = self.sm.get_deliveries_range(days=90)
        
        # Find most recent delivery on or before target date
        for delivery in reversed(deliveries):
            if delivery.get('Fuel_Type', '').upper() == fuel_type:
                delivery_date = delivery.get('Date', '')
                if delivery_date <= target_date:
                    cost = self._safe_float(delivery.get('Cost_Per_Litre', 0))
                    if cost > 0:
                        return cost
        
        # Fallback to default
        return self.default_costs.get(fuel_type, 160)
    
    def calculate_daily_gas_profit(self, date_str: str) -> Dict:
        """
        Calculate gas profit for a specific date using actual costs.
        """
        fuel_sales = self.sm.get_fuel_sales(date_str)
        
        if not fuel_sales:
            return {'date': date_str, 'profit': 0, 'details': {}}
        
        details = {}
        total_profit = 0
        total_revenue = 0
        total_cost = 0
        
        for fuel in ['87', '90', 'ADO', 'ULSD']:
            litres = self._safe_float(fuel_sales.get(f'Gas_{fuel}_Litres', 0))
            price = self._safe_float(fuel_sales.get(f'Price_{fuel}', 0))
            
            if litres and price:
                cost_per_litre = self.get_fuel_cost_for_date(fuel, date_str)
                
                revenue = litres * price
                cost = litres * cost_per_litre
                profit = revenue - cost
                margin_pct = (profit / revenue * 100) if revenue > 0 else 0
                
                details[fuel] = {
                    'litres': litres,
                    'sell_price': price,
                    'cost_price': cost_per_litre,
                    'revenue': revenue,
                    'cost': cost,
                    'profit': profit,
                    'margin_pct': margin_pct,
                    'profit_per_litre': profit / litres if litres > 0 else 0
                }
                
                total_profit += profit
                total_revenue += revenue
                total_cost += cost
        
        return {
            'date': date_str,
            'profit': total_profit,
            'revenue': total_revenue,
            'cost': total_cost,
            'margin_pct': (total_profit / total_revenue * 100) if total_revenue > 0 else 0,
            'details': details
        }
    
    def calculate_weekly_profit(self, weeks_back: int = 0) -> Dict:
        """
        Calculate comprehensive weekly profit breakdown.
        """
        # Get date range
        today = datetime.now()
        week_start = today - timedelta(days=today.weekday() + (weeks_back * 7))
        week_end = week_start + timedelta(days=6)
        
        # Get daily summaries for non-gas revenue
        daily_summaries = self.sm.get_daily_summaries(days=14)
        week_summaries = [
            s for s in daily_summaries
            if week_start.strftime('%Y-%m-%d') <= s.get('Date', '') <= week_end.strftime('%Y-%m-%d')
        ]
        
        # Get fuel sales for gas calculations
        fuel_sales = self.sm.get_fuel_sales_range(days=14)
        week_fuel = [
            f for f in fuel_sales
            if week_start.strftime('%Y-%m-%d') <= f.get('Date', '') <= week_end.strftime('%Y-%m-%d')
        ]
        
        # Calculate gas profit day by day
        gas_profit_total = 0
        gas_revenue_total = 0
        gas_cost_total = 0
        fuel_breakdown = {'87': {'litres': 0, 'revenue': 0, 'cost': 0, 'profit': 0},
                         '90': {'litres': 0, 'revenue': 0, 'cost': 0, 'profit': 0},
                         'ADO': {'litres': 0, 'revenue': 0, 'cost': 0, 'profit': 0},
                         'ULSD': {'litres': 0, 'revenue': 0, 'cost': 0, 'profit': 0}}
        
        for sale in week_fuel:
            date_str = sale.get('Date', '')
            daily = self.calculate_daily_gas_profit(date_str)
            
            gas_profit_total += daily['profit']
            gas_revenue_total += daily['revenue']
            gas_cost_total += daily['cost']
            
            for fuel, data in daily['details'].items():
                fuel_breakdown[fuel]['litres'] += data['litres']
                fuel_breakdown[fuel]['revenue'] += data['revenue']
                fuel_breakdown[fuel]['cost'] += data['cost']
                fuel_breakdown[fuel]['profit'] += data['profit']
        
        # Calculate margin % for each fuel
        for fuel in fuel_breakdown:
            fb = fuel_breakdown[fuel]
            fb['margin_pct'] = (fb['profit'] / fb['revenue'] * 100) if fb['revenue'] > 0 else 0
        
        # Non-gas profit (estimated margins)
        store_revenue = sum([self._safe_float(s.get('Store_Sales', 0)) for s in week_summaries])
        deli_revenue = sum([self._safe_float(s.get('Deli_Sales', 0)) for s in week_summaries])
        phone_revenue = sum([self._safe_float(s.get('Phone_Cards', 0)) for s in week_summaries])
        
        store_profit = store_revenue * self.store_margin
        deli_profit = deli_revenue * self.deli_margin
        phone_profit = phone_revenue * self.phone_margin
        
        total_revenue = gas_revenue_total + store_revenue + deli_revenue + phone_revenue
        total_profit = gas_profit_total + store_profit + deli_profit + phone_profit
        
        return {
            'week_start': week_start.strftime('%Y-%m-%d'),
            'week_end': week_end.strftime('%Y-%m-%d'),
            'days': len(week_summaries),
            
            'total_revenue': total_revenue,
            'total_profit': total_profit,
            'total_margin_pct': (total_profit / total_revenue * 100) if total_revenue > 0 else 0,
            
            'gas': {
                'revenue': gas_revenue_total,
                'cost': gas_cost_total,
                'profit': gas_profit_total,
                'margin_pct': (gas_profit_total / gas_revenue_total * 100) if gas_revenue_total > 0 else 0,
                'by_fuel': fuel_breakdown
            },
            
            'store': {
                'revenue': store_revenue,
                'profit': store_profit,
                'margin_pct': self.store_margin * 100
            },
            
            'deli': {
                'revenue': deli_revenue,
                'profit': deli_profit,
                'margin_pct': self.deli_margin * 100
            },
            
            'phone': {
                'revenue': phone_revenue,
                'profit': phone_profit,
                'margin_pct': self.phone_margin * 100
            },
            
            'daily_avg_profit': total_profit / len(week_summaries) if week_summaries else 0
        }
    
    def generate_weekly_profit_report(self, weeks_back: int = 0) -> Dict:
        """
        Generate formatted profit report with text and data.
        """
        data = self.calculate_weekly_profit(weeks_back)
        
        # Generate text report
        text = f"💰 **PROFIT REPORT**\n"
        text += f"_{data['week_start']} to {data['week_end']}_\n"
        text += f"({data['days']} days)\n\n"
        
        text += f"**TOTAL PROFIT:** ${data['total_profit']:,.0f}\n"
        text += f"**Margin:** {data['total_margin_pct']:.1f}%\n"
        text += f"**Daily Avg:** ${data['daily_avg_profit']:,.0f}\n\n"
        
        # Gas breakdown
        text += "⛽ **GAS STATION**\n"
        text += f"Revenue: ${data['gas']['revenue']:,.0f}\n"
        text += f"Cost: ${data['gas']['cost']:,.0f}\n"
        text += f"Profit: ${data['gas']['profit']:,.0f} ({data['gas']['margin_pct']:.1f}%)\n\n"
        
        # By fuel type
        text += "By Fuel:\n"
        for fuel in ['87', '90', 'ADO', 'ULSD']:
            fb = data['gas']['by_fuel'][fuel]
            if fb['litres'] > 0:
                text += f"  {fuel}: ${fb['profit']:,.0f} ({fb['margin_pct']:.1f}%)\n"
        
        text += "\n"
        
        # Other units
        text += f"🏪 **STORE:** ${data['store']['profit']:,.0f}\n"
        text += f"   ({data['store']['margin_pct']:.0f}% est. margin)\n"
        
        text += f"🍔 **DELI:** ${data['deli']['profit']:,.0f}\n"
        text += f"   ({data['deli']['margin_pct']:.0f}% est. margin)\n"
        
        text += f"📱 **PHONE:** ${data['phone']['profit']:,.0f}\n"
        text += f"   ({data['phone']['margin_pct']:.0f}% est. margin)\n"
        
        # Compare to last week
        last_week = self.calculate_weekly_profit(weeks_back + 1)
        if last_week['total_profit'] > 0:
            change = data['total_profit'] - last_week['total_profit']
            change_pct = (change / last_week['total_profit'] * 100)
            
            arrow = "📈" if change > 0 else "📉"
            text += f"\n{arrow} vs Last Week: {change_pct:+.1f}%"
        
        return {
            'text': text,
            'data': data
        }
    
    def generate_margin_analysis(self) -> str:
        """Generate detailed margin analysis text"""
        data = self.calculate_weekly_profit()
        
        text = "📊 **MARGIN ANALYSIS**\n\n"
        
        text += "⛽ **Fuel Margins:**\n"
        for fuel in ['87', '90', 'ADO', 'ULSD']:
            fb = data['gas']['by_fuel'][fuel]
            if fb['litres'] > 0:
                profit_per_litre = fb['profit'] / fb['litres']
                text += f"**{fuel}:**\n"
                text += f"  Litres: {fb['litres']:,.0f}L\n"
                text += f"  Revenue: ${fb['revenue']:,.0f}\n"
                text += f"  Profit: ${fb['profit']:,.0f}\n"
                text += f"  Margin: {fb['margin_pct']:.1f}%\n"
                text += f"  $/Litre: ${profit_per_litre:.2f}\n\n"
        
        # Best/worst performer
        performers = [(f, data['gas']['by_fuel'][f]) for f in ['87', '90', 'ADO', 'ULSD'] 
                     if data['gas']['by_fuel'][f]['litres'] > 0]
        
        if performers:
            best = max(performers, key=lambda x: x[1]['margin_pct'])
            worst = min(performers, key=lambda x: x[1]['margin_pct'])
            
            text += f"🏆 Best Margin: {best[0]} ({best[1]['margin_pct']:.1f}%)\n"
            text += f"⚠️ Lowest Margin: {worst[0]} ({worst[1]['margin_pct']:.1f}%)\n"
        
        return text
