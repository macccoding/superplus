#!/usr/bin/env python3
"""
SuperPlus AI Business Agent
A true autonomous agent that monitors, analyzes, and manages your business data

This agent:
- Monitors WhatsApp messages 24/7
- Extracts and validates business data
- Updates Google Sheets automatically
- Runs weekly analysis every Sunday
- Sends proactive insights and alerts
- Learns patterns and anomalies
- Handles exceptions intelligently
"""

import anthropic
import os
from datetime import datetime, timedelta
import json
import time
from typing import Dict, List, Any
import schedule

class SuperPlusAgent:
    """
    Autonomous AI agent for SuperPlus business management
    """
    
    def __init__(self, anthropic_api_key: str):
        self.client = anthropic.Anthropic(api_key=anthropic_api_key)
        self.model = "claude-sonnet-4-20250514"
        
        # Agent state and memory
        self.memory = {
            "last_processed_date": None,
            "weekly_data": [],
            "patterns": {},
            "anomalies": [],
            "pending_followups": []
        }
        
        # Tools available to the agent
        self.tools = [
            {
                "name": "read_whatsapp_messages",
                "description": "Read messages from WhatsApp business group for a date range. Returns messages with sender, timestamp, and content.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "start_date": {"type": "string", "description": "Start date in YYYY-MM-DD format"},
                        "end_date": {"type": "string", "description": "End date in YYYY-MM-DD format"}
                    },
                    "required": ["start_date", "end_date"]
                }
            },
            {
                "name": "update_google_sheet",
                "description": "Update Google Sheets with business data. Can add rows, update existing data, or query historical data.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "action": {"type": "string", "enum": ["add_row", "update_row", "query"], "description": "Action to perform"},
                        "sheet_name": {"type": "string", "description": "Name of the sheet"},
                        "data": {"type": "object", "description": "Data to add/update"}
                    },
                    "required": ["action", "sheet_name"]
                }
            },
            {
                "name": "send_message",
                "description": "Send a message via WhatsApp or email to the business owner",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "recipient": {"type": "string", "description": "Who to send to (owner, manager, etc)"},
                        "channel": {"type": "string", "enum": ["whatsapp", "email"], "description": "How to send"},
                        "message": {"type": "string", "description": "Message content"},
                        "priority": {"type": "string", "enum": ["low", "medium", "high", "urgent"], "description": "Message priority"}
                    },
                    "required": ["recipient", "channel", "message"]
                }
            },
            {
                "name": "run_analysis",
                "description": "Run business analysis on data for a specific time period",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "analysis_type": {"type": "string", "enum": ["daily", "weekly", "trend", "comparison"], "description": "Type of analysis"},
                        "start_date": {"type": "string", "description": "Start date"},
                        "end_date": {"type": "string", "description": "End date"}
                    },
                    "required": ["analysis_type", "start_date", "end_date"]
                }
            },
            {
                "name": "check_data_quality",
                "description": "Validate data quality, check for missing values, anomalies, or inconsistencies",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "date": {"type": "string", "description": "Date to check in YYYY-MM-DD format"}
                    },
                    "required": ["date"]
                }
            },
            {
                "name": "recall_memory",
                "description": "Access agent's memory to recall patterns, historical context, or previous insights",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "query": {"type": "string", "description": "What to recall from memory"}
                    },
                    "required": ["query"]
                }
            },
            {
                "name": "update_memory",
                "description": "Store new patterns, insights, or context in agent's long-term memory",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "category": {"type": "string", "enum": ["pattern", "anomaly", "insight", "context"], "description": "Type of memory"},
                        "content": {"type": "string", "description": "What to remember"}
                    },
                    "required": ["category", "content"]
                }
            }
        ]
    
    def run_autonomous_cycle(self):
        """
        Main agent loop - runs continuously, making decisions autonomously
        """
        
        system_prompt = """You are the AI Business Manager for SuperPlus, a multi-business operation in Jamaica.

Your role is to AUTONOMOUSLY:
1. Monitor daily WhatsApp reports from staff
2. Extract and validate business data
3. Update tracking systems (Google Sheets)
4. Identify patterns, anomalies, and opportunities
5. Alert the owner to critical issues
6. Generate weekly analysis and insights

You have access to tools that let you:
- Read WhatsApp messages
- Update Google Sheets
- Send messages to the owner
- Run business analysis
- Check data quality
- Maintain memory of patterns and context

AGENT BEHAVIOR:
- Be PROACTIVE: Don't wait to be asked, take initiative
- Be INTELLIGENT: Use context and memory to make smart decisions
- Be RELIABLE: Ensure data accuracy, follow up on missing info
- Be HELPFUL: Focus on actionable insights, not just reporting
- Be CONTEXTUAL: Remember Jamaica-specific factors (weather, payday cycles, etc)

DAILY ROUTINE (Automatic):
1. Check if today's data has been reported
2. Extract and validate the data
3. Update Google Sheets
4. Check for anomalies (sales 20%+ off from norm)
5. Alert owner if anything critical
6. Update memory with new patterns

WEEKLY ROUTINE (Every Sunday 8pm):
1. Review full week's data
2. Run comprehensive analysis
3. Generate insights and recommendations
4. Send detailed report to owner
5. Update memory with weekly patterns

DECISION MAKING:
- If data is unclear/incomplete: Ask clarifying questions
- If anomaly detected: Investigate and explain
- If pattern emerges: Store in memory and alert owner
- If opportunity spotted: Highlight immediately

You are NOT a rigid bot - you're an intelligent agent that learns and adapts."""

        # Get today's date
        today = datetime.now().strftime('%Y-%m-%d')
        
        # Agent's autonomous reasoning
        reasoning_prompt = f"""Today is {today}.

Analyze the current situation:
1. Has today's data been reported yet?
2. Are there any pending issues from previous days?
3. Is today a special day (Friday payday, Sunday analysis, etc)?
4. What actions should I take RIGHT NOW?

Use your tools to:
- Check WhatsApp for today's messages
- Validate and extract data if available
- Check for anomalies or missing data
- Take any necessary actions

Think step-by-step and explain your reasoning."""

        # Call Claude with tools (agentic mode)
        messages = [{"role": "user", "content": reasoning_prompt}]
        
        while True:
            response = self.client.messages.create(
                model=self.model,
                max_tokens=4096,
                system=system_prompt,
                tools=self.tools,
                messages=messages
            )
            
            # Process response
            if response.stop_reason == "tool_use":
                # Agent wants to use tools
                tool_results = []
                
                for content_block in response.content:
                    if content_block.type == "tool_use":
                        tool_name = content_block.name
                        tool_input = content_block.input
                        
                        print(f"[Agent Action] Using tool: {tool_name}")
                        print(f"[Agent Input] {json.dumps(tool_input, indent=2)}")
                        
                        # Execute the tool
                        result = self.execute_tool(tool_name, tool_input)
                        
                        tool_results.append({
                            "type": "tool_result",
                            "tool_use_id": content_block.id,
                            "content": json.dumps(result)
                        })
                
                # Continue conversation with tool results
                messages.append({"role": "assistant", "content": response.content})
                messages.append({"role": "user", "content": tool_results})
                
            elif response.stop_reason == "end_turn":
                # Agent finished its reasoning
                final_response = ""
                for content_block in response.content:
                    if hasattr(content_block, "text"):
                        final_response += content_block.text
                
                print(f"[Agent Conclusion] {final_response}")
                break
            
            else:
                break
        
        return final_response
    
    def execute_tool(self, tool_name: str, tool_input: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute a tool requested by the agent
        In production, these would call real APIs
        """
        
        if tool_name == "read_whatsapp_messages":
            # In production: Call WhatsApp Business API or webhook
            return self._mock_read_whatsapp(tool_input)
        
        elif tool_name == "update_google_sheet":
            # In production: Call Google Sheets API
            return self._mock_update_sheets(tool_input)
        
        elif tool_name == "send_message":
            # In production: Send real WhatsApp/Email
            return self._mock_send_message(tool_input)
        
        elif tool_name == "run_analysis":
            # In production: Run actual analysis
            return self._mock_run_analysis(tool_input)
        
        elif tool_name == "check_data_quality":
            # In production: Validate real data
            return self._mock_check_quality(tool_input)
        
        elif tool_name == "recall_memory":
            # Agent accessing its memory
            return self._recall_memory(tool_input)
        
        elif tool_name == "update_memory":
            # Agent updating its memory
            return self._update_memory(tool_input)
        
        return {"error": f"Unknown tool: {tool_name}"}
    
    def _mock_read_whatsapp(self, input: Dict) -> Dict:
        """Mock WhatsApp reading - returns sample message"""
        return {
            "messages": [
                {
                    "sender": "Jose (Gas Station)",
                    "timestamp": "2026-01-28 21:30:00",
                    "content": """Good night Sir
Wednesday 28,2026
Sales $702,327.66
Phone Cards $63,427
Restaurant/Deli $186,059.97

Litres sales 28.01.26
87-2316
90-6151
Ado-931
Ulsd-4356.90"""
                }
            ],
            "count": 1
        }
    
    def _mock_update_sheets(self, input: Dict) -> Dict:
        """Mock Google Sheets update"""
        return {
            "success": True,
            "action": input.get("action"),
            "rows_affected": 1
        }
    
    def _mock_send_message(self, input: Dict) -> Dict:
        """Mock message sending"""
        print(f"\n📱 MESSAGE TO {input['recipient'].upper()} via {input['channel']}:")
        print(f"Priority: {input.get('priority', 'medium')}")
        print(f"{input['message']}")
        print("=" * 60)
        return {"success": True, "sent_at": datetime.now().isoformat()}
    
    def _mock_run_analysis(self, input: Dict) -> Dict:
        """Mock analysis execution"""
        return {
            "analysis_type": input["analysis_type"],
            "summary": "Analysis completed successfully",
            "insights": ["Revenue up 5%", "Restaurant waste improved", "Stock management good"]
        }
    
    def _mock_check_quality(self, input: Dict) -> Dict:
        """Mock data quality check"""
        return {
            "date": input["date"],
            "quality_score": 0.95,
            "issues": [],
            "completeness": "100%"
        }
    
    def _recall_memory(self, input: Dict) -> Dict:
        """Agent recalls from its memory"""
        query = input["query"]
        # In production: Search through stored memories
        return {
            "recalled": f"Memory related to: {query}",
            "patterns": self.memory.get("patterns", {}),
            "context": "Jamaica, rural area, multi-business, 5-mile moat"
        }
    
    def _update_memory(self, input: Dict) -> Dict:
        """Agent updates its memory"""
        category = input["category"]
        content = input["content"]
        
        if category not in self.memory:
            self.memory[category] = []
        
        self.memory[category].append({
            "timestamp": datetime.now().isoformat(),
            "content": content
        })
        
        return {"success": True, "memory_updated": category}
    
    def daily_check(self):
        """
        Daily automated check - runs every evening
        """
        print(f"\n{'='*60}")
        print(f"🤖 AGENT DAILY CHECK - {datetime.now().strftime('%Y-%m-%d %H:%M')}")
        print(f"{'='*60}\n")
        
        result = self.run_autonomous_cycle()
        return result
    
    def weekly_analysis(self):
        """
        Weekly analysis - runs every Sunday at 8pm
        """
        print(f"\n{'='*60}")
        print(f"📊 AGENT WEEKLY ANALYSIS - {datetime.now().strftime('%Y-%m-%d %H:%M')}")
        print(f"{'='*60}\n")
        
        result = self.run_autonomous_cycle()
        return result


def main():
    """
    Run the SuperPlus AI Agent
    """
    
    # Initialize agent
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        print("ERROR: Set ANTHROPIC_API_KEY environment variable")
        return
    
    agent = SuperPlusAgent(api_key)
    
    # Schedule autonomous tasks
    schedule.every().day.at("22:00").do(agent.daily_check)  # 10pm daily check
    schedule.every().sunday.at("20:00").do(agent.weekly_analysis)  # 8pm Sunday analysis
    
    print("🤖 SuperPlus AI Agent Started")
    print("=" * 60)
    print("Agent is now running autonomously...")
    print("Daily check: 10:00 PM every day")
    print("Weekly analysis: 8:00 PM every Sunday")
    print("=" * 60)
    
    # Run once immediately for demo
    print("\n🎬 Running initial check...\n")
    agent.daily_check()
    
    # In production: Keep running forever
    # while True:
    #     schedule.run_pending()
    #     time.sleep(60)


if __name__ == "__main__":
    main()
