let trafficChartInstance = null;
const NOMINATIM_API_URL = "https://nominatim.openstreetmap.org/search";

// Indian cities with their coordinates
const INDIAN_CITIES = [
    { name: 'Delhi', lat: '28.6139', lon: '77.2090' },
    { name: 'Mumbai', lat: '19.0760', lon: '72.8777' },
    { name: 'Bangalore', lat: '12.9716', lon: '77.5946' },
    { name: 'Hyderabad', lat: '17.3850', lon: '78.4867' },
    { name: 'Chennai', lat: '13.0827', lon: '80.2707' },
    { name: 'Kolkata', lat: '22.5726', lon: '88.3639' },
    { name: 'Pune', lat: '18.5204', lon: '73.8567' },
    { name: 'Ahmedabad', lat: '23.0225', lon: '72.5714' },
    { name: 'Jaipur', lat: '26.9124', lon: '75.7873' },
    { name: 'Lucknow', lat: '26.8467', lon: '80.9462' }
];

// India's geographical boundaries
const INDIA_BOUNDS = {
    minLat: 8.4,  // Southernmost point
    maxLat: 37.6, // Northernmost point
    minLon: 68.7, // Westernmost point
    maxLon: 97.4  // Easternmost point
};

// Function to generate random coordinates within India
function getRandomIndiaCoordinates() {
    const lat = (Math.random() * (INDIA_BOUNDS.maxLat - INDIA_BOUNDS.minLat) + INDIA_BOUNDS.minLat).toFixed(4);
    const lon = (Math.random() * (INDIA_BOUNDS.maxLon - INDIA_BOUNDS.minLon) + INDIA_BOUNDS.minLon).toFixed(4);
    return { lat, lon };
}

// Initialize charts and data
document.addEventListener('DOMContentLoaded', () => {
    // Initialize traffic chart
    const trafficCanvas = document.getElementById('trafficChart');
    if (trafficCanvas) {
        if (window.trafficChartInstance) {
            window.trafficChartInstance.destroy();
        }
        // Show a loading state until data loads
        window.trafficChartInstance = new Chart(trafficCanvas.getContext('2d'), {
            type: 'line',
        data: {
                labels: Array.from({length: 12}, (_, i) => `--:--`),
            datasets: [{
                    label: 'Loading Traffic Data...',
                    data: Array(12).fill(0),
                    borderColor: 'rgba(200,200,200,0.5)',
                    backgroundColor: 'rgba(200,200,200,0.1)',
                    fill: true,
                    tension: 0.3,
                    pointRadius: 2
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Speed (km/h)'
                        }
                    },
                    x: {
                    title: {
                        display: true,
                            text: 'Time (last 12 hours)'
                        }
                    }
                }
            }
        });
    }

    // Initialize route chart only if the canvas exists
    const routeCanvas = document.getElementById('routeChart');
    if (routeCanvas) {
        const routeCtx = routeCanvas.getContext('2d');
    const routeChart = new Chart(routeCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Route Traffic Flow',
                data: [],
                borderColor: 'rgb(75, 192, 192)',
                tension: 0.1
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Speed (km/h)'
                    }
                }
            }
        }
    });
    }

    const trafficSection = document.getElementById('traffic');
    const trafficMap = document.getElementById('traffic-map');
    const trafficGraph = document.getElementById('traffic-graph');

    // Slide toggle for traffic section
    const showGraphBtn = document.getElementById('showGraphBtn');
    const showMapBtn = document.getElementById('showMapBtn');

    showGraphBtn.addEventListener('click', function() {
        trafficGraph.style.display = '';
        trafficMap.style.display = 'none';
        showGraphBtn.classList.add('btn-primary');
        showGraphBtn.classList.remove('btn-outline-primary');
        showMapBtn.classList.remove('btn-primary');
        showMapBtn.classList.add('btn-outline-primary');
    });

    showMapBtn.addEventListener('click', function() {
        trafficGraph.style.display = 'none';
        trafficMap.style.display = '';
        showMapBtn.classList.add('btn-primary');
        showMapBtn.classList.remove('btn-outline-primary');
        showGraphBtn.classList.remove('btn-primary');
        showGraphBtn.classList.add('btn-outline-primary');
        // Fix: Force Leaflet to resize when map is shown
        if (window.leafletMap) {
            setTimeout(() => window.leafletMap.invalidateSize(), 200);
        }
    });

    // Store the latest traffic data for modal use
    window.latestTrafficData = null;
    window.latestTrafficCity = null;

    // Function to show the traffic modal
    function showTrafficModal() {
        const modal = document.getElementById('trafficModal');
        const dataDiv = document.getElementById('full-traffic-data');
        const data = window.latestTrafficData;
        const city = window.latestTrafficCity || 'City';
        if (!data) {
            dataDiv.innerHTML = '<em>No traffic data available.</em>';
        } else {
            // Format the full data
            let html = `<strong>${city} Traffic Data</strong><br><br>`;
            html += `<b>Current Speed:</b> ${data.currentSpeed} km/h<br>`;
            html += `<b>Free Flow Speed:</b> ${data.freeFlowSpeed} km/h<br>`;
            html += `<b>Congestion Level:</b> ${Math.round((1 - data.currentSpeed / data.freeFlowSpeed) * 100)}%<br>`;
            html += `<b>Travel Time:</b> ${Math.round(data.travelTime / 60)} min<br>`;
            html += `<b>Free Flow Travel Time:</b> ${Math.round(data.freeFlowTravelTime / 60)} min<br>`;
            if (data.timeSeries) {
                html += `<b>Time Series:</b><br><ul style='margin-left: 1em;'>`;
                data.timeSeries.forEach(point => {
                    html += `<li>${point.time}: ${point.currentSpeed} km/h (Free Flow: ${point.freeFlowSpeed} km/h)</li>`;
                });
                html += `</ul>`;
            }
            dataDiv.innerHTML = html;
        }
        modal.style.display = 'block';
    }

    // Event listeners for modal
    window.addEventListener('DOMContentLoaded', function() {
        document.getElementById('trafficMenuBtn').onclick = showTrafficModal;
        document.getElementById('closeTrafficModal').onclick = function() {
            document.getElementById('trafficModal').style.display = 'none';
        };
        window.onclick = function(event) {
            const modal = document.getElementById('trafficModal');
            if (event.target === modal) {
                modal.style.display = 'none';
            }
        };
    });

    // After random data loads, store it for modal
    setTimeout(() => {
        // Try to get the chart data
        if (window.trafficChartInstance && window.trafficChartInstance.data) {
            const chart = window.trafficChartInstance;
            // Simulate a data object for modal
            window.latestTrafficData = {
                currentSpeed: chart.data.datasets[0].data[0] || 0,
                freeFlowSpeed: chart.data.datasets[0].data[1] || 0,
                travelTime: 0,
                freeFlowTravelTime: 0,
                timeSeries: chart.data.labels.map((label, i) => ({
                    time: label,
                    currentSpeed: chart.data.datasets[0].data[i] || 0,
                    freeFlowSpeed: chart.data.datasets[0].data[1] || 0
                }))
            };
            window.latestTrafficCity = 'Delhi';
        }
    }, 1200);

    initMap();
});

// Function to get coordinates from city name
async function getCityCoordinates(cityName) {
    try {
        // Use backend proxy to avoid CORS
        const response = await fetch(`http://localhost:3002/api/geocode?city=${encodeURIComponent(cityName)}`);
        const data = await response.json();
        if (data && data.length > 0) {
            return {
                lat: data[0].lat,
                lon: data[0].lon
            };
        }
        return null;
    } catch (error) {
        console.error('Error getting coordinates:', error);
        return null;
    }
}

// Update loadCityTrafficData function with better error handling
async function loadCityTrafficData(cityName) {
    try {
        // Get coordinates for the city
        const coords = await getCityCoordinates(cityName);
        if (!coords) {
            console.error('City coordinates not found');
            alert('City not found. Please enter a valid city name.');
            return;
        }

        console.log('Fetching traffic data for:', cityName, coords);

        // Fetch traffic data
        const response = await fetch(`http://localhost:3002/api/traffic?lat=${coords.lat}&lon=${coords.lon}`);
        const data = await response.json();

        if (data.error) {
            console.error('Traffic API Error:', data.error);
            // Use fallback data if provided
            if (data.fallback) {
                console.log('Using fallback traffic data');
                window.latestTrafficData = data.fallback;
                window.latestTrafficCity = cityName;
                updateTrafficChartTimeSeries(data.fallback, cityName);
                updateRouteChart(data.fallback);
                updateTrafficMap(coords.lat, coords.lon);
                return;
            }
            throw new Error(data.error);
        }

        // Store for modal
        window.latestTrafficData = data;
        window.latestTrafficCity = cityName;

        // Update the chart with city time-series data
        updateTrafficChartTimeSeries(data, cityName);
        updateRouteChart(data);

        // Update the map to center on the searched city
        updateTrafficMap(coords.lat, coords.lon);

    } catch (error) {
        console.error('Error loading traffic data:', error);
        alert('Failed to load traffic data. Using simulated data.');
        
        // Use simulated data as fallback
        const simulatedData = {
            currentSpeed: 30,
            freeFlowSpeed: 50,
            travelTime: 300,
            freeFlowTravelTime: 240,
            coordinates: { lat: (typeof coords !== 'undefined' && coords) ? coords.lat : 28.6139, lon: (typeof coords !== 'undefined' && coords) ? coords.lon : 77.2090 },
            timeSeries: Array.from({ length: 12 }, (_, i) => {
                const hour = new Date(Date.now() - i * 60 * 60 * 1000);
                let h = hour.getHours();
                const ampm = h >= 12 ? 'pm' : 'am';
                h = h % 12;
                if (h === 0) h = 12;
                return {
                    time: `${h} ${ampm}`,
                    currentSpeed: Math.max(5, 30 + Math.round(Math.sin(i / 2) * 8 + (Math.random() - 0.5) * 6)),
                    freeFlowSpeed: 50
                };
            })
        };

        window.latestTrafficData = simulatedData;
        window.latestTrafficCity = cityName;
        updateTrafficChartTimeSeries(simulatedData, cityName);
        updateRouteChart(simulatedData);
        if (typeof coords !== 'undefined' && coords) {
            updateTrafficMap(coords.lat, coords.lon);
        }
    }
}

// New function: update traffic chart as a time-series line chart
function updateTrafficChartTimeSeries(data, cityName = 'City') {
    const trafficCanvas = document.getElementById('trafficChart');
    if (!trafficCanvas) return;
    if (window.trafficChartInstance) {
        window.trafficChartInstance.destroy();
    }
    // Use timeSeries from backend
    const labels = data.timeSeries.map(point => point.time);
    const speeds = data.timeSeries.map(point => point.currentSpeed);
    window.trafficChartInstance = new Chart(trafficCanvas.getContext('2d'), {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: `${cityName} Traffic Speed (km/h)` ,
                data: speeds,
                borderColor: 'rgb(75, 192, 192)',
                backgroundColor: 'rgba(75, 192, 192, 0.15)',
                fill: true,
                tension: 0.3,
                pointRadius: 3,
                pointBackgroundColor: 'rgb(75, 192, 192)'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Speed (km/h)'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Time (last 12 hours)'
                    }
                }
            }
        }
    });
}

function updateRouteChart(data) {
    const routeCanvas = document.getElementById('routeChart');
    if (!routeCanvas) return;
    const ctx = routeCanvas.getContext('2d');
    
    // Generate sample route data (in a real app, this would come from the API)
    const routeData = Array.from({length: 10}, (_, i) => {
        const baseSpeed = data.currentSpeed;
        const variation = Math.random() * 20 - 10; // Random variation between -10 and +10
        return Math.max(0, baseSpeed + variation);
    });

    const chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: Array.from({length: 10}, (_, i) => `Point ${i + 1}`),
            datasets: [{
                label: 'Route Traffic Flow',
                data: routeData,
                borderColor: 'rgb(75, 192, 192)',
                tension: 0.1
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Speed (km/h)'
                    }
                }
            }
        }
    });
}

// Search functionality
function handleSearch() {
    const city = document.getElementById('search-bar').value.trim();
    if (!city) {
        alert('Please enter a city or state name');
        return;
    }
    getCityCoordinates(city).then(coords => {
        if (!coords) {
            alert('City not found. Please enter a valid city name.');
            return;
        }
        loadCityTrafficData(city);
        fetchPollutionData(city).then(updatePollutionData);
        fetchWeatherData(coords.lat, coords.lon).then(updateWeatherUI);
        fetchWeatherForecast(coords.lat, coords.lon).then(updateForecastUI);
        fetchWasteData(city).then(updateWasteData);
        fetchEnergyData(city).then(updateEnergyData);
        updateTransportMapForCity(city);
    });
}

// Load traffic data from backend
async function loadTrafficData(lat, lon) {
    try {
        const response = await fetch(`http://localhost:3002/api/traffic?lat=${lat}&lon=${lon}`);
        if (!response.ok) {
            throw new Error('Failed to fetch traffic data');
        }
        const data = await response.json();
        updateTrafficData(data);
    } catch (error) {
        console.error('Error loading traffic data:', error);
        alert('Failed to load traffic data. Please try again later.');
    }
}

function updateTrafficData(data) {
    const trafficCanvas = document.getElementById('trafficChart');
    if (!trafficCanvas) return;
    const ctx = trafficCanvas.getContext('2d');
    const chart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Current Speed', 'Free Flow Speed', 'Congestion'],
            datasets: [{
                label: 'Traffic Metrics',
                data: [
                    data.currentSpeed,
                    data.freeFlowSpeed,
                    Math.round((1 - data.currentSpeed / data.freeFlowSpeed) * 100)
                ],
                backgroundColor: [
                    'rgba(75, 192, 192, 0.2)',
                    'rgba(54, 162, 235, 0.2)',
                    'rgba(255, 99, 132, 0.2)'
                ],
                borderColor: [
                    'rgba(75, 192, 192, 1)',
                    'rgba(54, 162, 235, 1)',
                    'rgba(255, 99, 132, 1)'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Speed (km/h) / Congestion (%)'
                    }
                }
            }
        }
    });
}

// Render the traffic chart
function renderTrafficChart(congestion, travelTime, freeFlowTravelTime) {
    const trafficCanvas = document.getElementById('trafficChart');
    if (!trafficCanvas) return;
    const ctx = trafficCanvas.getContext('2d');
    // Destroy previous chart if exists
    if (trafficChartInstance) {
        trafficChartInstance.destroy();
    }
    // Create new chart
    trafficChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Current Traffic Congestion'],
            datasets: [{
                label: 'Congestion Level (%)',
                data: [congestion],
                backgroundColor: getCongestionColor(congestion),
                borderColor: getCongestionColor(congestion, true),
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    title: {
                        display: true,
                        text: 'Congestion Percentage'
                    },
                    ticks: {
                        callback: function(value) {
                            return value + '%';
                        }
                    }
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const travelMins = Math.floor(travelTime / 60);
                            const freeFlowMins = Math.floor(freeFlowTravelTime / 60);
                            return [
                                `Congestion: ${context.raw}%`,
                                `Current Travel Time: ${travelMins} mins`,
                                `Free Flow Time: ${freeFlowMins} mins`
                            ];
                        }
                    }
                }
            }
        }
    });
}

// Helper function to get color based on congestion level
function getCongestionColor(percentage, isBorder = false) {
    if (percentage > 70) return isBorder ? '#c62828' : '#ef5350'; // Red
    if (percentage > 40) return isBorder ? '#e65100' : '#ff9800'; // Orange
    return isBorder ? '#2e7d32' : '#4caf50'; // Green
}

// Authentication Functions

function switchAuth(mode) {
    const signinBox = document.getElementById('signin-box');
    const signupBox = document.getElementById('signup-box');
    
    if (mode === 'signup') {
        signinBox.classList.add('hidden');
        signupBox.classList.remove('hidden');
    } else {
        signupBox.classList.add('hidden');
        signinBox.classList.remove('hidden');
    }
}

// --- LOGIN ENFORCEMENT ---
function isLoggedIn() {
    return !!localStorage.getItem('loggedInUser');
}

function requireLogin() {
    // Hide dashboard content
    document.querySelector('main').style.display = 'none';
    document.querySelector('.search-bar').style.display = 'none';
    document.getElementById('auth-popup').classList.remove('hidden');
}

function allowDashboard() {
    document.querySelector('main').style.display = '';
    document.querySelector('.search-bar').style.display = '';
    document.getElementById('auth-popup').classList.add('hidden');
}

// On page load, enforce login
window.addEventListener('DOMContentLoaded', function() {
    if (!isLoggedIn()) {
        requireLogin();
    } else {
        allowDashboard();
    }
});

// Patch signIn to use backend API
window.signIn = async function() {
    const username = document.getElementById('signin-username').value.trim();
    const password = document.getElementById('signin-password').value;
    if (!username || !password) {
        alert('Please enter both username and password');
        return;
    }
    try {
        const res = await fetch('http://localhost:3002/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        if (data.success) {
            localStorage.setItem('loggedInUser', username);
            allowDashboard();
            document.getElementById('auth-toggle-btn').textContent = 'Logout';
            alert('Login successful!');
        } else {
            alert(data.error || 'Login failed');
        }
    } catch (err) {
        alert('Login failed. Server error.');
    }
};

// Patch signUp to use backend API
window.signUp = async function() {
    const username = document.getElementById('signup-username').value.trim();
    const email = document.getElementById('signup-email').value.trim();
    const dob = document.getElementById('signup-dob').value;
    const password = document.getElementById('signup-password').value;
    if (!username || !email || !dob || !password) {
        alert('Please fill all fields');
        return;
    }
    try {
        const res = await fetch('http://localhost:3002/api/auth/signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, dob, password })
        });
        const data = await res.json();
        if (data.success) {
            alert('Account created successfully! Please sign in.');
            switchAuth('signin');
        } else {
            alert(data.error || 'Sign up failed');
        }
    } catch (err) {
        alert('Sign up failed. Server error.');
    }
};

// Patch handleLogout to clear login and require login again
window.handleLogout = function() {
    localStorage.removeItem('loggedInUser');
    document.getElementById('auth-toggle-btn').textContent = 'Login';
    requireLogin();
};

// Patch auth-toggle-btn to handle logout
window.addEventListener('DOMContentLoaded', function() {
    document.getElementById('auth-toggle-btn').onclick = function() {
        if (isLoggedIn()) {
            handleLogout();
        } else {
            requireLogin();
        }
    };
});

// Block dashboard actions if not logged in
const originalHandleSearch = handleSearch;
handleSearch = function() {
    if (!isLoggedIn()) {
        requireLogin();
        return;
    }
    originalHandleSearch();
};

// Function to load all data
async function loadData() {
    try {
        // Load traffic data
        const trafficData = await fetchTrafficData();
        updateTrafficData(trafficData);

        // Load energy data
        const energyData = await fetchEnergyData();
        updateEnergyData(energyData);

        // Load pollution data
        const pollutionData = await fetchPollutionData();
        updatePollutionData(pollutionData);

        // Load waste data
        const wasteData = await fetchWasteData();
        updateWasteData(wasteData);

        // Load wifi data
        const wifiData = await fetchWifiData();
        updateWifiData(wifiData);

        // Load crime data
        const crimeData = await fetchCrimeData();
        updateCrimeData(crimeData);

        // Load transport data
        const transportData = await fetchTransportData();
        updateTransportData(transportData);

        // Load weather data
        const weatherData = await fetchWeatherData();
        updateWeatherData(weatherData);

        // Load disaster data
        const disasterData = await fetchDisasterData();
        updateDisasterData(disasterData);

    } catch (error) {
        console.error('Error loading data:', error);
        alert('Failed to load dashboard data. Please try again later.');
    }
}

// Data fetching functions
async function fetchTrafficData() {
    // Simulated data - replace with actual API call
    return {
        currentSpeed: 45,
        freeFlowSpeed: 60,
        congestion: 25
    };
}

const simulatedEnergyData = [
    {
        hours: ["12 am", "1 am", "2 am", "3 am", "4 am", "5 am", "6 am", "7 am", "8 am", "9 am", "10 am", "11 am", "12 pm", "1 pm", "2 pm", "3 pm", "4 pm", "5 pm", "6 pm", "7 pm", "8 pm", "9 pm", "10 pm", "11 pm"],
        values: [1150, 1120, 1100, 1100, 1120, 1200, 1300, 1450, 1600, 1700, 1750, 1800, 1780, 1750, 1700, 1650, 1600, 1550, 1500, 1480, 1450, 1400, 1350, 1300],
        renewablePct: 42,
        renewable: 600,
        nonRenewable: 850,
        current: 1450,
        peak: 1800,
        avg: 1400,
        total: 34000,
        stateName: "India (Simulated 1)",
        year: "2023-24"
    },
    {
        hours: ["12 am", "1 am", "2 am", "3 am", "4 am", "5 am", "6 am", "7 am", "8 am", "9 am", "10 am", "11 am", "12 pm", "1 pm", "2 pm", "3 pm", "4 pm", "5 pm", "6 pm", "7 pm", "8 pm", "9 pm", "10 pm", "11 pm"],
        values: [1200, 1180, 1150, 1130, 1150, 1250, 1350, 1500, 1650, 1750, 1800, 1850, 1830, 1800, 1750, 1700, 1650, 1600, 1550, 1520, 1500, 1450, 1400, 1350],
        renewablePct: 38,
        renewable: 570,
        nonRenewable: 930,
        current: 1500,
        peak: 1850,
        avg: 1430,
        total: 34500,
        stateName: "India (Simulated 2)",
        year: "2023-24"
    },
    {
        hours: ["12 am", "1 am", "2 am", "3 am", "4 am", "5 am", "6 am", "7 am", "8 am", "9 am", "10 am", "11 am", "12 pm", "1 pm", "2 pm", "3 pm", "4 pm", "5 pm", "6 pm", "7 pm", "8 pm", "9 pm", "10 pm", "11 pm"],
        values: [1100, 1080, 1070, 1080, 1100, 1150, 1250, 1400, 1550, 1650, 1700, 1750, 1730, 1700, 1650, 1600, 1550, 1500, 1450, 1430, 1400, 1350, 1300, 1250],
        renewablePct: 45,
        renewable: 650,
        nonRenewable: 800,
        current: 1400,
        peak: 1750,
        avg: 1350,
        total: 33000,
        stateName: "India (Simulated 3)",
        year: "2023-24"
    },
    {
        hours: ["12 am", "1 am", "2 am", "3 am", "4 am", "5 am", "6 am", "7 am", "8 am", "9 am", "10 am", "11 am", "12 pm", "1 pm", "2 pm", "3 pm", "4 pm", "5 pm", "6 pm", "7 pm", "8 pm", "9 pm", "10 pm", "11 pm"],
        values: [1300, 1280, 1250, 1230, 1250, 1350, 1450, 1600, 1750, 1850, 1900, 1950, 1930, 1900, 1850, 1800, 1750, 1700, 1650, 1620, 1600, 1550, 1500, 1450],
        renewablePct: 36,
        renewable: 540,
        nonRenewable: 960,
        current: 1550,
        peak: 1950,
        avg: 1500,
        total: 35500,
        stateName: "India (Simulated 4)",
        year: "2023-24"
    },
    {
        hours: ["12 am", "1 am", "2 am", "3 am", "4 am", "5 am", "6 am", "7 am", "8 am", "9 am", "10 am", "11 am", "12 pm", "1 pm", "2 pm", "3 pm", "4 pm", "5 pm", "6 pm", "7 pm", "8 pm", "9 pm", "10 pm", "11 pm"],
        values: [1250, 1220, 1200, 1200, 1220, 1300, 1400, 1550, 1700, 1800, 1850, 1900, 1880, 1850, 1800, 1750, 1700, 1650, 1600, 1580, 1550, 1500, 1450, 1400],
        renewablePct: 40,
        renewable: 600,
        nonRenewable: 900,
        current: 1500,
        peak: 1900,
        avg: 1450,
        total: 34800,
        stateName: "India (Simulated 5)",
        year: "2023-24"
    },
    {
        hours: ["12 am", "1 am", "2 am", "3 am", "4 am", "5 am", "6 am", "7 am", "8 am", "9 am", "10 am", "11 am", "12 pm", "1 pm", "2 pm", "3 pm", "4 pm", "5 pm", "6 pm", "7 pm", "8 pm", "9 pm", "10 pm", "11 pm"],
        values: [1400, 1380, 1350, 1330, 1350, 1450, 1550, 1700, 1850, 1950, 2000, 2050, 2030, 2000, 1950, 1900, 1850, 1800, 1750, 1720, 1700, 1650, 1600, 1550],
        renewablePct: 44,
        renewable: 700,
        nonRenewable: 900,
        current: 1700,
        peak: 2050,
        avg: 1600,
        total: 37000,
        stateName: "India (Simulated 6)",
        year: "2023-24"
    },
    {
        hours: ["12 am", "1 am", "2 am", "3 am", "4 am", "5 am", "6 am", "7 am", "8 am", "9 am", "10 am", "11 am", "12 pm", "1 pm", "2 pm", "3 pm", "4 pm", "5 pm", "6 pm", "7 pm", "8 pm", "9 pm", "10 pm", "11 pm"],
        values: [1350, 1320, 1300, 1300, 1320, 1400, 1500, 1650, 1800, 1900, 1950, 2000, 1980, 1950, 1900, 1850, 1800, 1750, 1700, 1680, 1650, 1600, 1550, 1500],
        renewablePct: 39,
        renewable: 650,
        nonRenewable: 1050,
        current: 1600,
        peak: 2000,
        avg: 1550,
        total: 35500,
        stateName: "India (Simulated 7)",
        year: "2023-24"
    },
    {
        hours: ["12 am", "1 am", "2 am", "3 am", "4 am", "5 am", "6 am", "7 am", "8 am", "9 am", "10 am", "11 am", "12 pm", "1 pm", "2 pm", "3 pm", "4 pm", "5 pm", "6 pm", "7 pm", "8 pm", "9 pm", "10 pm", "11 pm"],
        values: [1500, 1480, 1450, 1430, 1450, 1550, 1650, 1800, 1950, 2050, 2100, 2150, 2130, 2100, 2050, 2000, 1950, 1900, 1850, 1820, 1800, 1750, 1700, 1650],
        renewablePct: 47,
        renewable: 800,
        nonRenewable: 900,
        current: 1800,
        peak: 2150,
        avg: 1700,
        total: 39000,
        stateName: "India (Simulated 8)",
        year: "2023-24"
    },
    {
        hours: ["12 am", "1 am", "2 am", "3 am", "4 am", "5 am", "6 am", "7 am", "8 am", "9 am", "10 am", "11 am", "12 pm", "1 pm", "2 pm", "3 pm", "4 pm", "5 pm", "6 pm", "7 pm", "8 pm", "9 pm", "10 pm", "11 pm"],
        values: [1450, 1420, 1400, 1400, 1420, 1500, 1600, 1750, 1900, 2000, 2050, 2100, 2080, 2050, 2000, 1950, 1900, 1850, 1800, 1780, 1750, 1700, 1650, 1600],
        renewablePct: 41,
        renewable: 700,
        nonRenewable: 1000,
        current: 1750,
        peak: 2100,
        avg: 1650,
        total: 37500,
        stateName: "India (Simulated 9)",
        year: "2023-24"
    },
    {
        hours: ["12 am", "1 am", "2 am", "3 am", "4 am", "5 am", "6 am", "7 am", "8 am", "9 am", "10 am", "11 am", "12 pm", "1 pm", "2 pm", "3 pm", "4 pm", "5 pm", "6 pm", "7 pm", "8 pm", "9 pm", "10 pm", "11 pm"],
        values: [1550, 1520, 1500, 1500, 1520, 1600, 1700, 1850, 2000, 2100, 2150, 2200, 2180, 2150, 2100, 2050, 2000, 1950, 1900, 1880, 1850, 1800, 1750, 1700],
        renewablePct: 48,
        renewable: 900,
        nonRenewable: 1000,
        current: 1900,
        peak: 2200,
        avg: 1800,
        total: 41000,
        stateName: "India (Simulated 10)",
        year: "2023-24"
    }
];

async function fetchEnergyData(city = "") {
    let idx = 0;
    if (city) {
        let hash = 0;
        for (let i = 0; i < city.length; i++) {
            hash = (hash + city.charCodeAt(i)) % simulatedEnergyData.length;
        }
        idx = hash;
    } else {
        idx = Math.floor(Math.random() * simulatedEnergyData.length);
    }
    return simulatedEnergyData[idx];
}

async function fetchWAQIPollutionData(city = "delhi") {
    const token = "9d5ebfa1f45ab33f1e2899b9503db29443718935";
    try {
        const response = await fetch(`https://api.waqi.info/feed/${encodeURIComponent(city)}/?token=${token}`);
        const data = await response.json();
        if (data.status === "ok") {
            return {
                pm25: data.data.iaqi && data.data.iaqi.pm25 ? data.data.iaqi.pm25.v : "N/A",
                co2: data.data.iaqi && data.data.iaqi.co ? data.data.iaqi.co.v : "N/A",
                no2: data.data.iaqi && data.data.iaqi.no2 ? data.data.iaqi.no2.v : "N/A",
                o3: data.data.iaqi && data.data.iaqi.o3 ? data.data.iaqi.o3.v : "N/A"
            };
        } else {
            return {
                pm25: "N/A",
                co2: "N/A",
                no2: "N/A",
                o3: "N/A"
            };
        }
    } catch (error) {
    return {
            pm25: "N/A",
            co2: "N/A",
            no2: "N/A",
            o3: "N/A"
        };
    }
}

async function fetchPollutionData(city = "Delhi") {
    return await fetchWAQIPollutionData(city);
}

// Waste Management Charts
let wasteChartInstance = null;
let wasteCompositionChartInstance = null;

const simulatedWasteData = [
    {
        current: {
            collected: 150,
            recycled: 97.5,
            recyclingRate: 65,
            composition: { organic: 60, plastic: 30, paper: 35, metal: 15, others: 10 }
        },
        timeSeries: [
            { date: '2024-06-01', collected: 150, recycled: 97 },
            { date: '2024-06-02', collected: 148, recycled: 95 },
            { date: '2024-06-03', collected: 152, recycled: 98 },
            { date: '2024-06-04', collected: 155, recycled: 100 },
            { date: '2024-06-05', collected: 149, recycled: 96 },
            { date: '2024-06-06', collected: 151, recycled: 97 },
            { date: '2024-06-07', collected: 153, recycled: 99 }
        ],
        tips: [
            "Separate wet and dry waste at source",
            "Use composting for organic waste",
            "Reduce single-use plastics",
            "Participate in recycling programs"
        ]
    },
    {
        current: {
            collected: 180,
            recycled: 120,
            recyclingRate: 67,
            composition: { organic: 70, plastic: 40, paper: 40, metal: 20, others: 10 }
        },
        timeSeries: [
            { date: '2024-06-01', collected: 180, recycled: 120 },
            { date: '2024-06-02', collected: 178, recycled: 118 },
            { date: '2024-06-03', collected: 182, recycled: 121 },
            { date: '2024-06-04', collected: 185, recycled: 123 },
            { date: '2024-06-05', collected: 179, recycled: 119 },
            { date: '2024-06-06', collected: 181, recycled: 120 },
            { date: '2024-06-07', collected: 183, recycled: 122 }
        ],
        tips: [
            "Compost kitchen waste",
            "Recycle paper and cardboard",
            "Avoid plastic bags",
            "Donate old clothes"
        ]
    },
    {
        current: {
            collected: 130,
            recycled: 80,
            recyclingRate: 62,
            composition: { organic: 50, plastic: 25, paper: 30, metal: 12, others: 13 }
        },
        timeSeries: [
            { date: '2024-06-01', collected: 130, recycled: 80 },
            { date: '2024-06-02', collected: 128, recycled: 78 },
            { date: '2024-06-03', collected: 132, recycled: 81 },
            { date: '2024-06-04', collected: 135, recycled: 83 },
            { date: '2024-06-05', collected: 129, recycled: 79 },
            { date: '2024-06-06', collected: 131, recycled: 80 },
            { date: '2024-06-07', collected: 133, recycled: 82 }
        ],
        tips: [
            "Use reusable containers",
            "Recycle glass bottles",
            "Compost garden waste",
            "Buy in bulk to reduce packaging"
        ]
    },
    {
        current: {
            collected: 200,
            recycled: 140,
            recyclingRate: 70,
            composition: { organic: 80, plastic: 50, paper: 45, metal: 15, others: 10 }
        },
        timeSeries: [
            { date: '2024-06-01', collected: 200, recycled: 140 },
            { date: '2024-06-02', collected: 198, recycled: 138 },
            { date: '2024-06-03', collected: 202, recycled: 141 },
            { date: '2024-06-04', collected: 205, recycled: 143 },
            { date: '2024-06-05', collected: 199, recycled: 139 },
            { date: '2024-06-06', collected: 201, recycled: 140 },
            { date: '2024-06-07', collected: 203, recycled: 142 }
        ],
        tips: [
            "Recycle electronics responsibly",
            "Avoid food waste",
            "Use cloth bags",
            "Participate in local cleanups"
        ]
    },
    {
        current: {
            collected: 160,
            recycled: 100,
            recyclingRate: 63,
            composition: { organic: 65, plastic: 35, paper: 32, metal: 14, others: 14 }
        },
        timeSeries: [
            { date: '2024-06-01', collected: 160, recycled: 100 },
            { date: '2024-06-02', collected: 158, recycled: 98 },
            { date: '2024-06-03', collected: 162, recycled: 101 },
            { date: '2024-06-04', collected: 165, recycled: 103 },
            { date: '2024-06-05', collected: 159, recycled: 99 },
            { date: '2024-06-06', collected: 161, recycled: 100 },
            { date: '2024-06-07', collected: 163, recycled: 102 }
        ],
        tips: [
            "Compost at home",
            "Recycle batteries separately",
            "Avoid single-use cutlery",
            "Educate others about recycling"
        ]
    }
];

async function fetchWasteData(city = 'Default') {
    try {
        console.log('Fetching waste data for city:', city);
        const response = await fetch(`http://localhost:3002/api/waste/stats?city=${encodeURIComponent(city)}`);
        console.log('Waste API response status:', response.status);
        if (!response.ok) {
            throw new Error(`Failed to fetch waste data: ${response.status}`);
        }
        const data = await response.json();
        console.log('Waste data received:', data);
        return data;
    } catch (error) {
        console.error('Error fetching waste data:', error);
        // Return a different simulated dataset for each city
        let idx = 0;
        if (city) {
            let hash = 0;
            for (let i = 0; i < city.length; i++) {
                hash = (hash + city.charCodeAt(i)) % simulatedWasteData.length;
            }
            idx = hash;
        } else {
            idx = Math.floor(Math.random() * simulatedWasteData.length);
        }
        return data;
    }
}

async function fetchWeatherForecast(lat, lon) {
    try {
        const response = await fetch(`http://localhost:3002/api/weather/forecast?lat=${lat}&lon=${lon}`);
        if (!response.ok) {
            throw new Error('Failed to fetch weather forecast');
        }
        const data = await response.json();
        
        // Check for API errors
        if (data._error) {
            console.warn('Weather Forecast API Warning:', data._error);
            return data.data || []; // Return the fallback forecast data
        }
        return data;
    } catch (error) {
        console.error('Error fetching weather forecast:', error);
        return [];
    }
}

async function fetchDisasterData() {
    try {
        const response = await fetch('http://localhost:3002/api/disasters');
        if (!response.ok) throw new Error('Failed to fetch disaster data');
        return await response.json();
    } catch (error) {
        return { data: [], lastUpdate: 'N/A' };
    }
}

function updateDisasterData(data) {
    // Ambee's response: { data: [ { title, country, type, ... }, ... ] }
    const alerts = data.data || [];
    document.getElementById('disaster-alerts').textContent =
        alerts.length
            ? alerts.map(a => `${a.title || a.type} (${a.type}) in ${a.country || ''}`).join('; ')
            : 'No current alerts';
    document.getElementById('disaster-update').textContent = new Date().toLocaleString();
}

window.addEventListener('DOMContentLoaded', function() {
    fetchDisasterData().then(updateDisasterData);
});

// Update functions
function updateEnergyData(data) {
    document.getElementById('energy-consumption').textContent = data.current;
    document.getElementById('energy-peak').textContent = data.peak;
    document.getElementById('energy-avg').textContent = data.avg;
    document.getElementById('energy-renewable').textContent = data.renewablePct;
}

function updatePollutionData(data) {
    // PM2.5 badge and health message
    const pm25 = data.pm25 !== undefined ? data.pm25 : "N/A";
    const badge = document.getElementById('pm25-badge');
    let badgeClass = '', healthMsg = '';
    if (pm25 === "N/A") {
        badgeClass = '';
        healthMsg = 'No data available.';
    } else if (pm25 <= 50) {
        badgeClass = 'aqi-good';
        healthMsg = 'Good air quality. Enjoy outdoor activities!';
    } else if (pm25 <= 100) {
        badgeClass = 'aqi-moderate';
        healthMsg = 'Moderate air quality. Sensitive groups should take care.';
    } else if (pm25 <= 150) {
        badgeClass = 'aqi-unhealthy';
        healthMsg = 'Unhealthy for sensitive groups. Limit prolonged outdoor exertion.';
    } else {
        badgeClass = 'aqi-very-unhealthy';
        healthMsg = 'Very unhealthy. Avoid outdoor activities if possible.';
    }
    badge.textContent = pm25;
    badge.className = 'aqi-badge ' + badgeClass;
    window.latestPm25HealthMsg = healthMsg;

    // Other pollutants
    document.getElementById('co2').textContent = data.co2;
    document.getElementById('no2').textContent = data.no2;
    document.getElementById('o3').textContent = data.o3;
}

function updateWifiData(data) {
    document.getElementById('wifi-zones').textContent = data.activeZones;
    document.getElementById('wifi-speed').textContent = data.averageSpeed;
}

function updateCrimeData(data) {
    document.getElementById('crime-reports').textContent = data.incidents;
    document.getElementById('response-time').textContent = data.responseTime;
}

function updateWeatherUI(data) {
    if (!data) return;

    // Update current weather
    document.getElementById('weather-temp').textContent = data.temperature;
    document.getElementById('weather-feels-like').textContent = data.feels_like;
    document.getElementById('weather-condition').textContent = data.description;
    document.getElementById('weather-location').textContent = data.city;
    document.getElementById('weather-humidity').textContent = data.humidity;
    document.getElementById('weather-wind').textContent = data.wind_speed;
    document.getElementById('weather-pressure').textContent = data.pressure;
    document.getElementById('weather-visibility').textContent = data.visibility;
    document.getElementById('weather-sunrise').textContent = data.sunrise;
    document.getElementById('weather-sunset').textContent = data.sunset;
    
    // Update weather icon
    const iconUrl = `https://openweathermap.org/img/wn/${data.icon}@2x.png`;
    document.getElementById('weather-icon').src = iconUrl;

    // Store data for modal
    window.latestWeatherData = data;
}

function updateForecastUI(forecast) {
    if (!forecast || !forecast.length) return;

    const container = document.getElementById('forecast-container');
    container.innerHTML = ''; // Clear existing forecast

    // Group forecast by date
    const dailyForecasts = forecast.reduce((acc, item) => {
        const date = item.date;
        if (!acc[date]) {
            acc[date] = item;
        }
        return acc;
    }, {});

    // Create forecast items
    Object.values(dailyForecasts).forEach(item => {
        const forecastItem = document.createElement('div');
        forecastItem.className = 'forecast-item';
        forecastItem.innerHTML = `
            <div class="date">${new Date(item.date).toLocaleDateString('en-US', { weekday: 'short' })}</div>
            <img src="https://openweathermap.org/img/wn/${item.icon}.png" alt="${item.description}">
            <div class="temp">${item.temperature}°C</div>
            <div class="condition">${item.condition}</div>
        `;
        container.appendChild(forecastItem);
    });
}

function showWeatherModal() {
    const modal = document.getElementById('weatherModal');
    const dataDiv = document.getElementById('full-weather-data');
    const data = window.latestWeatherData;
    
    if (!data) {
        dataDiv.innerHTML = '<em>No weather data available.</em>';
    } else {
        let html = `<strong>${data.city} Weather Information</strong><br><br>`;
        html += `<b>Temperature:</b> ${data.temperature}°C (Feels like ${data.feels_like}°C)<br>`;
        html += `<b>Condition:</b> ${data.description}<br>`;
        html += `<b>Humidity:</b> ${data.humidity}%<br>`;
        html += `<b>Wind Speed:</b> ${data.wind_speed} km/h<br>`;
        html += `<b>Pressure:</b> ${data.pressure} hPa<br>`;
        html += `<b>Visibility:</b> ${data.visibility} km<br>`;
        html += `<b>Sunrise:</b> ${data.sunrise}<br>`;
        html += `<b>Sunset:</b> ${data.sunset}<br>`;
        dataDiv.innerHTML = html;
    }
    modal.style.display = 'block';
}

// Event listeners for weather functionality
window.addEventListener('DOMContentLoaded', function() {
    // Weather modal functionality
    document.getElementById('weatherMenuBtn').onclick = showWeatherModal;
    document.getElementById('closeWeatherModal').onclick = function() {
        document.getElementById('weatherModal').style.display = 'none';
    };
    window.onclick = function(event) {
        const modal = document.getElementById('weatherModal');
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    };

    // Initial weather data load for Delhi
    const defaultLat = 28.6139;
    const defaultLon = 77.2090;
    fetchWeatherData(defaultLat, defaultLon).then(updateWeatherUI);
    fetchWeatherForecast(defaultLat, defaultLon).then(updateForecastUI);
});

// LEAFLET MAP SETUP
let leafletMap = null;
let leafletMarker = null;

function initLeafletMap(lat = 28.6139, lon = 77.2090, city = 'Delhi', trafficData = null) {
    if (!window.L) return; // Leaflet not loaded
    if (!leafletMap) {
        leafletMap = L.map('leaflet-map').setView([lat, lon], 10);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '© OpenStreetMap'
        }).addTo(leafletMap);
        // Allow user to click on map to get traffic data
        leafletMap.on('click', async function(e) {
            const { lat, lng } = e.latlng;
            // Fetch traffic data for clicked location
            const response = await fetch(`http://localhost:3002/api/traffic?lat=${lat}&lon=${lng}`);
            if (response.ok) {
                const data = await response.json();
                // Show marker and popup
                updateLeafletMarker(lat, lng, 'Selected Location', data);
                // Also update chart and modal data
                window.latestTrafficData = data;
                window.latestTrafficCity = 'Selected Location';
                updateTrafficChartTimeSeries(data, 'Selected Location');
            }
        });
    } else {
        leafletMap.setView([lat, lon], 10);
    }
    updateLeafletMarker(lat, lon, city, trafficData);
}

function updateLeafletMarker(lat, lon, city, trafficData) {
    if (!window.L || !leafletMap) return;
    if (leafletMarker) {
        leafletMap.removeLayer(leafletMarker);
    }
    leafletMarker = L.marker([lat, lon]).addTo(leafletMap);
    let popupHtml = `<b>${city}</b>`;
    if (trafficData) {
        popupHtml += `<br>Speed: ${trafficData.currentSpeed} km/h`;
        popupHtml += `<br>Congestion: ${Math.round((1 - trafficData.currentSpeed / trafficData.freeFlowSpeed) * 100)}%`;
    }
    leafletMarker.bindPopup(popupHtml).openPopup();
}

// On DOMContentLoaded, initialize the map for Delhi
window.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        initLeafletMap(28.6139, 77.2090, 'Delhi', window.latestTrafficData);
    }, 1200);
});

// Update updateTrafficMap to use Leaflet
function updateTrafficMap(lat, lon) {
    // Center and update marker on the map
    const city = window.latestTrafficCity || 'City';
    const data = window.latestTrafficData;
    initLeafletMap(Number(lat), Number(lon), city, data);
}

// ENERGY SECTION UPGRADE
let energyLineChartInstance = null;
let energyPieChartInstance = null;
window.latestEnergyData = null;

function renderEnergyCharts(data) {
    // Line chart
    const lineCanvas = document.getElementById('energyLineChart');
    if (lineCanvas) {
        if (energyLineChartInstance) energyLineChartInstance.destroy();
        energyLineChartInstance = new Chart(lineCanvas.getContext('2d'), {
            type: 'line',
        data: {
                labels: data.hours,
            datasets: [{
                    label: '', // Remove label from chart
                    data: data.values,
                    borderColor: '#fdcb6e',
                    backgroundColor: 'rgba(253,203,110,0.13)',
                    fill: true,
                    tension: 0.3,
                    pointRadius: 2,
                    pointBackgroundColor: '#fdcb6e'
            }]
        },
        options: {
            responsive: true,
                plugins: {
                    legend: { display: false },
                    tooltip: { enabled: false } // Disable tooltips
                },
            scales: {
                y: {
                    beginAtZero: true,
                        title: { display: false } // Hide axis title
                    },
                    x: {
                        title: { display: false } // Hide axis title
                    }
                }
            }
        });
    }
    // Pie chart
    const pieCanvas = document.getElementById('energyPieChart');
    if (pieCanvas) {
        if (energyPieChartInstance) energyPieChartInstance.destroy();
        energyPieChartInstance = new Chart(pieCanvas.getContext('2d'), {
            type: 'pie',
            data: {
                labels: ['', ''], // Hide labels
                datasets: [{
                    data: [data.renewable, data.nonRenewable],
                    backgroundColor: ['#00b894', '#636e72'],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { display: false },
                    tooltip: { enabled: false }
                }
            }
        });
    }
}

function updateEnergyStats(data) {
    document.getElementById('energy-consumption').textContent = data.current;
    document.getElementById('energy-peak').textContent = data.peak;
    document.getElementById('energy-avg').textContent = data.avg;
    document.getElementById('energy-renewable').textContent = data.renewablePct;
}

function showEnergyModal() {
    const modal = document.getElementById('energyModal');
    const dataDiv = document.getElementById('full-energy-data');
    const data = window.latestEnergyData;
    if (!data) {
        dataDiv.innerHTML = '<em>No energy data available.</em>';
    } else {
        let html = `<strong>Energy Data (last 24 hours)</strong><br><br>`;
        html += `<b>Current:</b> ${data.current} kWh<br>`;
        html += `<b>Peak:</b> ${data.peak} kWh<br>`;
        html += `<b>Average:</b> ${data.avg} kWh<br>`;
        html += `<b>Renewable:</b> ${data.renewablePct}%<br>`;
        html += `<b>Total:</b> ${data.total} kWh<br>`;
        html += `<b>Hourly Data:</b><br><ul style='margin-left: 1em;'>`;
        data.hours.forEach((h, i) => {
            html += `<li>${h}: ${data.values[i]} kWh</li>`;
        });
        html += `</ul>`;
        html += `<b>Renewable:</b> ${data.renewable} kWh<br>`;
        html += `<b>Non-Renewable:</b> ${data.nonRenewable} kWh`;
        dataDiv.innerHTML = html;
    }
    modal.style.display = 'block';
}

window.addEventListener('DOMContentLoaded', function() {
    // Load and render energy data on page load
    fetchEnergyData().then(energyData => {
        window.latestEnergyData = energyData;
        renderEnergyCharts(energyData);
        updateEnergyStats(energyData);
    });
    // Modal logic
    document.getElementById('energyMenuBtn').onclick = showEnergyModal;
    document.getElementById('closeEnergyModal').onclick = function() {
        document.getElementById('energyModal').style.display = 'none';
    };
    window.onclick = function(event) {
        const modal = document.getElementById('energyModal');
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    };
    // Energy chart toggle logic
    const showEnergyLineBtn = document.getElementById('showEnergyLineBtn');
    const showEnergyPieBtn = document.getElementById('showEnergyPieBtn');
    const energyLineChart = document.getElementById('energyLineChart');
    const energyPieChart = document.getElementById('energyPieChart');
    if (showEnergyLineBtn && showEnergyPieBtn && energyLineChart && energyPieChart) {
        showEnergyLineBtn.addEventListener('click', function() {
            energyLineChart.style.display = '';
            energyPieChart.style.display = 'none';
            showEnergyLineBtn.classList.add('btn-primary');
            showEnergyLineBtn.classList.remove('btn-outline-primary');
            showEnergyPieBtn.classList.remove('btn-primary');
            showEnergyPieBtn.classList.add('btn-outline-primary');
        });
        showEnergyPieBtn.addEventListener('click', function() {
            energyLineChart.style.display = 'none';
            energyPieChart.style.display = '';
            showEnergyPieBtn.classList.add('btn-primary');
            showEnergyPieBtn.classList.remove('btn-outline-primary');
            showEnergyLineBtn.classList.remove('btn-primary');
            showEnergyLineBtn.classList.add('btn-outline-primary');
        });
    }
});

// Pollution modal logic
window.addEventListener('DOMContentLoaded', function() {
    const pollutionMenuBtn = document.getElementById('pollutionMenuBtn');
    const pollutionModal = document.getElementById('pollutionModal');
    const closePollutionModal = document.getElementById('closePollutionModal');
    const pollutionModalMsg = document.getElementById('pollution-modal-message');
    if (pollutionMenuBtn && pollutionModal && closePollutionModal && pollutionModalMsg) {
        pollutionMenuBtn.onclick = function() {
            pollutionModal.style.display = 'block';
            pollutionModalMsg.textContent = window.latestPm25HealthMsg || '';
        };
        closePollutionModal.onclick = function() {
            pollutionModal.style.display = 'none';
        };
        window.onclick = function(event) {
            if (event.target === pollutionModal) {
                pollutionModal.style.display = 'none';
            }
        };
    }
});

// Google Maps Public Transport Map
function initGoogleTransportMap(lat = 28.6139, lon = 77.2090) {
    if (!window.google || !window.google.maps) {
        setTimeout(() => initGoogleTransportMap(lat, lon), 500);
        return;
    }
    const map = new google.maps.Map(document.getElementById('google-transport-map'), {
        center: { lat: Number(lat), lng: Number(lon) },
        zoom: 13,
        mapTypeId: 'roadmap'
    });
    const transitLayer = new google.maps.TransitLayer();
    transitLayer.setMap(map);

    // --- Show nearby transit stations ---
    // const service = new google.maps.places.PlacesService(map);
    // service.nearbySearch({ ... }, ...);
}

// Call this when the page loads or when the city changes
window.addEventListener('DOMContentLoaded', function() {
    initGoogleTransportMap();
});

// Optionally, update the map when the user searches for a new city
async function updateTransportMapForCity(cityName) {
    const coords = await getCityCoordinates(cityName);
    if (coords) {
        initGoogleTransportMap(coords.lat, coords.lon);
    }
}

window.handleSearch = handleSearch;
window.initMap = function() { initGoogleTransportMap(); };

window.getTransitDirections = function() {
    const from = document.getElementById('from-location').value;
    const to = document.getElementById('to-location').value;
    if (!from || !to) {
        alert('Please enter both locations.');
        return;
    }
    const mapContainer = document.getElementById('google-transport-map');
    // Remove any previous map content (if any extra box or panel was added)
    while (mapContainer.firstChild) {
        mapContainer.removeChild(mapContainer.firstChild);
    }
    const directionsService = new google.maps.DirectionsService();
    const map = new google.maps.Map(mapContainer, {
        center: { lat: 28.6139, lng: 77.2090 },
        zoom: 13,
        mapTypeId: 'roadmap'
    });
    const directionsRenderer = new google.maps.DirectionsRenderer();
    directionsRenderer.setMap(map);
    directionsService.route({
        origin: from,
        destination: to,
        travelMode: google.maps.TravelMode.TRANSIT
    }, (result, status) => {
        if (status === 'OK') {
            directionsRenderer.setDirections(result);
        } else {
            alert('Could not find transit route.');
        }
    });
};

async function fetchWeatherData(lat, lon) {
    try {
        const response = await fetch(`http://localhost:3002/api/weather/current?lat=${lat}&lon=${lon}`);
        const data = await response.json();
        // Check for API errors
        if (data._error) {
            console.warn('Weather API Warning:', data._error);
            // Optionally show a warning in the UI
            const weatherSection = document.getElementById('weather');
            if (weatherSection && !weatherSection.querySelector('.api-warning')) {
                const warning = document.createElement('div');
                warning.className = 'api-warning';
                warning.style.cssText = 'background: #fff3cd; color: #856404; padding: 8px; border-radius: 4px; margin: 10px 0; font-size: 0.9em;';
                warning.textContent = data._error;
                weatherSection.insertBefore(warning, weatherSection.firstChild.nextSibling);
            }
        }
        return data;
    } catch (error) {
        console.error('Error fetching weather data:', error);
        return null;
    }
}

function updateWasteData(data) {
    if (!data || !data.current) return;
    // Update main stats
    document.getElementById('waste-collected').textContent = data.current.collected;
    document.getElementById('recycling-rate').textContent = data.current.recyclingRate;

    // Render waste collection chart (line chart)
    const wasteChartCanvas = document.getElementById('wasteChart');
    if (wasteChartInstance) wasteChartInstance.destroy();
    if (wasteChartCanvas && data.timeSeries) {
        wasteChartInstance = new Chart(wasteChartCanvas.getContext('2d'), {
            type: 'line',
            data: {
                labels: data.timeSeries.map(d => d.date),
                datasets: [
                    {
                        label: 'Collected',
                        data: data.timeSeries.map(d => d.collected),
                        borderColor: '#00b894',
                        backgroundColor: 'rgba(0,184,148,0.13)',
                        fill: true,
                        tension: 0.3,
                        pointRadius: 2
                    },
                    {
                        label: 'Recycled',
                        data: data.timeSeries.map(d => d.recycled),
                        borderColor: '#fdcb6e',
                        backgroundColor: 'rgba(253,203,110,0.13)',
                        fill: true,
                        tension: 0.3,
                        pointRadius: 2
                    }
                ]
            },
            options: {
                responsive: true,
                plugins: { legend: { display: true } },
                scales: { y: { beginAtZero: true } }
            }
        });
    }

    // Render waste composition chart (pie chart)
    const wasteCompCanvas = document.getElementById('wasteCompositionChart');
    if (wasteCompositionChartInstance) wasteCompositionChartInstance.destroy();
    if (wasteCompCanvas && data.current.composition) {
        const comp = data.current.composition;
        wasteCompositionChartInstance = new Chart(wasteCompCanvas.getContext('2d'), {
            type: 'pie',
            data: {
                labels: ['Organic', 'Plastic', 'Paper', 'Metal', 'Others'],
                datasets: [{
                    data: [comp.organic, comp.plastic, comp.paper, comp.metal, comp.others],
                    backgroundColor: ['#00b894', '#0984e3', '#fdcb6e', '#636e72', '#b2bec3']
                }]
            },
            options: {
                responsive: true,
                plugins: { legend: { display: true } }
            }
        });
    }

    // Update waste tips
    const tipsList = document.getElementById('waste-tips-list');
    if (tipsList && data.tips) {
        tipsList.innerHTML = '';
        data.tips.forEach(tip => {
            const li = document.createElement('li');
            li.textContent = tip;
            tipsList.appendChild(li);
        });
    }
}
window.switchAuth = switchAuth;