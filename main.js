// Config
const OSM_TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const RAINVIEWER_URL = "https://api.rainviewer.com/public/weather-maps.json";
const DEFAULT_LAT = "47.9977308";
const DEFAULT_LON = "7.8412948";
const DEFAULT_ZOOM = "8";
const ATTRIBUTION = 'Software: GPLv3 <a href="https://github.com/leveled-up/rain-radar">Source</a> | Map data &copy; <a href="https://openstreetmap.org">OpenStreetMap</a> contributors &amp; <a href="https://www.rainviewer.com/api.html">RainViewer</a>';
const COVERAGE_PATH = "/v2/coverage/0/256/{z}/{x}/{y}/0/0_0.png";
const SHOW_MARKER = true;

const q = (sname, def = null) => (new URL(window.location).searchParams.get(sname) || def);

const dateStr = time => {
    const pad = x => String(x).padStart(2, '0');
    let date = new Date(time * 1000);
    return pad(date.getDate()) + "." + pad(date.getMonth()) + "." + date.getFullYear() + " " + pad(date.getHours()) + ":" + pad(date.getMinutes());
}

let state = null;
const refresh = async () => {
    state = await fetch(RAINVIEWER_URL).then(res => res.json());
};

let map;
let marker;

let frames = []; // frame: { time, path, leaflet_layer, forecast }

let animationPosition = 0;
let animationTimer = false;

// Activate the current frame
const showFrame = () => {
    for (let i in frames) {
        let layer = frames[i].leaflet_layer;
        if (i == animationPosition && !map.hasLayer(layer))
            map.addLayer(layer);
        else if (map.hasLayer(layer))
            map.removeLayer(layer);
    }
    let obj = frames[animationPosition];
    document.getElementById("timestamp").className = obj.forecast ? "future" : "past";
    document.getElementById("timestamp").innerText = dateStr(obj.time);
};


const prevFrame = () => {
    animationPosition -= 1;
    if (animationPosition < 0)
        animationPosition = frames.length - 1;
    showFrame();
}

const nextFrame = () => {
    animationPosition = (animationPosition + 1) % frames.length;
    showFrame();
};

const animation = () => {
    let btn = document.getElementById("animbtn");
    if (!animationTimer) {
        // Start
        animationTimer = setInterval(nextFrame, 500);
        btn.innerText = "Stop";
    } else {
        // Stop
        clearInterval(animationTimer);
        btn.innerText = "Start";
    }
};

const init = async () => {
    // Load state
    await refresh();

    // Init Leaflet map
    map = L.map('mapid', {
        zoomControl: true,
        attributionControl: true,
        fadeAnimation: false
    }).setView(
        [
            q('lat', DEFAULT_LAT),
            q('lon', DEFAULT_LON)
        ],
        q("zoom", DEFAULT_ZOOM)
    );

    // Add OSM tiles
    L.tileLayer(
        OSM_TILE_URL,
        {
            // Show version in attribution box
            attribution: ATTRIBUTION + ", as of " + dateStr(state.generated),
            zIndex: 1
        }
    ).addTo(map);

    // Add coverage tiles
    L.tileLayer(
        state.host + COVERAGE_PATH,
        {
            tileSize: 256,
            opacity: 0.1,
            zIndex: 2
        }
    ).addTo(map);

    // Add position marker
    if (SHOW_MARKER)
        marker = L.marker([
            q('lat', DEFAULT_LAT),
            q('lon', DEFAULT_LON)
        ]).addTo(map);

    // Create frame objects
    frames = [];
    const create_frame = (item, forecast) => {
        let layer = new L.TileLayer(state.host + item.path + '/256/{z}/{x}/{y}/1/1_1.png', {
            tileSize: 256,
            opacity: 0.6,
            zIndex: 3
        });
        frames.push({
            time: item.time,
            path: item.path,
            forecast,
            leaflet_layer: layer
        });
    }

    // Past data
    for (let item of state.radar.past)
        create_frame(item, false);

    // Set the frame to be rendered by default to the most recent past frame (observed data)
    animationPosition = frames.length - 1;

    // Forecast
    for (let item of state.radar.nowcast)
        create_frame(item, true);

    showFrame();
};

init();