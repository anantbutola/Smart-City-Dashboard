// Map Service for handling multiple map providers
class MapService {
    constructor() {
        this.currentProvider = 'openstreetmap'; // Default provider
        this.providers = {
            openstreetmap: {
                name: 'OpenStreetMap',
                isLoaded: true, // Already loaded via Leaflet
            },
            google: {
                name: 'Google Maps',
                isLoaded: false,
                apiKey: '', // To be set via environment variable
            },
            mapmyindia: {
                name: 'Map My India',
                isLoaded: false,
                apiKey: '', // To be set via environment variable
            }
        };
        
        // Bind methods after the object is created
        this.providers.openstreetmap.init = this.initOpenStreetMap.bind(this);
        this.providers.openstreetmap.update = this.updateOpenStreetMap?.bind(this);
        this.providers.google.init = this.initGoogleMaps.bind(this);
        this.providers.google.update = this.updateGoogleMaps?.bind(this);
        this.providers.mapmyindia.init = this.initMapMyIndia.bind(this);
        this.providers.mapmyindia.update = this.updateMapMyIndia?.bind(this);

        this.map = null;
        this.marker = null;
        this.mapContainer = null;
    }

    // Initialize the map service with a container
    async init(containerId, options = {}) {
        this.mapContainer = document.getElementById(containerId);
        if (!this.mapContainer) {
            throw new Error(`Map container ${containerId} not found`);
        }

        // Load the current provider
        await this.loadProvider(this.currentProvider, options);
    }

    // Load a specific map provider
    async loadProvider(providerName, options = {}) {
        const provider = this.providers[providerName];
        if (!provider) {
            throw new Error(`Unknown map provider: ${providerName}`);
        }

        // If provider is not loaded, load its script
        if (!provider.isLoaded) {
            await this.loadProviderScript(providerName);
        }

        // Initialize the provider
        this.currentProvider = providerName;
        await provider.init(options);
    }

    // Load provider scripts dynamically
    async loadProviderScript(providerName) {
        switch (providerName) {
            case 'google':
                return new Promise((resolve, reject) => {
                    const script = document.createElement('script');
                    script.src = `https://maps.googleapis.com/maps/api/js?key=${this.providers.google.apiKey}`;
                    script.async = true;
                    script.defer = true;
                    script.onload = () => {
                        this.providers.google.isLoaded = true;
                        resolve();
                    };
                    script.onerror = reject;
                    document.head.appendChild(script);
                });

            case 'mapmyindia':
                return new Promise((resolve, reject) => {
                    const script = document.createElement('script');
                    script.src = `https://apis.mapmyindia.com/map_v3/1.js?apikey=${this.providers.mapmyindia.apiKey}`;
                    script.async = true;
                    script.defer = true;
                    script.onload = () => {
                        this.providers.mapmyindia.isLoaded = true;
                        resolve();
                    };
                    script.onerror = reject;
                    document.head.appendChild(script);
                });
        }
    }

    // OpenStreetMap implementation (current Leaflet implementation)
    initOpenStreetMap(options) {
        if (!window.L) {
            throw new Error('Leaflet not loaded');
        }

        const { lat = 28.6139, lon = 77.2090, zoom = 10 } = options;
        
        if (!this.map) {
            this.map = L.map(this.mapContainer).setView([lat, lon], zoom);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 19,
                attribution: '© OpenStreetMap'
            }).addTo(this.map);
        } else {
            this.map.setView([lat, lon], zoom);
        }

        // Add click handler for traffic data
        this.map.on('click', async (e) => {
            const { lat, lng } = e.latlng;
            try {
                const response = await fetch(`http://localhost:3002/api/traffic?lat=${lat}&lon=${lng}`);
                if (response.ok) {
                    const data = await response.json();
                    this.updateMarker(lat, lng, 'Selected Location', data);
                    // Trigger custom event for traffic data update
                    window.dispatchEvent(new CustomEvent('trafficDataUpdate', { 
                        detail: { data, location: 'Selected Location' }
                    }));
                }
            } catch (error) {
                console.error('Error fetching traffic data:', error);
            }
        });
    }

    // Google Maps implementation
    initGoogleMaps(options) {
        if (!window.google || !window.google.maps) {
            throw new Error('Google Maps not loaded');
        }

        const { lat = 28.6139, lon = 77.2090, zoom = 10 } = options;
        
        if (!this.map) {
            this.map = new google.maps.Map(this.mapContainer, {
                center: { lat, lng: lon },
                zoom: zoom,
                mapTypeId: google.maps.MapTypeId.ROADMAP
            });

            // Add click handler for traffic data
            this.map.addListener('click', async (e) => {
                const lat = e.latLng.lat();
                const lng = e.latLng.lng();
                try {
                    const response = await fetch(`http://localhost:3002/api/traffic?lat=${lat}&lon=${lng}`);
                    if (response.ok) {
                        const data = await response.json();
                        this.updateMarker(lat, lng, 'Selected Location', data);
                        window.dispatchEvent(new CustomEvent('trafficDataUpdate', { 
                            detail: { data, location: 'Selected Location' }
                        }));
                    }
                } catch (error) {
                    console.error('Error fetching traffic data:', error);
                }
            });
        } else {
            this.map.setCenter({ lat, lng: lon });
            this.map.setZoom(zoom);
        }
    }

    // Map My India implementation
    initMapMyIndia(options) {
        if (!window.MapmyIndia) {
            throw new Error('Map My India not loaded');
        }

        const { lat = 28.6139, lon = 77.2090, zoom = 10 } = options;
        
        if (!this.map) {
            this.map = new MapmyIndia.Map(this.mapContainer, {
                center: [lat, lon],
                zoomControl: true,
                hybrid: false
            });

            // Add click handler for traffic data
            this.map.addListener('click', async (e) => {
                const lat = e.latLng.lat;
                const lng = e.latLng.lng;
                try {
                    const response = await fetch(`http://localhost:3002/api/traffic?lat=${lat}&lon=${lng}`);
                    if (response.ok) {
                        const data = await response.json();
                        this.updateMarker(lat, lng, 'Selected Location', data);
                        window.dispatchEvent(new CustomEvent('trafficDataUpdate', { 
                            detail: { data, location: 'Selected Location' }
                        }));
                    }
                } catch (error) {
                    console.error('Error fetching traffic data:', error);
                }
            });
        } else {
            this.map.setCenter([lat, lon]);
            this.map.setZoom(zoom);
        }
    }

    // Update marker for all providers
    updateMarker(lat, lon, title, data) {
        const provider = this.providers[this.currentProvider];
        if (!provider) return;

        switch (this.currentProvider) {
            case 'openstreetmap':
                if (this.marker) {
                    this.map.removeLayer(this.marker);
                }
                this.marker = L.marker([lat, lon]).addTo(this.map);
                let popupHtml = `<b>${title}</b>`;
                if (data) {
                    popupHtml += `<br>Speed: ${data.currentSpeed} km/h`;
                    popupHtml += `<br>Congestion: ${Math.round((1 - data.currentSpeed / data.freeFlowSpeed) * 100)}%`;
                }
                this.marker.bindPopup(popupHtml).openPopup();
                break;

            case 'google':
                if (this.marker) {
                    this.marker.setMap(null);
                }
                this.marker = new google.maps.Marker({
                    position: { lat, lng: lon },
                    map: this.map,
                    title: title
                });
                let infoWindow = new google.maps.InfoWindow({
                    content: `<b>${title}</b>${data ? 
                        `<br>Speed: ${data.currentSpeed} km/h<br>Congestion: ${Math.round((1 - data.currentSpeed / data.freeFlowSpeed) * 100)}%` 
                        : ''}`
                });
                this.marker.addListener('click', () => infoWindow.open(this.map, this.marker));
                infoWindow.open(this.map, this.marker);
                break;

            case 'mapmyindia':
                if (this.marker) {
                    this.marker.setMap(null);
                }
                this.marker = new MapmyIndia.Marker({
                    position: [lat, lon],
                    map: this.map,
                    title: title
                });
                let popup = new MapmyIndia.InfoWindow({
                    content: `<b>${title}</b>${data ? 
                        `<br>Speed: ${data.currentSpeed} km/h<br>Congestion: ${Math.round((1 - data.currentSpeed / data.freeFlowSpeed) * 100)}%` 
                        : ''}`
                });
                this.marker.addListener('click', () => popup.open(this.map, this.marker));
                popup.open(this.map, this.marker);
                break;
        }
    }

    // Update map view for all providers
    updateMap(lat, lon, zoom = 10) {
        const provider = this.providers[this.currentProvider];
        if (!provider) return;

        switch (this.currentProvider) {
            case 'openstreetmap':
                this.map.setView([lat, lon], zoom);
                break;
            case 'google':
                this.map.setCenter({ lat, lng: lon });
                this.map.setZoom(zoom);
                break;
            case 'mapmyindia':
                this.map.setCenter([lat, lon]);
                this.map.setZoom(zoom);
                break;
        }
    }

    // Set API keys for providers
    setApiKeys(keys) {
        if (keys.google) this.providers.google.apiKey = keys.google;
        if (keys.mapmyindia) this.providers.mapmyindia.apiKey = keys.mapmyindia;
    }
}

// Export a singleton instance
const mapService = new MapService();
export default mapService; 