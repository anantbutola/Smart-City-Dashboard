const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const weatherRoutes = require('./weather');
const wasteRoutes = require('./waste');
const transportRoutes = require('./transport');
const mongoose = require('mongoose');

const app = express();
const PORT = 3002;

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({ error: err.message });
});

// Rate limiting to prevent abuse
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000 // or a higher number for dev
});

app.use(cors());
app.use(limiter);
app.use(express.json());

//Traffic API
const TOMTOM_API_KEY = '';    //->Enter TOMTOM Traffic API here
// AirPOllution API
const AIRVISUAL_API_KEY = '';   //->Enter AirVisual API here

// Ambee Natural Disaster Alerts Proxy
const AMBEE_API_KEY = ''; // <-- //->Enter AMBEE API here

// Add routes
app.use('/api/weather', weatherRoutes);
app.use('/api/waste', wasteRoutes);
app.use('/api/transport', transportRoutes);

app.get('/api/traffic', async (req, res) => {
    const { lat = '28.6139', lon = '77.2090' } = req.query;

    try {
        // First validate coordinates
        if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
            return res.status(400).json({ error: "Invalid coordinates" });
        }

        const url = `https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json?point=${lat},${lon}&key=${TOMTOM_API_KEY}`;
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`TomTom API error: ${response.status}`);
        }

        const data = await response.json();

        if (data.flowSegmentData) {
            // Simulate time-series data for the past 12 hours
            const now = new Date();
            const timeSeries = [];
            for (let i = 11; i >= 0; i--) {
                const hour = new Date(now.getTime() - i * 60 * 60 * 1000);
                // Format hour as 12-hour am/pm
                let h = hour.getHours();
                const ampm = h >= 12 ? 'pm' : 'am';
                h = h % 12;
                if (h === 0) h = 12;
                const timeLabel = `${h} ${ampm}`;
                // Simulate currentSpeed with some random variation
                const baseSpeed = data.flowSegmentData.currentSpeed;
                const freeFlowSpeed = data.flowSegmentData.freeFlowSpeed;
                const simulatedSpeed = Math.max(5, baseSpeed + Math.round(Math.sin(i / 2) * 8 + (Math.random() - 0.5) * 6));
                timeSeries.push({
                    time: timeLabel,
                    currentSpeed: simulatedSpeed,
                    freeFlowSpeed: freeFlowSpeed
                });
            }

            res.json({
                currentSpeed: data.flowSegmentData.currentSpeed,
                freeFlowSpeed: data.flowSegmentData.freeFlowSpeed,
                travelTime: data.flowSegmentData.currentTravelTime,
                freeFlowTravelTime: data.flowSegmentData.freeFlowTravelTime,
                coordinates: { lat, lon },
                timeSeries
            });
        } else {
            res.status(404).json({ error: "Traffic data not available for this location" });
        }
    } catch (error) {
        console.error('Traffic API error:', error);
        res.status(500).json({ 
            error: "Failed to fetch traffic data",
            details: error.message 
        });
    }
});

app.get('/api/pollution', async (req, res) => {
    const { lat = '28.6139', lon = '77.2090' } = req.query;
    if (!lat || !lon) {
        return res.status(400).json({ error: "Missing lat or lon" });
    }
    try {
        const url = `https://api.airvisual.com/v2/nearest_city?lat=${lat}&lon=${lon}&key=${AIRVISUAL_API_KEY}`;
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`AirVisual API error: ${response.status}`);
        }
        const data = await response.json();
        if (!data.data || !data.data.current || !data.data.current.pollution) {
            return res.status(404).json({ error: "Pollution data not available for this location" });
        }
        const pollution = data.data.current.pollution;
        // AirVisual provides AQI and main pollutant, but not all values. We'll map what we can.
        // For demonstration, we'll use AQI values and set others to N/A if not present.
        res.json({
            pm25: pollution.aqius || 'N/A', // US AQI (mainly PM2.5)
            co2: pollution.co || 'N/A',     // Not always available
            no2: pollution.no2 || 'N/A',    // Not always available
            o3: pollution.o3 || 'N/A'       // Not always available
        });
    } catch (err) {
        console.error('AirVisual API error:', err);
        res.status(500).json({ error: "Failed to fetch pollution data", details: err.message });
    }
});

app.get('/api/openaq', async (req, res) => {
    const { city = 'Delhi' } = req.query;
    try {
        const response = await fetch(
            `https://api.openaq.org/v3/measurements?city=${encodeURIComponent(city)}&country=IN&limit=100`,
            {
                headers: {
                    "X-API-Key": "3959d5e80ce6fa2bb96c6ff19785e2bcf98af8bf3c34ad6ca380259aeeb58ea2"
                }
            }
        );
        const data = await response.json();
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch OpenAQ data", details: err.message });
    }
});

// Geocoding proxy for Nominatim (to avoid CORS issues)
app.get('/api/geocode', async (req, res) => {
    const { city } = req.query;
    if (!city) {
        return res.status(400).json({ error: 'City parameter is required' });
    }
    try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(city + ', India')}&limit=1`;
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'SmartCityDashboard/1.0 (your@email.com)'
            }
        });
        if (!response.ok) {
            throw new Error('Nominatim request failed');
        }
        const data = await response.json();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch geocode data', details: error.message });
    }
});

app.get('/api/disasters', async (req, res) => {
    try {
        const url = "https://api.ambeedata.com/disasters/latest/by-country-code?countryCode=IND&limit=5&page=1";
        const response = await fetch(url, {
            headers: {
                "x-api-key": "2c78ab6646b63ac2e6069a3e71bc7f8f69bd00840e2840d6be72d03f77801a1f",
                "Content-type": "application/json"
            }
        });
        if (!response.ok) throw new Error('Ambee API error');
        const data = await response.json();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch disaster data', details: error.message });
    }
});

const authRoutes = require('./auth');
app.use('/api/auth', authRoutes);

mongoose.connect('mongodb://localhost:27017/smartcity', { useNewUrlParser: true, useUnifiedTopology: true });

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log('Routes registered:');
    console.log('- /api/weather');
    console.log('- /api/waste');
    console.log('- /api/transport');
    console.log('- /api/disasters');
    console.log('- /api/auth');
});
