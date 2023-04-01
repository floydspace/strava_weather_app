import os
import requests

WEATHER_BASE_URL = "http://api.openweathermap.org/data/2.5"


class WeatherClient:
    """Class for getting weather data from https://openweathermap.org/ API."""

    def __init__(self, settings):
        """Initialize WeatherClient.

        :param settings: settings from database
        """

        self.__api_key = os.environ.get("API_WEATHER_KEY")
        self.__settings = settings

    def get_weather(self, lat, lon, w_time):
        """Get weather data using https://openweathermap.org/ API.

        :param lat: latitude
        :param lon: longitude
        :param w_time: time of requested weather data
        :return: dict with weather data
        """

        base_url = (
            f"{WEATHER_BASE_URL}/onecall/timemachine?"
            f"lat={lat}&lon={lon}&dt={w_time}&appid={self.__api_key}&units=metric&lang={self.__settings.lan}"
        )

        response = requests.get(base_url)

        try:
            return response.json()["current"]
        except (KeyError, ValueError):
            print(f"OpenApiWeather response - code: {response.status_code}, body: {response.text}")
            raise

    def get_air_quality(self, lat, lon):
        """Get air quality data using https://openweathermap.org/ API.

        :param lat: latitude
        :param lon: longitude
        :return: dict with air quality data
        """

        base_url = f"{WEATHER_BASE_URL}/air_pollution?lat={lat}&lon={lon}&appid={self.__api_key}"

        aq = requests.get(base_url).json()

        return aq["list"][0]
