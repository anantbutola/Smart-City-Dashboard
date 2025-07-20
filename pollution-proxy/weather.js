const express = require('express');
const fetch = require('node-fetch');
const router = express.Router();

const OPENWEATHER_API_KEY = '59238a7d251aa7f95172ea7a4317a4d8'; // New API key

// Validate API key on startup
async function validateApiKey() {
    try {
        const testUrl = `https://api.openweathermap.org/data/2.5/weather?lat=28.6139&lon=77.2090&appid=${OPENWEATHER_API_KEY}&units=metric`;
        const response = await fetch(testUrl);
        if (response.status === 401) {
            console.error('OpenWeatherMap API Key is invalid or expired. Please update the API key.');
            return false;
        }
        return response.ok;
    } catch (error) {
        console.error('Failed to validate OpenWeatherMap API key:', error);
        return false;
    }
}

// Call validation on startup
validateApiKey().then(isValid => {
    if (!isValid) {
        console.warn('Weather data will use fallback values until a valid API key is provided.');
    } else {
        console.log('OpenWeatherMap API key is valid.');
    }
});

// Fallback data generator
function generateFallbackWeatherData(lat, lon, city = 'Delhi') {
    const now = new Date();
    const sunrise = new Date(now);
    sunrise.setHours(6, 30, 0);
    const sunset = new Date(now);
    sunset.setHours(18, 30, 0);

    return {
        temperature: Math.round(25 + (Math.random() * 10 - 5)),
        feels_like: Math.round(26 + (Math.random() * 10 - 5)),
        humidity: Math.round(60 + (Math.random() * 20 - 10)),
        wind_speed: Math.round(10 + (Math.random() * 10)),
        condition: 'Clear',
        description: 'Clear sky',
        icon: '01d',
        pressure: 1012,
        visibility: 10,
        sunrise: sunrise.toLocaleTimeString(),
        sunset: sunset.toLocaleTimeString(),
        city: city
    };
}

function generateFallbackForecast() {
    const forecast = [];
    const now = new Date();
    
    for (let i = 0; i < 5; i++) {
        const date = new Date(now);
        date.setDate(date.getDate() + i);
        
        forecast.push({
            time: '12:00:00',
            date: date.toLocaleDateString(),
            temperature: Math.round(25 + (Math.random() * 10 - 5)),
            condition: 'Clear',
            description: 'Clear sky',
            icon: '01d',
            humidity: Math.round(60 + (Math.random() * 20 - 10)),
            wind_speed: Math.round(10 + (Math.random() * 10))
        });
    }
    
    return forecast;
}

router.get('/current', async (req, res) => {
    const { lat = '28.6139', lon = '77.2090', city = 'Delhi' } = req.query;

    try {
        const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${OPENWEATHER_API_KEY}&units=metric`;
        const response = await fetch(url);
        
        if (response.status === 401) {
            console.error('OpenWeatherMap API Key is invalid or expired');
            return res.json({
                ...generateFallbackWeatherData(lat, lon, city),
                _error: 'API key is invalid or expired. Using fallback data.'
            });
        }
        
        if (!response.ok) {
            console.error(`Weather API failed with status ${response.status}`);
            return res.json({
                ...generateFallbackWeatherData(lat, lon, city),
                _error: `API request failed with status ${response.status}. Using fallback data.`
            });
        }

        const data = await response.json();
        
        // Format the response
        const weatherData = {
            temperature: Math.round(data.main.temp),
            feels_like: Math.round(data.main.feels_like),
            humidity: data.main.humidity,
            wind_speed: data.wind.speed,
            condition: data.weather[0].main,
            description: data.weather[0].description,
            icon: data.weather[0].icon,
            pressure: data.main.pressure,
            visibility: data.visibility / 1000, // Convert to km
            sunrise: new Date(data.sys.sunrise * 1000).toLocaleTimeString(),
            sunset: new Date(data.sys.sunset * 1000).toLocaleTimeString(),
            city: data.name
        };

        res.json(weatherData);
    } catch (error) {
        console.error('Weather API error:', error);
        res.json({
            ...generateFallbackWeatherData(lat, lon, city),
            _error: 'Failed to fetch weather data. Using fallback data.'
        });
    }
});

router.get('/forecast', async (req, res) => {
    const { lat = '28.6139', lon = '77.2090' } = req.query;

    try {
        const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${OPENWEATHER_API_KEY}&units=metric`;
        const response = await fetch(url);
        
        if (response.status === 401) {
            console.error('OpenWeatherMap API Key is invalid or expired');
            return res.json({
                data: generateFallbackForecast(),
                _error: 'API key is invalid or expired. Using fallback data.'
            });
        }
        
        if (!response.ok) {
            console.error(`Weather Forecast API failed with status ${response.status}`);
            return res.json({
                data: generateFallbackForecast(),
                _error: `API request failed with status ${response.status}. Using fallback data.`
            });
        }

        const data = await response.json();
        
        // Process and format 5-day forecast data
        const forecast = data.list.map(item => ({
            time: new Date(item.dt * 1000).toLocaleTimeString(),
            date: new Date(item.dt * 1000).toLocaleDateString(),
            temperature: Math.round(item.main.temp),
            condition: item.weather[0].main,
            description: item.weather[0].description,
            icon: item.weather[0].icon,
            humidity: item.main.humidity,
            wind_speed: item.wind.speed
        }));

        res.json(forecast);
    } catch (error) {
        console.error('Weather Forecast API error:', error);
        res.json({
            data: generateFallbackForecast(),
            _error: 'Failed to fetch forecast data. Using fallback data.'
        });
    }
});

module.exports = router; 