"""
SuperPlus AI Agent - Profit Report
Real profit margins using actual delivery costs
Weekly profit report broken down by business unit
"""

import os
from datetime import datetime, timedelta
from typing import Dict, List
import json


class ProfitReport:
    """
    Calculate and report actual profit margins using delivery cost data.
    This replaces estimated margins with real margins.
    """
    
    def __init__(self, agent):
        self.agent = agent
        
        # Default costs (fallback when no delivery cost recorded)
        self.default_costs = {
            '87': float(os.getenv('COST_87', '158.00')),
            '90': float(os.getenv('COST_90', '168.00')),
            'ado': float(os.getenv('COST_ADO', '172.00')),
            'ulsd': float(os.getenv('COST_ULSD', '178.00'))
        }
        
        # Estimated margins for non-gas businesses (% of revenue)
        # These are rough estimates - can be refined with actual data
        self.estimated_margins = {
            'store': float(os.getenv('STORE_MARGIN_PCT', '25')),   # Convenience store typical
            'deli': float(os.getenv('DELI_MARGIN_PCT', '35')),     # Food service higher
            'phone': float(os.getenv('PHONE_MARGIN_PCT', '8'))     # Low margin, high volume
        }
    
    def get_fuel_cost_for_date(self, all_data: List[Dict], target_date: str, fuel_type: str) -> float:
        """
        Get the most recent delivery cost for a fuel type as of a given date.
        Uses FIFO-like logic: cost from most recent delivery before/on that date.
        Falls back to default if no delivery cost found.
        """
        cost_key = f"Delivery_{fuel_type.upper()}_Cost"
        
        # Sort by date and find most recent delivery cost
        for row in reversed(all_data):
            row_date = row.get('Date', '')
            if row_date <= target_date:
                cost = self._safe_float(row.get(cost_key))
                if cost > 0:
                    return cost
        
        # Fallback to default
        return self.default_costs.get(fuel_type.lower(), 0)
    
    def _safe_float(self, val) -> float:
        """Safely convert to float"""
        if not val or val == '':
            return 0
        try:
            return float(str(val).replace(',', '').replace('$', '').strip())
        except:
            return 0
    
    def calculate_daily_gas_profit(self, row: Dict, all_data: List[Dict]) -> Dict:
        """
        Calculate actual gas profit for a single day using real costs.
        Returns breakdown by fuel type.
        """
        date = row.get('Date', '')
        
        result = {
            'date': date,
            'fuels': {},
            'total_revenue': 0,
            'total_cost': 0,
            'total_profit': 0
        }
        
        for fuel in ['87', '90', 'ado', 'ulsd']:
            litres = self._safe_float(row.get(f'Gas_{fuel.upper()}_Litres', 0))
            price = self._safe_float(row.get(f'GasMart_{fuel.upper()}_Price', 0))
            
            if litres > 0 and price > 0:
                # Get actual cost from delivery data
                cost_per_litre = self.get_fuel_cost_for_date(all_data, date, fuel)
                
                revenue = litres * price
                cost = litres * cost_per_litre
                profit = revenue - cost
                margin_pct = (profit / revenue * 100) if revenue > 0 else 0
                
                result['fuels'][fuel] = {
                    'litres': litres,
                    'sell_price': price,
                    'cost_per_litre': cost_per_litre,
                    'revenue': revenue,
                    'cost': cost,
                    'profit': profit,
                    'margin_pct': margin_pct,
                    'using_default_cost': cost_per_litre == self.default_costs.get(fuel.lower())
                }
                
                result['total_revenue'] += revenue
                result['total_cost'] += cost
                result['total_profit'] += profit
        
        return result
    
    def calculate_weekly_profit(self, all_data: List[Dict]) -> Dict:
        """
        Calculate comprehensive weekly profit report.
        Breaks down by business unit with real margins.
        """
        # Get last 7 days
        this_week = all_data[-7:] if len(all_data) >= 7 else all_data
        last_week = all_data[-14:-7] if len(all_data) >= 14 else []
        
        report = {
            'period': {
                'start': this_week[0].get('Date') if this_week else '',
                'end': this_week[-1].get('Date') if this_week else '',
                'days': len(this_week)
            },
            'gas_station': self._calc_gas_profit(this_week, all_data),
            'store': self._calc_store_profit(this_week),
            'deli': self._calc_deli_profit(this_week),
            'phone_cards': self._calc_phone_profit(this_week),
            'total': {},
            'comparison': {}
        }
        
        # Calculate totals
        total_revenue = (
            report['gas_station']['revenue'] +
            report['store']['revenue'] +
            report['deli']['revenue'] +
            report['phone_cards']['revenue']
        )
        
        total_profit = (
            report['gas_station']['profit'] +
            report['store']['profit'] +
            report['deli']['profit'] +
            report['phone_cards']['profit']
        )
        
        report['total'] = {
            'revenue': total_revenue,
            'profit': total_profit,
            'margin_pct': (total_profit / total_revenue * 100) if total_revenue > 0 else 0,
            'daily_avg_profit': total_profit / len(this_week) if this_week else 0
        }
        
        # Calculate comparison to last week
        if last_week:
            lw_report = {
                'gas_station': self._calc_gas_profit(last_week, all_data),
                'store': self._calc_store_profit(last_week),
                'deli': self._calc_deli_profit(last_week),
                'phone_cards': self._calc_phone_profit(last_week)
            }
            
            lw_total_profit = sum([lw_report[k]['profit'] for k in lw_report])
            
            report['comparison'] = {
                'last_week_profit': lw_total_profit,
                'profit_change': total_profit - lw_total_profit,
                'profit_change_pct': ((total_profit - lw_total_profit) / lw_total_profit * 100) if lw_total_profit > 0 else 0
            }
        
        return report
    
    def _calc_gas_profit(self, rows: List[Dict], all_data: List[Dict]) -> Dict:
        """Calculate gas station profit with real costs"""
        total_revenue = 0
        total_cost = 0
        total_litres = 0
        fuel_breakdown = {}
        
        for row in rows:
            daily = self.calculate_daily_gas_profit(row, all_data)
            total_revenue += daily['total_revenue']
            total_cost += daily['total_cost']
            
            # Aggregate fuel breakdown
            for fuel, data in daily['fuels'].items():
                if fuel not in fuel_breakdown:
                    fuel_breakdown[fuel] = {
                        'litres': 0, 'revenue': 0, 'cost': 0, 'profit': 0
                    }
                fuel_breakdown[fuel]['litres'] += data['litres']
                fuel_breakdown[fuel]['revenue'] += data['revenue']
                fuel_breakdown[fuel]['cost'] += data['cost']
                fuel_breakdown[fuel]['profit'] += data['profit']
                total_litres += data['litres']
        
        profit = total_revenue - total_cost
        
        return {
            'revenue': total_revenue,
            'cost': total_cost,
            'profit': profit,
            'margin_pct': (profit / total_revenue * 100) if total_revenue > 0 else 0,
            'litres': total_litres,
            'profit_per_litre': profit / total_litres if total_litres > 0 else 0,
            'fuel_breakdown': fuel_breakdown
        }
    
    def _calc_store_profit(self, rows: List[Dict]) -> Dict:
        """Calculate store profit using estimated margin"""
        revenue = sum([self._safe_float(row.get('Store_Sales', 0)) for row in rows])
        margin_pct = self.estimated_margins['store']
        profit = revenue * (margin_pct / 100)
        
        return {
            'revenue': revenue,
            'profit': profit,
            'margin_pct': margin_pct,
            'margin_type': 'estimated'
        }
    
    def _calc_deli_profit(self, rows: List[Dict]) -> Dict:
        """Calculate deli profit using estimated margin"""
        revenue = sum([self._safe_float(row.get('Deli_Sales', 0)) for row in rows])
        margin_pct = self.estimated_margins['deli']
        profit = revenue * (margin_pct / 100)
        
        return {
            'revenue': revenue,
            'profit': profit,
            'margin_pct': margin_pct,
            'margin_type': 'estimated'
        }
    
    def _calc_phone_profit(self, rows: List[Dict]) -> Dict:
        """Calculate phone cards profit using estimated margin"""
        revenue = sum([self._safe_float(row.get('Phone_Cards', 0)) for row in rows])
        margin_pct = self.estimated_margins['phone']
        profit = revenue * (margin_pct / 100)
        
        return {
            'revenue': revenue,
            'profit': profit,
            'margin_pct': margin_pct,
            'margin_type': 'estimated'
        }
    
    def generate_profit_report_text(self, all_data: List[Dict]) -> str:
        """Generate formatted text profit report for WhatsApp/Telegram"""
        report = self.calculate_weekly_profit(all_data)
        
        text = f"""💰 **WEEKLY PROFIT REPORT**
{report['period']['start']} to {report['period']['end']}

**SUMMARY:**
Total Revenue: JMD ${report['total']['revenue']:,.0f}
**Total Profit: JMD ${report['total']['profit']:,.0f}**
Overall Margin: {report['total']['margin_pct']:.1f}%
Daily Avg Profit: JMD ${report['total']['daily_avg_profit']:,.0f}

**BY BUSINESS UNIT:**

⛽ **Gas Station** (actual costs)
Revenue: ${report['gas_station']['revenue']:,.0f}
Profit: ${report['gas_station']['profit']:,.0f}
Margin: {report['gas_station']['margin_pct']:.1f}%
Profit/Litre: ${report['gas_station']['profit_per_litre']:.2f}
"""
        
        # Fuel breakdown
        for fuel, data in report['gas_station'].get('fuel_breakdown', {}).items():
            if data['litres'] > 0:
                fuel_margin = (data['profit'] / data['revenue'] * 100) if data['revenue'] > 0 else 0
                text += f"  • {fuel.upper()}: {data['litres']:,.0f}L → ${data['profit']:,.0f} ({fuel_margin:.1f}%)\n"
        
        text += f"""
🏪 **Community Store** (est. {report['store']['margin_pct']:.0f}% margin)
Revenue: ${report['store']['revenue']:,.0f}
Profit: ${report['store']['profit']:,.0f}

🍽️ **Deli** (est. {report['deli']['margin_pct']:.0f}% margin)
Revenue: ${report['deli']['revenue']:,.0f}
Profit: ${report['deli']['profit']:,.0f}

💳 **Phone Cards** (est. {report['phone_cards']['margin_pct']:.0f}% margin)
Revenue: ${report['phone_cards']['revenue']:,.0f}
Profit: ${report['phone_cards']['profit']:,.0f}
"""
        
        # Comparison
        if report['comparison']:
            change = report['comparison']['profit_change']
            change_pct = report['comparison']['profit_change_pct']
            emoji = "📈" if change > 0 else "📉"
            text += f"""
**vs LAST WEEK:**
{emoji} Profit change: ${change:+,.0f} ({change_pct:+.1f}%)
"""
        
        # Insights
        text += "\n**💡 INSIGHTS:**\n"
        
        # Check gas margins
        gas_margin = report['gas_station']['margin_pct']
        if gas_margin < 5:
            text += "⚠️ Gas margins below 5% - review pricing or costs\n"
        elif gas_margin > 10:
            text += "✅ Gas margins healthy at >10%\n"
        
        # Best performing unit
        units = [
            ('Gas', report['gas_station']['profit']),
            ('Store', report['store']['profit']),
            ('Deli', report['deli']['profit']),
            ('Phone', report['phone_cards']['profit'])
        ]
        best = max(units, key=lambda x: x[1])
        text += f"🏆 Top profit: {best[0]} (${best[1]:,.0f})\n"
        
        return text
    
    def generate_profit_report_html(self, all_data: List[Dict]) -> str:
        """Generate HTML profit report for email"""
        report = self.calculate_weekly_profit(all_data)
        
        html = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>SuperPlus Weekly Profit Report</title>
    <style>
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
        }}
        .container {{
            background-color: white;
            border-radius: 12px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            overflow: hidden;
        }}
        .header {{
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
            color: white;
            padding: 40px 30px;
            text-align: center;
        }}
        .header h1 {{
            margin: 0;
            font-size: 32px;
            font-weight: 700;
        }}
        .content {{
            padding: 40px 30px;
        }}
        .profit-highlight {{
            background: #ecfdf5;
            border: 2px solid #10b981;
            border-radius: 12px;
            padding: 30px;
            text-align: center;
            margin: 20px 0;
        }}
        .profit-highlight h2 {{
            margin: 0;
            font-size: 48px;
            color: #059669;
        }}
        .profit-highlight p {{
            margin: 10px 0 0;
            color: #064e3b;
            font-size: 18px;
        }}
        .unit-grid {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin: 30px 0;
        }}
        .unit-card {{
            background: #f8fafc;
            border-radius: 8px;
            padding: 20px;
            border-left: 4px solid #10b981;
        }}
        .unit-card h3 {{
            margin: 0 0 15px;
            color: #1e293b;
            font-size: 16px;
        }}
        .unit-revenue {{
            font-size: 14px;
            color: #64748b;
        }}
        .unit-profit {{
            font-size: 24px;
            font-weight: 700;
            color: #059669;
            margin: 5px 0;
        }}
        .unit-margin {{
            font-size: 14px;
            color: #64748b;
        }}
        .fuel-table {{
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
        }}
        .fuel-table th, .fuel-table td {{
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #e2e8f0;
        }}
        .fuel-table th {{
            background: #f8fafc;
            font-weight: 600;
            color: #64748b;
            font-size: 12px;
            text-transform: uppercase;
        }}
        .fuel-table td {{
            font-size: 14px;
        }}
        .positive {{ color: #10b981; }}
        .negative {{ color: #ef4444; }}
        .footer {{
            background: #f8fafc;
            padding: 30px;
            text-align: center;
            color: #64748b;
            font-size: 14px;
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>💰 Weekly Profit Report</h1>
            <p>{report['period']['start']} to {report['period']['end']}</p>
        </div>
        
        <div class="content">
            <div class="profit-highlight">
                <h2>JMD ${report['total']['profit']:,.0f}</h2>
                <p>Total Profit This Week • {report['total']['margin_pct']:.1f}% Margin</p>
            </div>
            
            <div class="unit-grid">
                <div class="unit-card">
                    <h3>⛽ Gas Station</h3>
                    <div class="unit-revenue">Revenue: ${report['gas_station']['revenue']:,.0f}</div>
                    <div class="unit-profit">${report['gas_station']['profit']:,.0f}</div>
                    <div class="unit-margin">{report['gas_station']['margin_pct']:.1f}% margin (actual)</div>
                </div>
                
                <div class="unit-card">
                    <h3>🏪 Community Store</h3>
                    <div class="unit-revenue">Revenue: ${report['store']['revenue']:,.0f}</div>
                    <div class="unit-profit">${report['store']['profit']:,.0f}</div>
                    <div class="unit-margin">{report['store']['margin_pct']:.0f}% margin (est.)</div>
                </div>
                
                <div class="unit-card">
                    <h3>🍽️ Deli</h3>
                    <div class="unit-revenue">Revenue: ${report['deli']['revenue']:,.0f}</div>
                    <div class="unit-profit">${report['deli']['profit']:,.0f}</div>
                    <div class="unit-margin">{report['deli']['margin_pct']:.0f}% margin (est.)</div>
                </div>
                
                <div class="unit-card">
                    <h3>💳 Phone Cards</h3>
                    <div class="unit-revenue">Revenue: ${report['phone_cards']['revenue']:,.0f}</div>
                    <div class="unit-profit">${report['phone_cards']['profit']:,.0f}</div>
                    <div class="unit-margin">{report['phone_cards']['margin_pct']:.0f}% margin (est.)</div>
                </div>
            </div>
            
            <h3>⛽ Gas Profit by Fuel Type (Actual Costs)</h3>
            <table class="fuel-table">
                <tr>
                    <th>Fuel</th>
                    <th>Litres</th>
                    <th>Revenue</th>
                    <th>Cost</th>
                    <th>Profit</th>
                    <th>Margin</th>
                </tr>
"""
        
        for fuel, data in report['gas_station'].get('fuel_breakdown', {}).items():
            if data['litres'] > 0:
                fuel_margin = (data['profit'] / data['revenue'] * 100) if data['revenue'] > 0 else 0
                html += f"""
                <tr>
                    <td><strong>{fuel.upper()}</strong></td>
                    <td>{data['litres']:,.0f}L</td>
                    <td>${data['revenue']:,.0f}</td>
                    <td>${data['cost']:,.0f}</td>
                    <td class="positive">${data['profit']:,.0f}</td>
                    <td>{fuel_margin:.1f}%</td>
                </tr>
"""
        
        html += """
            </table>
"""
        
        if report['comparison']:
            change = report['comparison']['profit_change']
            change_pct = report['comparison']['profit_change_pct']
            change_class = "positive" if change > 0 else "negative"
            html += f"""
            <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin-top: 30px;">
                <h3>📊 vs Last Week</h3>
                <p>Profit change: <span class="{change_class}">${change:+,.0f} ({change_pct:+.1f}%)</span></p>
            </div>
"""
        
        html += """
        </div>
        
        <div class="footer">
            <p><strong>SuperPlus AI Business Agent</strong></p>
            <p>Profit report generated with actual delivery costs where available.</p>
            <p style="font-size: 12px; margin-top: 15px;">
                Gas margins use actual delivery costs. Store/Deli/Phone use estimated margins.
            </p>
        </div>
    </div>
</body>
</html>
"""
        
        return html


def generate_weekly_profit_report(agent) -> Dict:
    """
    Convenience function to generate profit report.
    Call from main agent or scheduled tasks.
    """
    try:
        profit_reporter = ProfitReport(agent)
        
        worksheet = agent.sheet.worksheet("Daily_Report")
        all_data = worksheet.get_all_records()
        
        if not all_data:
            return {"error": "No data available"}
        
        report_data = profit_reporter.calculate_weekly_profit(all_data)
        report_text = profit_reporter.generate_profit_report_text(all_data)
        report_html = profit_reporter.generate_profit_report_html(all_data)
        
        return {
            "data": report_data,
            "text": report_text,
            "html": report_html
        }
        
    except Exception as e:
        print(f"❌ Error generating profit report: {e}")
        import traceback
        traceback.print_exc()
        return {"error": str(e)}
