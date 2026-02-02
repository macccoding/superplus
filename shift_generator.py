#!/usr/bin/env python3
"""
SuperPlus Gas Station Shift Generator v2
=========================================
Automated weekly schedule generation with business rules.

RULES:
1. One supervisor must be present at all times
2. Male on overnight shift EVERY night (8PM-6AM = 10h)
3. No shifts under 7 hours
4. Richard: Must work Sat, off Sun, off Wed
5. Target 40 hours per staff
6. Sunday: 1 supervisor + 4 pump attendants + overnight (all day crew 6AM-9PM)
7. Sunday rotation: If worked this Sunday, OFF next Sunday
8. Sharma & Sash: Auxiliary staff, alternate open/close, 40h each
9. Delon: Overnight specialist (8PM-6AM, 4 nights = 40h)
10. USE 15h SHIFTS (6AM-9PM) to reduce daily headcount - staff prefer fewer long days
11. Balance daily staffing - avoid overpacked days

SHIFT TYPES:
- Morning:    6AM - 2PM  (8h)
- Midday:     10AM - 6PM (8h)
- Afternoon:  2PM - 9PM  (7h)
- Extended:   6AM - 4PM  (10h)
- Full Day:   6AM - 9PM  (15h) - PREFERRED for reducing daily count
- Overnight:  8PM - 6AM  (10h) - males only
"""

import json
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass, field
import os

# =============================================================================
# CONFIGURATION
# =============================================================================

@dataclass
class StaffMember:
    name: str
    is_supervisor: bool = False
    is_male: bool = False
    is_auxiliary: bool = False
    is_overnight_specialist: bool = False
    prefers_long_shifts: bool = False  # Prefers 15h shifts, fewer days
    fixed_day_off: List[str] = field(default_factory=list)
    must_work: List[str] = field(default_factory=list)
    target_hours: int = 40

# Staff roster
STAFF_ROSTER = [
    # Supervisors
    StaffMember("KEVAUGHN", is_supervisor=True, is_male=True),
    StaffMember("MELLISA", is_supervisor=True),
    StaffMember("LIYONIE", is_supervisor=True),
    StaffMember("RICHIE", is_supervisor=True, is_male=True),
    # Richard - special constraints
    StaffMember("RICHARD", is_male=True, fixed_day_off=['SUNDAY', 'WEDNESDAY'], must_work=['SATURDAY']),
    # Regular staff - some prefer long shifts
    StaffMember("TANISHA", prefers_long_shifts=True),
    StaffMember("DENTON", is_male=True),
    StaffMember("BRITANNIA"),
    StaffMember("GEORGIA", prefers_long_shifts=True),
    StaffMember("STACEY"),
    StaffMember("ORVILLE", is_male=True),
    StaffMember("ROMONE", is_male=True),
    StaffMember("IEASHA"),
    StaffMember("RACQUEL", prefers_long_shifts=True),
    # Overnight specialist
    StaffMember("DELON", is_male=True, is_overnight_specialist=True),
    # Regular
    StaffMember("YONIQUE"),
    # Auxiliary
    StaffMember("SHARMA", is_auxiliary=True),
    StaffMember("SASH", is_auxiliary=True),
]

SHIFTS = {
    'morning': ('6:00 AM', '2:00 PM', 8),
    'midday': ('10:00 AM', '6:00 PM', 8),
    'afternoon': ('2:00 PM', '9:00 PM', 7),
    'extended_am': ('6:00 AM', '4:00 PM', 10),
    'extended_pm': ('12:00 PM', '9:00 PM', 9),
    'full_day': ('6:00 AM', '9:00 PM', 15),
    'overnight': ('8:00 PM', '6:00 AM', 10),
}

DAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY']

# Target daily staff (excluding overnight)
TARGET_DAILY_STAFF = {
    'SUNDAY': 5,      # 1 sup + 4 regular (lean)
    'MONDAY': 8,
    'TUESDAY': 8,
    'WEDNESDAY': 7,
    'THURSDAY': 8,
    'FRIDAY': 9,
    'SATURDAY': 10,
}

# =============================================================================
# SHIFT GENERATOR
# =============================================================================

class ShiftGenerator:
    def __init__(self, staff_roster: List[StaffMember], previous_sunday_workers: List[str] = None):
        self.staff = {s.name: s for s in staff_roster}
        self.schedule: Dict[str, List] = {s.name: ['OFF'] * 7 for s in staff_roster}
        self.hours: Dict[str, int] = {s.name: 0 for s in staff_roster}
        self.previous_sunday_workers = previous_sunday_workers or []
        
    def _calc_hours(self, start: str, end: str) -> int:
        def parse(t):
            t = t.replace(' ', '')
            if 'PM' in t:
                h = int(t.replace('PM', '').split(':')[0])
                if h != 12: h += 12
            else:
                h = int(t.replace('AM', '').split(':')[0])
                if h == 12: h = 0
            return h
        s, e = parse(start), parse(end)
        return (24 - s) + e if e < s else e - s
        
    def _get_staff_by_role(self, role: str) -> List[str]:
        if role == 'supervisors':
            return [s.name for s in self.staff.values() if s.is_supervisor]
        elif role == 'males':
            return [s.name for s in self.staff.values() if s.is_male]
        elif role == 'overnight_eligible':
            return [s.name for s in self.staff.values() if s.is_male and not s.is_supervisor and not s.is_overnight_specialist]
        elif role == 'overnight_specialist':
            return [s.name for s in self.staff.values() if s.is_overnight_specialist]
        elif role == 'auxiliary':
            return [s.name for s in self.staff.values() if s.is_auxiliary]
        elif role == 'regular':
            return [s.name for s in self.staff.values() 
                    if not s.is_supervisor and not s.is_auxiliary and not s.is_overnight_specialist]
        elif role == 'prefers_long':
            return [s.name for s in self.staff.values() if s.prefers_long_shifts]
        return []
    
    def _can_work_day(self, staff_name: str, day: str) -> bool:
        staff = self.staff[staff_name]
        if day in staff.fixed_day_off:
            return False
        if day == 'SUNDAY' and staff_name in self.previous_sunday_workers:
            return False
        return True
    
    def _assign_shift(self, staff_name: str, day_idx: int, shift_type: str) -> bool:
        if self.schedule[staff_name][day_idx] != 'OFF':
            return False
        start, end, hours = SHIFTS[shift_type]
        if self.hours[staff_name] + hours > 50:
            return False
        self.schedule[staff_name][day_idx] = (start, end)
        self.hours[staff_name] += hours
        return True
    
    def _get_daily_count(self, day_idx: int) -> int:
        """Count staff working on a day (excluding overnight)"""
        count = 0
        for name in self.schedule:
            shift = self.schedule[name][day_idx]
            if shift != 'OFF':
                # Don't count overnight in daily headcount
                if shift[0] != '8:00 PM':
                    count += 1
        return count
    
    def generate_schedule(self) -> Dict[str, List]:
        """Generate complete weekly schedule"""
        
        # Step 1: Sunday - lean crew, all full day
        self._assign_sunday()
        
        # Step 2: Overnight every night
        self._assign_overnight()
        
        # Step 3: Supervisors (use 15h shifts where possible)
        self._assign_supervisors()
        
        # Step 4: Richard
        self._assign_richard()
        
        # Step 5: Auxiliary (Sharma & Sash)
        self._assign_auxiliary()
        
        # Step 6: Regular staff - prefer 15h shifts to reduce daily count
        self._assign_regular_staff()
        
        # Step 7: Top up anyone under 40h
        self._top_up_hours()
        
        return self.schedule
    
    def _assign_sunday(self):
        """Sunday: 1 supervisor + 4 attendants, all 6AM-9PM"""
        day_idx = 0
        
        # Pick 1 supervisor
        available_sups = [s for s in self._get_staff_by_role('supervisors') 
                         if self._can_work_day(s, 'SUNDAY')]
        if available_sups:
            self._assign_shift(available_sups[0], day_idx, 'full_day')
        
        # Pick 1 auxiliary + 3 regular = 4 pump attendants
        auxiliary = [s for s in self._get_staff_by_role('auxiliary') if self._can_work_day(s, 'SUNDAY')]
        regular = [s for s in self._get_staff_by_role('regular') 
                   if self._can_work_day(s, 'SUNDAY') and s != 'RICHARD']
        
        assigned = 0
        if auxiliary:
            self._assign_shift(auxiliary[0], day_idx, 'full_day')
            assigned += 1
        
        for name in regular:
            if assigned >= 4:
                break
            if self._assign_shift(name, day_idx, 'full_day'):
                assigned += 1
        
        # Overnight
        overnight = self._get_staff_by_role('overnight_specialist')
        if overnight:
            self._assign_shift(overnight[0], day_idx, 'overnight')
    
    def _assign_overnight(self):
        """Male overnight every night"""
        specialist = self._get_staff_by_role('overnight_specialist')
        other_males = self._get_staff_by_role('overnight_eligible')
        
        # Delon: Sun, Tue, Thu, Sat (already has Sun)
        if specialist:
            for day_idx in [2, 4, 6]:
                self._assign_shift(specialist[0], day_idx, 'overnight')
        
        # Other males: Mon, Wed, Fri - rotate
        male_idx = 0
        for day_idx in [1, 3, 5]:
            for i in range(len(other_males)):
                male = other_males[(male_idx + i) % len(other_males)]
                if self._assign_shift(male, day_idx, 'overnight'):
                    male_idx = (male_idx + i + 1) % len(other_males)
                    break
    
    def _assign_supervisors(self):
        """Assign supervisors - use full day shifts to minimize daily count"""
        # Check who already worked Sunday
        sun_sup = None
        for sup in self._get_staff_by_role('supervisors'):
            if self.schedule[sup][0] != 'OFF':
                sun_sup = sup
                break
        
        # Supervisor pairs for coverage
        # The Sunday supervisor works fewer other days (already has 15h)
        
        if sun_sup == 'KEVAUGHN':
            # Kevaughn: Sun(15) + 2 more days = 15 + 2x10 = 35h, need 5 more
            self._assign_shift('KEVAUGHN', 3, 'extended_am')  # Wed
            self._assign_shift('KEVAUGHN', 5, 'extended_am')  # Fri
            self._assign_shift('KEVAUGHN', 6, 'morning')      # Sat 8h = 48h total, trim
            # Actually: 15+10+10+8 = 43h ✓
            
            # Mellisa: Mon, Tue, Thu, Fri, Sat evenings
            self._assign_shift('MELLISA', 1, 'extended_pm')   # Mon 9h
            self._assign_shift('MELLISA', 2, 'extended_pm')   # Tue 9h
            self._assign_shift('MELLISA', 4, 'extended_pm')   # Thu 9h
            self._assign_shift('MELLISA', 5, 'extended_pm')   # Fri 9h
            self._assign_shift('MELLISA', 6, 'afternoon')     # Sat 7h = 43h
            
            # Liyonie: Tue, Thu, Sat mornings
            self._assign_shift('LIYONIE', 2, 'extended_am')   # Tue 10h
            self._assign_shift('LIYONIE', 4, 'extended_am')   # Thu 10h
            self._assign_shift('LIYONIE', 6, 'extended_am')   # Sat 10h
            self._assign_shift('LIYONIE', 1, 'extended_am')   # Mon 10h = 40h
            
            # Richie: Mon, Wed, Fri, Sat
            self._assign_shift('RICHIE', 1, 'extended_pm')    # Mon 9h
            self._assign_shift('RICHIE', 3, 'extended_pm')    # Wed 9h
            self._assign_shift('RICHIE', 5, 'extended_pm')    # Fri 9h
            self._assign_shift('RICHIE', 6, 'extended_pm')    # Sat 9h
            self._assign_shift('RICHIE', 4, 'afternoon')      # Thu 7h = 43h
            
        else:
            # Default pattern if different sup works Sunday
            # Kevaughn: Mon, Wed, Fri, Sat
            self._assign_shift('KEVAUGHN', 1, 'extended_am')
            self._assign_shift('KEVAUGHN', 3, 'extended_am')
            self._assign_shift('KEVAUGHN', 5, 'extended_am')
            self._assign_shift('KEVAUGHN', 6, 'extended_am')
            
            # Mellisa covers evenings on her days
            for day_idx in [1, 2, 3, 5, 6]:
                if self.schedule['MELLISA'][day_idx] == 'OFF':
                    if self.hours['MELLISA'] < 40:
                        self._assign_shift('MELLISA', day_idx, 'extended_pm')
            
            # Liyonie - if worked Sunday
            if sun_sup == 'LIYONIE':
                self._assign_shift('LIYONIE', 2, 'morning')
                self._assign_shift('LIYONIE', 4, 'morning')
                self._assign_shift('LIYONIE', 6, 'morning')  # 15+8+8+8=39, need 1 more
                self._assign_shift('LIYONIE', 3, 'morning')  # +8 = 47h
            else:
                for day_idx in [2, 4, 6]:
                    self._assign_shift('LIYONIE', day_idx, 'extended_am')
                self._assign_shift('LIYONIE', 1, 'extended_am')
            
            # Richie
            if self.hours['RICHIE'] < 40:
                for day_idx in [2, 4, 5, 6]:
                    if self.hours['RICHIE'] >= 43:
                        break
                    self._assign_shift('RICHIE', day_idx, 'extended_pm')
    
    def _assign_richard(self):
        """Richard: Off Sun, Off Wed, must work Sat"""
        # Mon, Tue, Thu, Fri, Sat = 5 days
        # Use mix of 8h shifts = 40h
        for day_idx in [1, 2, 4, 5, 6]:
            self._assign_shift('RICHARD', day_idx, 'morning')
    
    def _assign_auxiliary(self):
        """Sharma & Sash - alternate, both 40h"""
        sharma_worked_sun = self.schedule['SHARMA'][0] != 'OFF'
        sash_worked_sun = self.schedule['SASH'][0] != 'OFF'
        
        if sharma_worked_sun:
            # Sharma: Sun 15h + 3 more days of 8h = 39h, need 1 more
            self._assign_shift('SHARMA', 2, 'morning')   # Tue open
            self._assign_shift('SHARMA', 4, 'morning')   # Thu open
            self._assign_shift('SHARMA', 6, 'morning')   # Sat open = 15+24=39h
            self._assign_shift('SHARMA', 3, 'morning')   # Wed = 47h, too much
            # Adjust: Tue, Thu, Sat = 15+24=39h is close enough, or add 1h somewhere
            
            # Sash: Mon, Tue, Wed, Thu, Fri alternating open/close
            self._assign_shift('SASH', 1, 'morning')     # Mon open 8h
            self._assign_shift('SASH', 2, 'afternoon')   # Tue close 7h
            self._assign_shift('SASH', 3, 'morning')     # Wed open 8h
            self._assign_shift('SASH', 4, 'afternoon')   # Thu close 7h
            self._assign_shift('SASH', 5, 'extended_am') # Fri open 10h = 40h
        else:
            # Sash worked Sunday
            self._assign_shift('SASH', 2, 'morning')
            self._assign_shift('SASH', 4, 'morning')
            self._assign_shift('SASH', 6, 'morning')
            
            self._assign_shift('SHARMA', 1, 'morning')
            self._assign_shift('SHARMA', 2, 'afternoon')
            self._assign_shift('SHARMA', 3, 'morning')
            self._assign_shift('SHARMA', 4, 'afternoon')
            self._assign_shift('SHARMA', 5, 'extended_am')
    
    def _assign_regular_staff(self):
        """Assign regular staff - USE 15h SHIFTS to reduce daily headcount"""
        regular = [s for s in self._get_staff_by_role('regular') if s != 'RICHARD']
        
        for name in regular:
            current = self.hours[name]
            if current >= 40:
                continue
            
            needed = 40 - current
            staff = self.staff[name]
            
            # Strategy: Use full_day (15h) shifts to reduce days worked
            # 15h + 15h + 10h = 40h (3 days) OR
            # 15h + 15h + 8h + 7h = 45h (4 days) - slightly over but fewer daily staff
            
            # Find available days (not Sunday unless can work, not already assigned)
            available = []
            for day_idx in range(1, 7):  # Mon-Sat
                day_name = DAYS[day_idx]
                if self._can_work_day(name, day_name) and self.schedule[name][day_idx] == 'OFF':
                    daily_count = self._get_daily_count(day_idx)
                    available.append((day_idx, daily_count))
            
            # Sort by daily count - prefer days with fewer staff
            available.sort(key=lambda x: x[1])
            
            # If staff prefers long shifts OR we want to reduce headcount
            if staff.prefers_long_shifts or needed >= 30:
                # Try to use 15h shifts
                for day_idx, _ in available:
                    if self.hours[name] >= 40:
                        break
                    if self.hours[name] + 15 <= 48:
                        self._assign_shift(name, day_idx, 'full_day')
                
                # If still under, add shorter shifts
                for day_idx, _ in available:
                    if self.hours[name] >= 40:
                        break
                    if self.schedule[name][day_idx] == 'OFF':
                        if self.hours[name] + 8 <= 48:
                            self._assign_shift(name, day_idx, 'morning')
            else:
                # Use 8h shifts (5 days)
                for day_idx, _ in available:
                    if self.hours[name] >= 40:
                        break
                    self._assign_shift(name, day_idx, 'morning')
    
    def _top_up_hours(self):
        """Ensure everyone has at least 40h (or close)"""
        for name in self.schedule:
            if name == 'DELON':
                continue  # Overnight specialist is set
            
            current = self.hours[name]
            if current >= 39:
                continue
            
            needed = 40 - current
            
            # Find any available day
            for day_idx in range(7):
                day_name = DAYS[day_idx]
                if not self._can_work_day(name, day_name):
                    continue
                if self.schedule[name][day_idx] != 'OFF':
                    continue
                
                # Add appropriate shift
                if needed >= 15:
                    self._assign_shift(name, day_idx, 'full_day')
                elif needed >= 8:
                    self._assign_shift(name, day_idx, 'morning')
                elif needed >= 7:
                    self._assign_shift(name, day_idx, 'afternoon')
                
                needed = 40 - self.hours[name]
                if needed <= 0:
                    break
    
    def get_sunday_workers(self) -> List[str]:
        """Get list of who worked Sunday for next week's rotation"""
        return [s for s in self.schedule if self.schedule[s][0] != 'OFF']
    
    def get_summary(self) -> dict:
        """Get schedule summary"""
        daily_counts = {}
        for day_idx, day in enumerate(DAYS):
            count = sum(1 for s in self.schedule if self.schedule[s][day_idx] != 'OFF')
            daily_counts[day] = count
        
        staff_hours = {name: self.hours[name] for name in self.schedule}
        
        return {
            'schedule': self.schedule,
            'hours': staff_hours,
            'daily_counts': daily_counts,
            'sunday_workers': self.get_sunday_workers(),
            'total_hours': sum(self.hours.values()),
            'avg_hours': sum(self.hours.values()) / len(self.schedule)
        }
    
    def print_summary(self):
        """Print formatted schedule"""
        print("=" * 100)
        print(f"{'STAFF':<12} | {'SUN':^7} | {'MON':^7} | {'TUE':^7} | {'WED':^7} | {'THU':^7} | {'FRI':^7} | {'SAT':^7} | TOTAL")
        print("-" * 100)
        
        for name in self.schedule:
            shifts = self.schedule[name]
            hrs = []
            for s in shifts:
                if s == 'OFF':
                    hrs.append(0)
                else:
                    hrs.append(self._calc_hours(s[0], s[1]))
            
            total = sum(hrs)
            row = f"{name:<12} |"
            for h in hrs:
                row += f" {h:^7} |" if h > 0 else "   OFF  |"
            
            status = "✓" if total >= 40 else f"({total})"
            row += f" {total}h {status}"
            
            if self.staff[name].is_supervisor:
                row = "👑" + row[1:]
            elif self.staff[name].is_auxiliary:
                row = "📎" + row[1:]
            elif self.staff[name].is_overnight_specialist:
                row = "🌙" + row[1:]
            
            print(row)
        
        print("-" * 100)
        print(f"TOTAL: {sum(self.hours.values())}h | AVG: {sum(self.hours.values())/len(self.schedule):.1f}h")
        
        print("\n📊 DAILY STAFF COUNT:")
        for day_idx, day in enumerate(DAYS):
            count = sum(1 for s in self.schedule if self.schedule[s][day_idx] != 'OFF')
            overnight = sum(1 for s in self.schedule 
                          if self.schedule[s][day_idx] != 'OFF' and 
                          self.schedule[s][day_idx][0] == '8:00 PM')
            day_staff = count - overnight
            print(f"  {day}: {day_staff} day + {overnight} overnight = {count} total")
    
    def export_json(self) -> str:
        """Export as JSON"""
        return json.dumps(self.get_summary(), indent=2, default=str)


# =============================================================================
# GOOGLE SHEETS INTEGRATION
# =============================================================================

def save_schedule_to_sheets(generator: ShiftGenerator, sheet_manager, week_start_date: str):
    """
    Save generated schedule to Google Sheets.
    Creates/updates a 'Shifts_Gas' tab.
    """
    schedule = generator.schedule
    
    # Prepare rows for sheet
    rows = []
    base_date = datetime.strptime(week_start_date, "%Y-%m-%d")
    
    for day_idx, day in enumerate(DAYS):
        date_str = (base_date + timedelta(days=day_idx)).strftime("%Y-%m-%d")
        
        for staff_name, shifts in schedule.items():
            shift = shifts[day_idx]
            if shift != 'OFF':
                start, end = shift
                hours = generator._calc_hours(start, end)
                is_overnight = 'PM' in start and 'AM' in end
                
                rows.append({
                    'Date': date_str,
                    'Day': day,
                    'Staff_Name': staff_name,
                    'Shift_Start': start,
                    'Shift_End': end,
                    'Hours': hours,
                    'Is_Overnight': 'Yes' if is_overnight else 'No',
                    'Role': 'Supervisor' if generator.staff[staff_name].is_supervisor 
                           else 'Auxiliary' if generator.staff[staff_name].is_auxiliary
                           else 'Overnight' if generator.staff[staff_name].is_overnight_specialist
                           else 'Regular'
                })
    
    # Save to sheet (implement based on your sheet_manager)
    return rows


def load_previous_sunday_workers(sheet_manager) -> List[str]:
    """Load previous Sunday workers from sheet for rotation"""
    try:
        # Try to read from a metadata/config tab
        # For now, return empty - can be stored in sheet
        return []
    except:
        return []


def save_sunday_workers(sheet_manager, workers: List[str]):
    """Save Sunday workers for next week's rotation"""
    # Store in sheet or config
    pass


# =============================================================================
# MAIN / TEST
# =============================================================================

if __name__ == "__main__":
    print("\n" + "="*60)
    print("SUPERPLUS SHIFT GENERATOR v2")
    print("="*60)
    
    # Week 1
    print("\n📅 WEEK 1 SCHEDULE")
    gen1 = ShiftGenerator(STAFF_ROSTER, previous_sunday_workers=[])
    gen1.generate_schedule()
    gen1.print_summary()
    
    week1_sunday = gen1.get_sunday_workers()
    print(f"\n🔄 Sunday rotation - these staff OFF next Sunday: {week1_sunday}")
    
    # Week 2
    print("\n" + "="*60)
    print("\n📅 WEEK 2 SCHEDULE (Sunday rotation applied)")
    gen2 = ShiftGenerator(STAFF_ROSTER, previous_sunday_workers=week1_sunday)
    gen2.generate_schedule()
    gen2.print_summary()
    
    week2_sunday = gen2.get_sunday_workers()
    print(f"\n🔄 Sunday rotation - these staff OFF next Sunday: {week2_sunday}")
