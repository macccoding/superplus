"""
SuperPlus AI Agent - Demand Forecasting (v3 Multi-tab)
Predicts fuel demand and generates auto-order suggestions
Uses sheet_manager for data access
"""

import os
from datetime import datetime, timedelta
from typing import Dict, List, Optional
import statistics


class DemandForecaster:
    """
    Predicts fuel demand and generates ordering recommendations.
    Uses multi-tab sheet structure via sheet_manager.
    """
    
    def __init__(self, sheet_manager=None):
        self.sm = sheet_manager
        
        # Tank capacities (litres)
        self.tank_capacity = {
            '87': float(os.getenv('TANK_CAPACITY_87', '25000')),
            '90': float(os.getenv('TANK_CAPACITY_90', '20000')),
            'ADO': float(os.getenv('TANK_CAPACITY_ADO', '25000')),
            'ULSD': float(os.getenv('TANK_CAPACITY_ULSD', '15000'))
        }
        
        # Order parameters
        self.min_days_stock = float(os.getenv('MIN_DAYS_STOCK', '2.0'))
        self.reorder_point = float(os.getenv('REORDER_POINT_DAYS', '3.0'))
        self.delivery_lead_time = float(os.getenv('DELIVERY_LEAD_TIME', '1.0'))
        
        # Jamaica payday patterns
        self.govt_payday = int(os.getenv('GOVT_PAYDAY', '25'))
        self.payday_boost = float(os.getenv('PAYDAY_BOOST_PCT', '35'))
        
        # Weather impact
        self.rain_reduction = float(os.getenv('RAIN_REDUCTION_PCT', '15'))
    
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
    
    def calculate_baseline_demand(self, fuel_type: str, days: int = 28) -> Dict:
        """
        Calculate baseline demand patterns from historical data.
        """
        if not self.sm:
            return {'avg_daily': 0, 'std_dev': 0, 'dow_factors': {}, 'data_days': 0}
        
        fuel_sales = self.sm.get_fuel_sales_range(days=days)
        
        if not fuel_sales:
            return {'avg_daily': 0, 'std_dev': 0, 'dow_factors': {}, 'data_days': 0}
        
        fuel_key = f'Gas_{fuel_type.upper()}_Litres'
        
        daily_sales = []
        dow_sales = {i: [] for i in range(7)}
        
        for row in fuel_sales:
            litres = self._safe_float(row.get(fuel_key, 0))
            if litres > 0:
                daily_sales.append(litres)
                
                date_str = row.get('Date', '')
                if date_str:
                    try:
                        date_obj = datetime.strptime(date_str, '%Y-%m-%d')
                        dow = date_obj.weekday()
                        dow_sales[dow].append(litres)
                    except:
                        pass
        
        if not daily_sales:
            return {'avg_daily': 0, 'std_dev': 0, 'dow_factors': {}, 'data_days': 0}
        
        avg_daily = statistics.mean(daily_sales)
        std_dev = statistics.stdev(daily_sales) if len(daily_sales) > 1 else 0
        
        # Day-of-week factors
        dow_factors = {}
        for dow, sales in dow_sales.items():
            if sales:
                dow_avg = statistics.mean(sales)
                dow_factors[dow] = dow_avg / avg_daily if avg_daily > 0 else 1.0
            else:
                dow_factors[dow] = 1.0
        
        return {
            'avg_daily': avg_daily,
            'std_dev': std_dev,
            'dow_factors': dow_factors,
            'data_days': len(daily_sales),
            'min_daily': min(daily_sales),
            'max_daily': max(daily_sales)
        }
    
    def is_payday_period(self, date: datetime) -> bool:
        """Check if date is in payday period"""
        day = date.day
        return abs(day - self.govt_payday) <= 2 or (self.govt_payday > 25 and day <= 2)
    
    def forecast_demand(self, fuel_type: str, days_ahead: int = 7) -> List[Dict]:
        """
        Forecast demand for the next N days.
        """
        baseline = self.calculate_baseline_demand(fuel_type)
        
        if baseline['avg_daily'] == 0:
            return []
        
        forecasts = []
        today = datetime.now()
        
        for i in range(1, days_ahead + 1):
            forecast_date = today + timedelta(days=i)
            dow = forecast_date.weekday()
            
            base_forecast = baseline['avg_daily'] * baseline['dow_factors'].get(dow, 1.0)
            
            if self.is_payday_period(forecast_date):
                base_forecast *= (1 + self.payday_boost / 100)
            
            confidence_low = base_forecast - (1.5 * baseline['std_dev'])
            confidence_high = base_forecast + (1.5 * baseline['std_dev'])
            
            forecasts.append({
                'date': forecast_date.strftime('%Y-%m-%d'),
                'day_name': forecast_date.strftime('%A'),
                'forecast_litres': round(base_forecast),
                'confidence_low': round(max(0, confidence_low)),
                'confidence_high': round(confidence_high),
                'is_payday_period': self.is_payday_period(forecast_date),
                'dow_factor': baseline['dow_factors'].get(dow, 1.0)
            })
        
        return forecasts
    
    def calculate_inventory_projection(self, fuel_type: str) -> Dict:
        """
        Project when inventory will run out.
        """
        if not self.sm:
            return {'status': 'NO_DATA', 'message': 'No sheet manager'}
        
        # Get current inventory
        inventory = self.sm.get_latest_inventory()
        current = self._safe_float(inventory.get(fuel_type.lower(), 0))
        
        if current == 0:
            return {
                'current_inventory': 0,
                'status': 'NO_DATA',
                'message': 'No inventory data'
            }
        
        forecasts = self.forecast_demand(fuel_type, days_ahead=14)
        
        if not forecasts:
            return {
                'current_inventory': current,
                'status': 'NO_HISTORY',
                'message': 'Not enough sales history'
            }
        
        remaining = current
        stockout_date = None
        reorder_date = None
        days_until_stockout = None
        days_until_reorder = None
        
        daily_avg = statistics.mean([f['forecast_litres'] for f in forecasts])
        
        for i, forecast in enumerate(forecasts):
            remaining -= forecast['forecast_litres']
            
            days_of_stock = remaining / daily_avg if daily_avg > 0 else 999
            
            if reorder_date is None and days_of_stock <= self.reorder_point:
                reorder_date = forecast['date']
                days_until_reorder = i + 1
            
            if remaining <= 0:
                stockout_date = forecast['date']
                days_until_stockout = i + 1
                break
        
        if days_until_stockout and days_until_stockout <= 2:
            status = 'CRITICAL'
        elif days_until_reorder and days_until_reorder <= 2:
            status = 'ORDER_NOW'
        elif days_until_reorder and days_until_reorder <= 4:
            status = 'ORDER_SOON'
        else:
            status = 'OK'
        
        return {
            'fuel_type': fuel_type,
            'current_inventory': current,
            'daily_avg_forecast': round(daily_avg),
            'days_until_stockout': days_until_stockout,
            'stockout_date': stockout_date,
            'days_until_reorder': days_until_reorder,
            'reorder_date': reorder_date,
            'status': status,
            'forecasts': forecasts[:7]
        }
    
    def generate_order_recommendation(self, fuel_type: str) -> Dict:
        """
        Generate specific ordering recommendation.
        """
        projection = self.calculate_inventory_projection(fuel_type)
        
        if projection['status'] in ['NO_DATA', 'NO_HISTORY']:
            return projection
        
        daily_avg = projection['daily_avg_forecast']
        current = projection['current_inventory']
        tank_capacity = self.tank_capacity.get(fuel_type.upper(), 20000)
        
        # Target 90% of capacity
        target_fill = tank_capacity * 0.9
        
        sales_during_lead = daily_avg * self.delivery_lead_time
        projected_at_delivery = current - sales_during_lead
        order_quantity = target_fill - projected_at_delivery
        
        # Round to 5000L increments
        order_quantity = round(order_quantity / 5000) * 5000
        order_quantity = max(5000, order_quantity)
        
        space_available = tank_capacity - projected_at_delivery
        if order_quantity > space_available:
            order_quantity = round(space_available / 5000) * 5000
        
        projection['recommendation'] = {
            'order_quantity': order_quantity,
            'order_by_date': projection.get('reorder_date'),
            'expected_delivery': (
                datetime.strptime(projection['reorder_date'], '%Y-%m-%d') + 
                timedelta(days=self.delivery_lead_time)
            ).strftime('%Y-%m-%d') if projection.get('reorder_date') else None,
            'tank_capacity': tank_capacity,
            'space_at_delivery': round(space_available),
            'urgency': projection['status']
        }
        
        return projection
    
    def generate_full_forecast_report(self) -> Dict:
        """
        Generate complete forecast for all fuel types.
        """
        report = {
            'generated_at': datetime.now().isoformat(),
            'fuels': {},
            'alerts': [],
            'summary': ''
        }
        
        for fuel in ['87', '90', 'ADO', 'ULSD']:
            recommendation = self.generate_order_recommendation(fuel)
            report['fuels'][fuel] = recommendation
            
            status = recommendation.get('status', 'OK')
            if status == 'CRITICAL':
                report['alerts'].append({
                    'level': 'CRITICAL',
                    'fuel': fuel,
                    'message': f"🚨 {fuel} CRITICAL: Will run out in {recommendation.get('days_until_stockout', '?')} days",
                    'order_qty': recommendation.get('recommendation', {}).get('order_quantity', 0)
                })
            elif status == 'ORDER_NOW':
                report['alerts'].append({
                    'level': 'URGENT',
                    'fuel': fuel,
                    'message': f"⚠️ {fuel}: Order now for delivery by {recommendation.get('recommendation', {}).get('expected_delivery', '?')}",
                    'order_qty': recommendation.get('recommendation', {}).get('order_quantity', 0)
                })
            elif status == 'ORDER_SOON':
                report['alerts'].append({
                    'level': 'WARNING',
                    'fuel': fuel,
                    'message': f"📦 {fuel}: Plan order for {recommendation.get('reorder_date', '?')}",
                    'order_qty': recommendation.get('recommendation', {}).get('order_quantity', 0)
                })
        
        critical_count = len([a for a in report['alerts'] if a['level'] == 'CRITICAL'])
        urgent_count = len([a for a in report['alerts'] if a['level'] == 'URGENT'])
        
        if critical_count > 0:
            report['summary'] = f"🚨 {critical_count} fuel(s) critically low"
        elif urgent_count > 0:
            report['summary'] = f"⚠️ {urgent_count} fuel(s) need ordering"
        else:
            report['summary'] = "✅ All fuel levels healthy"
        
        return report
    
    def generate_forecast_text(self) -> str:
        """Generate formatted text report"""
        report = self.generate_full_forecast_report()
        
        text = f"📊 **DEMAND FORECAST**\n"
        text += f"_{datetime.now().strftime('%A, %B %d, %Y')}_\n\n"
        text += f"{report['summary']}\n\n"
        
        if report['alerts']:
            text += "**🚨 ALERTS:**\n"
            for alert in report['alerts']:
                text += f"{alert['message']}\n"
                if alert.get('order_qty'):
                    text += f"   → Order: {alert['order_qty']:,}L\n"
            text += "\n"
        
        text += "**📦 INVENTORY:**\n\n"
        
        for fuel, data in report['fuels'].items():
            if data.get('status') in ['NO_DATA', 'NO_HISTORY']:
                continue
            
            status_icon = {
                'CRITICAL': '🔴',
                'ORDER_NOW': '🟠',
                'ORDER_SOON': '🟡',
                'OK': '🟢'
            }.get(data['status'], '⚪')
            
            text += f"{status_icon} **{fuel}**\n"
            text += f"Current: {data['current_inventory']:,}L\n"
            text += f"Avg demand: {data['daily_avg_forecast']:,}L/day\n"
            
            if data.get('days_until_stockout'):
                text += f"Stockout: {data['days_until_stockout']} days\n"
            
            if data.get('recommendation'):
                rec = data['recommendation']
                text += f"**Order: {rec['order_quantity']:,}L**\n"
            
            text += "\n"
        
        # 7-day forecast for 87
        if report['fuels'].get('87', {}).get('forecasts'):
            text += "**📅 7-DAY 87 FORECAST:**\n"
            for f in report['fuels']['87']['forecasts'][:7]:
                payday = "💰" if f['is_payday_period'] else ""
                text += f"{f['day_name'][:3]}: {f['forecast_litres']:,}L {payday}\n"
        
        return text


def check_and_send_alerts(sheet_manager) -> Dict:
    """
    Check inventory and send alerts if needed.
    Call from scheduled tasks.
    """
    try:
        forecaster = DemandForecaster(sheet_manager)
        report = forecaster.generate_full_forecast_report()
        
        critical_or_urgent = [a for a in report['alerts'] if a['level'] in ['CRITICAL', 'URGENT']]
        
        if critical_or_urgent:
            import requests
            
            telegram_token = os.getenv('TELEGRAM_BOT_TOKEN')
            telegram_chat = os.getenv('TELEGRAM_CHAT_ID')
            
            if telegram_token and telegram_chat:
                message = "🚨 **FUEL ORDER ALERT**\n\n"
                for alert in critical_or_urgent:
                    message += f"{alert['message']}\n"
                    if alert.get('order_qty'):
                        message += f"→ Order: {alert['order_qty']:,}L\n\n"
                
                url = f"https://api.telegram.org/bot{telegram_token}/sendMessage"
                requests.post(url, json={
                    'chat_id': telegram_chat,
                    'text': message,
                    'parse_mode': 'Markdown'
                })
                
                print(f"✅ Sent {len(critical_or_urgent)} fuel alerts")
        
        return report
        
    except Exception as e:
        print(f"❌ Alert check error: {e}")
        return {"error": str(e)}
