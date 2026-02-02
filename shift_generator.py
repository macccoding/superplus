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
5. Target EXACTLY 40 hours (minimum) - extend shifts 1-3h to reach, don't add full shifts
6. Sunday: 1 supervisor + 4 pump attendants + overnight (all day crew 6AM-9PM)
7. Sunday rotation: If worked this Sunday, OFF next Sunday
8. Sharma & Sash: Auxiliary staff, alternate open/close, 40h each
9. Delon: Overnight specialist (8PM-6AM, 4 nights = 40h)
10. USE 15h SHIFTS (6AM-9PM) to reduce daily headcount
11. NO CLOSE-THEN-OPEN: If closing 9PM, cannot open 6AM next day

SHIFT TYPES:
- Morning:    6AM - 2PM  (8h)
- Midday:     10AM - 6PM (8h)
- Afternoon:  2PM - 9PM  (7h)
- Extended:   6AM - 4PM  (10h)
- Full Day:   6AM - 9PM  (15h)
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
    prefers_long_shifts: bool = False
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
    # Regular staff
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

# Daily staffing targets (day staff + overnight)
# Based on business volume - Friday is busiest
DAILY_TARGETS = {
    'SUNDAY': 8,      # 1 sup + 5 att + 1 aux + 1 overnight (fixed/lean)
    'MONDAY': 10,     # Slower day
    'TUESDAY': 11,
    'WEDNESDAY': 11,
    'THURSDAY': 11,
    'FRIDAY': 12,     # Busy day - needs more staff
    'SATURDAY': 9,    # Lighter than weekdays
}

# Minimum coverage requirements
MIN_OPENERS = 3   # At least 3 attendants for opening (6AM)
MIN_CLOSERS = 3   # At least 3 attendants for closing (9PM)

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
        return []
    
    def _can_work_day(self, staff_name: str, day: str) -> bool:
        staff = self.staff[staff_name]
        if day in staff.fixed_day_off:
            return False
        if day == 'SUNDAY' and staff_name in self.previous_sunday_workers:
            return False
        
        # Check overnight-then-off rule: if worked overnight on previous day,
        # they end at 6AM today and should be OFF today's daytime shift
        day_idx = DAYS.index(day)
        prev_day_idx = (day_idx - 1) % 7  # Wrap Sunday->Saturday
        
        prev_shift = self.schedule[staff_name][prev_day_idx]
        if prev_shift != 'OFF' and prev_shift[0] == '8:00 PM':
            # Previous day was overnight (8PM-6AM), ends 6AM today = OFF today
            return False
        
        return True
    
    def _closes_at_9pm(self, staff_name: str, day_idx: int) -> bool:
        """Check if staff closes at 9PM on given day"""
        shift = self.schedule[staff_name][day_idx]
        if shift == 'OFF':
            return False
        return shift[1] == '9:00 PM'
    
    def _can_open_next_day(self, staff_name: str, day_idx: int) -> bool:
        """Check if staff can open (6AM) the day after day_idx"""
        if day_idx == 0:
            return True  # No previous day to check
        prev_day = day_idx - 1
        return not self._closes_at_9pm(staff_name, prev_day)
    
    def _assign_shift(self, staff_name: str, day_idx: int, shift_type: str) -> bool:
        if self.schedule[staff_name][day_idx] != 'OFF':
            return False
        
        start, end, hours = SHIFTS[shift_type]
        
        # Check close-then-open rule
        if start == '6:00 AM' and not self._can_open_next_day(staff_name, day_idx):
            return False
        
        # Check if closing at 9PM would block next day opening
        # (we'll handle this in assignment logic)
        
        if self.hours[staff_name] + hours > 48:  # Hard cap
            return False
            
        self.schedule[staff_name][day_idx] = (start, end)
        self.hours[staff_name] += hours
        return True
    
    def _extend_shift(self, staff_name: str, day_idx: int, extra_hours: int) -> bool:
        """Extend an existing shift by 1-3 hours to reach 40h"""
        shift = self.schedule[staff_name][day_idx]
        if shift == 'OFF':
            return False
        
        start, end = shift
        current_hours = self._calc_hours(start, end)
        
        # Don't extend overnight shifts
        if '8:00 PM' in start:
            return False
        
        # Parse end time
        end_hour = self._parse_hour(end)
        
        # Can only extend up to 9PM (21:00)
        if end_hour >= 21:
            return False
        
        # Calculate how much we can actually extend
        max_extend = 21 - end_hour
        actual_extend = min(extra_hours, max_extend, 3)
        
        if actual_extend <= 0:
            return False
        
        new_end_hour = end_hour + actual_extend
        
        # Format new end time
        if new_end_hour == 12:
            new_end = "12:00 PM"
        elif new_end_hour > 12:
            new_end = f"{new_end_hour - 12}:00 PM"
        else:
            new_end = f"{new_end_hour}:00 AM"
        
        self.schedule[staff_name][day_idx] = (start, new_end)
        self.hours[staff_name] += actual_extend
        return True
    
    def _parse_hour(self, time_str: str) -> int:
        time_str = time_str.replace(' ', '')
        if 'PM' in time_str:
            h = int(time_str.replace('PM', '').split(':')[0])
            if h != 12: h += 12
        else:
            h = int(time_str.replace('AM', '').split(':')[0])
            if h == 12: h = 0
        return h
    
    def _get_daily_count(self, day_idx: int) -> int:
        count = 0
        for name in self.schedule:
            shift = self.schedule[name][day_idx]
            if shift != 'OFF' and shift[0] != '8:00 PM':
                count += 1
        return count
    
    def generate_schedule(self) -> Dict[str, List]:
        """Generate complete weekly schedule"""
        
        # Step 1: Sunday - lean crew
        self._assign_sunday()
        
        # Step 2: Overnight every night
        self._assign_overnight()
        
        # Step 3: Supervisors
        self._assign_supervisors()
        
        # Step 4: Richard
        self._assign_richard()
        
        # Step 5: Auxiliary
        self._assign_auxiliary()
        
        # Step 6: Regular staff with 15h shifts
        self._assign_regular_staff()
        
        # Step 7: Fine-tune to exactly 40h
        self._fine_tune_hours()
        
        return self.schedule
    
    def _assign_sunday(self):
        """Sunday: 1 supervisor + 5 attendants + 1 auxiliary, all 6AM-9PM"""
        day_idx = 0
        
        # Pick 1 supervisor who didn't work last Sunday
        available_sups = [s for s in self._get_staff_by_role('supervisors') 
                         if self._can_work_day(s, 'SUNDAY')]
        if available_sups:
            self._assign_shift(available_sups[0], day_idx, 'full_day')
        
        # Pick 1 auxiliary (doesn't count toward attendant count)
        auxiliary = [s for s in self._get_staff_by_role('auxiliary') if self._can_work_day(s, 'SUNDAY')]
        if auxiliary:
            self._assign_shift(auxiliary[0], day_idx, 'full_day')
        
        # Pick 5 regular attendants
        regular = [s for s in self._get_staff_by_role('regular') 
                   if self._can_work_day(s, 'SUNDAY') and s != 'RICHARD']
        
        assigned = 0
        for name in regular:
            if assigned >= 5:
                break
            if self._assign_shift(name, day_idx, 'full_day'):
                assigned += 1
        
        # Overnight
        overnight = self._get_staff_by_role('overnight_specialist')
        if overnight:
            self._assign_shift(overnight[0], day_idx, 'overnight')
    
    def _assign_overnight(self):
        """Male overnight every night - assign specific males to specific nights"""
        specialist = self._get_staff_by_role('overnight_specialist')
        
        # Delon: Sun, Tue, Thu, Sat = 4 x 10h = 40h ✓
        if specialist:
            for day_idx in [0, 2, 4, 6]:
                if self.schedule[specialist[0]][day_idx] == 'OFF':
                    self._assign_shift(specialist[0], day_idx, 'overnight')
        
        # Other males: Mon, Wed, Fri
        # Denton: Friday overnight (can't open Saturday)
        # Orville: Monday overnight (can't open Tuesday)
        # Romone: Wednesday overnight (can't open Thursday)
        self._assign_shift('DENTON', 5, 'overnight')   # Fri
        self._assign_shift('ORVILLE', 1, 'overnight')  # Mon
        self._assign_shift('ROMONE', 3, 'overnight')   # Wed
    
    def _assign_supervisors(self):
        """Assign supervisors - target 40h each, max 2-3 per day (except Sunday=1)"""
        sun_sup = None
        for sup in self._get_staff_by_role('supervisors'):
            if self.schedule[sup][0] != 'OFF':
                sun_sup = sup
                break
        
        # Goal: 2-3 supervisors per day (Mon-Sat), spread across week
        # Sunday sup (15h) needs ~25 more
        # Others need 40h
        
        if sun_sup == 'KEVAUGHN':
            # Kevaughn: Sun(15) + 3 days of ~8h = 40h
            # Skip Saturday to reduce supervisor count there
            self._assign_shift('KEVAUGHN', 2, 'extended_am')  # Tue 10h
            self._assign_shift('KEVAUGHN', 4, 'extended_am')  # Thu 10h
            self._assign_shift('KEVAUGHN', 5, 'morning')      # Fri 8h = 43h
        
        # Mellisa: Mon, Tue, Thu, Fri = 4 days closing
        # Skip Saturday
        self._assign_shift('MELLISA', 1, 'extended_pm')   # Mon 9h (close)
        self._assign_shift('MELLISA', 3, 'extended_pm')   # Wed 9h (close)
        self._assign_shift('MELLISA', 4, 'extended_pm')   # Thu 9h (close)
        self._assign_shift('MELLISA', 5, 'extended_pm')   # Fri 9h = 36h
        self._assign_shift('MELLISA', 6, 'afternoon')     # Sat 7h = 43h
        
        # Liyonie: Mon, Tue, Wed, Sat mornings = 4 days opening
        self._assign_shift('LIYONIE', 1, 'extended_am')   # Mon 10h
        self._assign_shift('LIYONIE', 2, 'extended_am')   # Tue 10h
        self._assign_shift('LIYONIE', 3, 'extended_am')   # Wed 10h
        self._assign_shift('LIYONIE', 6, 'extended_am')   # Sat 10h = 40h
        
        # Richie: Tue, Thu, Fri, Sat closing
        self._assign_shift('RICHIE', 2, 'extended_pm')    # Tue 9h (close)
        self._assign_shift('RICHIE', 4, 'extended_pm')    # Thu 9h (close)
        self._assign_shift('RICHIE', 5, 'extended_pm')    # Fri 9h (close)
        self._assign_shift('RICHIE', 6, 'afternoon')      # Sat 7h = 34h
        # Need 6 more - add Wed
        self._assign_shift('RICHIE', 3, 'midday')         # Wed 8h = 42h
    
    def _assign_richard(self):
        """Richard: Driver/attendant - evening shifts only, Off Sun, Off Wed, must work Sat"""
        # Mon, Tue, Thu, Fri, Sat = 5 days
        # Evening shifts: afternoon (2PM-9PM, 7h) or extended_pm (12PM-9PM, 9h)
        # 5 x 8h avg = 40h → use mix of 7h and 9h shifts
        self._assign_shift('RICHARD', 1, 'extended_pm')   # Mon 9h
        self._assign_shift('RICHARD', 2, 'afternoon')     # Tue 7h
        self._assign_shift('RICHARD', 4, 'extended_pm')   # Thu 9h
        self._assign_shift('RICHARD', 5, 'afternoon')     # Fri 7h
        self._assign_shift('RICHARD', 6, 'extended_pm')   # Sat 9h = 41h
    
    def _assign_auxiliary(self):
        """Sharma & Sash - both 40h, alternate open/close"""
        sharma_worked_sun = self.schedule['SHARMA'][0] != 'OFF'
        
        if sharma_worked_sun:
            # Sharma: Sun 15h + 3 days = 15 + 24 = 39h, extend one shift
            # Tue, Thu, Sat - but check close-then-open
            self._assign_shift('SHARMA', 2, 'morning')   # Tue 8h (open)
            self._assign_shift('SHARMA', 4, 'morning')   # Thu 8h (open)
            self._assign_shift('SHARMA', 6, 'morning')   # Sat 8h = 39h
            # Extend one shift by 1h later
            
            # Sash: Mon, Tue(close), Wed, Thu(close), Fri
            self._assign_shift('SASH', 1, 'morning')     # Mon 8h
            self._assign_shift('SASH', 2, 'afternoon')   # Tue 7h (close) 
            # Can't open Wed after 9PM close
            self._assign_shift('SASH', 3, 'midday')      # Wed 8h (10AM OK)
            self._assign_shift('SASH', 4, 'afternoon')   # Thu 7h (close)
            # Can't open Fri after 9PM close
            self._assign_shift('SASH', 5, 'midday')      # Fri 8h = 38h
            # Will extend
        else:
            # Swap pattern
            self._assign_shift('SASH', 2, 'morning')
            self._assign_shift('SASH', 4, 'morning')
            self._assign_shift('SASH', 6, 'morning')
            
            self._assign_shift('SHARMA', 1, 'morning')
            self._assign_shift('SHARMA', 2, 'afternoon')
            self._assign_shift('SHARMA', 3, 'midday')
            self._assign_shift('SHARMA', 4, 'afternoon')
            self._assign_shift('SHARMA', 5, 'midday')
    
    def _assign_regular_staff(self):
        """Assign regular staff - balance across week with daily targets"""
        regular = [s for s in self._get_staff_by_role('regular') if s != 'RICHARD']
        
        # Separate by role
        sunday_workers = [s for s in regular if self.schedule[s][0] != 'OFF']
        overnight_males = ['DENTON', 'ORVILLE', 'ROMONE']  # They have 1 overnight each
        non_sunday = [s for s in regular if self.schedule[s][0] == 'OFF' and s not in overnight_males]
        
        # Sunday workers have 15h, need 25 more
        for i, name in enumerate(sunday_workers):
            # Check if this person also has overnight (Denton does Fri overnight)
            has_overnight = any(self.schedule[name][d] != 'OFF' and 
                               self.schedule[name][d][0] == '8:00 PM' for d in range(7))
            
            if has_overnight:
                # They have 15h (Sun) + 10h (overnight) = 25h, need 15 more
                # Add Mon midday 8h + Wed 7h = 15h (boost Mon & Wed)
                self._try_assign(name, 1, 'midday')
                self._try_assign(name, 3, 'afternoon')
            elif i % 5 == 0:
                # Pattern A: Mon midday 8h + Wed 10h + Fri 7h = 25h (boost Mon, Wed, Fri)
                self._try_assign(name, 1, 'midday')
                self._try_assign(name, 3, 'extended_am')
                self._try_assign(name, 5, 'afternoon')
            elif i % 5 == 1:
                # Pattern B: Wed 10h + Fri 15h = 25h (no Mon, no Sat)
                self._try_assign(name, 3, 'extended_am')
                self._try_assign(name, 5, 'full_day')
            elif i % 5 == 2:
                # Pattern C: Mon midday 8h + Wed 10h + Sat 7h = 25h (one Sat)
                self._try_assign(name, 1, 'midday')
                self._try_assign(name, 3, 'extended_am')
                self._try_assign(name, 6, 'afternoon')
            elif i % 5 == 3:
                # Pattern D: Wed 15h + Fri 10h = 25h (no Mon, no Sat)
                self._try_assign(name, 3, 'full_day')
                self._try_assign(name, 5, 'extended_am')
            else:
                # Pattern E: Mon midday 8h + Fri 10h + Sat 7h = 25h (one Sat)
                self._try_assign(name, 1, 'midday')
                self._try_assign(name, 5, 'extended_am')
                self._try_assign(name, 6, 'afternoon')
            
            self._fill_remaining(name)
        
        # Overnight males (non-Sunday): They have 10h overnight, need 30 more
        for name in overnight_males:
            if self.schedule[name][0] != 'OFF':
                continue  # Already handled as Sunday worker
            
            # Find which day they have overnight
            overnight_day = None
            for d in range(7):
                if self.schedule[name][d] != 'OFF' and self.schedule[name][d][0] == '8:00 PM':
                    overnight_day = d
                    break
            
            # They have 10h from overnight, need 30 more
            # CRITICAL: Day after overnight they MUST be OFF (end at 6AM that day)
            day_after = (overnight_day + 1) % 7
            
            if overnight_day == 1:  # Mon overnight -> OFF Tuesday
                # Can work: Wed, Thu, Fri, Sat (NOT Tue)
                self._try_assign(name, 3, 'extended_am')  # Wed 10h
                self._try_assign(name, 4, 'full_day')     # Thu 15h
                self._try_assign(name, 6, 'morning')      # Sat 8h = 33h + 10h = 43h
            elif overnight_day == 3:  # Wed overnight -> OFF Thursday
                # Can work: Mon, Tue, Fri, Sat (NOT Thu)
                self._try_assign(name, 2, 'full_day')     # Tue 15h
                self._try_assign(name, 5, 'extended_am')  # Fri 10h
                self._try_assign(name, 6, 'afternoon')    # Sat 7h = 32h + 10h = 42h (or fill will adjust)
            elif overnight_day == 5:  # Fri overnight -> OFF Saturday
                # Can work: Sun, Mon, Tue, Wed, Thu (NOT Sat)
                self._try_assign(name, 2, 'full_day')     # Tue 15h
                self._try_assign(name, 4, 'full_day')     # Thu 15h = 30h + 10h = 40h
            
            self._fill_remaining(name)
        
        # Non-Sunday, non-overnight workers need 40h
        for i, name in enumerate(non_sunday):
            if i % 4 == 0:
                # Pattern A: Mon 15h + Wed 15h + Fri 10h = 40h (Wed + Fri)
                self._try_assign(name, 1, 'full_day')
                self._try_assign(name, 3, 'full_day')
                self._try_assign(name, 5, 'extended_am')
            elif i % 4 == 1:
                # Pattern B: Tue 15h + Thu 15h + Fri 10h = 40h (Thu + Fri)
                self._try_assign(name, 2, 'full_day')
                self._try_assign(name, 4, 'full_day')
                self._try_assign(name, 5, 'extended_am')
            elif i % 4 == 2:
                # Pattern C: Mon 15h + Wed 15h + Thu 10h = 40h (Wed + Thu)
                self._try_assign(name, 1, 'full_day')
                self._try_assign(name, 3, 'full_day')
                self._try_assign(name, 4, 'extended_am')
            else:
                # Pattern D: Tue 15h + Fri 15h + Sat 10h = 40h (Fri + Sat)
                self._try_assign(name, 2, 'full_day')
                self._try_assign(name, 5, 'full_day')
                self._try_assign(name, 6, 'extended_am')
            
            self._fill_remaining(name)
    
    def _try_assign(self, name: str, day_idx: int, shift_type: str) -> bool:
        """Try to assign shift, respecting close-then-open rule"""
        if self.schedule[name][day_idx] != 'OFF':
            return False
        if not self._can_work_day(name, DAYS[day_idx]):
            return False
        
        # Check close-then-open
        start, end, hours = SHIFTS[shift_type]
        if start == '6:00 AM' and not self._can_open_next_day(name, day_idx):
            # Try midday instead
            return self._assign_shift(name, day_idx, 'midday')
        
        return self._assign_shift(name, day_idx, shift_type)
    
    def _fill_remaining(self, name: str):
        """Fill remaining hours for a staff member, respecting daily targets"""
        max_iterations = 10
        iteration = 0
        
        while self.hours[name] < 40 and iteration < max_iterations:
            iteration += 1
            added = False
            
            # Find best day to add hours - prefer under-target days
            best_day = None
            best_room = -999
            
            for day_idx in range(1, 7):  # Mon-Sat
                if self.schedule[name][day_idx] != 'OFF':
                    continue
                if not self._can_work_day(name, DAYS[day_idx]):
                    continue
                
                day_name = DAYS[day_idx]
                current_count = self._get_daily_count(day_idx) + 1  # +1 for overnight
                target = DAILY_TARGETS[day_name]
                room = target - current_count
                
                if room > best_room:
                    best_room = room
                    best_day = day_idx
            
            if best_day is None:
                break
            
            can_open = self._can_open_next_day(name, best_day)
            remaining = 40 - self.hours[name]
            
            if remaining >= 15 and can_open and best_room >= 0:
                added = self._assign_shift(name, best_day, 'full_day')
            elif remaining >= 10 and can_open:
                added = self._assign_shift(name, best_day, 'extended_am')
            elif remaining >= 8 and can_open:
                added = self._assign_shift(name, best_day, 'morning')
            elif remaining >= 8:
                added = self._assign_shift(name, best_day, 'midday')
            elif remaining >= 7:
                added = self._assign_shift(name, best_day, 'afternoon')
            
            if not added:
                break
    
    def _fine_tune_hours(self):
        """Adjust to get everyone to exactly 40h - extend shifts or add small shifts"""
        for name in self.schedule:
            current = self.hours[name]
            
            # Skip overnight specialist (fixed schedule)
            if self.staff[name].is_overnight_specialist:
                continue
            
            # Under 40h - need to add hours
            while current < 40:
                needed = 40 - current
                added = False
                
                # First try extending existing shifts (best for small needs)
                for day_idx in range(7):
                    shift = self.schedule[name][day_idx]
                    if shift == 'OFF':
                        continue
                    
                    extend_by = min(needed, 3)
                    if self._extend_shift(name, day_idx, extend_by):
                        added = True
                        current = self.hours[name]
                        break
                
                if added:
                    continue
                
                # If can't extend, try adding a shift on an empty day
                for day_idx in range(1, 7):  # Mon-Sat
                    day_name = DAYS[day_idx]
                    if not self._can_work_day(name, day_name):
                        continue
                    if self.schedule[name][day_idx] != 'OFF':
                        continue
                    
                    can_open = self._can_open_next_day(name, day_idx)
                    
                    # Add shift - try different sizes
                    if can_open:
                        if needed >= 10:
                            added = self._assign_shift(name, day_idx, 'extended_am')
                        elif needed >= 8:
                            added = self._assign_shift(name, day_idx, 'morning')
                        else:
                            # Need less than 8 - add 7h afternoon (slightly over is OK)
                            added = self._assign_shift(name, day_idx, 'afternoon')
                    else:
                        # Can't open - use midday or afternoon
                        if needed >= 8:
                            added = self._assign_shift(name, day_idx, 'midday')
                        else:
                            added = self._assign_shift(name, day_idx, 'afternoon')
                    
                    if added:
                        current = self.hours[name]
                        break
                
                if not added:
                    break  # Can't add more, stop trying
    
    def get_sunday_workers(self) -> List[str]:
        return [s for s in self.schedule if self.schedule[s][0] != 'OFF']
    
    def get_summary(self) -> dict:
        daily_counts = {}
        for day_idx, day in enumerate(DAYS):
            count = sum(1 for s in self.schedule if self.schedule[s][day_idx] != 'OFF')
            daily_counts[day] = count
        
        return {
            'schedule': self.schedule,
            'hours': {name: self.hours[name] for name in self.schedule},
            'daily_counts': daily_counts,
            'sunday_workers': self.get_sunday_workers(),
            'total_hours': sum(self.hours.values()),
            'avg_hours': sum(self.hours.values()) / len(self.schedule)
        }
    
    def print_summary(self):
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
            
            status = "✓" if 40 <= total <= 43 else f"({total})"
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
        
        print("\n📊 DAILY STAFF COUNT (vs target):")
        for day_idx, day in enumerate(DAYS):
            count = sum(1 for s in self.schedule if self.schedule[s][day_idx] != 'OFF')
            overnight = sum(1 for s in self.schedule 
                          if self.schedule[s][day_idx] != 'OFF' and 
                          isinstance(self.schedule[s][day_idx], tuple) and
                          self.schedule[s][day_idx][0] == '8:00 PM')
            day_staff = count - overnight
            target = DAILY_TARGETS[day]
            diff = count - target
            status = "✓" if diff == 0 else f"+{diff}" if diff > 0 else str(diff)
            print(f"  {day}: {day_staff} day + {overnight} overnight = {count} total (target: {target}) {status}")
    
    def export_json(self) -> str:
        return json.dumps(self.get_summary(), indent=2, default=str)


if __name__ == "__main__":
    print("\n" + "="*60)
    print("SUPERPLUS SHIFT GENERATOR v2.1")
    print("="*60)
    
    gen = ShiftGenerator(STAFF_ROSTER, previous_sunday_workers=[])
    gen.generate_schedule()
    gen.print_summary()
    
    sunday_workers = gen.get_sunday_workers()
    print(f"\n🔄 Sunday rotation - OFF next week: {sunday_workers}")
