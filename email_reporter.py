"""
SuperPlus AI Agent - Email Reports
Beautiful HTML email reports with charts and insights
"""

import os
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail, Attachment, FileContent, FileName, FileType, Disposition
import base64
from datetime import datetime
import json
from typing import Dict

class EmailReporter:
    """
    Generate and send beautiful HTML email reports
    """
    
    def __init__(self):
        self.sendgrid_api_key = os.getenv('SENDGRID_API_KEY')
        self.from_email = os.getenv('REPORT_FROM_EMAIL', 'reports@superplus.ai')
        self.to_email = os.getenv('OWNER_EMAIL')
        
    def generate_weekly_html(self, analysis: str, metrics: Dict) -> str:
        """Generate beautiful HTML email"""
        
        # Calculate changes
        revenue_change = metrics['week_over_week']['revenue_change_pct']
        revenue_arrow = "📈" if revenue_change > 0 else "📉" if revenue_change < 0 else "→"
        revenue_color = "#10b981" if revenue_change > 0 else "#ef4444" if revenue_change < 0 else "#6b7280"
        
        html = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SuperPlus Weekly Report</title>
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
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 40px 30px;
            text-align: center;
        }}
        .header h1 {{
            margin: 0;
            font-size: 32px;
            font-weight: 700;
        }}
        .header p {{
            margin: 10px 0 0;
            opacity: 0.9;
            font-size: 16px;
        }}
        .content {{
            padding: 40px 30px;
        }}
        .metric-grid {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin: 30px 0;
        }}
        .metric-card {{
            background: #f8fafc;
            border-radius: 8px;
            padding: 20px;
            border-left: 4px solid #667eea;
        }}
        .metric-label {{
            font-size: 14px;
            color: #64748b;
            margin-bottom: 8px;
            font-weight: 500;
        }}
        .metric-value {{
            font-size: 28px;
            font-weight: 700;
            color: #1e293b;
        }}
        .metric-change {{
            font-size: 14px;
            margin-top: 8px;
            font-weight: 600;
        }}
        .positive {{ color: #10b981; }}
        .negative {{ color: #ef4444; }}
        .section {{
            margin: 40px 0;
        }}
        .section-title {{
            font-size: 24px;
            font-weight: 700;
            color: #1e293b;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 3px solid #667eea;
        }}
        .business-unit {{
            background: #f8fafc;
            border-radius: 8px;
            padding: 20px;
            margin: 15px 0;
        }}
        .business-unit-header {{
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
        }}
        .business-unit-name {{
            font-size: 18px;
            font-weight: 600;
            color: #1e293b;
        }}
        .business-unit-revenue {{
            font-size: 24px;
            font-weight: 700;
            color: #667eea;
        }}
        .progress-bar {{
            height: 8px;
            background: #e2e8f0;
            border-radius: 4px;
            overflow: hidden;
        }}
        .progress-fill {{
            height: 100%;
            background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
            transition: width 0.3s ease;
        }}
        .analysis-section {{
            background: #fef3c7;
            border-left: 4px solid #f59e0b;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
        }}
        .analysis-title {{
            font-size: 18px;
            font-weight: 700;
            color: #92400e;
            margin-bottom: 15px;
        }}
        .analysis-content {{
            color: #451a03;
            white-space: pre-wrap;
            font-size: 15px;
            line-height: 1.8;
        }}
        .footer {{
            background: #f8fafc;
            padding: 30px;
            text-align: center;
            color: #64748b;
            font-size: 14px;
        }}
        .cta-button {{
            display: inline-block;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 12px 30px;
            border-radius: 6px;
            text-decoration: none;
            font-weight: 600;
            margin: 20px 0;
        }}
    </style>
</head>
<body>
    <div class="container">
        <!-- Header -->
        <div class="header">
            <h1>📊 SuperPlus Weekly Report</h1>
            <p>Week Ending {datetime.now().strftime('%B %d, %Y')}</p>
        </div>
        
        <!-- Content -->
        <div class="content">
            <!-- Key Metrics -->
            <div class="metric-grid">
                <div class="metric-card">
                    <div class="metric-label">Total Revenue</div>
                    <div class="metric-value">JMD ${metrics['this_week']['total_revenue']:,.0f}</div>
                    <div class="metric-change {('positive' if revenue_change > 0 else 'negative')}">
                        {revenue_arrow} {revenue_change:+.1f}% vs last week
                    </div>
                </div>
                
                <div class="metric-card">
                    <div class="metric-label">Daily Average</div>
                    <div class="metric-value">JMD ${metrics['this_week']['daily_avg_revenue']:,.0f}</div>
                </div>
                
                <div class="metric-card">
                    <div class="metric-label">Gas Volume</div>
                    <div class="metric-value">{metrics['this_week']['total_litres']:,.0f}L</div>
                    <div class="metric-change {('positive' if metrics['week_over_week']['litres_change_pct'] > 0 else 'negative')}">
                        {("📈" if metrics['week_over_week']['litres_change_pct'] > 0 else "📉")} {metrics['week_over_week']['litres_change_pct']:+.1f}%
                    </div>
                </div>
            </div>
            
            <!-- Business Units -->
            <div class="section">
                <div class="section-title">Business Unit Performance</div>
                
                <div class="business-unit">
                    <div class="business-unit-header">
                        <span class="business-unit-name">⛽ Gas Station</span>
                        <span class="business-unit-revenue">JMD ${metrics['this_week']['gas_revenue']:,.0f}</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: {metrics['business_mix']['gas_pct']}%"></div>
                    </div>
                    <p style="margin-top: 10px; color: #64748b;">
                        {metrics['business_mix']['gas_pct']:.1f}% of total revenue • {metrics['this_week']['total_litres']:,.0f} litres sold
                    </p>
                </div>
                
                <div class="business-unit">
                    <div class="business-unit-header">
                        <span class="business-unit-name">🏪 Community Store</span>
                        <span class="business-unit-revenue">JMD ${metrics['this_week']['store_sales']:,.0f}</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: {metrics['business_mix']['store_pct']}%"></div>
                    </div>
                    <p style="margin-top: 10px; color: #64748b;">
                        {metrics['business_mix']['store_pct']:.1f}% of total revenue
                    </p>
                </div>
                
                <div class="business-unit">
                    <div class="business-unit-header">
                        <span class="business-unit-name">🍽️ Deli/Restaurant</span>
                        <span class="business-unit-revenue">JMD ${metrics['this_week']['deli_sales']:,.0f}</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: {metrics['business_mix']['deli_pct']}%"></div>
                    </div>
                    <p style="margin-top: 10px; color: #64748b;">
                        {metrics['business_mix']['deli_pct']:.1f}% of total revenue
                    </p>
                </div>
                
                <div class="business-unit">
                    <div class="business-unit-header">
                        <span class="business-unit-name">💳 Phone Cards / Western Union</span>
                        <span class="business-unit-revenue">JMD ${metrics['this_week']['phone_cards']:,.0f}</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: {metrics['business_mix']['phone_pct']}%"></div>
                    </div>
                    <p style="margin-top: 10px; color: #64748b;">
                        {metrics['business_mix']['phone_pct']:.1f}% of total revenue • High margin business
                    </p>
                </div>
            </div>
            
            <!-- AI Analysis -->
            <div class="analysis-section">
                <div class="analysis-title">🤖 AI Business Analysis</div>
                <div class="analysis-content">{analysis}</div>
            </div>
            
            <!-- CTA -->
            <div style="text-align: center; margin: 40px 0;">
                <a href="https://docs.google.com/spreadsheets/d/{os.getenv('GOOGLE_SHEET_ID', '')}" class="cta-button">
                    View Full Data in Google Sheets →
                </a>
            </div>
        </div>
        
        <!-- Footer -->
        <div class="footer">
            <p><strong>SuperPlus AI Business Agent</strong></p>
            <p>Autonomous business intelligence for SuperPlus Jamaica</p>
            <p style="margin-top: 20px; font-size: 12px;">
                This report was generated automatically by your AI agent.<br>
                Questions? Reply to this email or message the agent on Telegram.
            </p>
        </div>
    </div>
</body>
</html>
"""
        return html
    
    def send_weekly_report(self, analysis: str, metrics: Dict):
        """Send weekly report via email"""
        try:
            html_content = self.generate_weekly_html(analysis, metrics)
            
            # Create plain text version (fallback)
            text_content = f"""
SUPERPLUS WEEKLY REPORT
Week Ending {datetime.now().strftime('%B %d, %Y')}

TOTAL REVENUE: JMD ${metrics['this_week']['total_revenue']:,.0f}
Change: {metrics['week_over_week']['revenue_change_pct']:+.1f}% vs last week

BUSINESS UNITS:
- Gas: JMD ${metrics['this_week']['gas_revenue']:,.0f}
- Store: JMD ${metrics['this_week']['store_sales']:,.0f}
- Deli: JMD ${metrics['this_week']['deli_sales']:,.0f}
- Phone Cards: JMD ${metrics['this_week']['phone_cards']:,.0f}

AI ANALYSIS:
{analysis}

View full data: https://docs.google.com/spreadsheets/d/{os.getenv('GOOGLE_SHEET_ID', '')}
"""
            
            message = Mail(
                from_email=self.from_email,
                to_emails=self.to_email,
                subject=f"📊 SuperPlus Weekly Report - {datetime.now().strftime('%b %d, %Y')}",
                html_content=html_content,
                plain_text_content=text_content
            )
            
            sg = SendGridAPIClient(self.sendgrid_api_key)
            response = sg.send(message)
            
            print(f"✅ Email report sent to {self.to_email}")
            print(f"   Status: {response.status_code}")
            
            return True
            
        except Exception as e:
            print(f"❌ Error sending email: {e}")
            return False
    
    def send_daily_summary(self, data: Dict):
        """Send brief daily summary email"""
        try:
            html = f"""
<!DOCTYPE html>
<html>
<head>
    <style>
        body {{ font-family: Arial, sans-serif; line-height: 1.6; }}
        .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
        .header {{ background: #667eea; color: white; padding: 20px; border-radius: 8px; }}
        .content {{ padding: 20px; }}
        .metric {{ margin: 15px 0; padding: 15px; background: #f8fafc; border-radius: 6px; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>📊 SuperPlus Daily Summary</h2>
            <p>{datetime.now().strftime('%A, %B %d, %Y')}</p>
        </div>
        <div class="content">
            <div class="metric">
                <strong>Total Revenue:</strong> JMD ${data.get('total_revenue', 0):,.0f}
            </div>
            <div class="metric">
                <strong>Gas Volume:</strong> {data.get('total_litres', 0):,.0f} litres
            </div>
            <p>Check your Telegram for detailed analysis.</p>
        </div>
    </div>
</body>
</html>
"""
            
            message = Mail(
                from_email=self.from_email,
                to_emails=self.to_email,
                subject=f"📊 Daily Summary - {datetime.now().strftime('%b %d')}",
                html_content=html
            )
            
            sg = SendGridAPIClient(self.sendgrid_api_key)
            sg.send(message)
            
            print(f"✅ Daily summary email sent")
            return True
            
        except Exception as e:
            print(f"❌ Error sending daily email: {e}")
            return False
