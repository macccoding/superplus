"""
SuperPlus AI Agent - Sheet Manager
Routes data to correct tabs, creates tabs if missing, provides unified query interface.

Tab Structure:
- Daily_Summary: High-level daily totals
- Fuel_Sales: Gas station sales detail by day
- Fuel_Inventory: Opening/closing dips by day
- Fuel_Deliveries: Individual tanker deliveries (multiple per day possible)
- Competitor_Prices: Price observations (one row per competitor per day)
- Shifts: Staff scheduling (future)
- Invoices: Scanned document records (future)
"""

import os
import json
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
import gspread
from google.oauth2.service_account import Credentials


class SheetManager:
    """
    Manages multi-tab Google Sheet structure for SuperPlus.
    Routes incoming data to appropriate tabs and provides query methods.
    """
    
    # Tab definitions with headers
    TAB_SCHEMAS = {
        'Daily_Summary': [
            'Date', 'Day', 'Total_Revenue', 'Gas_Revenue', 'Store_Sales', 
            'Deli_Sales', 'Phone_Cards', 'Total_Litres',
            'Weather_Condition', 'Weather_Temp_C', 'Weather_Rain_MM', 'Notes'
        ],
        'Fuel_Sales': [
            'Date', 'Day', 'Gas_87_Litres', 'Gas_90_Litres', 'Gas_ADO_Litres', 'Gas_ULSD_Litres',
            'Total_Litres', 'Price_87', 'Price_90', 'Price_ADO', 'Price_ULSD',
            'Revenue_87', 'Revenue_90', 'Revenue_ADO', 'Revenue_ULSD', 'Total_Revenue'
        ],
        'Fuel_Inventory': [
            'Date', 'Day',
            'Opening_87', 'Opening_90', 'Opening_ADO', 'Opening_ULSD',
            'Closing_87', 'Closing_90', 'Closing_ADO', 'Closing_ULSD',
            'Sold_87', 'Sold_90', 'Sold_ADO', 'Sold_ULSD',
            'Shrinkage_87', 'Shrinkage_90', 'Shrinkage_ADO', 'Shrinkage_ULSD',
            'Notes'
        ],
        'Fuel_Deliveries': [
            'Date', 'Time', 'Fuel_Type', 'Litres', 'Cost_Per_Litre', 'Total_Cost',
            'Supplier', 'Invoice_Number', 'Notes'
        ],
        'Competitor_Prices': [
            'Date', 'Competitor', 'Price_87', 'Price_90', 'Price_ADO', 'Price_ULSD', 'Notes'
        ]
    }
    
    # Header formatting
    HEADER_FORMAT = {
        "backgroundColor": {"red": 0.2, "green": 0.6, "blue": 0.86},
        "textFormat": {"bold": True, "foregroundColor": {"red": 1, "green": 1, "blue": 1}},
        "horizontalAlignment": "CENTER"
    }
    
    def __init__(self, sheet):
        """
        Initialize with gspread sheet object.
        
        Args:
            sheet: gspread Spreadsheet object (from gc.open_by_key())
        """
        self.sheet = sheet
        self._ensure_tabs_exist()
    
    def _ensure_tabs_exist(self):
        """Create any missing tabs with correct headers"""
        existing_tabs = [ws.title for ws in self.sheet.worksheets()]
        
        for tab_name, headers in self.TAB_SCHEMAS.items():
            if tab_name not in existing_tabs:
                print(f"📋 Creating tab: {tab_name}")
                worksheet = self.sheet.add_worksheet(tab_name, rows=1000, cols=len(headers) + 5)
                worksheet.append_row(headers)
                
                # Format header row
                header_range = f'A1:{chr(64 + len(headers))}1'
                worksheet.format(header_range, self.HEADER_FORMAT)
            else:
                # Verify headers match (in case schema changed)
                worksheet = self.sheet.worksheet(tab_name)
                current_headers = worksheet.row_values(1)
                if current_headers != headers:
                    print(f"📝 Updating headers for {tab_name}")
                    header_range = f'A1:{chr(64 + len(headers))}1'
                    worksheet.update(header_range, [headers])
    
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
    
    def _get_day_of_week(self, date_str: str) -> str:
        """Get day name from date string"""
        try:
            date_obj = datetime.strptime(date_str, '%Y-%m-%d')
            return date_obj.strftime('%A')
        except:
            return ''
    
    def _find_or_create_row(self, worksheet, date_str: str) -> int:
        """Find existing row for date or return next empty row"""
        dates = worksheet.col_values(1)[1:]  # Skip header
        if date_str in dates:
            return dates.index(date_str) + 2  # +2 for header and 0-index
        return len(dates) + 2
    
    # ============================================
    # ROUTING - Main entry point
    # ============================================
    
    def route_data(self, data: Dict) -> Dict:
        """
        Route extracted data to appropriate tabs.
        Returns summary of what was updated.
        
        Args:
            data: Extracted data dictionary from agent_reasoning
        
        Returns:
            Dict with update results for each tab
        """
        results = {
            'date': data.get('date'),
            'updates': []
        }
        
        date_str = data.get('date')
        if not date_str:
            return {'error': 'No date provided', 'updates': []}
        
        # Check what data we have and route accordingly
        
        # Daily summary (store, deli, phone, totals)
        if any([data.get('store_sales'), data.get('deli_sales'), data.get('phone_cards')]):
            self._update_daily_summary(data)
            results['updates'].append('Daily_Summary')
        
        # Fuel sales (litres sold, prices)
        if any([data.get('gas_87'), data.get('gas_90'), data.get('gas_ado'), data.get('gas_ulsd')]):
            self._update_fuel_sales(data)
            results['updates'].append('Fuel_Sales')
            # Also update daily summary with gas totals
            self._update_daily_summary_gas(data)
        
        # Fuel inventory (opening/closing dips)
        if any([data.get('opening_87'), data.get('opening_90'), data.get('closing_87'), data.get('closing_90')]):
            self._update_fuel_inventory(data)
            results['updates'].append('Fuel_Inventory')
        
        # Fuel deliveries (tanker arrivals with costs)
        if any([data.get('delivery_87'), data.get('delivery_90'), data.get('delivery_ado'), data.get('delivery_ulsd')]):
            self._update_fuel_deliveries(data)
            results['updates'].append('Fuel_Deliveries')
        
        # Competitor prices
        if data.get('competitor_prices'):
            self._update_competitor_prices(data)
            results['updates'].append('Competitor_Prices')
        
        # Prices only (update Fuel_Sales)
        if any([data.get('gasmart_87_price'), data.get('gasmart_90_price')]) and 'Fuel_Sales' not in results['updates']:
            self._update_fuel_prices(data)
            results['updates'].append('Fuel_Sales (prices)')
        
        print(f"✅ Routed data for {date_str} to: {', '.join(results['updates'])}")
        return results
    
    # ============================================
    # TAB UPDATE METHODS
    # ============================================
    
    def _update_daily_summary(self, data: Dict):
        """Update Daily_Summary tab with store/deli/phone data"""
        worksheet = self.sheet.worksheet('Daily_Summary')
        date_str = data['date']
        row_idx = self._find_or_create_row(worksheet, date_str)
        
        # Get existing row if updating
        existing = {}
        if row_idx <= len(worksheet.get_all_values()):
            existing_row = worksheet.row_values(row_idx)
            headers = self.TAB_SCHEMAS['Daily_Summary']
            existing = {headers[i]: existing_row[i] if i < len(existing_row) else '' for i in range(len(headers))}
        
        # Merge new data with existing
        store = data.get('store_sales') if data.get('store_sales') else self._safe_float(existing.get('Store_Sales', 0))
        deli = data.get('deli_sales') if data.get('deli_sales') else self._safe_float(existing.get('Deli_Sales', 0))
        phone = data.get('phone_cards') if data.get('phone_cards') else self._safe_float(existing.get('Phone_Cards', 0))
        gas_rev = self._safe_float(existing.get('Gas_Revenue', 0))
        total_litres = self._safe_float(existing.get('Total_Litres', 0))
        
        total_revenue = sum([x for x in [store, deli, phone, gas_rev] if x])
        
        # Weather
        weather_condition = existing.get('Weather_Condition', '')
        weather_temp = existing.get('Weather_Temp_C', '')
        weather_rain = existing.get('Weather_Rain_MM', '')
        
        try:
            from weather_service import get_weather_for_date
            weather = get_weather_for_date(date_str)
            if weather:
                weather_condition = weather.get('condition', '') or weather_condition
                weather_temp = weather.get('temp_max_c', '') or weather_temp
                weather_rain = weather.get('rain_mm', '') or weather_rain
        except:
            pass
        
        row = [
            date_str,
            self._get_day_of_week(date_str),
            total_revenue if total_revenue else '',
            gas_rev if gas_rev else '',
            store if store else '',
            deli if deli else '',
            phone if phone else '',
            total_litres if total_litres else '',
            weather_condition,
            weather_temp,
            weather_rain,
            data.get('notes', existing.get('Notes', ''))
        ]
        
        worksheet.update(f'A{row_idx}:L{row_idx}', [row])
    
    def _update_daily_summary_gas(self, data: Dict):
        """Update just the gas revenue and litres in Daily_Summary"""
        worksheet = self.sheet.worksheet('Daily_Summary')
        date_str = data['date']
        row_idx = self._find_or_create_row(worksheet, date_str)
        
        # Ensure basic row exists
        existing = worksheet.row_values(row_idx) if row_idx <= len(worksheet.get_all_values()) else []
        if not existing or existing[0] != date_str:
            worksheet.update(f'A{row_idx}:B{row_idx}', [[date_str, self._get_day_of_week(date_str)]])
            existing = [date_str, self._get_day_of_week(date_str)] + [''] * 10
        
        # Calculate totals
        litres_87 = self._safe_float(data.get('gas_87', 0))
        litres_90 = self._safe_float(data.get('gas_90', 0))
        litres_ado = self._safe_float(data.get('gas_ado', 0))
        litres_ulsd = self._safe_float(data.get('gas_ulsd', 0))
        total_litres = litres_87 + litres_90 + litres_ado + litres_ulsd
        
        # Get prices for revenue calc
        price_87 = self._safe_float(data.get('gasmart_87_price', 0))
        price_90 = self._safe_float(data.get('gasmart_90_price', 0))
        price_ado = self._safe_float(data.get('gasmart_ado_price', 0))
        price_ulsd = self._safe_float(data.get('gasmart_ulsd_price', 0))
        
        # If no prices in this data, try to get from Fuel_Sales
        if not price_87:
            fuel_sales = self.get_fuel_sales(date_str)
            if fuel_sales:
                price_87 = self._safe_float(fuel_sales.get('Price_87', 0))
                price_90 = self._safe_float(fuel_sales.get('Price_90', 0))
                price_ado = self._safe_float(fuel_sales.get('Price_ADO', 0))
                price_ulsd = self._safe_float(fuel_sales.get('Price_ULSD', 0))
        
        gas_revenue = 0
        if price_87 and litres_87:
            gas_revenue += litres_87 * price_87
        if price_90 and litres_90:
            gas_revenue += litres_90 * price_90
        if price_ado and litres_ado:
            gas_revenue += litres_ado * price_ado
        if price_ulsd and litres_ulsd:
            gas_revenue += litres_ulsd * price_ulsd
        
        # Update columns D (Gas_Revenue) and H (Total_Litres)
        if gas_revenue:
            worksheet.update(f'D{row_idx}', [[gas_revenue]])
        if total_litres:
            worksheet.update(f'H{row_idx}', [[total_litres]])
        
        # Recalculate total revenue
        store = self._safe_float(existing[4]) if len(existing) > 4 else 0
        deli = self._safe_float(existing[5]) if len(existing) > 5 else 0
        phone = self._safe_float(existing[6]) if len(existing) > 6 else 0
        total_revenue = sum([x for x in [store, deli, phone, gas_revenue] if x])
        
        if total_revenue:
            worksheet.update(f'C{row_idx}', [[total_revenue]])
    
    def _update_fuel_sales(self, data: Dict):
        """Update Fuel_Sales tab with litres and prices"""
        worksheet = self.sheet.worksheet('Fuel_Sales')
        date_str = data['date']
        row_idx = self._find_or_create_row(worksheet, date_str)
        
        # Get existing data
        existing = {}
        if row_idx <= len(worksheet.get_all_values()):
            existing_row = worksheet.row_values(row_idx)
            headers = self.TAB_SCHEMAS['Fuel_Sales']
            existing = {headers[i]: existing_row[i] if i < len(existing_row) else '' for i in range(len(headers))}
        
        # Merge data
        litres_87 = data.get('gas_87') if data.get('gas_87') else self._safe_float(existing.get('Gas_87_Litres', 0))
        litres_90 = data.get('gas_90') if data.get('gas_90') else self._safe_float(existing.get('Gas_90_Litres', 0))
        litres_ado = data.get('gas_ado') if data.get('gas_ado') else self._safe_float(existing.get('Gas_ADO_Litres', 0))
        litres_ulsd = data.get('gas_ulsd') if data.get('gas_ulsd') else self._safe_float(existing.get('Gas_ULSD_Litres', 0))
        total_litres = sum([x for x in [litres_87, litres_90, litres_ado, litres_ulsd] if x])
        
        price_87 = data.get('gasmart_87_price') if data.get('gasmart_87_price') else self._safe_float(existing.get('Price_87', 0))
        price_90 = data.get('gasmart_90_price') if data.get('gasmart_90_price') else self._safe_float(existing.get('Price_90', 0))
        price_ado = data.get('gasmart_ado_price') if data.get('gasmart_ado_price') else self._safe_float(existing.get('Price_ADO', 0))
        price_ulsd = data.get('gasmart_ulsd_price') if data.get('gasmart_ulsd_price') else self._safe_float(existing.get('Price_ULSD', 0))
        
        # Calculate revenues
        rev_87 = litres_87 * price_87 if litres_87 and price_87 else ''
        rev_90 = litres_90 * price_90 if litres_90 and price_90 else ''
        rev_ado = litres_ado * price_ado if litres_ado and price_ado else ''
        rev_ulsd = litres_ulsd * price_ulsd if litres_ulsd and price_ulsd else ''
        total_rev = sum([x for x in [rev_87, rev_90, rev_ado, rev_ulsd] if isinstance(x, (int, float))])
        
        row = [
            date_str,
            self._get_day_of_week(date_str),
            litres_87 or '',
            litres_90 or '',
            litres_ado or '',
            litres_ulsd or '',
            total_litres or '',
            price_87 or '',
            price_90 or '',
            price_ado or '',
            price_ulsd or '',
            rev_87,
            rev_90,
            rev_ado,
            rev_ulsd,
            total_rev or ''
        ]
        
        worksheet.update(f'A{row_idx}:P{row_idx}', [row])
    
    def _update_fuel_prices(self, data: Dict):
        """Update just prices in Fuel_Sales (when only prices reported)"""
        worksheet = self.sheet.worksheet('Fuel_Sales')
        date_str = data['date']
        row_idx = self._find_or_create_row(worksheet, date_str)
        
        # Ensure row exists with date
        existing = worksheet.row_values(row_idx) if row_idx <= len(worksheet.get_all_values()) else []
        if not existing or existing[0] != date_str:
            worksheet.update(f'A{row_idx}:B{row_idx}', [[date_str, self._get_day_of_week(date_str)]])
        
        # Update price columns (H-K)
        prices = [
            data.get('gasmart_87_price', ''),
            data.get('gasmart_90_price', ''),
            data.get('gasmart_ado_price', ''),
            data.get('gasmart_ulsd_price', '')
        ]
        
        # Only update non-empty prices
        for i, price in enumerate(prices):
            if price:
                col = chr(72 + i)  # H, I, J, K
                worksheet.update(f'{col}{row_idx}', [[price]])
    
    def _update_fuel_inventory(self, data: Dict):
        """Update Fuel_Inventory tab with dips"""
        worksheet = self.sheet.worksheet('Fuel_Inventory')
        date_str = data['date']
        row_idx = self._find_or_create_row(worksheet, date_str)
        
        # Get existing
        existing = {}
        if row_idx <= len(worksheet.get_all_values()):
            existing_row = worksheet.row_values(row_idx)
            headers = self.TAB_SCHEMAS['Fuel_Inventory']
            existing = {headers[i]: existing_row[i] if i < len(existing_row) else '' for i in range(len(headers))}
        
        # Merge
        open_87 = data.get('opening_87') if data.get('opening_87') else self._safe_float(existing.get('Opening_87', 0)) or ''
        open_90 = data.get('opening_90') if data.get('opening_90') else self._safe_float(existing.get('Opening_90', 0)) or ''
        open_ado = data.get('opening_ado') if data.get('opening_ado') else self._safe_float(existing.get('Opening_ADO', 0)) or ''
        open_ulsd = data.get('opening_ulsd') if data.get('opening_ulsd') else self._safe_float(existing.get('Opening_ULSD', 0)) or ''
        
        close_87 = data.get('closing_87') if data.get('closing_87') else self._safe_float(existing.get('Closing_87', 0)) or ''
        close_90 = data.get('closing_90') if data.get('closing_90') else self._safe_float(existing.get('Closing_90', 0)) or ''
        close_ado = data.get('closing_ado') if data.get('closing_ado') else self._safe_float(existing.get('Closing_ADO', 0)) or ''
        close_ulsd = data.get('closing_ulsd') if data.get('closing_ulsd') else self._safe_float(existing.get('Closing_ULSD', 0)) or ''
        
        # Get sold from Fuel_Sales for shrinkage calc
        fuel_sales = self.get_fuel_sales(date_str)
        sold_87 = self._safe_float(fuel_sales.get('Gas_87_Litres', 0)) if fuel_sales else ''
        sold_90 = self._safe_float(fuel_sales.get('Gas_90_Litres', 0)) if fuel_sales else ''
        sold_ado = self._safe_float(fuel_sales.get('Gas_ADO_Litres', 0)) if fuel_sales else ''
        sold_ulsd = self._safe_float(fuel_sales.get('Gas_ULSD_Litres', 0)) if fuel_sales else ''
        
        # Get deliveries for shrinkage calc
        deliveries = self.get_deliveries_for_date(date_str)
        del_87 = sum([self._safe_float(d.get('Litres', 0)) for d in deliveries if str(d.get('Fuel_Type', '')).upper() == '87'])
        del_90 = sum([self._safe_float(d.get('Litres', 0)) for d in deliveries if str(d.get('Fuel_Type', '')).upper() == '90'])
        del_ado = sum([self._safe_float(d.get('Litres', 0)) for d in deliveries if str(d.get('Fuel_Type', '')).upper() in ['ADO', 'DIESEL']])
        del_ulsd = sum([self._safe_float(d.get('Litres', 0)) for d in deliveries if str(d.get('Fuel_Type', '')).upper() == 'ULSD'])
        
        # Calculate shrinkage: opening + deliveries - sold - closing = shrinkage
        def calc_shrinkage(opening, delivered, sold, closing):
            if all([opening, closing]) and opening != '' and closing != '':
                expected = self._safe_float(opening) + delivered - self._safe_float(sold or 0)
                return round(expected - self._safe_float(closing), 1)
            return ''
        
        shrink_87 = calc_shrinkage(open_87, del_87, sold_87, close_87)
        shrink_90 = calc_shrinkage(open_90, del_90, sold_90, close_90)
        shrink_ado = calc_shrinkage(open_ado, del_ado, sold_ado, close_ado)
        shrink_ulsd = calc_shrinkage(open_ulsd, del_ulsd, sold_ulsd, close_ulsd)
        
        row = [
            date_str,
            self._get_day_of_week(date_str),
            open_87, open_90, open_ado, open_ulsd,
            close_87, close_90, close_ado, close_ulsd,
            sold_87, sold_90, sold_ado, sold_ulsd,
            shrink_87, shrink_90, shrink_ado, shrink_ulsd,
            data.get('notes', existing.get('Notes', ''))
        ]
        
        worksheet.update(f'A{row_idx}:S{row_idx}', [row])
    
    def _update_fuel_deliveries(self, data: Dict):
        """Add fuel delivery records (append, don't update)"""
        worksheet = self.sheet.worksheet('Fuel_Deliveries')
        date_str = data['date']
        current_time = datetime.now().strftime('%H:%M')
        
        # Each fuel type with delivery gets its own row
        for fuel in ['87', '90', 'ado', 'ulsd']:
            litres = data.get(f'delivery_{fuel}')
            if litres:
                cost = data.get(f'delivery_{fuel}_cost', '')
                total_cost = litres * cost if litres and cost else ''
                
                row = [
                    date_str,
                    current_time,
                    fuel.upper(),
                    litres,
                    cost,
                    total_cost,
                    '',  # Supplier
                    '',  # Invoice number
                    data.get('notes', '')
                ]
                
                worksheet.append_row(row)
                print(f"📦 Added delivery: {fuel.upper()} {litres}L @ ${cost}/L")
    
    def _update_competitor_prices(self, data: Dict):
        """Add competitor price records"""
        worksheet = self.sheet.worksheet('Competitor_Prices')
        date_str = data['date']
        
        for comp in data.get('competitor_prices', []):
            comp_name = comp.get('competitor', 'Unknown')
            
            row = [
                date_str,
                comp_name,
                comp.get('fuel_87', ''),
                comp.get('fuel_90', ''),
                comp.get('fuel_ado', ''),
                comp.get('fuel_ulsd', ''),
                ''
            ]
            
            worksheet.append_row(row)
            print(f"🏁 Added competitor prices: {comp_name}")
    
    # ============================================
    # QUERY METHODS - For reports and analysis
    # ============================================
    
    def get_daily_summary(self, date_str: str) -> Optional[Dict]:
        """Get daily summary for a specific date"""
        worksheet = self.sheet.worksheet('Daily_Summary')
        records = worksheet.get_all_records()
        for record in records:
            if record.get('Date') == date_str:
                return record
        return None
    
    def get_daily_summaries(self, days: int = 7) -> List[Dict]:
        """Get last N days of daily summaries"""
        worksheet = self.sheet.worksheet('Daily_Summary')
        records = worksheet.get_all_records()
        return records[-days:] if len(records) >= days else records
    
    def get_fuel_sales(self, date_str: str) -> Optional[Dict]:
        """Get fuel sales for a specific date"""
        worksheet = self.sheet.worksheet('Fuel_Sales')
        records = worksheet.get_all_records()
        for record in records:
            if record.get('Date') == date_str:
                return record
        return None
    
    def get_fuel_sales_range(self, days: int = 7) -> List[Dict]:
        """Get last N days of fuel sales"""
        worksheet = self.sheet.worksheet('Fuel_Sales')
        records = worksheet.get_all_records()
        return records[-days:] if len(records) >= days else records
    
    def get_fuel_inventory(self, date_str: str) -> Optional[Dict]:
        """Get fuel inventory for a specific date"""
        worksheet = self.sheet.worksheet('Fuel_Inventory')
        records = worksheet.get_all_records()
        for record in records:
            if record.get('Date') == date_str:
                return record
        return None
    
    def get_fuel_inventory_range(self, days: int = 7) -> List[Dict]:
        """Get last N days of fuel inventory"""
        worksheet = self.sheet.worksheet('Fuel_Inventory')
        records = worksheet.get_all_records()
        return records[-days:] if len(records) >= days else records
    
    def get_deliveries_for_date(self, date_str: str) -> List[Dict]:
        """Get all deliveries for a specific date"""
        worksheet = self.sheet.worksheet('Fuel_Deliveries')
        records = worksheet.get_all_records()
        return [r for r in records if r.get('Date') == date_str]
    
    def get_deliveries_range(self, days: int = 30) -> List[Dict]:
        """Get deliveries from last N days"""
        worksheet = self.sheet.worksheet('Fuel_Deliveries')
        records = worksheet.get_all_records()
        
        cutoff = (datetime.now() - timedelta(days=days)).strftime('%Y-%m-%d')
        return [r for r in records if r.get('Date', '') >= cutoff]
    
    def get_latest_delivery_cost(self, fuel_type: str) -> Optional[float]:
        """Get most recent delivery cost for a fuel type"""
        worksheet = self.sheet.worksheet('Fuel_Deliveries')
        records = worksheet.get_all_records()
        
        fuel_type = fuel_type.upper()
        for record in reversed(records):
            if str(record.get('Fuel_Type', '')).upper() == fuel_type:
                cost = self._safe_float(record.get('Cost_Per_Litre', 0))
                if cost > 0:
                    return cost
        return None
    
    def get_competitor_prices(self, date_str: str = None, days: int = 1) -> List[Dict]:
        """Get competitor prices for a date or last N days"""
        worksheet = self.sheet.worksheet('Competitor_Prices')
        records = worksheet.get_all_records()
        
        if date_str:
            return [r for r in records if r.get('Date') == date_str]
        
        cutoff = (datetime.now() - timedelta(days=days)).strftime('%Y-%m-%d')
        return [r for r in records if r.get('Date', '') >= cutoff]
    
    def get_latest_inventory(self) -> Dict:
        """Get most recent inventory levels (opening dips)"""
        worksheet = self.sheet.worksheet('Fuel_Inventory')
        records = worksheet.get_all_records()
        
        if not records:
            return {}
        
        latest = records[-1]
        return {
            'date': latest.get('Date', ''),
            '87': self._safe_float(latest.get('Opening_87', 0)),
            '90': self._safe_float(latest.get('Opening_90', 0)),
            'ado': self._safe_float(latest.get('Opening_ADO', 0)),
            'ulsd': self._safe_float(latest.get('Opening_ULSD', 0))
        }
    
    # ============================================
    # AGGREGATE QUERIES - For reports
    # ============================================
    
    def get_weekly_summary(self, weeks_back: int = 0) -> Dict:
        """Get aggregated weekly summary"""
        today = datetime.now()
        week_start = today - timedelta(days=today.weekday() + (weeks_back * 7))
        week_end = week_start + timedelta(days=6)
        
        summaries = self.get_daily_summaries(days=30)
        
        week_data = [
            s for s in summaries 
            if week_start.strftime('%Y-%m-%d') <= s.get('Date', '') <= week_end.strftime('%Y-%m-%d')
        ]
        
        if not week_data:
            return {}
        
        return {
            'week_start': week_start.strftime('%Y-%m-%d'),
            'week_end': week_end.strftime('%Y-%m-%d'),
            'days': len(week_data),
            'total_revenue': sum([self._safe_float(d.get('Total_Revenue', 0)) for d in week_data]),
            'gas_revenue': sum([self._safe_float(d.get('Gas_Revenue', 0)) for d in week_data]),
            'store_sales': sum([self._safe_float(d.get('Store_Sales', 0)) for d in week_data]),
            'deli_sales': sum([self._safe_float(d.get('Deli_Sales', 0)) for d in week_data]),
            'phone_cards': sum([self._safe_float(d.get('Phone_Cards', 0)) for d in week_data]),
            'total_litres': sum([self._safe_float(d.get('Total_Litres', 0)) for d in week_data])
        }
    
    def get_shrinkage_summary(self, days: int = 7) -> Dict:
        """Get shrinkage summary for period"""
        inventory = self.get_fuel_inventory_range(days)
        
        result = {
            'days_with_data': 0,
            '87': {'total': 0, 'days': 0},
            '90': {'total': 0, 'days': 0},
            'ado': {'total': 0, 'days': 0},
            'ulsd': {'total': 0, 'days': 0}
        }
        
        for record in inventory:
            has_data = False
            for fuel in ['87', '90', 'ado', 'ulsd']:
                col_name = f'Shrinkage_{fuel.upper()}' if fuel != 'ado' else 'Shrinkage_ADO'
                shrink = self._safe_float(record.get(col_name, 0))
                if shrink != 0:
                    result[fuel]['total'] += shrink
                    result[fuel]['days'] += 1
                    has_data = True
            if has_data:
                result['days_with_data'] += 1
        
        return result
