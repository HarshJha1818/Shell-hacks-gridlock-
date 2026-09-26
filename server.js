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

// Interactive Assistant Q&A route
app.post('/api/chat', async (req, res) => {
  const { question, query, projects: clientProjects, history } = req.body;
  const userQuestion = question || query;
  const apiKey = getGeminiApiKey();

  if (!apiKey || apiKey === 'your_key_here') {
    return res.json({ text: "> Offline Mode: Please add your GEMINI_API_KEY to the .env file to enable live Q&A." });
  }

  const projectList = (Array.isArray(clientProjects) && clientProjects.length > 0)
    ? clientProjects
    : (Array.isArray(req.body.projects) && req.body.projects.length > 0 ? req.body.projects : projects);

  const systemContext = `You are 'Assistant', an analytical agent for a Florida multi-utility coordination platform covering 10 utilities:
Electric (Power): FPL, Duke Energy, Keys Energy, Keys Co-op, Glades Co-op
Water (Civil/Trenches): Miami-Dade WASD, Broward BCWWS, Palm Beach PBCWUD, FGUA, Tampa Bay Water.

Active project data: ${JSON.stringify(projectList)}

You strictly enforce the 3-mile logistics radius and the "Dig Once" right-of-way initiative.

Follow this strict 2-step execution loop:
STEP 1 (Propose): If the user asks for a clear build site, untouched location, or recommendation, analyze the active electric and water project data. Find a coordinate that is at least 3+ miles away from ALL active projects (e.g., Orlando [28.5383, -81.3792], Naples [26.1420, -81.7948], or Ocala [29.1872, -82.1401]). Name the location, confirm it is 100% clear of all 10 electric and water utility projects within the 3-mile logistics radius, and END your response by asking: "Would you like me to plot this location on your map?" Do NOT append any execution tags yet.
STEP 2 (Execute): If the user approves (e.g., "yes", "plot it", "do it"), reply with a direct conversational confirmation and append this exact machine-readable tag at the very end of your response: [PLOT_LOCATION: latitude, longitude, "Location Name"].

RULES: Never use emojis. Be direct, comprehensive, and professional.`;

  try {
    const text = await generateGeminiContent(userQuestion, systemContext, history);
    if (text) {
      const clean = text.trim();
      const formatted = clean.startsWith('>') ? clean : `> Assistant: ${clean}`;
      res.json({ text: formatted, answer: clean });
    } else {
      throw new Error("No candidate generated");
    }
  } catch (error) {
    console.error("Assistant chat error:", error?.message);
    res.json({ text: "> Error: Communication with assistant dispatch failed." });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`⚡ GridSync server running on http://0.0.0.0:${PORT}`);
});
