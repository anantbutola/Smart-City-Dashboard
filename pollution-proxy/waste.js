const express = require('express');
const router = express.Router();

// Simulated waste data for different cities
const cityWasteData = {
    'Delhi':     { collected: 150, recycled: 97.5, organic: 60, plastic: 30, paper: 35, metal: 15, others: 10 },
    'Mumbai':    { collected: 180, recycled: 120,  organic: 70, plastic: 40, paper: 40, metal: 20, others: 10 },
    'Bangalore': { collected: 130, recycled: 80,   organic: 50, plastic: 25, paper: 30, metal: 12, others: 13 },
    'Hyderabad': { collected: 140, recycled: 90,   organic: 55, plastic: 28, paper: 32, metal: 13, others: 12 },
    'Chennai':   { collected: 200, recycled: 140,  organic: 80, plastic: 50, paper: 45, metal: 15, others: 10 },
    'Kolkata':   { collected: 160, recycled: 100,  organic: 65, plastic: 35, paper: 32, metal: 14, others: 14 },
    'Pune':      { collected: 120, recycled: 75,   organic: 48, plastic: 22, paper: 28, metal: 10, others: 12 },
    'Ahmedabad': { collected: 135, recycled: 85,   organic: 52, plastic: 27, paper: 31, metal: 11, others: 14 },
    'Jaipur':    { collected: 110, recycled: 70,   organic: 45, plastic: 20, paper: 25, metal: 9,  others: 11 },
    'Lucknow':   { collected: 125, recycled: 78,   organic: 50, plastic: 23, paper: 27, metal: 10, others: 15 },
    'Default':   { collected: 150, recycled: 97.5, organic: 60, plastic: 30, paper: 35, metal: 15, others: 10 }
};

// Generate time series data for waste collection
function generateTimeSeriesData(baseValue) {
    const data = [];
    for (let i = 0; i < 7; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        data.push({
            date: date.toLocaleDateString(),
            collected: Math.round(baseValue * (0.9 + Math.random() * 0.2)), // ±10% variation
            recycled: Math.round(baseValue * 0.65 * (0.9 + Math.random() * 0.2))
        });
    }
    return data.reverse(); // Return in chronological order
}

// GET /api/waste/stats
router.get('/stats', (req, res) => {
    try {
        const { city = 'Default' } = req.query;
        const cityData = cityWasteData[city] || cityWasteData['Default'];
        
        // Calculate recycling rate
        const recyclingRate = Math.round((cityData.recycled / cityData.collected) * 100);
        
        // Get time series data
        const timeSeriesData = generateTimeSeriesData(cityData.collected);

        res.json({
            current: {
                collected: cityData.collected,
                recycled: cityData.recycled,
                recyclingRate: recyclingRate,
                composition: {
                    organic: cityData.organic,
                    plastic: cityData.plastic,
                    paper: cityData.paper,
                    metal: cityData.metal,
                    others: cityData.others
                }
            },
            timeSeries: timeSeriesData,
            tips: [
                "Separate wet and dry waste at source",
                "Use composting for organic waste",
                "Reduce single-use plastics",
                "Participate in recycling programs"
            ]
        });
    } catch (error) {
        console.error('Error in waste stats:', error);
        res.status(500).json({ error: 'Failed to get waste data' });
    }
});

module.exports = router; 