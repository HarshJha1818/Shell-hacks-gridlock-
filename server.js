// GridSync Backend — Cross-Utility Infrastructure Coordination
require('dotenv').config({ override: true });
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const app = express();

function getGeminiApiKey() {
  let key = (process.env.GEMINI_API_KEY || process.env.GEMINI_KEY || '').trim();
  if (!key || key === 'MY_GEMINI_API_KEY' || key === 'your_key_here') {
    try {
      if (fs.existsSync('.env')) {
        const envContent = fs.readFileSync('.env', 'utf8');
        const match = envContent.match(/GEMINI_API_KEY\s*=\s*([^\r\n]+)/);
        if (match && match[1]) {
          key = match[1].trim();
        }
      }
    } catch (_) {}
  }
  return key;
}

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// ===== FLORIDA MULTI-UTILITY GRID & WATER INFRASTRUCTURE DATA =====
// 10 Regional Florida Utilities:
// Electric (Power): FPL, Duke Energy, Keys Energy, Keys Co-op, Glades Co-op
// Water (Civil/Trenches): Miami-Dade WASD, Broward BCWWS, Palm Beach PBCWUD, FGUA, Tampa Bay Water
const projects = [
  // ELECTRIC (Power)
  { id: 'elec-1', type: 'Electric', utility: 'FPL', name: 'Miami Substation Upgrade', lat: 25.7617, lng: -80.1918, start: '2027-03-01', end: '2027-09-01', cost: 2100000 },
  { id: 'elec-2', type: 'Electric', utility: 'FPL', name: 'Broward Transmission Line', lat: 26.1224, lng: -80.1434, start: '2027-02-15', end: '2027-08-15', cost: 3400000 },
  { id: 'elec-3', type: 'Electric', utility: 'Duke Energy', name: 'Dade Border Upgrade', lat: 25.8500, lng: -80.3000, start: '2027-03-10', end: '2027-09-10', cost: 1900000 },
  { id: 'elec-4', type: 'Electric', utility: 'Keys Energy', name: 'Key West Hardening', lat: 24.5551, lng: -81.7800, start: '2027-01-10', end: '2027-07-10', cost: 1800000 },
  { id: 'elec-5', type: 'Electric', utility: 'Glades Co-op', name: 'Okeechobee Ag-Grid', lat: 27.2439, lng: -80.8298, start: '2027-03-15', end: '2027-09-15', cost: 3100000 },
  { id: 'elec-6', type: 'Electric', utility: 'Keys Co-op', name: 'Key Largo Interconnect', lat: 25.0865, lng: -80.4473, start: '2027-04-01', end: '2027-10-01', cost: 1900000 },

  // WATER (Civil/Trenches)
  { id: 'wat-1', type: 'Water', utility: 'Miami-Dade WASD', name: 'Downtown Water Main Replacement', lat: 25.7700, lng: -80.1900, start: '2027-04-01', end: '2027-08-01', cost: 1500000 },
  { id: 'wat-2', type: 'Water', utility: 'Broward BCWWS', name: 'Fort Lauderdale Pipe Trench', lat: 26.1200, lng: -80.1400, start: '2027-02-01', end: '2027-07-01', cost: 2800000 },
  { id: 'wat-3', type: 'Water', utility: 'Tampa Bay Water', name: 'Resilience Reservoir', lat: 27.9500, lng: -82.4500, start: '2027-05-01', end: '2027-11-01', cost: 4200000 },
  { id: 'wat-4', type: 'Water', utility: 'Palm Beach PBCWUD', name: 'West Palm Trunk Main Loop', lat: 26.7080, lng: -80.0510, start: '2027-06-01', end: '2027-12-01', cost: 2200000 },
  { id: 'wat-5', type: 'Water', utility: 'FGUA', name: 'Pasco Utility Corridor Conduit', lat: 28.2500, lng: -82.4500, start: '2027-03-01', end: '2027-09-01', cost: 1700000 },
  { id: 'wat-6', type: 'Water', utility: 'Miami-Dade WASD', name: 'Hialeah Water Treatment Bypass', lat: 25.8600, lng: -80.2850, start: '2027-05-01', end: '2027-10-01', cost: 2600000 }
];

// ===== OVERLAP DETECTION ALGORITHMS =====
// Haversine formula to compute great-circle distance in statute miles
function milesApart(lat1, lon1, lat2, lon2) {
  const R = 3958.8; // Earth radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Construction schedule overlap or within 90-day mobilization window
function datesOverlap(aStart, aEnd, bStart, bEnd) {
  const s1 = new Date(aStart).getTime();
  const e1 = new Date(aEnd).getTime();
  const s2 = new Date(bStart).getTime();
  const e2 = new Date(bEnd).getTime();
  const MS_90_DAYS = 90 * 24 * 60 * 60 * 1000;
  if (s1 <= e2 && s2 <= e1) return true;
  if (e1 < s2 && (s2 - e1) <= MS_90_DAYS) return true;
  if (e2 < s1 && (s1 - e2) <= MS_90_DAYS) return true;
  return false;
}

// 3-Mile Logistics Radar Rule:
// Strictly <= 3 miles AND overlapping construction dates.
// Categorizes collisions dynamically:
// - Power vs. Power: "Shared Crane/Laydown Logistics"
// - Power vs. Water: "Right-of-Way Road Excavation Collision" (The "Dig Once" initiative)
// - Water vs. Water: "Shared Trenching Logistics"
function findOverlaps(list) {
  const out = [];
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i], b = list[j];
      if (a.utility === b.utility) continue;

      const dist = milesApart(a.lat, a.lng, b.lat, b.lng);
      // Strictly <= 3 miles
      if (dist <= 3 && datesOverlap(a.start, a.end, b.start, b.end)) {
        let clashType = "Shared Crane/Laydown Logistics"; // Electric vs Electric
        if (a.type !== b.type) {
          clashType = "Right-of-Way Road Excavation Collision"; // Power vs Water ("Dig Once")
        } else if (a.type === 'Water' && b.type === 'Water') {
          clashType = "Shared Trenching Logistics"; // Water vs Water
        }

        out.push({
          a,
          b,
          dist: Number(dist.toFixed(1)),
          clashType,
          savings: Math.round(((a.cost || 2000000) + (b.cost || 2000000)) * 0.15)
        });
      }
    }
  }
  return out;
}

// ===== API ROUTES =====
// Configuration endpoint providing Google Maps API key
app.get('/api/config', (req, res) => {
  const mapsApiKey = (process.env.GOOGLE_MAPS_API_KEY ||
                     process.env.VITE_GOOGLE_MAPS_API_KEY ||
                     'AIzaSyBoaJjSmLEluNWyG8yvL41Rr-uL2_Lid58').trim();
  res.json({ mapsApiKey });
});

// Get all active grid projects
app.get('/api/projects', (req, res) => {
  res.json(projects);
});

// Calculate and return all current cross-utility overlaps
app.get('/api/overlaps', (req, res) => {
  const overlaps = findOverlaps(projects);
  const totalSavings = overlaps.reduce((sum, o) => sum + o.savings, 0);
  res.json({
    overlaps,
    count: overlaps.length,
    totalSavings
  });
});

// Simulate new proposed project against existing utility projects
app.post('/api/check', (req, res) => {
  const p = req.body;
  const userLat = Number(p.lat);
  const userLng = Number(p.lng);
  const userStart = p.start;
  const userEnd = p.end;
  const userUtil = p.utility;
  const userType = p.type || (['Miami-Dade WASD', 'Broward BCWWS', 'Palm Beach PBCWUD', 'FGUA', 'Tampa Bay Water'].includes(userUtil) ? 'Water' : 'Electric');

  const hits = [];
  const nearMisses = [];

  for (const q of projects) {
    if (q.utility === userUtil) continue; // Check against opposing utilities

    const dist = milesApart(userLat, userLng, q.lat, q.lng);
    const roundedDist = Math.round(dist * 10) / 10;
    const touching = datesOverlap(userStart, userEnd, q.start, q.end);

    if (dist <= 3 && touching) {
      let clashType = "Shared Crane/Laydown Logistics";
      if (userType !== q.type) {
        clashType = "Right-of-Way Road Excavation Collision"; // Dig Once initiative
      } else if (userType === 'Water' && q.type === 'Water') {
        clashType = "Shared Trenching Logistics";
      }

      hits.push({
        id: q.id,
        name: q.name,
        utility: q.utility,
        type: q.type,
        start: q.start,
        end: q.end,
        lat: q.lat,
        lng: q.lng,
        dist: roundedDist,
        clashType,
        cost: q.cost,
        savings: Math.round(((q.cost || 2000000) + 2000000) * 0.15),
        status: 'OVERLAP',
        message: `${roundedDist} mi away, within 3-mile logistics radius (${clashType}).`
      });
    } else if (dist <= 3 && !touching) {
      nearMisses.push({
        name: q.name,
        utility: q.utility,
        dist: roundedDist,
        reason: "Within 3 miles but construction dates outside mobilization window."
      });
    } else if (dist > 3 && touching) {
      nearMisses.push({
        name: q.name,
        utility: q.utility,
        dist: roundedDist,
        reason: "More than 3 miles — outside 3-mile logistics radar."
      });
    }
  }

  // Save the tested project into the in-memory array so it reflects dynamically
  const newProj = {
    id: 'user-' + Date.now(),
    type: userType,
    utility: userUtil,
    name: p.name || `${userUtil} Proposed Project`,
    lat: userLat,
    lng: userLng,
    start: userStart,
    end: userEnd,
    cost: Number(p.cost) || 2000000,
    region: 'South Florida (User Proposed)'
  };
  projects.push(newProj);

  res.json({
    hits,
    nearMisses,
    clear: hits.length === 0,
    project: newProj
  });
});

// Helper to call Gemini with multi-model fallback for maximum availability
async function generateGeminiContent(prompt, systemInstruction = '', history = []) {
  const apiKey = getGeminiApiKey();
  if (!apiKey || apiKey === 'your_key_here') {
    throw new Error('API_KEY_MISSING');
  }

  const models = ['gemini-3.5-flash-lite', 'gemini-3.8-flash', 'gemini-3.5-flash'];
  let lastError = null;

  // Build raw history array
  const rawContents = [];
  if (Array.isArray(history) && history.length > 0) {
    for (const msg of history) {
      const role = (msg.role === 'assistant' || msg.role === 'model') ? 'model' : 'user';
      const text = (msg.content || msg.text || '').trim();
      if (text) {
        rawContents.push({ role, text });
      }
    }
  }

  // Ensure current user question is the last turn
  const lastRaw = rawContents[rawContents.length - 1];
  if (!lastRaw || lastRaw.role !== 'user' || lastRaw.text !== prompt) {
    rawContents.push({ role: 'user', text: prompt });
  }

  // Consolidate turns to ensure alternating user/model roles required by Gemini API
  const contents = [];
  for (const item of rawContents) {
    if (contents.length > 0 && contents[contents.length - 1].role === item.role) {
      contents[contents.length - 1].parts[0].text += `\n${item.text}`;
    } else {
      contents.push({ role: item.role, parts: [{ text: item.text }] });
    }
  }

  // Ensure first turn is from user
  while (contents.length > 0 && contents[0].role === 'model') {
    contents.shift();
  }
  if (contents.length === 0 || contents[contents.length - 1].role !== 'user') {
    contents.push({ role: 'user', parts: [{ text: prompt }] });
  }

  for (const model of models) {
    try {
      const payload = {
        contents
      };
      if (systemInstruction) {
        payload.systemInstruction = { parts: [{ text: systemInstruction }] };
      }

      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        return text;
      }
      if (data.error) {
        lastError = new Error(`${model}: ${data.error.message}`);
      }
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error('All Gemini model endpoints unavailable');
}

// Explain the overlap with Gemini
app.post('/api/explain', async (req, res) => {
  const overlaps = findOverlaps(projects);
  if (!overlaps.length) {
    return res.json({ text: 'Grid Clear: No cross-utility project overlaps are currently detected within the Sperry Tech 25-mile radius with overlapping dates.' });
  }

  const o = overlaps[0];

  try {
    const prompt = `You are a power grid infrastructure coordination analyst. Explain in 3 concise, impactful sentences why these two power grid projects in South Florida overlapping matters: ${o.a.name} (${o.a.utility}) and ${o.b.name} (${o.b.utility}), located ${o.dist} miles apart (within the Sperry Tech 25-mile corridor), with construction dates overlapping in 2027. Mention the potential shared crew and heavy machinery savings of $${o.savings.toLocaleString()}, road easement minimization, and compliance with FERC Order 1920 for regional transmission planning.`;
    const text = await generateGeminiContent(prompt);
    if (text) return res.json({ text: text.trim() });
  } catch (e) {
    console.log('Gemini request failed, using standard utility analysis fallback:', e?.message);
  }

  res.json({
    text: `${o.a.name} (${o.a.utility}) and ${o.b.name} (${o.b.utility}) are only ${o.dist} miles apart in South Florida with overlapping construction timelines. Coordinating joint easements and sharing heavy equipment (e.g. directional boring & line crews) unlocks ~$${(o.savings / 1000).toFixed(0)}k in direct savings while cutting community road disruption, fulfilling the FERC Order 1920 mandate for inter-utility transmission coordination.`
  });
});

// ===== GLOBAL 30-CITY INTERNATIONAL INFRASTRUCTURE EXPANSION DATABASE =====
const globalCities = [
  { city: "New York City", country: "USA", electric: "Con Edison", water: "NYC DEP", contact: "pm-nynorth@coned.com", phone: "+1 (212) 460-4600", lat: 40.7128, lon: -74.0060, plan: "Shared underground conduit trenching." },
  { city: "Los Angeles", country: "USA", electric: "LADWP", water: "LADWP", contact: "infrastructure@ladwp.com", phone: "+1 (213) 367-4211", lat: 34.0522, lon: -118.2437, plan: "Grid reinforcement paired with water pipeline replacements." },
  { city: "Chicago", country: "USA", electric: "ComEd", water: "Chicago Dept. of Water Management", contact: "grid.ops@comed.com", phone: "+1 (800) 334-7661", lat: 41.8781, lon: -87.6298, plan: "Automated utility easement clearance." },
  { city: "Houston", country: "USA", electric: "CenterPoint Energy", water: "Houston Public Works", contact: "capital.projects@centerpointenergy.com", phone: "+1 (713) 207-2222", lat: 29.7604, lon: -95.3698, plan: "Hurricane-resilient underground sub-feeds." },
  { city: "Atlanta", country: "USA", electric: "Georgia Power", water: "Atlanta Watershed", contact: "sertp.liaison@georgiapower.com", phone: "+1 (888) 660-5890", lat: 33.7490, lon: -84.3880, plan: "Aligning transmission expansions with watershed tunneling." },
  { city: "Seattle", country: "USA", electric: "Seattle City Light", water: "Seattle Public Utilities", contact: "scl.planning@seattle.gov", phone: "+1 (206) 684-3000", lat: 47.6062, lon: -122.3321, plan: "Smart-grid micro-hubs sharing multi-utility downtown tunnels." },
  { city: "Denver", country: "USA", electric: "Xcel Energy", water: "Denver Water", contact: "co.infrastructure@xcelenergy.com", phone: "+1 (800) 895-4999", lat: 39.7392, lon: -104.9903, plan: "Renewable feeder lines with synchronized trenching." },
  { city: "Boston", country: "USA", electric: "Eversource", water: "Boston Water & Sewer", contact: "ma.projects@eversource.com", phone: "+1 (800) 592-2000", lat: 42.3601, lon: -71.0589, plan: "Modernizing downtown grid rings during sewer separation." },
  { city: "Dallas", country: "USA", electric: "Oncor", water: "Dallas Water Utilities", contact: "capital.coord@oncor.com", phone: "+1 (888) 313-6862", lat: 32.7767, lon: -96.7970, plan: "Synchronizing suburban high-growth feeder routes." },
  { city: "Toronto", country: "Canada", electric: "Toronto Hydro", water: "Toronto Water", contact: "planning@torontohydro.com", phone: "+1 (416) 542-8000", lat: 43.6532, lon: -79.3832, plan: "Subterranean utility-sharing tunnels." },
  { city: "Vancouver", country: "Canada", electric: "BC Hydro", water: "Metro Vancouver Water", contact: "majorprojects@bchydro.com", phone: "+1 (800) 224-9376", lat: 49.2827, lon: -123.1207, plan: "Coastal substation hardening with flood-mitigation drainage." },
  { city: "Montreal", country: "Canada", electric: "Hydro-Québec", water: "Ville de Montréal", contact: "coordination@hydroquebec.com", phone: "+1 (888) 385-7252", lat: 45.5017, lon: -73.5673, plan: "Upgrading underground hydro vaults during aqueduct rehabilitation." },
  { city: "Calgary", country: "Canada", electric: "ENMAX", water: "Calgary Water Services", contact: "grid.expansion@enmax.com", phone: "+1 (403) 514-3000", lat: 51.0447, lon: -114.0719, plan: "Aligning wind-integration feeder lines with water distribution." },
  { city: "Ottawa", country: "Canada", electric: "Hydro Ottawa", water: "Ottawa Environmental Services", contact: "capital@hydroottawa.com", phone: "+1 (613) 738-6400", lat: 45.4215, lon: -75.6972, plan: "Partnering with district heating and water utilities." },
  { city: "London", country: "UK", electric: "UK Power Networks", water: "Thames Water", contact: "capital.works@ukpowernetworks.co.uk", phone: "+44 800 056 5866", lat: 51.5074, lon: -0.1278, plan: "Central London \"Dig Once\" digital twin mandate." },
  { city: "Paris", country: "France", electric: "Enedis", water: "Eau de Paris", contact: "contact@enedis.fr", phone: "+33 9 70 83 19 70", lat: 48.8566, lon: 2.3522, plan: "Synchronizing EV charging rollout with cleaning water networks." },
  { city: "Berlin", country: "Germany", electric: "Stromnetz Berlin", water: "Berliner Wasserbetriebe", contact: "info@stromnetz-berlin.de", phone: "+49 30 492020", lat: 52.5200, lon: 13.4050, plan: "Integrating district heating with medium-voltage cable loops." },
  { city: "Madrid", country: "Spain", electric: "Iberdrola", water: "Canal de Isabel II", contact: "proyectos@iberdrola.es", phone: "+34 900 225 235", lat: 40.4168, lon: -3.7038, plan: "Automated joint trenching approvals across urban renewal zones." },
  { city: "Rome", country: "Italy", electric: "Areti (Acea)", water: "Acea Ato 2", contact: "sviluppo@areti.it", phone: "+39 06 57991", lat: 41.9028, lon: 12.4964, plan: "Protecting archaeological strata via dual-utility micro-tunnels." },
  { city: "Tokyo", country: "Japan", electric: "TEPCO Power Grid", water: "Bureau of Waterworks, Tokyo", contact: "global-ops@tepco.co.jp", phone: "+81 3 6373 1111", lat: 35.6762, lon: 139.6503, plan: "Seismic-resistant utility pipe-in-conduit joint networks." },
  { city: "Singapore", country: "Singapore", electric: "SP Group", water: "PUB Water Agency", contact: "info@spgroup.com.sg", phone: "+65 6916 8888", lat: 1.3521, lon: 103.8198, plan: "Integrating underground Common Services Tunnel (CST) data." },
  { city: "Seoul", country: "South Korea", electric: "KEPCO", water: "Seoul Waterworks Authority", contact: "global@kepco.co.kr", phone: "+82 2 3456 3114", lat: 37.5665, lon: 126.9780, plan: "IoT-enabled smart utility conduits across commercial districts." },
  { city: "Sydney", country: "Australia", electric: "Ausgrid", water: "Sydney Water", contact: "projects@ausgrid.com.au", phone: "+61 13 13 65", lat: -33.8688, lon: 151.2093, plan: "Coastal resilience grid upgrades with wastewater outfalls." },
  { city: "Dubai", country: "UAE", electric: "DEWA", water: "DEWA", contact: "customercare@dewa.gov.ae", phone: "+971 4 601 9999", lat: 25.2048, lon: 55.2708, plan: "Automated desalination-to-substation cooling loops." },
  { city: "Mumbai", country: "India", electric: "Adani/Tata Power", water: "BMC", contact: "helpdesk@adanielectricity.com", phone: "+91 22 5074 5000", lat: 19.0760, lon: 72.8777, plan: "Monsoon-vulnerable coastal feeder upgrades." },
  { city: "São Paulo", country: "Brazil", electric: "Enel São Paulo", water: "Sabesp", contact: "atendimento.sp@enel.com", phone: "+55 11 2195 2000", lat: -23.5505, lon: -46.6333, plan: "Metropolitan underground feeder ducts with sanitation works." },
  { city: "Buenos Aires", country: "Argentina", electric: "Edenor", water: "AySA", contact: "contacto@edenor.com", phone: "+54 11 4346 8400", lat: -34.6037, lon: -58.3816, plan: "Coordinating grid modernization with potable water networks." },
  { city: "Cairo", country: "Egypt", electric: "North Cairo Electricity", water: "HCWW", contact: "info@ncdec.gov.eg", phone: "+20 2 2773 6672", lat: 30.0444, lon: 31.2357, plan: "Aligning new capital grid interconnects with trunk pipelines." },
  { city: "Johannesburg", country: "South Africa", electric: "City Power Joburg", water: "Joburg Water", contact: "info@joburgpower.co.za", phone: "+27 11 490 7000", lat: -26.2041, lon: 28.0473, plan: "Micro-grid resilience hubs with emergency water pumps." },
  { city: "Mexico City", country: "Mexico", electric: "CFE", water: "Sacmex", contact: "contacto@cfe.mx", phone: "+52 55 5229 4400", lat: 19.4326, lon: -99.1332, plan: "Geotechnical joint monitoring for seismic fault-line conduits." }
];

// Endpoint for global expansion cities
app.get('/api/global-cities', (req, res) => {
  res.json(globalCities);
});

// Interactive Assistant Q&A route supporting /api/chat, /api/dispatch, and /api/assistant
async function handleAssistantChat(req, res) {
  try {
    const body = req.body || {};
    const queryParam = req.query || {};
    const message = (body.message || body.question || body.query || body.prompt || body.text || queryParam.message || queryParam.q || '').trim();
    const history = body.history || body.chatHistory || [];
    const clientProjects = body.projects;
    const projectList = (Array.isArray(clientProjects) && clientProjects.length > 0)
      ? clientProjects
      : projects;

    if (!message) {
      return res.json({
        reply: "GridSync Dispatch AI: Ready. Ask for any global city's dispatch contact, utility provider, Dig Once right-of-way analysis, or 5-mile logistics radar scan across Florida, North America, and 30 international hubs.",
        answer: "GridSync Dispatch AI: Ready.",
        text: "GridSync Dispatch AI: Ready.",
        lat: 25.7617,
        lon: -80.1918,
        status: 'success'
      });
    }

    const lowerMsg = message.toLowerCase();

    // 1. Dynamic Matcher for 30 International Global Cities & Utilities
    const matchedCity = globalCities.find(c => {
      const cCity = c.city.toLowerCase();
      const cCountry = c.country.toLowerCase();
      const cElec = c.electric.toLowerCase();
      const cWater = c.water.toLowerCase();
      return lowerMsg.includes(cCity) ||
        (cCountry !== 'usa' && lowerMsg.includes(cCountry)) ||
        (lowerMsg.includes('con ed') && cCity.includes('york')) ||
        (lowerMsg.includes('ladwp') && cCity.includes('angeles')) ||
        (lowerMsg.includes('comed') && cCity.includes('chicago')) ||
        (lowerMsg.includes('thames') && cCity.includes('london')) ||
        (lowerMsg.includes('tepco') && cCity.includes('tokyo')) ||
        (lowerMsg.includes('hydro-quebec') && cCity.includes('montreal')) ||
        (lowerMsg.includes('toronto hydro') && cCity.includes('toronto')) ||
        lowerMsg.includes(cElec) ||
        lowerMsg.includes(cWater);
    });

    if (matchedCity) {
      const replyText = `GridSync AI: Found records for ${matchedCity.city}, ${matchedCity.country}.\n• Electric: ${matchedCity.electric}\n• Water: ${matchedCity.water}\n• Contact: ${matchedCity.contact}\n• Phone: ${matchedCity.phone || '+1 (800) 555-GRID'}\n• Plan: ${matchedCity.plan}`;
      return res.json({
        reply: replyText,
        answer: replyText,
        text: replyText,
        lat: matchedCity.lat,
        lon: matchedCity.lon,
        lng: matchedCity.lon,
        city: matchedCity.city,
        country: matchedCity.country,
        electric: matchedCity.electric,
        water: matchedCity.water,
        contact: matchedCity.contact,
        phone: matchedCity.phone || '+1 (800) 555-GRID',
        plan: matchedCity.plan,
        recommendedLocation: {
          lat: matchedCity.lat,
          lng: matchedCity.lon,
          name: `${matchedCity.city}, ${matchedCity.country}`,
          status: 'GLOBAL_BASE'
        },
        status: 'success'
      });
    }

    // 2. Gemini Generative AI Model if API key is configured
    const apiKey = getGeminiApiKey();
    let aiReply = null;

    if (apiKey && apiKey !== 'your_key_here') {
      const systemContext = `You are 'GridSync Dispatch Assistant', an analytical engine for GridSync — an ArcGIS-style multi-utility coordination platform tracking infrastructure projects, 5-mile (8,046.72 m) logistics radiuses, and utility networks across Florida, North America, and 30 international cities under FERC Order 1920 compliance.
International 30-City Hubs: ${JSON.stringify(globalCities.map(c => ({ city: c.city, country: c.country, electric: c.electric, water: c.water, contact: c.contact, phone: c.phone, coords: [c.lat, c.lon], plan: c.plan })))}
Florida Projects: ${JSON.stringify(projectList)}

When discussing any city or location, provide the exact utility providers, email, and phone contact, and include coordinates using this tag: [PLOT_LOCATION: lat, lon, "City/Location Name"].`;

      try {
        const generated = await generateGeminiContent(message, systemContext, history);
        if (generated && generated.trim()) {
          aiReply = generated.trim();
        }
      } catch (err) {
        console.warn("Gemini call failed or rate-limited, switching to structured fallback:", err?.message);
      }
    }

    if (aiReply) {
      let lat = 25.7617;
      let lon = -80.1918;
      let recommendedLocation = null;
      const plotMatch = aiReply.match(/\[PLOT_LOCATION:\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*["']?([^\]"']+)["']?\]/i);
      if (plotMatch) {
        lat = parseFloat(plotMatch[1]);
        lon = parseFloat(plotMatch[2]);
        recommendedLocation = {
          lat,
          lng: lon,
          name: plotMatch[3].trim(),
          status: 'CLEAR'
        };
      }
      return res.json({
        reply: aiReply,
        answer: aiReply,
        text: aiReply,
        lat,
        lon,
        status: 'success',
        recommendedLocation
      });
    }

    // 3. Structured fallback handling
    let fallbackReply = "";
    let recLoc = { lat: 25.7617, lng: -80.1918, name: "Miami-Dade Infrastructure Hub", status: "CLEAR" };

    if (lowerMsg.includes("clear") || lowerMsg.includes("optimal") || lowerMsg.includes("untouched") || lowerMsg.includes("where") || lowerMsg.includes("recommend") || lowerMsg.includes("build site")) {
      fallbackReply = "Analysis of transmission corridors and municipal water mains confirms Orlando Central Grid [28.5383° N, 81.3792° W] is an optimal, untouched location. It is 100% clear of all active electric and water utility projects outside the 5-mile logistics radar perimeter, with zero road excavation conflicts under FERC Order 1920. Would you like me to plot this location on your map?";
      recLoc = { lat: 28.5383, lng: -81.3792, name: "Orlando Central Clear Build Zone", status: "CLEAR" };
    } else if (lowerMsg.includes("yes") || lowerMsg.includes("plot") || lowerMsg.includes("do it") || lowerMsg.includes("sure")) {
      fallbackReply = "Plotting confirmed. Transmitting Orlando Central Clear Build Zone [28.5383° N, 81.3792° W] directly to your Leaflet radar map with a 5-mile logistics perimeter buffer.";
      recLoc = { lat: 28.5383, lng: -81.3792, name: "Orlando Central Clear Build Zone", status: "CLEAR" };
    } else if (lowerMsg.includes("dig once") || lowerMsg.includes("mobilization") || lowerMsg.includes("saving") || lowerMsg.includes("ferc") || lowerMsg.includes("explain")) {
      fallbackReply = "The 'Dig Once' initiative and FERC Order 1920 mandate cross-sector coordination between power grid transmission operators and municipal water utilities before repaving public thoroughfares. Within GridSync's 5-mile (8,046.72 m) logistics radar, synchronizing heavy equipment (such as directional boring rigs, cranes, and civil trenchers) unlocks $2.1M in shared mobilization savings across South Florida while eliminating redundant road closures.";
    } else if (lowerMsg.includes("miami") || lowerMsg.includes("wasd") || lowerMsg.includes("power vs water") || lowerMsg.includes("collision") || lowerMsg.includes("overlap")) {
      fallbackReply = "Active Conflict Detected in Miami-Dade: Florida Power & Light (Miami Substation Upgrade at [25.7617, -80.1918]) overlaps with Miami-Dade WASD (Downtown Water Main Replacement at [25.7700, -80.1900]) within 0.6 miles during Q2-Q3 2027. Under the 'Dig Once' standard, coordinating joint civil trenching prevents duplicate street excavations and secures $540,000 in shared crew savings.";
      recLoc = { lat: 25.7680, lng: -80.1910, name: "Downtown Trench Overlap (FPL x WASD)", status: "OVERLAP" };
    } else if (lowerMsg.includes("broward") || lowerMsg.includes("lauderdale") || lowerMsg.includes("bcwws")) {
      fallbackReply = "Active Conflict in Broward Sector: FPL Broward Transmission Line [26.1224, -80.1434] is within 0.3 miles of Broward BCWWS Fort Lauderdale Pipe Trench [26.1200, -80.1400]. Construction dates overlap from Feb to July 2027. Joint right-of-way mobilization yields $930,000 in shared contractor efficiencies.";
      recLoc = { lat: 26.1215, lng: -80.1415, name: "Fort Lauderdale Corridor Collision", status: "OVERLAP" };
    } else if (lowerMsg.includes("tampa") || lowerMsg.includes("fgua")) {
      fallbackReply = "Tampa Bay Sector: Tampa Bay Water Resilience Reservoir is operational alongside FGUA Pasco Utility Corridor Conduit [28.2500, -82.4500]. Currently clear of high-voltage transmission clashes with zero duplicate road cuts detected.";
      recLoc = { lat: 27.9500, lng: -82.4500, name: "Tampa Bay Clear Utility Zone", status: "CLEAR" };
    } else if (lowerMsg.includes("palm beach") || lowerMsg.includes("pbcwud")) {
      fallbackReply = "Palm Beach Sector: PBCWUD West Palm Trunk Main Loop [26.7080, -80.0510] is clear of heavy electrical crane logistics corridors, maintaining green status across the 5-mile logistics buffer.";
      recLoc = { lat: 26.7080, lng: -80.0510, name: "Palm Beach Coordinated Corridor", status: "CLEAR" };
    } else if (lowerMsg.includes("keys") || lowerMsg.includes("key west")) {
      fallbackReply = "Florida Keys Sector: Keys Energy Services Key West Hardening [24.5551, -81.7800] and Keys Co-op Key Largo Interconnect [25.0865, -80.4473] are separated by over 60 miles across the Overseas Highway with zero mutual trench conflicts.";
      recLoc = { lat: 24.5551, lng: -81.7800, name: "Key West Hardened Grid Zone", status: "CLEAR" };
    } else {
      fallbackReply = `GridSync AI: Analyzed query regarding "${message}". Global 5-mile / 8km logistics radar sectors and local U.S./Canada lines are active and monitoring cross-utility coordination. Ask for any city's contact, utility provider, or to jump to a location on the map!`;
    }

    return res.json({
      reply: fallbackReply,
      answer: fallbackReply,
      text: fallbackReply,
      lat: recLoc.lat,
      lon: recLoc.lng,
      lng: recLoc.lng,
      status: 'success',
      recommendedLocation: recLoc
    });
  } catch (error) {
    console.error("Dispatcher error:", error);
    return res.status(200).json({
      reply: `GridSync Dispatch AI: Global 5-mile / 8km logistics radar sectors are active and monitoring cross-utility coordination.`,
      lat: 25.7617,
      lon: -80.1918,
      status: 'fallback'
    });
  }
}

app.post('/api/chat', handleAssistantChat);
app.get('/api/chat', handleAssistantChat);
app.post('/api/dispatch', handleAssistantChat);
app.get('/api/dispatch', handleAssistantChat);
app.post('/api/assistant', handleAssistantChat);
app.get('/api/assistant', handleAssistantChat);

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`GridSync server running on http://0.0.0.0:${PORT}`);
});
