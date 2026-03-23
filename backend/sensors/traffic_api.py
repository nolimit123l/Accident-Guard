import requests
import json
from datetime import datetime
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

class TrafficDataAPI(APIView):
  
    OVERPASS_URL = 'https://overpass-api.de/api/interpreter'

    def get(self, request):
        try:
            lat = float(request.GET.get('lat', 28.6139))
            lon = float(request.GET.get('lon', 77.2090))
            # Define a small bounding box (~0.01 degrees ~1km)
            delta = 0.01
            bbox = f"{lat - delta},{lon - delta},{lat + delta},{lon + delta}"
            # Overpass query: fetch ways with highway tag within bbox
            query = f"[out:json][timeout:25];(way[\"highway\"]({bbox}););out count;"
            response = requests.post(self.OVERPASS_URL, data={'data': query})
            response.raise_for_status()
            data = response.json()
            # Count of highway ways
            count = data.get('elements', [{}])[0].get('tags', {}).get('count', 0)
            # Simple categorization based on count
            if count > 150:
                density = 'Heavy'
                congestion = 80
            elif count > 80:
                density = 'Moderate'
                congestion = 50
            else:
                density = 'Light'
                congestion = 20
            # For demonstration, we return placeholder lists for roads
            nearby_roads = []
            major_highways = []
            # Extract road names if available
            for element in data.get('elements', []):
                tags = element.get('tags', {})
                name = tags.get('name')
                highway_type = tags.get('highway')
                if name:
                    if highway_type in ['motorway', 'trunk']:
                        major_highways.append(name)
                    else:
                        nearby_roads.append(name)
            return Response({
                'traffic_density': density,
                'estimated_congestion': congestion,
                'nearby_roads': nearby_roads,
                'major_highways': major_highways,
                'description': f"{density} traffic with {count} road segments"
            }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
