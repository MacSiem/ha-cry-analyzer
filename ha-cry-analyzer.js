class HaCryAnalyzer extends HTMLElement {
  setConfig(config) {
    this.config = config;
    this.title = config.title || "Baby Cry Analyzer";
    this.soundSensor = config.sound_sensor;
  }

  set hass(hass) {
    this.hassObj = hass;
    if (!this.hasUpdated) {
      this.render();
      this.hasUpdated = true;
    }
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.cryLog = [];
    this.currentTab = "log";
    this.showAddForm = false;
    this.formData = {
      category: "unknown",
      intensity: 3,
      duration: 5,
      notes: ""
    };
    this.hasUpdated = false;
  }

  getCategories() {
    return ["hungry", "tired", "pain", "discomfort", "bored", "unknown"];
  }

  addCryLog() {
    const now = new Date();
    const entry = {
      id: Date.now(),
      timestamp: now.toISOString(),
      category: this.formData.category,
      intensity: parseInt(this.formData.intensity),
      duration: parseInt(this.formData.duration),
      notes: this.formData.notes
    };
    this.cryLog.push(entry);
    this.formData = { category: "unknown", intensity: 3, duration: 5, notes: "" };
    this.showAddForm = false;
    this.render();
  }

  deleteCryLog(id) {
    this.cryLog = this.cryLog.filter(entry => entry.id !== id);
    this.render();
  }

  exportToJSON() {
    const dataStr = JSON.stringify(this.cryLog, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `cry-log-${new Date().toISOString().split("T")[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  analyzePatterns() {
    if (this.cryLog.length === 0) {
      return { hourly: [], topCategories: [], avgDuration: 0, totalCries: 0 };
    }

    // Hourly frequency
    const hourlyData = new Array(24).fill(0);
    this.cryLog.forEach(entry => {
      const hour = new Date(entry.timestamp).getHours();
      hourlyData[hour]++;
    });

    // Top categories
    const categoryCount = {};
    this.getCategories().forEach(cat => categoryCount[cat] = 0);
    this.cryLog.forEach(entry => {
      categoryCount[entry.category]++;
    });
    const topCategories = Object.entries(categoryCount)
      .sort((a, b) => b[1] - a[1])
      .filter(([_, count]) => count > 0);

    // Average duration
    const avgDuration = this.cryLog.length > 0
      ? Math.round(this.cryLog.reduce((sum, e) => sum + e.duration, 0) / this.cryLog.length)
      : 0;

    return {
      hourly: hourlyData,
      topCategories,
      avgDuration,
      totalCries: this.cryLog.length
    };
  }

  generateTips() {
    const analysis = this.analyzePatterns();
    const tips = [];

    if (analysis.totalCries === 0) {
      return ["Start logging cry episodes to see personalized tips"];
    }

    // Peak hour analysis
    let peakHour = -1;
    let peakCount = 0;
    analysis.hourly.forEach((count, hour) => {
      if (count > peakCount) {
        peakCount = count;
        peakHour = hour;
      }
    });

    if (peakHour >= 17 && peakHour <= 20) {
      tips.push("🌆 Most cries happen in evening (5-8 PM) - this may be the 'witching hour'. Consider extra soothing time.");
    } else if (peakHour >= 21 || peakHour < 6) {
      tips.push("🌙 Peak crying times are at night. Review sleep patterns and feeding schedule.");
    }

    // Category analysis
    if (analysis.topCategories.length > 0) {
      const topCategory = analysis.topCategories[0][0];
      if (topCategory === "hungry") {
        tips.push("🍼 Hunger is the most common cry. Consider more frequent feeding sessions.");
      } else if (topCategory === "tired") {
        tips.push("😴 Fatigue causes most cries. Review sleep duration and nap times.");
      } else if (topCategory === "pain") {
        tips.push("⚠️ Pain-related cries detected. Monitor for signs of discomfort or illness.");
      }
    }

    // Duration analysis
    if (analysis.avgDuration > 15) {
      tips.push("⏱️ Average cry duration is long. Try different soothing techniques.");
    }

    if (tips.length === 0) {
      tips.push("✓ Varied cry patterns detected. Continue regular monitoring.");
    }

    return tips;
  }

  renderHourlyChart() {
    const analysis = this.analyzePatterns();
    const max = Math.max(...analysis.hourly, 1);

    const hours = Array.from({ length: 24 }, (_, i) => i);
    const chartBars = hours.map((hour, idx) => {
      const count = analysis.hourly[idx];
      const height = Math.max(count / max * 100, 2);
      const label = hour.toString().padStart(2, "0") + ":00";
      return `
        <div class="chart-bar-container">
          <div class="chart-bar" style="height: ${height}%"></div>
          <span class="chart-label">${label}</span>
        </div>
      `;
    }).join("");

    return `<div class="hourly-chart">${chartBars}</div>`;
  }

  renderPieChart() {
    const analysis = this.analyzePatterns();
    if (analysis.topCategories.length === 0) return "<p>No data yet</p>";

    const total = analysis.topCategories.reduce((sum, [_, count]) => sum + count, 0);
    const colors = {
      hungry: "#FFB6C1",
      tired: "#B0E0E6",
      pain: "#FFB6B6",
      discomfort: "#F0E68C",
      bored: "#DDA0DD",
      unknown: "#D3D3D3"
    };

    let slices = "";
    let currentAngle = 0;
    analysis.topCategories.forEach(([category, count]) => {
      const percentage = count / total;
      const angle = percentage * 360;
      const color = colors[category] || "#ccc";
      slices += `<div class="pie-slice" style="--angle: ${currentAngle}deg; --slice-angle: ${angle}deg; background: ${color};" title="${category}: ${count}"></div>`;
      currentAngle += angle;
    });

    const legend = analysis.topCategories.map(([cat, count]) =>
      `<div class="legend-item"><span class="legend-color" style="background: ${colors[cat]}"></span>${cat}: ${count}</div>`
    ).join("");

    return `<div class="pie-container"><div class="pie">${slices}</div></div><div class="pie-legend">${legend}</div>`;
  }

  renderLogTab() {
    const entries = [...this.cryLog].reverse();

    return `
      <div class="tab-content">
        <div class="log-header">
          <h3>Cry Episodes (${this.cryLog.length})</h3>
          <button class="btn btn-primary" @click="${() => { this.showAddForm = !this.showAddForm; this.render(); }}">
            ${this.showAddForm ? "Cancel" : "+ Log Cry"}
          </button>
        </div>

        ${this.showAddForm ? `
          <div class="form-card">
            <h4>Log a Cry Episode</h4>
            <div class="form-group">
              <label>Category</label>
              <select class="form-select" @change="${(e) => { this.formData.category = e.target.value; }}">
                ${this.getCategories().map(cat =>
                  `<option value="${cat}" ${this.formData.category === cat ? "selected" : ""}>${cat}</option>`
                ).join("")}
              </select>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Intensity (1-5)</label>
                <input type="range" min="1" max="5" class="form-range"
                  value="${this.formData.intensity}"
                  @change="${(e) => { this.formData.intensity = e.target.value; this.render(); }}">
                <span class="intensity-display">${this.formData.intensity}</span>
              </div>
              <div class="form-group">
                <label>Duration (min)</label>
                <input type="number" min="1" max="60" class="form-input"
                  value="${this.formData.duration}"
                  @change="${(e) => { this.formData.duration = e.target.value; }}">
              </div>
            </div>
            <div class="form-group">
              <label>Notes</label>
              <textarea class="form-textarea" placeholder="Any observations..."
                @change="${(e) => { this.formData.notes = e.target.value; }}"></textarea>
            </div>
            <button class="btn btn-success" @click="${() => this.addCryLog()}">Save Entry</button>
          </div>
        ` : ""}

        <div class="log-list">
          ${entries.length === 0 ? `<p class="empty-state">No cry logs yet. Start tracking to build a pattern analysis.</p>` : entries.map(entry => `
            <div class="log-entry">
              <div class="entry-header">
                <span class="entry-time">${new Date(entry.timestamp).toLocaleTimeString()}</span>
                <span class="entry-category" data-category="${entry.category}">${entry.category}</span>
              </div>
              <div class="entry-details">
                <span>Intensity: ${"★".repeat(entry.intensity)}${"☆".repeat(5 - entry.intensity)}</span>
                <span>Duration: ${entry.duration} min</span>
              </div>
              ${entry.notes ? `<p class="entry-notes">${entry.notes}</p>` : ""}
              <button class="btn btn-small btn-danger" @click="${() => this.deleteCryLog(entry.id)}">Delete</button>
            </div>
          `).join("")}
        </div>
      </div>
    `;
  }

  renderAnalysisTab() {
    const analysis = this.analyzePatterns();
    return `
      <div class="tab-content">
        <h3>Pattern Analysis</h3>

        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-value">${analysis.totalCries}</div>
            <div class="stat-label">Total Cries</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${analysis.avgDuration}</div>
            <div class="stat-label">Avg Duration (min)</div>
          </div>
        </div>

        <div class="chart-section">
          <h4>Cries by Hour of Day</h4>
          ${this.renderHourlyChart()}
        </div>

        <div class="chart-section">
          <h4>Cry Categories</h4>
          ${this.renderPieChart()}
        </div>
      </div>
    `;
  }

  renderInsightsTab() {
    const tips = this.generateTips();
    return `
      <div class="tab-content">
        <h3>Insights & Tips</h3>
        <div class="tips-container">
          ${tips.map(tip => `<div class="tip-card">${tip}</div>`).join("")}
        </div>
      </div>
    `;
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          --primary-color: #FFB6C1;
          --secondary-color: #87CEEB;
          --bg-color: var(--ha-card-background, #fff);
          --text-color: var(--ha-primary-text-color, #212121);
          --border-color: var(--ha-border-color, #e0e0e0);
        }

        .card {
          background: var(--bg-color);
          color: var(--text-color);
          border-radius: 12px;
          padding: 16px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        .card-title {
          font-size: 20px;
          font-weight: 600;
          margin-bottom: 16px;
          color: var(--text-color);
        }

        .tabs {
          display: flex;
          gap: 8px;
          margin-bottom: 16px;
          border-bottom: 2px solid var(--border-color);
        }

        .tab-button {
          padding: 12px 16px;
          background: none;
          border: none;
          cursor: pointer;
          color: var(--text-color);
          font-weight: 500;
          border-bottom: 3px solid transparent;
          transition: all 0.3s;
        }

        .tab-button.active {
          color: var(--primary-color);
          border-bottom-color: var(--primary-color);
        }

        .tab-button:hover {
          opacity: 0.8;
        }

        .tab-content {
          animation: fadeIn 0.3s;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .log-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }

        .form-card {
          background: rgba(255, 182, 193, 0.1);
          padding: 16px;
          border-radius: 8px;
          margin-bottom: 16px;
          border: 1px solid var(--border-color);
        }

        .form-group {
          margin-bottom: 12px;
        }

        .form-group label {
          display: block;
          font-weight: 500;
          margin-bottom: 6px;
          font-size: 14px;
        }

        .form-select, .form-input, .form-range, .form-textarea {
          width: 100%;
          padding: 8px;
          border: 1px solid var(--border-color);
          border-radius: 6px;
          background: var(--bg-color);
          color: var(--text-color);
          font-family: inherit;
        }

        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }

        .intensity-display {
          display: inline-block;
          margin-left: 8px;
          font-weight: 600;
          color: var(--primary-color);
        }

        .form-textarea {
          resize: vertical;
          min-height: 80px;
        }

        .btn {
          padding: 10px 16px;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 500;
          transition: all 0.2s;
        }

        .btn-primary {
          background: var(--primary-color);
          color: white;
        }

        .btn-primary:hover {
          opacity: 0.9;
          box-shadow: 0 2px 8px rgba(255, 182, 193, 0.3);
        }

        .btn-success {
          background: #90EE90;
          color: white;
        }

        .btn-danger {
          background: #FFB6B6;
          color: white;
        }

        .btn-small {
          padding: 6px 12px;
          font-size: 12px;
        }

        .log-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .log-entry {
          background: rgba(255, 182, 193, 0.05);
          padding: 12px;
          border-radius: 8px;
          border-left: 4px solid var(--primary-color);
        }

        .entry-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }

        .entry-time {
          font-size: 12px;
          color: var(--secondary-color);
          font-weight: 600;
        }

        .entry-category {
          padding: 4px 8px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 600;
          background: var(--primary-color);
          color: white;
        }

        .entry-category[data-category="tired"] {
          background: var(--secondary-color);
        }

        .entry-category[data-category="pain"] {
          background: #FFB6B6;
        }

        .entry-category[data-category="discomfort"] {
          background: #F0E68C;
        }

        .entry-category[data-category="bored"] {
          background: #DDA0DD;
        }

        .entry-details {
          display: flex;
          gap: 16px;
          font-size: 13px;
          margin-bottom: 8px;
        }

        .entry-notes {
          font-size: 13px;
          font-style: italic;
          margin: 8px 0;
          padding: 8px;
          background: rgba(0, 0, 0, 0.03);
          border-radius: 4px;
        }

        .empty-state {
          text-align: center;
          color: var(--border-color);
          padding: 32px 16px;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-bottom: 24px;
        }

        .stat-card {
          background: linear-gradient(135deg, rgba(255, 182, 193, 0.2), rgba(135, 206, 235, 0.2));
          padding: 16px;
          border-radius: 8px;
          text-align: center;
          border: 1px solid var(--border-color);
        }

        .stat-value {
          font-size: 28px;
          font-weight: 700;
          color: var(--primary-color);
        }

        .stat-label {
          font-size: 12px;
          margin-top: 4px;
          color: var(--text-color);
          opacity: 0.7;
        }

        .chart-section {
          margin-bottom: 24px;
        }

        .chart-section h4 {
          margin-bottom: 12px;
        }

        .hourly-chart {
          display: flex;
          align-items: flex-end;
          gap: 2px;
          height: 120px;
          padding: 12px;
          background: rgba(255, 182, 193, 0.05);
          border-radius: 8px;
          overflow-x: auto;
        }

        .chart-bar-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          flex: 1;
          min-width: 30px;
        }

        .chart-bar {
          width: 100%;
          background: linear-gradient(180deg, var(--primary-color), rgba(255, 182, 193, 0.5));
          border-radius: 4px 4px 0 0;
          transition: all 0.2s;
          min-height: 4px;
        }

        .chart-bar:hover {
          opacity: 0.8;
        }

        .chart-label {
          font-size: 10px;
          margin-top: 4px;
          transform: rotate(45deg);
          transform-origin: left;
          width: 100%;
          text-align: center;
        }

        .pie-container {
          display: flex;
          justify-content: center;
          margin-bottom: 16px;
        }

        .pie {
          width: 120px;
          height: 120px;
          border-radius: 50%;
          position: relative;
          background: conic-gradient(#FFB6C1 0deg 90deg, #87CEEB 90deg 180deg, #FFB6B6 180deg 270deg, #DDA0DD 270deg 360deg);
        }

        .pie-legend {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .legend-item {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
        }

        .legend-color {
          width: 16px;
          height: 16px;
          border-radius: 4px;
        }

        .tips-container {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .tip-card {
          background: linear-gradient(135deg, rgba(255, 182, 193, 0.15), rgba(135, 206, 235, 0.15));
          padding: 16px;
          border-radius: 8px;
          border-left: 4px solid var(--secondary-color);
          line-height: 1.6;
        }

        @media (max-width: 600px) {
          .form-row {
            grid-template-columns: 1fr;
          }

          .stats-grid {
            grid-template-columns: 1fr;
          }

          .log-header {
            flex-direction: column;
            gap: 12px;
          }

          .btn {
            width: 100%;
          }
        }
      </style>

      <div class="card">
        <div class="card-title">${this.title}</div>

        <div class="tabs">
          <button class="tab-button ${this.currentTab === "log" ? "active" : ""}"
            @click="${() => { this.currentTab = "log"; this.render(); }}">Log</button>
          <button class="tab-button ${this.currentTab === "analysis" ? "active" : ""}"
            @click="${() => { this.currentTab = "analysis"; this.render(); }}">Analysis</button>
          <button class="tab-button ${this.currentTab === "insights" ? "active" : ""}"
            @click="${() => { this.currentTab = "insights"; this.render(); }}">Insights</button>
        </div>

        ${this.currentTab === "log" ? this.renderLogTab() : ""}
        ${this.currentTab === "analysis" ? this.renderAnalysisTab() : ""}
        ${this.currentTab === "insights" ? this.renderInsightsTab() : ""}

        <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid var(--border-color); text-align: center;">
          <button class="btn btn-primary" @click="${() => this.exportToJSON()}">Export to JSON</button>
        </div>
      </div>
    `;

    this.attachEventListeners();
  }

  attachEventListeners() {
    const buttons = this.shadowRoot.querySelectorAll("button[\\@click]");
    buttons.forEach(button => {
      const clickHandler = button.getAttribute("@click");
      if (clickHandler) {
        button.removeAttribute("@click");
        const match = clickHandler.match(/\(\)\s*=>\s*{\s*(.*?)\s*}/);
        if (match) {
          const code = match[1];
          button.addEventListener("click", () => {
            eval(code);
          });
        }
      }
    });

    // Handle form inputs
    const selects = this.shadowRoot.querySelectorAll("select");
    selects.forEach(select => {
      const changeHandler = select.getAttribute("@change");
      if (changeHandler) {
        select.removeAttribute("@change");
        select.addEventListener("change", (e) => {
          this.formData.category = e.target.value;
        });
      }
    });

    const ranges = this.shadowRoot.querySelectorAll("input[type='range']");
    ranges.forEach(range => {
      const changeHandler = range.getAttribute("@change");
      if (changeHandler) {
        range.removeAttribute("@change");
        range.addEventListener("change", (e) => {
          this.formData.intensity = e.target.value;
          this.render();
        });
      }
    });

    const numberInputs = this.shadowRoot.querySelectorAll("input[type='number']");
    numberInputs.forEach(input => {
      const changeHandler = input.getAttribute("@change");
      if (changeHandler) {
        input.removeAttribute("@change");
        input.addEventListener("change", (e) => {
          this.formData.duration = e.target.value;
        });
      }
    });

    const textareas = this.shadowRoot.querySelectorAll("textarea");
    textareas.forEach(textarea => {
      const changeHandler = textarea.getAttribute("@change");
      if (changeHandler) {
        textarea.removeAttribute("@change");
        textarea.addEventListener("change", (e) => {
          this.formData.notes = e.target.value;
        });
      }
    });
  }

  static getConfigElement() {
    return document.createElement("ha-cry-analyzer-editor");
  }

  static getStubConfig() {
    return {
      type: "custom:ha-cry-analyzer",
      title: "Baby Cry Analyzer",
      sound_sensor: "binary_sensor.nursery_sound"
    };
  }
}

customElements.define("ha-cry-analyzer", HaCryAnalyzer);
