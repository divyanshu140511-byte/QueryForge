// ===== GLOBAL =====
let schemaText = "";
let chartInstance = null;
let isLoading = false;

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

// ===== STREAMING =====
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

// ===== FILE NAME SHOW =====
document.getElementById("csvFile").addEventListener("change", function (e) {
    const fileName = e.target.files[0]?.name || "Choose CSV";
    document.getElementById("fileText").textContent = fileName;
});

// ===== LOAD SCHEMA (FIXED) =====
async function loadSchema() {
    const source = document.getElementById("source").value;
    const fileInput = document.getElementById("csvFile");
    const loadBtn = document.getElementById("loadSchemaBtn");
    const schemaBox = document.getElementById("schemaBox");

    let fd = new FormData();
    fd.append("source", source);

    if (source === "csv") {
        const file = fileInput.files[0];

        console.log("Selected file:", file);

        if (!file) {
            addMessage("⚠️ Please select CSV file", "bot");
            return;
        }

        fd.append("csv_file", file);
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

        // show schema
        schemaBox.innerText = schemaText;

        generateSuggestions(schemaText);

        addMessage("✅ Schema loaded successfully!", "bot");

    } catch (err) {
        console.error(err);
        addMessage("❌ Failed to load schema", "bot");
    } finally {
        loadBtn.disabled = false;
        loadBtn.innerHTML = '<i class="fa-solid fa-magic"></i> <span>Load Schema</span>';
    }
}

// ===== ENTER KEY =====
document.getElementById("queryInput").addEventListener("keypress", function(e) {
    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendQuery();
    }
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
            addMessage(data.error, "bot");
            return;
        }

        await streamText(`🧠 SQL:\n${data.sql}`);

        executeSQL(data.sql);

    } catch {
        typingMsg.remove();
        addMessage("❌ Error", "bot");
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
    }

    try {
        let res = await fetch("/execute_sql", { method: "POST", body: fd });
        let data = await res.json();

        if (data.error) return addMessage(data.error, "bot");

        showResultLoading();

        setTimeout(() => {
            renderTable(data.columns, data.results);

            const type = detectChartType(data.results, data.columns);
            renderChart(data.results, data.columns, type);

            generateDownloadButton(data.columns, data.results);

        }, 800);

    } catch {
        addMessage("❌ SQL failed", "bot");
    }
}

// ===== SKELETON =====
function showResultLoading() {
    const resultBox = document.getElementById("resultBox");

    let skeleton = "";
    for (let i = 0; i < 6; i++) {
        skeleton += `<div class="skeleton"></div>`;
    }

    resultBox.innerHTML = skeleton;
}

// ===== TABLE =====
function renderTable(columns, rows) {
    const resultBox = document.getElementById("resultBox");

    let html = "<table><tr>";
    columns.forEach(c => html += `<th>${c}</th>`);
    html += "</tr>";

    rows.forEach(r => {
        html += "<tr>";
        r.forEach(c => html += `<td>${c}</td>`);
        html += "</tr>";
    });

    html += "</table>";

    resultBox.innerHTML = html;
}

// ===== DOWNLOAD =====
function generateDownloadButton(columns, rows) {
    const resultBox = document.getElementById("resultBox");

    let btn = document.createElement("button");
    btn.innerText = "⬇ Download CSV";
    btn.style.marginBottom = "10px";

    btn.onclick = () => {
        let csv = columns.join(",") + "\n";

        rows.forEach(r => {
            csv += r.join(",") + "\n";
        });

        let blob = new Blob([csv], { type: "text/csv" });
        let url = URL.createObjectURL(blob);

        let a = document.createElement("a");
        a.href = url;
        a.download = "result.csv";
        a.click();
    };

    resultBox.prepend(btn);
}

// ===== CHART =====
function detectChartType(rows, columns) {
    if (!rows.length) return "bar";

    let numIndex = columns.findIndex((_, i) => !isNaN(rows[0][i]));

    if (numIndex !== -1 && rows.length <= 6) return "pie";
    if (numIndex !== -1 && rows.length <= 15) return "bar";

    return "line";
}

function renderChart(rows, columns, type = "bar") {
    const ctx = document.getElementById("chartCanvas");

    if (chartInstance) chartInstance.destroy();

    let numIndex = columns.findIndex((_, i) => !isNaN(rows[0][i]));
    let labelIndex = numIndex === 0 ? 1 : 0;

    const labels = rows.map(r => r[labelIndex]);
    const values = rows.map(r => Number(r[numIndex]) || 0);

    chartInstance = new Chart(ctx, {
        type: type,
        data: {
            labels,
            datasets: [{
                label: columns[numIndex],
                data: values
            }]
        }
    });
}

// ===== SUGGESTIONS =====
function generateSuggestions(schemaText) {
    const box = document.getElementById("suggestionsBox");
    box.innerHTML = "";

    const columns = schemaText
        .split("\n")
        .map(line => line.split(" ")[0])
        .filter(c => c && c !== "Table:");

    const suggestions = [
        "Show all data",
        "Count total records",
        `Top ${columns[0]}`,
        `Average of ${columns[1] || columns[0]}`,
        `Group by ${columns[0]}`
    ];

    suggestions.forEach(text => {
        const chip = document.createElement("div");
        chip.className = "suggestion-chip";
        chip.innerText = text;

        chip.onclick = () => {
            document.getElementById("queryInput").value = text;
        };

        box.appendChild(chip);
    });
}
const fileInput = document.getElementById("csvFile");
const uploadBtn = document.getElementById("uploadBtn");

// open file picker
uploadBtn.addEventListener("click", () => {
    fileInput.click();
});

// update file name
fileInput.addEventListener("change", function () {
    const file = this.files[0];

    console.log("FILE SELECTED:", file); // 🔍 DEBUG

    if (file) {
        document.getElementById("fileText").innerText = file.name;
    }
});