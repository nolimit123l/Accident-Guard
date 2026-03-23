from twilio.rest import Client
import os

class SMSAlertService:
    def __init__(self):
        # Get Twilio credentials from environment variables
        self.account_sid = os.getenv('TWILIO_ACCOUNT_SID', '')
        self.auth_token = os.getenv('TWILIO_AUTH_TOKEN', '')
        self.from_number = os.getenv('TWILIO_PHONE_NUMBER', '')
        
        # Initialize client only if credentials are available
        self.client = None
        if self.account_sid and self.auth_token:
            try:
                self.client = Client(self.account_sid, self.auth_token)
            except Exception as e:
                print(f"Failed to initialize Twilio client: {e}")
    
    def send_emergency_alert(self, to_number, risk_score, location=None):
        """
        Send emergency SMS alert to specified number.
        NOTE: Message body is kept very short to work reliably
        with Twilio trial accounts (avoids error 30044).
        """
        # Short, single‑segment message for trial accounts (no emoji, minimal text)
        if location:
            lat = location.get('latitude', 'Unknown')
            lon = location.get('longitude', 'Unknown')
            maps_link = f"https://maps.google.com/?q={lat},{lon}"
        else:
            maps_link = "Location unavailable"

        if risk_score and risk_score > 0:
            message_body = f"ACCIDENT HAPPENENED ...HELP!!!: Risk {risk_score:.0f}%. {maps_link}"
        else:
            message_body = f"REFLEX SOS: Manual alert. {maps_link}"

        if not self.client:
            err = "Twilio not configured (missing TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_PHONE_NUMBER)"
            print("\n" + "!"*40)
            print("MOCK SOS (NO REAL SMS SENT)")
            print(f"Reason: {err}")
            print(f"To: {to_number}")
            print(f"Body: {message_body}")
            print("!"*40 + "\n")
            return {"success": False, "error": err}

        try:
            # Send real SMS
            message = self.client.messages.create(
                body=message_body,
                from_=self.from_number,
                to=to_number
            )
            print(f"Twilio SMS sent successfully to {to_number}. SID: {message.sid}")
            return {"success": True}
            
        except Exception as e:
            err = str(e)
            print(f"Twilio failed to send SMS: {err}")
            return {"success": False, "error": err}
    
    def send_bulk_alerts(self, phone_numbers, risk_score, location=None):
        """
        Send alerts to multiple emergency contacts
        """
        results = []
        for number in phone_numbers:
            res = self.send_emergency_alert(number, risk_score, location)
            if isinstance(res, dict):
                results.append({"number": number, **res})
            else:
                # Backward-compat fallback if return type changes
                results.append({"number": number, "success": bool(res)})

        return results

# Singleton instance
sms_service = SMSAlertService()

