// ===== GLOBAL =====
let schemaText = "";
let chartInstance = null;
let isLoading = false;

// ===== AUTHENTICATION =====
document.addEventListener("DOMContentLoaded", () => {
    const overlay = document.getElementById("loginOverlay");
    if (overlay && localStorage.getItem("qf_auth") === "true") {
        overlay.classList.remove("active");
    }
});

function handleLogin() {
    const user = document.getElementById("loginUsername").value;
    const pass = document.getElementById("loginPassword").value;
    const err = document.getElementById("loginError");
    const btn = document.getElementById("loginBtn");

    if (user === "admin" && pass === "admin") {
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Authenticating...';
        err.style.display = 'none';
        
        setTimeout(() => {
            localStorage.setItem("qf_auth", "true");
            document.getElementById("loginOverlay").classList.remove("active");
        }, 800);
    } else {
        err.style.display = 'block';
    }
}

// ===== MESSAGE =====
function addMessage(text, type) {
    const box = document.getElementById("chatBox");

    const msg = document.createElement("div");
    msg.className = `message ${type}`;

    const avatar = document.createElement("div");
    avatar.className = "avatar";
    avatar.textContent = type === 'user' ? '👤' : '🤖';

    const bubble = document.createElement("div");
    bubble.className = "bubble";
    bubble.innerHTML = text;

    if (type === 'user') {
        msg.append(avatar, bubble);
    } else {
        msg.append(bubble, avatar);
    }

    box.appendChild(msg);
    msg.scrollIntoView({ behavior: 'smooth' });

    return msg;
}

// ===== STREAMING TEXT =====
async function streamText(text) {
    const msg = addMessage("", "bot");
    const bubble = msg.querySelector(".bubble");

    let i = 0;

    return new Promise(resolve => {
        const interval = setInterval(() => {
            bubble.innerHTML += text[i];
            i++;

            if (i >= text.length) {
                clearInterval(interval);
                resolve();
            }
        }, 10);
    });
}

// ===== LOAD SCHEMA =====
async function loadSchema() {
    const source = document.getElementById("source").value;
    const loadBtn = document.getElementById("loadSchemaBtn");
    const schemaBox = document.getElementById("schemaBox");

    let fd = new FormData();
    fd.append("source", source);

    if (source === "csv") {
        const file = document.getElementById("csvFile").files[0];
        if (!file) {
            addMessage("⚠️ Please upload CSV first", "bot");
            return;
        }
        fd.append("csv_file", file);
    } else if (source === "db") {
        const dbUri = document.getElementById("dbUri").value.trim();
        if (!dbUri) {
            addMessage("⚠️ Please enter a valid Database URI", "bot");
            return;
        }
        fd.append("db_uri", dbUri);
    }

    loadBtn.disabled = true;
    loadBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Loading...';

    try {
        const res = await fetch("/schema", {
            method: "POST",
            body: fd
        });

        const data = await res.json();

        if (data.error) {
            addMessage("❌ " + data.error, "bot");
            return;
        }

        schemaText = data.schema;
        schemaBox.innerHTML = `<pre>${schemaText}</pre>`;
        schemaBox.classList.add("loaded");

        generateSuggestions(schemaText);
        addMessage("✅ Schema loaded successfully!", "bot");

    } catch (e) {
        console.error("Schema load error:", e);
        addMessage("❌ Failed to load schema. Check console.", "bot");
    } finally {
        loadBtn.disabled = false;
        loadBtn.innerHTML = '<i class="fa-solid fa-magic"></i> <span>Load Schema</span>';
    }
}

// File upload listener
document.addEventListener("DOMContentLoaded", function() {
    document.getElementById("csvFile").addEventListener("change", function(e) {
        const fileName = e.target.files[0]?.name || "Choose CSV";
        document.getElementById("fileText").textContent = fileName;
    });

    // Hide empty state initially
    const emptyState = document.getElementById("emptyState");
    if(emptyState) emptyState.style.display = 'flex';
});

// ===== ENTER KEY =====
document.addEventListener("DOMContentLoaded", function() {
    document.getElementById("queryInput").addEventListener("keypress", function(e) {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendQuery();
        }
    });
});

// ===== SEND QUERY =====
async function sendQuery() {
    let input = document.getElementById("queryInput");
    let query = input.value.trim();

    if (!query || isLoading) return;

    if (!schemaText) {
        addMessage("⚠️ Load schema first", "bot");
        return;
    }

    const emptyState = document.getElementById("emptyState");
    if(emptyState) emptyState.style.display = 'none';

    isLoading = true;
    addMessage(query, "user");
    input.value = "";

    document.getElementById("suggestionsBox").innerHTML = "";

    const typingMsg = addMessage("🤖 Thinking...", "bot");

    try {
        let fd = new FormData();
        fd.append("nl_query", query);
        fd.append("schema", schemaText);

        let res = await fetch("/generate_sql", { method: "POST", body: fd });
        let data = await res.json();

        typingMsg.remove();

        if (data.error) {
            addMessage("AI Error: " + data.error, "bot");
            return;
        }

        await streamText(`🧠 SQL:\n\`\`\`sql\n${data.sql}\n\`\`\``);

        executeSQL(data.sql);

    } catch (e) {
        typingMsg.remove();
        addMessage("❌ Network error. Check server.", "bot");
        console.error("Query error:", e);
    }

    isLoading = false;
}

// ===== EXECUTE SQL =====
async function executeSQL(sql) {
    let fd = new FormData();
    const source = document.getElementById("source").value;

    fd.append("sql", sql);
    fd.append("source", source);

    if (source === "csv") {
        const file = document.getElementById("csvFile").files[0];
        if (!file) {
            addMessage("⚠️ CSV missing", "bot");
            return;
        }
        fd.append("csv_file", file);
    } else if (source === "db") {
        const dbUri = document.getElementById("dbUri").value.trim();
        fd.append("db_uri", dbUri);
    }

    try {
        let res = await fetch("/execute_sql", { method: "POST", body: fd });
        let data = await res.json();

        if (data.error) {
            addMessage("Execution Error: " + data.error, "bot");
            return;
        }

        // Show results
        const resultWrapper = document.querySelector(".result-chart-container");
        resultWrapper.classList.add("active");
        showResultLoading();
        resultWrapper.scrollIntoView({ behavior: 'smooth', block: 'end' });

        setTimeout(() => {
            renderTable(data.columns, data.results);
            const type = detectChartType(data.results, data.columns);
            renderChart(data.results, data.columns, type);
            generateDownloadButton(data.columns, data.results);
            resultWrapper.scrollIntoView({ behavior: 'smooth', block: 'end' });
            
            // Trigger AI insight generation
            generateInsight(data.results.slice(0, 50));
        }, 500);

    } catch (e) {
        addMessage("❌ SQL execution failed", "bot");
        console.error("SQL error:", e);
    }
}

// ===== UI HELPERS =====
function showResultLoading() {
    const resultBox = document.getElementById("resultBox");

    let skeleton = "";
    for (let i = 0; i < 6; i++) {
        skeleton += `<div class="skeleton-row"></div>`;
    }

    resultBox.innerHTML = `<div class="skeleton">${skeleton}</div>`;
}

// ===== TABLE =====
function renderTable(columns, rows) {
    const resultBox = document.getElementById("resultBox");

    let html = "<table><thead><tr>";
    columns.forEach(c => html += `<th>${c}</th>`);
    html += "</tr></thead><tbody>";

    rows.slice(0, 20).forEach(r => {
        html += "<tr>";
        r.forEach(c => html += `<td>${c ?? ''}</td>`);
        html += "</tr>";
    });

    html += "</tbody></table>";

    resultBox.innerHTML = html;
}

// ===== DOWNLOAD =====
function generateDownloadButton(columns, rows) {
    const resultBox = document.getElementById("resultBox");

    let btn = document.createElement("button");
    btn.innerHTML = "<i class='fa-solid fa-download'></i> Download CSV";
    btn.className = "download-btn";

    btn.onclick = () => {
        let csv = columns.join(",") + "\n";
        rows.forEach(r => csv += r.join(",") + "\n");

        let blob = new Blob([csv], { type: "text/csv" });
        let url = URL.createObjectURL(blob);

        let a = document.createElement("a");
        a.href = url;
        a.download = "query_results.csv";
        a.click();
    };

    resultBox.prepend(btn);
}

// ===== CHART =====
function detectChartType(rows, columns) {
    if (rows.length === 0) return "bar";

    // Find numeric column
    let numIndex = columns.findIndex(col => {
        return rows[0] && rows[0][columns.indexOf(col)] !== null && !isNaN(rows[0][columns.indexOf(col)]);
    });

    if (numIndex === -1) return "bar";

    if (rows.length <= 6) return "pie";
    if (rows.length <= 15) return "bar";

    return "line";
}

function renderChart(rows, columns, type = "bar") {
    const ctx = document.getElementById("chartCanvas").getContext("2d");
    const chartBox = document.querySelector(".chart-box");
    chartBox.classList.add("active");

    if (chartInstance) chartInstance.destroy();

    let numIndex = columns.findIndex((_, i) => rows[0] && rows[0][i] !== null && !isNaN(rows[0][i]));
    if (numIndex === -1) {
        chartBox.classList.remove("active");
        return;
    }

    let labelIndex = numIndex === 0 ? 1 : 0;
    if (labelIndex >= columns.length) labelIndex = 0;
    
    const labels = rows.map(r => String(r[labelIndex] || ''));
    const values = rows.map(r => Number(r[numIndex]) || 0);
    
    const isPie = type === 'pie';
    
    // Create stunning gradient for continuous charts
    let gradientFill = null;
    if (!isPie) {
        gradientFill = ctx.createLinearGradient(0, 0, 0, 400);
        gradientFill.addColorStop(0, 'rgba(56, 189, 248, 0.6)');
        gradientFill.addColorStop(1, 'rgba(56, 189, 248, 0.05)');
    }

    const pieColors = [
        'rgba(56, 189, 248, 0.8)', 'rgba(139, 92, 246, 0.8)', 'rgba(236, 72, 153, 0.8)', 
        'rgba(16, 185, 129, 0.8)', 'rgba(245, 158, 11, 0.8)', 'rgba(99, 102, 241, 0.8)'
    ];
    const pieBorders = ['#38bdf8', '#8b5cf6', '#ec4899', '#10b981', '#f59e0b', '#6366f1'];

    chartInstance = new Chart(ctx, {
        type: type,
        data: {
            labels,
            datasets: [{
                label: columns[numIndex],
                data: values,
                backgroundColor: isPie ? pieColors : gradientFill,
                borderColor: isPie ? pieBorders : '#38bdf8',
                borderWidth: isPie ? 2 : 3,
                borderRadius: type === 'bar' ? 6 : 0, // Rounded tops for bars
                tension: 0.4, // Smooth curvy lines
                fill: true, // Fill area under lines
                pointBackgroundColor: '#0f172a',
                pointBorderColor: '#38bdf8',
                pointBorderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6,
                hoverOffset: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                legend: { 
                    position: 'top', 
                    labels: { 
                        color: "#e4e4e7",
                        font: { family: "'Inter', sans-serif", size: 12, weight: '500' },
                        usePointStyle: true,
                        boxWidth: 8
                    } 
                },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    titleColor: '#f8fafc',
                    bodyColor: '#cbd5e1',
                    borderColor: 'rgba(56, 189, 248, 0.3)',
                    borderWidth: 1,
                    padding: 12,
                    cornerRadius: 12,
                    boxPadding: 6,
                    titleFont: { family: "'Inter', sans-serif", size: 14, weight: '600' },
                    bodyFont: { family: "'Inter', sans-serif", size: 13 }
                }
            },
            scales: !isPie ? {
                x: { 
                    ticks: { color: "#94a3b8", font: { family: "'Inter', sans-serif" } }, 
                    grid: { display: false },
                    border: { display: false }
                },
                y: { 
                    beginAtZero: true,
                    ticks: { color: "#94a3b8", font: { family: "'Inter', sans-serif" }, padding: 10 }, 
                    grid: { color: "rgba(255,255,255,0.05)", drawBorder: false, borderDash: [5, 5] },
                    border: { display: false }
                }
            } : {}
        }
    });
}

// ===== AI INSIGHTS =====
async function generateInsight(dataRows) {
    const box = document.getElementById("aiInsightBox");
    const content = document.getElementById("insightContent");
    
    if (!box || !content) return;
    
    // Reset and show
    content.innerHTML = '<i class="fa-solid fa-spinner fa-spin" style="margin-right: 5px;"></i> Analyzing data trends...';
    box.style.display = 'flex';
    box.scrollIntoView({ behavior: 'smooth', block: 'end' });
    
    try {
        let fd = new FormData();
        fd.append("data", JSON.stringify(dataRows));
        
        let res = await fetch("/generate_insights", { method: "POST", body: fd });
        let data = await res.json();
        
        if(data.error) {
            content.innerHTML = `<span style="color: #ef4444;">Insight analysis failed.</span>`;
            return;
        }
        
        // Typewriter effect
        content.innerHTML = "";
        let text = data.insight;
        let i = 0;
        
        const interval = setInterval(() => {
            content.innerHTML += text[i] === '\n' ? '<br>' : text[i];
            i++;
            if (i >= text.length) clearInterval(interval);
        }, 15);
        
    } catch(e) {
        content.innerHTML = `<span style="color: #ef4444;">Insight analysis failed.</span>`;
    }
}

// ===== SUGGESTIONS =====
function generateSuggestions(schemaText) {
    const box = document.getElementById("suggestionsBox");
    box.innerHTML = "";

    const lines = schemaText.split("\n");
    const tables = [];
    let currentTable = null;

    lines.forEach(line => {
        if (line.toLowerCase().startsWith("table:")) {
            currentTable = line.split(":")[1].trim();
        } else if (line.trim().length > 0 && currentTable) {
            const match = line.match(/"([^"]+)"/);
            const colName = match ? match[1] : line.split(" ")[0].trim();
            tables.push({ table: currentTable, col: colName });
        }
    });

    if (tables.length === 0) return;

    const firstTable = tables[0].table;
    const cols = tables.filter(t => t.table === firstTable).map(t => t.col).slice(0, 5);

    const suggestions = [
        `Show top 10 rows from ${firstTable}`,
        `Count total records in ${firstTable}`,
        cols[0] ? `Top 5 by ${cols[0]}` : "Show all records",
        cols[1] ? `Average ${cols[1]}` : "Group by category"
    ];

    suggestions.forEach(text => {
        const chip = document.createElement("div");
        chip.className = "suggestion-chip";
        chip.innerText = text;
        chip.onclick = () => {
            document.getElementById("queryInput").value = text;
            box.innerHTML = "";
            sendQuery();
        };
        box.appendChild(chip);
    });
}
