export const Config = {
    API_BASE_URL: 'https://swift-backend-wr1y.onrender.com/api/v1',
    /** Predefined phone numbers that always receive SOS (E.164, e.g. +919876543210) */
    DEFAULT_EMERGENCY_NUMBERS: [] as string[],
    get SENSORS_DATA_URL() {
        return `${this.API_BASE_URL}/sensors/data/`;
    },
    get SMS_ALERT_URL() {
        return `${this.API_BASE_URL}/sensors/send-alert/`;
    },
    get REGIONAL_DATA_URL() {
        return `${this.API_BASE_URL}/sensors/regional-data/`;
    },
    get TRAFFIC_DATA_URL() {
        return `${this.API_BASE_URL}/sensors/traffic/`;
    },
};
