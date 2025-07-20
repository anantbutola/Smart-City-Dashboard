const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');
require('dotenv').config();

// Configuration for different transit data sources
const CONFIG = {
    delhi: {
        baseUrl: 'https://otd.delhi.gov.in/api/v1',
        apiKey: process.env.DELHI_TRANSIT_API_KEY,
        enabled: !!process.env.DELHI_TRANSIT_API_KEY
    },
    mumbai: {
        baseUrl: 'https://mumbai.transit.api/v1',
        apiKey: process.env.MUMBAI_TRANSIT_API_KEY,
        enabled: !!process.env.MUMBAI_TRANSIT_API_KEY
    },
    gtfs: {
        baseUrl: 'https://transit.land/api/v2',
        apiKey: process.env.GTFS_API_KEY,
        enabled: !!process.env.GTFS_API_KEY
    }
};

// Cache for real-time data to prevent excessive API calls
const dataCache = {
    delhi: { data: null, timestamp: 0 },
    mumbai: { data: null, timestamp: 0 },
    gtfs: { data: null, timestamp: 0 }
};

const CACHE_DURATION = 30000; // 30 seconds cache

// Function to check if cached data is still valid
function isCacheValid(city) {
    return dataCache[city] && 
           (Date.now() - dataCache[city].timestamp) < CACHE_DURATION;
}

// Simulated bus routes data for different cities
const busRoutes = {
    'Delhi': [
        { id: 'DL1', name: 'Red Line', stops: ['Central Delhi', 'North Delhi', 'East Delhi'], frequency: 10 },
        { id: 'DL2', name: 'Blue Line', stops: ['South Delhi', 'Central Delhi', 'West Delhi'], frequency: 15 },
        { id: 'DL3', name: 'Green Line', stops: ['East Delhi', 'Central Delhi', 'South Delhi'], frequency: 12 }
    ],
    'Mumbai': [
        { id: 'MB1', name: 'Route 1', stops: ['Colaba', 'Churchgate', 'Andheri'], frequency: 8 },
        { id: 'MB2', name: 'Route 2', stops: ['Bandra', 'Dadar', 'Thane'], frequency: 12 }
    ],
    'Default': [
        { id: 'RT1', name: 'Route 1', stops: ['Stop A', 'Stop B', 'Stop C'], frequency: 10 },
        { id: 'RT2', name: 'Route 2', stops: ['Stop X', 'Stop Y', 'Stop Z'], frequency: 15 }
    ]
};

// Generate simulated bus locations for a route
function generateBusLocations(route) {
    const buses = [];
    const numBuses = Math.floor(Math.random() * 3) + 2; // 2-4 buses per route
    
    for (let i = 0; i < numBuses; i++) {
        const stopIndex = Math.floor(Math.random() * route.stops.length);
        const nextStopIndex = (stopIndex + 1) % route.stops.length;
        buses.push({
            id: `${route.id}-Bus${i + 1}`,
            currentStop: route.stops[stopIndex],
            nextStop: route.stops[nextStopIndex],
            eta: Math.floor(Math.random() * 10) + 1,
            capacity: Math.floor(Math.random() * 30) + 70, // 70-100% capacity
            onTime: Math.random() > 0.2 // 80% chance of being on time
        });
    }
    return buses;
}

// Generate schedule for a route
function generateSchedule(route) {
    const schedule = [];
    const now = new Date();
    for (let i = 0; i < 6; i++) {
        const time = new Date(now.getTime() + i * route.frequency * 60000);
        schedule.push({
            departureTime: time.toLocaleTimeString(),
            from: route.stops[0],
            to: route.stops[route.stops.length - 1],
            status: Math.random() > 0.1 ? 'On Time' : 'Delayed'
        });
    }
    return schedule;
}

// Function to fetch real-time bus locations from Delhi OTD
async function fetchDelhiRealTimeData() {
    if (!CONFIG.delhi.enabled) {
        console.log('Delhi transit API not configured');
        return null;
    }

    try {
        const response = await fetch(`${CONFIG.delhi.baseUrl}/bus/locations`, {
            headers: {
                'Authorization': `Bearer ${CONFIG.delhi.apiKey}`,
                'Accept': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`Delhi transit API error: ${response.status}`);
        }
        
        const data = await response.json();
        dataCache.delhi = { data, timestamp: Date.now() };
        return data;
    } catch (error) {
        console.error('Error fetching Delhi real-time data:', error);
        return dataCache.delhi?.data || null;
    }
}

// Function to fetch real-time bus locations from Mumbai Transit
async function fetchMumbaiRealTimeData() {
    if (!CONFIG.mumbai.enabled) {
        console.log('Mumbai transit API not configured');
        return null;
    }

    try {
        const response = await fetch(`${CONFIG.mumbai.baseUrl}/vehicles`, {
            headers: {
                'X-Api-Key': CONFIG.mumbai.apiKey,
                'Accept': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`Mumbai transit API error: ${response.status}`);
        }
        
        const data = await response.json();
        dataCache.mumbai = { data, timestamp: Date.now() };
        return data;
    } catch (error) {
        console.error('Error fetching Mumbai real-time data:', error);
        return dataCache.mumbai?.data || null;
    }
}

// Function to fetch GTFS real-time data
async function fetchGTFSRealTimeData(city) {
    if (!CONFIG.gtfs.enabled) {
        console.log('GTFS API not configured');
        return null;
    }

    try {
        const response = await fetch(`${CONFIG.gtfs.baseUrl}/routes?city=${city}`, {
            headers: {
                'Authorization': `Bearer ${CONFIG.gtfs.apiKey}`,
                'Accept': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`GTFS API error: ${response.status}`);
        }
        
        const data = await response.json();
        dataCache.gtfs = { data, timestamp: Date.now() };
        return data;
    } catch (error) {
        console.error('Error fetching GTFS real-time data:', error);
        return dataCache.gtfs?.data || null;
    }
}

// Function to get real-time data based on city
async function getRealTimeData(city) {
    const cityLower = city.toLowerCase();
    
    // Check cache first
    if (isCacheValid(cityLower)) {
        return dataCache[cityLower].data;
    }

    // Try city-specific API first
    let data = null;
    switch(cityLower) {
        case 'delhi':
            data = await fetchDelhiRealTimeData();
            break;
        case 'mumbai':
            data = await fetchMumbaiRealTimeData();
            break;
        default:
            // Try GTFS as fallback for other cities
            data = await fetchGTFSRealTimeData(city);
    }

    return data;
}

// Transform real-time data to match our API format
function transformRealTimeData(realTimeData, city) {
    if (!realTimeData) return null;

    try {
        // Handle different API response formats
        let routes;
        if (realTimeData.routes) {
            // Delhi/Mumbai format
            routes = realTimeData.routes.map(route => ({
                id: route.routeId || route.id,
                name: route.routeName || route.name,
                stops: route.stops || [],
                frequency: route.headway || route.frequency || 10,
                buses: (route.vehicles || []).map(vehicle => ({
                    id: vehicle.id,
                    currentStop: vehicle.currentStop,
                    nextStop: vehicle.nextStop,
                    eta: vehicle.eta || 5,
                    capacity: vehicle.occupancy || 80,
                    onTime: vehicle.onSchedule || true,
                    location: vehicle.location || null
                })),
                status: route.status || 'Normal'
            }));
        } else if (realTimeData.features) {
            // GTFS format
            routes = realTimeData.features.map(feature => ({
                id: feature.properties.route_id,
                name: feature.properties.route_name,
                stops: feature.properties.stops || [],
                frequency: feature.properties.headway || 10,
                buses: (feature.properties.vehicles || []).map(vehicle => ({
                    id: vehicle.id,
                    currentStop: vehicle.stop_id,
                    nextStop: vehicle.next_stop_id,
                    eta: vehicle.arrival_time || 5,
                    capacity: vehicle.occupancy || 80,
                    onTime: vehicle.schedule_deviation < 300, // 5 minutes threshold
                    location: vehicle.location || null
                })),
                status: feature.properties.status || 'Normal'
            }));
        } else {
            throw new Error('Unknown data format');
        }

        const stats = {
            totalBuses: routes.reduce((acc, r) => acc + r.buses.length, 0),
            activeRoutes: routes.length,
            avgWaitTime: Math.round(routes.reduce((acc, r) => acc + r.frequency, 0) / routes.length),
            onTimePerformance: Math.round(
                (routes.reduce((acc, r) => 
                    acc + r.buses.filter(b => b.onTime).length, 0) / 
                routes.reduce((acc, r) => acc + r.buses.length, 0)) * 100
            )
        };

        return {
            routes,
            stats,
            dataSource: 'real-time',
            lastUpdated: new Date().toISOString()
        };
    } catch (error) {
        console.error('Error transforming real-time data:', error);
        return null;
    }
}

// GET /api/transport/routes
router.get('/routes', async (req, res) => {
    try {
        const { city = 'Default' } = req.query;
        // Try to get real-time data only
        const realTimeData = await getRealTimeData(city);
        const transformedData = realTimeData ? transformRealTimeData(realTimeData, city) : null;
        if (transformedData) {
            res.json(transformedData);
            return;
        }
        // If no real-time data, return error
        res.status(503).json({
            error: 'No real-time transport data available',
            dataSource: 'unavailable',
            lastUpdated: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error in transport routes:', error);
        res.status(500).json({ 
            error: 'Failed to get transport data',
            details: error.message,
            dataSource: 'error'
        });
    }
});

// GET /api/transport/schedule
router.get('/schedule', async (req, res) => {
    try {
        const { city = 'Default', routeId } = req.query;
        if (!routeId) {
            return res.status(400).json({ error: 'Route ID is required' });
        }
        // Try to get real-time data only
        const realTimeData = await getRealTimeData(city);
        const transformedData = realTimeData ? transformRealTimeData(realTimeData, city) : null;
        if (transformedData && transformedData.routes) {
            const route = transformedData.routes.find(r => r.id === routeId);
            if (!route) {
                return res.status(404).json({ error: 'Route not found' });
            }
            res.json({
                routeInfo: route,
                schedule: route.schedule || []
            });
            return;
        }
        // If no real-time data, return error
        res.status(503).json({
            error: 'No real-time schedule data available',
            dataSource: 'unavailable',
            lastUpdated: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error in transport schedule:', error);
        res.status(500).json({ error: 'Failed to get schedule data' });
    }
});

module.exports = router; 