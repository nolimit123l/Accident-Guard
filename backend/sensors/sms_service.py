import os
from datetime import datetime

from twilio.rest import Client


class SMSAlertService:
    def __init__(self):
        self.account_sid = os.getenv("TWILIO_ACCOUNT_SID", "")
        self.auth_token = os.getenv("TWILIO_AUTH_TOKEN", "")
        self.from_number = os.getenv("TWILIO_PHONE_NUMBER", "")

        self.client = None
        if self.account_sid and self.auth_token:
            try:
                self.client = Client(self.account_sid, self.auth_token)
            except Exception as exc:
                print(f"Failed to initialize Twilio client: {exc}")

    @staticmethod
    def _format_location(location):
        if not location:
            return None

        latitude = location.get("latitude")
        longitude = location.get("longitude")
        if latitude in (None, "") or longitude in (None, ""):
            return None

        return f"https://maps.google.com/?q={latitude},{longitude}"

    @staticmethod
    def _format_label(value):
        if not value:
            return ""
        return str(value).replace("_", " ").strip().title()

    @staticmethod
    def _format_time(timestamp):
        if isinstance(timestamp, datetime):
            return timestamp.strftime("%d %b %Y %H:%M")
        if timestamp:
            return str(timestamp)
        return ""

    def build_message_body(
        self,
        risk_score,
        location=None,
        sender_name="",
        risk_band="",
        motion_state="",
        trigger_source="",
        detected_events=None,
        timestamp=None,
    ):
        sender = sender_name or "A REFLEX user"
        parts = [f"REFLEX SOS: {sender} may need help."]

        if risk_score and float(risk_score) > 0:
            risk_text = f"Risk {float(risk_score):.0f}%"
            if risk_band:
                risk_text += f" ({self._format_label(risk_band)})"
            parts.append(f"{risk_text}.")

        if motion_state:
            parts.append(f"State {self._format_label(motion_state)}.")

        if detected_events:
            event_labels = [item.get("type", "") for item in detected_events[:2] if item.get("type")]
            if event_labels:
                parts.append(f"Reason {', '.join(event_labels)}.")

        if trigger_source:
            parts.append(f"Trigger {self._format_label(trigger_source)}.")

        formatted_time = self._format_time(timestamp)
        if formatted_time:
            parts.append(f"Time {formatted_time}.")

        maps_link = self._format_location(location)
        if maps_link:
            parts.append(f"Location {maps_link}")

        return " ".join(parts).strip()

    def send_emergency_alert(self, to_number, risk_score, location=None, **context):
        message_body = self.build_message_body(risk_score, location=location, **context)

        if not self.client:
            err = (
                "Twilio not configured (missing TWILIO_ACCOUNT_SID / "
                "TWILIO_AUTH_TOKEN / TWILIO_PHONE_NUMBER)"
            )
            print("\n" + "!" * 40)
            print("MOCK SOS (NO REAL SMS SENT)")
            print(f"Reason: {err}")
            print(f"To: {to_number}")
            print(f"Body: {message_body}")
            print("!" * 40 + "\n")
            return {"success": False, "error": err, "message_body": message_body}

        try:
            message = self.client.messages.create(
                body=message_body,
                from_=self.from_number,
                to=to_number,
            )
            print(f"Twilio SMS sent successfully to {to_number}. SID: {message.sid}")
            return {
                "success": True,
                "message_sid": message.sid,
                "message_body": message_body,
            }
        except Exception as exc:
            err = str(exc)
            print(f"Twilio failed to send SMS: {err}")
            return {"success": False, "error": err, "message_body": message_body}

    def send_bulk_alerts(self, phone_numbers, risk_score, location=None, **context):
        results = []
        for number in phone_numbers:
            result = self.send_emergency_alert(number, risk_score, location=location, **context)
            if isinstance(result, dict):
                results.append({"number": number, **result})
            else:
                results.append({"number": number, "success": bool(result)})
        return results


sms_service = SMSAlertService()
