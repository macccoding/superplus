"""
SuperPlus AI Agent - Google Drive Integration
Automatically archive reports to Google Drive
"""

import os
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload, MediaInMemoryUpload
import json
from datetime import datetime
import io
from typing import Dict, List

class DriveArchiver:
    """
    Automatically archive reports to Google Drive
    """
    
    def __init__(self):
        self.setup_drive()
        self.reports_folder_id = None
        
    def setup_drive(self):
        """Initialize Google Drive API"""
        try:
            # Try base64 encoded credentials first (same as sheets)
            creds_base64 = os.getenv('GOOGLE_CREDENTIALS_BASE64')
            creds_json_str = None
            
            if creds_base64:
                print("📁 Loading Drive credentials from GOOGLE_CREDENTIALS_BASE64")
                import base64
                try:
                    creds_json_str = base64.b64decode(creds_base64).decode('utf-8')
                except Exception as e:
                    print(f"❌ Failed to decode base64 credentials: {e}")
            
            # Fallback to plain JSON
            if not creds_json_str:
                creds_json_str = os.getenv('GOOGLE_CREDENTIALS')
                if creds_json_str:
                    print("📁 Loading Drive credentials from GOOGLE_CREDENTIALS")
            
            if creds_json_str:
                try:
                    creds_dict = json.loads(creds_json_str)
                except json.JSONDecodeError as e:
                    print(f"❌ Failed to parse credentials JSON: {e}")
                    self.service = None
                    return
                
                # Use the same scopes as gspread for compatibility
                scopes = [
                    'https://www.googleapis.com/auth/spreadsheets',
                    'https://www.googleapis.com/auth/drive'
                ]
                
                try:
                    credentials = Credentials.from_service_account_info(
                        creds_dict, 
                        scopes=scopes
                    )
                    # Force refresh to get access token
                    from google.auth.transport.requests import Request
                    credentials.refresh(Request())
                    
                    self.service = build('drive', 'v3', credentials=credentials)
                    print("✅ Google Drive API connected")
                except Exception as e:
                    print(f"❌ Failed to create Drive credentials: {e}")
                    import traceback
                    traceback.print_exc()
                    self.service = None
            else:
                print("⚠️ Google Drive credentials not found in environment")
                print("   Looking for: GOOGLE_CREDENTIALS_BASE64 or GOOGLE_CREDENTIALS")
                self.service = None
                
        except Exception as e:
            print(f"❌ Error connecting to Google Drive: {e}")
            import traceback
            traceback.print_exc()
            self.service = None
    
    def get_or_create_folder(self, folder_name: str, parent_id: str = None) -> str:
        """Get existing folder or create new one"""
        try:
            # Search for existing folder
            query = f"name='{folder_name}' and mimeType='application/vnd.google-apps.folder' and trashed=false"
            if parent_id:
                query += f" and '{parent_id}' in parents"
            
            results = self.service.files().list(
                q=query,
                spaces='drive',
                fields='files(id, name)'
            ).execute()
            
            folders = results.get('files', [])
            
            if folders:
                print(f"✅ Found existing folder: {folder_name}")
                return folders[0]['id']
            
            # Create new folder
            file_metadata = {
                'name': folder_name,
                'mimeType': 'application/vnd.google-apps.folder'
            }
            if parent_id:
                file_metadata['parents'] = [parent_id]
            
            folder = self.service.files().create(
                body=file_metadata,
                fields='id'
            ).execute()
            
            print(f"✅ Created folder: {folder_name}")
            return folder['id']
            
        except Exception as e:
            print(f"❌ Error with folder: {e}")
            return None
    
    def setup_folder_structure(self):
        """Create organized folder structure"""
        try:
            # Root folder
            root_folder = self.get_or_create_folder("SuperPlus Reports")
            
            # Year folder
            year = datetime.now().strftime("%Y")
            year_folder = self.get_or_create_folder(year, root_folder)
            
            # Month folder
            month = datetime.now().strftime("%B")
            month_folder = self.get_or_create_folder(month, year_folder)
            
            self.reports_folder_id = month_folder
            
            print(f"📁 Folder structure: SuperPlus Reports/{year}/{month}/")
            return month_folder
            
        except Exception as e:
            print(f"❌ Error setting up folders: {e}")
            return None
    
    def upload_weekly_report(self, html_content: str, metrics: Dict) -> str:
        """Upload weekly report as HTML file"""
        try:
            if not self.service:
                print("❌ Google Drive service not initialized")
                return None
            
            if not self.reports_folder_id:
                self.setup_folder_structure()
            
            if not self.reports_folder_id:
                print("❌ Could not create Drive folder structure")
                return None
            
            # Generate filename
            week_ending = datetime.now().strftime("%Y-%m-%d")
            filename = f"Weekly Report - Week Ending {week_ending}.html"
            
            print(f"📁 Uploading: {filename}")
            
            # Create file metadata
            file_metadata = {
                'name': filename,
                'parents': [self.reports_folder_id],
                'mimeType': 'text/html'
            }
            
            # Upload file
            media = MediaInMemoryUpload(
                html_content.encode('utf-8'),
                mimetype='text/html',
                resumable=True
            )
            
            file = self.service.files().create(
                body=file_metadata,
                media_body=media,
                fields='id, webViewLink'
            ).execute()
            
            file_url = file.get('webViewLink')
            print(f"✅ Report uploaded to Google Drive: {filename}")
            print(f"   URL: {file_url}")
            
            return file_url
            
        except Exception as e:
            print(f"❌ Error uploading report: {e}")
            import traceback
            traceback.print_exc()
            return None
    
    def upload_data_backup(self, data: list) -> str:
        """Upload raw data backup as JSON"""
        try:
            if not self.reports_folder_id:
                self.setup_folder_structure()
            
            # Filename
            timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M")
            filename = f"Data Backup - {timestamp}.json"
            
            # Convert to JSON
            json_content = json.dumps(data, indent=2, ensure_ascii=False)
            
            file_metadata = {
                'name': filename,
                'parents': [self.reports_folder_id],
                'mimeType': 'application/json'
            }
            
            media = MediaInMemoryUpload(
                json_content.encode('utf-8'),
                mimetype='application/json',
                resumable=True
            )
            
            file = self.service.files().create(
                body=file_metadata,
                media_body=media,
                fields='id'
            ).execute()
            
            print(f"✅ Data backup uploaded: {filename}")
            return file['id']
            
        except Exception as e:
            print(f"❌ Error uploading backup: {e}")
            return None
    
    def create_monthly_summary(self, month_data: list) -> str:
        """Create and upload monthly summary document"""
        try:
            if not self.reports_folder_id:
                self.setup_folder_structure()
            
            # Calculate monthly totals
            total_revenue = sum([row.get('Total_Revenue', 0) or 0 for row in month_data])
            total_litres = sum([row.get('Total_Litres', 0) or 0 for row in month_data])
            
            # Generate summary HTML
            month_name = datetime.now().strftime("%B %Y")
            
            html = f"""
<!DOCTYPE html>
<html>
<head>
    <title>SuperPlus Monthly Summary - {month_name}</title>
    <style>
        body {{ font-family: Arial, sans-serif; padding: 40px; }}
        h1 {{ color: #667eea; }}
        .metric {{ padding: 20px; background: #f8fafc; margin: 15px 0; border-radius: 8px; }}
    </style>
</head>
<body>
    <h1>📊 SuperPlus Monthly Summary</h1>
    <h2>{month_name}</h2>
    
    <div class="metric">
        <h3>Total Revenue</h3>
        <p style="font-size: 36px; font-weight: bold;">JMD ${total_revenue:,.0f}</p>
    </div>
    
    <div class="metric">
        <h3>Total Gas Volume</h3>
        <p style="font-size: 36px; font-weight: bold;">{total_litres:,.0f} litres</p>
    </div>
    
    <div class="metric">
        <h3>Operating Days</h3>
        <p style="font-size: 36px; font-weight: bold;">{len(month_data)} days</p>
    </div>
    
    <div class="metric">
        <h3>Daily Average Revenue</h3>
        <p style="font-size: 36px; font-weight: bold;">JMD ${total_revenue / len(month_data):,.0f}</p>
    </div>
</body>
</html>
"""
            
            filename = f"Monthly Summary - {month_name}.html"
            
            file_metadata = {
                'name': filename,
                'parents': [self.reports_folder_id],
                'mimeType': 'text/html'
            }
            
            media = MediaInMemoryUpload(
                html.encode('utf-8'),
                mimetype='text/html',
                resumable=True
            )
            
            file = self.service.files().create(
                body=file_metadata,
                media_body=media,
                fields='id, webViewLink'
            ).execute()
            
            print(f"✅ Monthly summary created: {filename}")
            return file.get('webViewLink')
            
        except Exception as e:
            print(f"❌ Error creating monthly summary: {e}")
            return None
    
    def share_with_user(self, file_id: str, email: str):
        """Share a file with specific user"""
        try:
            self.service.permissions().create(
                fileId=file_id,
                body={
                    'type': 'user',
                    'role': 'reader',
                    'emailAddress': email
                },
                sendNotificationEmail=False
            ).execute()
            
            print(f"✅ Shared file with {email}")
            
        except Exception as e:
            print(f"❌ Error sharing file: {e}")
    
    def list_reports(self, limit: int = 10) -> list:
        """List recent reports in Drive"""
        try:
            if not self.reports_folder_id:
                self.setup_folder_structure()
            
            results = self.service.files().list(
                q=f"'{self.reports_folder_id}' in parents and trashed=false",
                pageSize=limit,
                orderBy='createdTime desc',
                fields='files(id, name, webViewLink, createdTime)'
            ).execute()
            
            files = results.get('files', [])
            
            print(f"📁 Found {len(files)} reports in Drive")
            for file in files:
                print(f"   - {file['name']}")
            
            return files
            
        except Exception as e:
            print(f"❌ Error listing files: {e}")
            return []
