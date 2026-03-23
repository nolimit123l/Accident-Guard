from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
import json
import os
from datetime import datetime

class RegionalDataAPI(APIView):
    """
    API endpoint to get regional accident history and traffic data
    GET /api/v1/sensors/regional-data/?lat=28.6139&lon=77.2090
    """
    
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        # Load regional data
        ml_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '..', 'ml')
        
        try:
            with open(os.path.join(ml_dir, 'region_summary.json'), 'r') as f:
                self.region_data = json.load(f)
        except:
            self.region_data = []
    
    def get(self, request):
        try:
            lat = float(request.GET.get('lat', 28.6139))
            lon = float(request.GET.get('lon', 77.2090))
            
            # Find matching region
            matching_region = None
            for region in self.region_data:
                if (region['lat_min'] <= lat <= region['lat_max'] and
                    region['lon_min'] <= lon <= region['lon_max']):
                    matching_region = region
                    break
            
            if not matching_region:
                # Default data if no match
                return Response({
                    "city": "Unknown",
                    "state": "India",
                    "accident_history": {
                        "yearly_accidents": 0,
                        "avg_accident_rate": 0,
                        "risk_level": "Unknown"
                    },
                    "traffic": {
                        "density": "Unknown",
                        "congestion_level": 0
                    }
                })
            
            # Calculate traffic density based on time and location
            current_hour = datetime.now().hour
            
            # Traffic patterns
            traffic_density = "Light"
            congestion = 20
            
            # Peak hours
            if 7 <= current_hour <= 10 or 17 <= current_hour <= 21:
                traffic_density = "Heavy"
                congestion = 75
            elif 11 <= current_hour <= 16:
                traffic_density = "Moderate"
                congestion = 50
            
            # High-risk cities have more traffic
            if matching_region['avg_accident_rate'] > 40:
                congestion = min(100, congestion + 15)
            
            return Response({
                "city": matching_region['city'],
                "state": matching_region['state'],
                "accident_history": {
                    "yearly_accidents": matching_region['total_yearly_accidents'],
                    "avg_accident_rate": matching_region['avg_accident_rate'],
                    "risk_level": matching_region['risk_level'],
                    "description": f"{matching_region['total_yearly_accidents']} accidents/year"
                },
                "traffic": {
                    "density": traffic_density,
                    "congestion_level": congestion,
                    "description": f"{traffic_density} traffic"
                }
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            return Response({
                "error": str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
